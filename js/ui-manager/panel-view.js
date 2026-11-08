/*
 * panel-view.js — Settings Panel DOM Rendering, Tab Navigation & Dependent Row Animations
 *   Factory: AA.createPanelView(ui) -> mounted at ui.panelView
 *   Returned API: {
 *     renderPanel, setTab, updateBlockLastVisible, syncDependentRow,
 *     syncDependents, cancelRowAnims, setScrollGuard, isScrollGuarded
 *   }
 *   Reads / writes on ui:
 *     - Reads: ui.store, ui.panel, ui._cp (calls ui._cp.close() on renderPanel/setTab)
 *     - Reads & Writes: ui.activeTab (read in renderPanel, written in setTab, read by gesture-manager.js)
 *     - Calls: ui.controls.renderBlock(block, lang, state), ui.updateSegmentHighlight(ctrl, val, true)
 *   Private state: _rowAnims (Map<rowEl, Animation>), _scrollGuardUntil (timestamp guarding panel scroll)
 *   Globals: AA.util ($, qs), AA.CONST (EASE_OUT), AA.DICT, AA.UI_CONFIG (SETTINGS_SCHEMA, DEPENDENTS_BY_KEY)
 *   Co-change guide: Panel shell / tab layout / row expand animation -> panel-view.js
 *     + css/ui-manager/settings-panel.css
 */
(function (AA) {
  const { $, qs } = AA.util;
  const { EASE_OUT } = AA.CONST;
  const { DICT } = AA;
  const { SETTINGS_SCHEMA, DEPENDENTS_BY_KEY } = AA.UI_CONFIG;

  const qsa = (el, sel) => el.querySelectorAll(sel);

  AA.createPanelView = function createPanelView(ui) {
    const _rowAnims = new Map();
    let _scrollGuardUntil = 0;

    function setScrollGuard(ms) {
      _scrollGuardUntil = performance.now() + ms;
    }

    function isScrollGuarded(now = performance.now()) {
      return now < _scrollGuardUntil;
    }

    function cancelRowAnims() {
      if (_rowAnims.size) {
        _rowAnims.forEach(a => a.cancel());
        _rowAnims.clear();
      }
    }

    function renderPanel() {
      const state = ui.store.getState();
      const { lang } = state;
      const d = DICT[lang];
      const I = ui.activeTab;

      const tabs = d.tabs.map((_, t) => {
        const blocks = [];
        SETTINGS_SCHEMA.filter(e => e.tab === t).forEach(e => {
          (blocks[e.block] = blocks[e.block] || []).push(e);
        });
        return blocks.filter(Boolean).map(b => ui.controls.renderBlock(b, lang, state));
      });

      if (ui._cp) ui._cp.close();

      ui.panel.innerHTML = `<div class="tab-header" role="tablist">${d.tabs.map((t, i) => `<button class="tab-nav-btn${i === I ? ' active' : ''}" data-tab="${i}" role="tab">${t}</button>`).join('')}</div><div class="tab-panes">${tabs.map((blocks, i) => `<div class="tab-pane${i === I ? ' active' : ''}">${blocks.map(b => `<div class="settings-block">${b.join('')}</div>`).join('')}</div>`).join('')}</div>`;
    }

    function setTab(i) {
      if (ui._cp) ui._cp.close();

      const tp = qs(ui.panel, '.tab-panes');
      if (tp) tp.scrollTop = 0;

      ui.activeTab = i;
      const state = ui.store.getState();

      qsa(ui.panel, '.tab-nav-btn').forEach((b, j) => {
        b.classList.toggle('active', j === i);
      });

      qsa(ui.panel, '.tab-pane').forEach((p, j) => {
        p.classList.toggle('active', j === i);
        if (j === i) {
          qsa(p, '.segmented-control').forEach(c => {
            ui.updateSegmentHighlight(c, state[c.dataset.prop], true);
          });
        }
      });
    }

    function updateBlockLastVisible(blockEl) {
      const rows = Array.from(blockEl.children);
      rows.forEach(r => r.classList.remove('is-last-visible'));
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (!r.classList.contains('is-hidden') && !r.dataset.hiding) {
          r.classList.add('is-last-visible');
          break;
        }
      }
    }

    function syncDependentRow(e, st, isFull, skipAnim = false) {
      const ctrl = e.type === 'segmented' ? qs(ui.panel, `.segmented-control[data-prop="${e.key}"]`) : $(e.id);
      const rowEl = ctrl && ctrl.closest(e.type === 'slider' ? '.slider-row' : '.settings-row');
      if (!rowEl) return;
      const blockEl = rowEl.parentElement && rowEl.parentElement.classList.contains('settings-block') ? rowEl.parentElement : null;
      const refreshBlock = () => {
        if (blockEl) updateBlockLastVisible(blockEl);
      };
      const vis = Boolean(st[e.dependsOn]);
      const running = _rowAnims.get(rowEl);

      // Instant switch: cancels any running animation and settles the final state
      const settle = () => {
        if (running) {
          running.cancel();
          _rowAnims.delete(rowEl);
        }
        delete rowEl.dataset.hiding;
        rowEl.classList.remove('is-animating-row');
        rowEl.classList.toggle('is-hidden', !vis);
        rowEl.style.display = vis ? '' : 'none';
        refreshBlock();
        if (vis && e.type === 'segmented') ui.updateSegmentHighlight(ctrl, st[e.key], true);
      };

      if (isFull || skipAnim) {
        settle();
        return;
      }

      const curVis = !rowEl.classList.contains('is-hidden') && rowEl.dataset.hiding !== '1';
      if (vis === curVis) return;

      const panes = qs(ui.panel, '.tab-panes');
      const savedScroll = panes ? panes.scrollTop : 0;
      const restoreScroll = () => {
        if (!panes) return;
        setScrollGuard(150);
        panes.scrollTop = savedScroll;
      };

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setScrollGuard(150);
        settle();
        restoreScroll();
        return;
      }

      // Capture the in-flight state so the animation can reverse from where it is
      let startH = 0;
      let startOp = vis ? 0 : 1;
      let startPT = 0;
      let startPB = 0;
      if (running) {
        const cs0 = getComputedStyle(rowEl);
        startH = rowEl.getBoundingClientRect().height;
        const op = parseFloat(cs0.opacity);
        startOp = Number.isNaN(op) ? startOp : op;
        startPT = parseFloat(cs0.paddingTop) || 0;
        startPB = parseFloat(cs0.paddingBottom) || 0;
        running.cancel();
        _rowAnims.delete(rowEl);
      }

      setScrollGuard(400);
      const opts = { duration: 220, easing: EASE_OUT };
      let anim;

      if (vis) {
        delete rowEl.dataset.hiding;
        rowEl.classList.remove('is-hidden', 'is-animating-row');
        rowEl.style.display = '';
        refreshBlock();
        if (e.type === 'segmented') ui.updateSegmentHighlight(ctrl, st[e.key], true);
        const cs = getComputedStyle(rowEl);
        const natPT = parseFloat(cs.paddingTop) || 0;
        const natPB = parseFloat(cs.paddingBottom) || 0;
        const targetH = rowEl.getBoundingClientRect().height || rowEl.scrollHeight || 44;
        rowEl.classList.add('is-animating-row');
        anim = rowEl.animate([
          { height: `${startH}px`, paddingTop: `${startPT}px`, paddingBottom: `${startPB}px`, opacity: startOp },
          { height: `${targetH}px`, paddingTop: `${natPT}px`, paddingBottom: `${natPB}px`, opacity: 1 }
        ], opts);
        _rowAnims.set(rowEl, anim);
        anim.onfinish = () => {
          if (_rowAnims.get(rowEl) !== anim) return;
          _rowAnims.delete(rowEl);
          rowEl.classList.remove('is-animating-row');
          if (e.type === 'segmented') ui.updateSegmentHighlight(ctrl, ui.store.getState()[e.key], true);
          restoreScroll();
        };
      } else {
        rowEl.dataset.hiding = '1';
        if (!running) {
          const cs = getComputedStyle(rowEl);
          startH = rowEl.getBoundingClientRect().height;
          startOp = 1;
          startPT = parseFloat(cs.paddingTop) || 0;
          startPB = parseFloat(cs.paddingBottom) || 0;
        }
        refreshBlock();
        rowEl.classList.add('is-animating-row');
        anim = rowEl.animate([
          { height: `${startH}px`, paddingTop: `${startPT}px`, paddingBottom: `${startPB}px`, opacity: startOp },
          { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }
        ], opts);
        _rowAnims.set(rowEl, anim);
        anim.onfinish = () => {
          if (_rowAnims.get(rowEl) !== anim) return;
          _rowAnims.delete(rowEl);
          if (rowEl.dataset.hiding === '1') {
            delete rowEl.dataset.hiding;
            rowEl.classList.remove('is-animating-row');
            rowEl.classList.add('is-hidden');
            rowEl.style.display = 'none';
            refreshBlock();
          }
          restoreScroll();
        };
      }
      restoreScroll();
    }

    function syncDependents(state, full, changedKey, skipAnim = false) {
      if (full) {
        SETTINGS_SCHEMA.forEach(e => {
          if (e.dependsOn) syncDependentRow(e, state, true, skipAnim);
        });
        qsa(ui.panel, '.settings-block').forEach(updateBlockLastVisible);
      } else if (DEPENDENTS_BY_KEY[changedKey]) {
        DEPENDENTS_BY_KEY[changedKey].forEach(e => syncDependentRow(e, state, false, skipAnim));
      }
    }

    return {
      renderPanel,
      setTab,
      updateBlockLastVisible,
      syncDependentRow,
      syncDependents,
      cancelRowAnims,
      setScrollGuard,
      isScrollGuarded
    };
  };
})(window.AA);
