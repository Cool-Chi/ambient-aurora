/*
 * gesture-manager.js - pointer gesture state machine & control event dispatch
 *
 * Responsibility
 *   Pointer gesture state machine; 10px touch intent lock ('drag' vs 'scroll'); capture-phase
 *   scroll/click/change anti-misfire guards; 1D / 2D (wrapped chip rows) segmented scrubbing; slider bubble hold
 *   timer; 500ms anchor hold-to-reset;
 *   color-picker trigger and outside-tap wiring; panel control and shell click dispatch.
 *
 * Returned API
 *   { bindEvents, trackGlassPtr }
 *
 * ui.* usage
 *   Reads:  ui.store, ui.panel, ui.activeTab, ui._cp (created in UIManager.init before bindEvents),
 *           ui.panelView.isScrollGuarded(now), ui._chrome.handleShellClick(e)
 *   Writes: ui.ptrX, ui.ptrY, ui.ptrActiveUntil, ui.touchStartX, ui.touchStartY
 *   Calls:  ui.tryRequestGyro(), ui.updateSliderFill(el), ui.exitApp(isStarting), ui.setTab(i),
 *           ui.wakeUp(), ui.requestWakeLock(), AA.UIManager.hexToRgb(hex)
 *
 * Private closure state
 *   tgStart, tgTarget, tgDragged, tgOrigChecked, tgFlipped, segTarget, segProp, segDragged,
 *   lastHap, anchorHold, holdFired, slideEl, slideTimer, slideHeld,
 *   pId, pType, startX, startY, intent, maxMove, startScrollTop, lastPanelScrollTime,
 *   suppressNextClick, gestureEnd, gestureInPanel, downTarget, rangeEl, rangeOrigVal, rangeCommitted
 *
 * Global dependencies
 *   AA.util (qs, on, clamp); AA.UI_CONFIG (BINDING_BY_ID, SETTINGS_SCHEMA, SCHEMA_BY_KEY);
 *   AA.UIManager.hexToRgb
 *
 * Co-change guide
 *   Touch gesture tuning        -> gesture-manager.js only
 *   Adding a new control type   -> controls-registry.js + gesture-manager.js + ui-config.js
 *                                  + css/ui-manager/settings-controls.css
 */
(function (AA) {
  const { qs, on, clamp } = AA.util;
  const { BINDING_BY_ID, SETTINGS_SCHEMA, SCHEMA_BY_KEY } = AA.UI_CONFIG;

  const haptic = p => {
    try {
      navigator.vibrate?.(p);
    } catch (e) {}
  };

  const keyOfType = type => {
    const e = SETTINGS_SCHEMA.find(s => s.type === type);
    return e ? e.key : null;
  };
  const ANCHOR_KEY = keyOfType('anchor');
  const THEME_KEY = keyOfType('theme');

  // 2D hit test for a wrapped segmented control: nearest row for y, then nearest chip in that row for x
  // (a pointer above / below / beside the grid clamps to the first / last row and the first / last chip)
  const pickWrappedBtn = (btns, x, y, cache) => {
    const rects = cache ? cache.rects : Array.from(btns, b => b.getBoundingClientRect());
    let rows = cache && cache.rows;
    if (!rows) {
      rows = [];
      rects.forEach((r, i) => {
        const row = rows.find(w => Math.abs(w.top - r.top) < 2);
        if (row) {
          row.items.push(i);
        } else {
          rows.push({ top: r.top, bottom: r.bottom, items: [i] });
        }
      });
    }
    let row = rows[0];
    let best = Infinity;
    for (const w of rows) {
      const d = y < w.top ? w.top - y : (y > w.bottom ? y - w.bottom : 0);
      if (d < best) {
        best = d;
        row = w;
      }
    }
    let hit = null;
    best = Infinity;
    for (const i of row.items) {
      const r = rects[i];
      const d = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
      if (d < best) {
        best = d;
        hit = btns[i];
      }
    }
    return hit;
  };

  const buildSegCache = target => {
    const btns = Array.from(target.querySelectorAll('.segment-btn'));
    const rects = btns.map(b => b.getBoundingClientRect());
    const wrapped = target.classList.contains('is-wrapped');
    let rows = null;
    if (wrapped) {
      rows = [];
      rects.forEach((r, i) => {
        const row = rows.find(w => Math.abs(w.top - r.top) < 2);
        if (row) {
          row.items.push(i);
        } else {
          rows.push({ top: r.top, bottom: r.bottom, items: [i] });
        }
      });
    }
    return { target, btns, rects, wrapped, rows };
  };

  AA.createGestureManager = function createGestureManager(ui) {
    // Toggle & segmented drag state
    let tgStart = null;
    let tgTarget = null;
    let tgDragged = false;
    let tgOrigChecked = false;
    let tgFlipped = false;
    let segTarget = null;
    let segProp = null;
    let segDragged = false;
    let segCache = null;

    const trackGlassPtr = e => {
      ui.ptrX = clamp((e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
      ui.ptrY = clamp((e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
      ui.ptrActiveUntil = performance.now() + 900;
    };

    function bindEvents() {
      let lastHap = 0;
      let anchorHold = null;
      let holdFired = false;
      let slideEl = null;
      let slideTimer = null;
      let slideHeld = false;

      // Pointer gesture state (touch intent lock / click guard)
      let pId = null;
      let pType = '';
      let startX = 0;
      let startY = 0;
      let intent = null;
      let maxMove = 0;
      let startScrollTop = 0;
      let lastPanelScrollTime = 0;
      let suppressNextClick = false;
      let gestureEnd = 0;
      let gestureInPanel = false;
      let downTarget = null;
      let rangeEl = null;
      let rangeOrigVal = null;
      let rangeCommitted = false;

      const getPanes = () => qs(ui.panel, '.tab-panes');

      const setSlide = (range, active) => {
        const w = range && range.parentElement;
        if (w && w.classList.contains('slider-wrap')) w.classList.toggle('is-sliding', active);
      };

      const endSlide = () => {
        clearTimeout(slideTimer);
        slideHeld = false;
        if (slideEl) {
          setSlide(slideEl, false);
          slideEl = null;
        }
      };

      const showSlide = (range, held) => {
        if (!ui.store.getState().showSliderVal) return;
        if (slideEl && slideEl !== range) setSlide(slideEl, false);
        slideEl = range;
        if (held) slideHeld = true;
        setSlide(range, true);
        clearTimeout(slideTimer);
        if (!slideHeld) slideTimer = setTimeout(endSlide, 400);
      };

      const cp = ui._cp;

      const clearAnchorHold = () => {
        if (anchorHold) {
          clearTimeout(anchorHold);
          anchorHold = null;
        }
      };

      const segValue = b => (isNaN(b.dataset.value) ? b.dataset.value : Number(b.dataset.value));

      const applySeg = (prop, b) => {
        if (prop === 'clockMaterial' && +b.dataset.value === 3) ui.tryRequestGyro();
        haptic(10);
        ui.store.setState(prop, segValue(b));
      };

      const resetSeg = () => {
        segTarget = null;
        segProp = null;
        segCache = null;
      };

      const revertToggle = () => {
        const tg = tgTarget;
        if (!tg || !tgFlipped) return;
        tgFlipped = false;
        tg.checked = tgOrigChecked;
        const entry = BINDING_BY_ID[tg.id];
        if (entry) ui.store.setState(entry[0], tgOrigChecked);
      };

      const commitRange = () => {
        if (!rangeEl) return;
        const hit = BINDING_BY_ID[rangeEl.id];
        if (hit) ui.store.setState(hit[0], parseFloat(rangeEl.value));
        rangeCommitted = true;
      };

      const rollbackRange = () => {
        const el = rangeEl;
        if (!el || rangeOrigVal === null) return;
        const hit = BINDING_BY_ID[el.id];
        if (rangeCommitted && hit) ui.store.setState(hit[0], parseFloat(rangeOrigVal));
        if (el.value !== rangeOrigVal) {
          el.value = rangeOrigVal;
          ui.updateSliderFill(el);
        }
        rangeCommitted = false;
      };

      const cancelGestureForScroll = () => {
        if (pId === null || !gestureInPanel) return;
        intent = 'scroll';
        suppressNextClick = true;
        clearAnchorHold();
        resetSeg();
        revertToggle();
        tgStart = null;
        tgTarget = null;
        rollbackRange();
        endSlide();
        document.body.classList.remove('is-dragging');
      };

      const shouldBlockPanelTap = e => {
        if (!ui.panel.contains(e.target)) return false;
        if (e.type === 'click' && e.detail === 0) return false;
        if (e.type === 'change' && !e.isTrusted) return false;
        const now = performance.now();
        if (pType === 'touch' && now - lastPanelScrollTime < 100) return true;
        if (pId === null && now - gestureEnd > 600) return false;
        if (intent === 'drag') return false;
        if (intent === 'scroll' || suppressNextClick) return true;
        if (maxMove > 10) return true;
        const panes = getPanes();
        return !!(panes && Math.abs(panes.scrollTop - startScrollTop) > 4);
      };

      const scrubSeg = e => {
        if (e.pointerType === 'mouse' && e.buttons === 0) {
          resetSeg();
          return;
        }
        if (!segTarget.isConnected) {
          segTarget = ui.panel && ui.panel.querySelector(`.segmented-control[data-prop="${segProp}"]`);
          segCache = null;
          if (!segTarget) {
            resetSeg();
            return;
          }
        }
        if (!segCache || segCache.target !== segTarget) {
          segCache = buildSegCache(segTarget);
        }
        const { btns, rects, wrapped } = segCache;
        if (!btns.length) return;
        const x = e.clientX;
        let hit = null;
        if (wrapped) {
          hit = pickWrappedBtn(btns, x, e.clientY, segCache);
        } else {
          const lastIdx = btns.length - 1;
          if (x < rects[0].left) {
            hit = btns[0];
          } else if (x > rects[lastIdx].right) {
            hit = btns[lastIdx];
          } else {
            for (let i = 0; i <= lastIdx; i++) {
              const r = rects[i];
              if (x >= r.left && x <= r.right) {
                hit = btns[i];
                break;
              }
            }
          }
        }
        if (!hit || String(segValue(hit)) === String(ui.store.getState()[segProp])) return;
        segDragged = true;
        applySeg(segProp, hit);
      };

      // Panel scroll (capture: scroll events do not bubble) cancels any pending control gesture
      on(ui.panel, 'scroll', () => {
        const now = performance.now();
        if (ui.panelView.isScrollGuarded(now)) return;
        lastPanelScrollTime = now;
        cancelGestureForScroll();
      }, { capture: true, passive: true });

      on(document, 'pointerdown', e => {
        if (e.isPrimary) {
          pId = e.pointerId;
          pType = e.pointerType;
          startX = e.clientX;
          startY = e.clientY;
          intent = null;
          maxMove = 0;
          suppressNextClick = false;
          downTarget = e.target;
          gestureInPanel = ui.panel.contains(e.target);
          const panes = getPanes();
          startScrollTop = panes ? panes.scrollTop : 0;
          rangeEl = null;
          rangeOrigVal = null;
          rangeCommitted = false;
          if (gestureInPanel && pType === 'touch' && e.target.type === 'range') {
            rangeEl = e.target;
            rangeOrigVal = e.target.value;
          }
        }
        if (ui.store.getState().clockMaterial === 3) {
          trackGlassPtr(e);
          ui.tryRequestGyro();
        }
        if (e.target.type === 'range' && e.pointerType !== 'touch') {
          document.body.classList.add('is-dragging');
          showSlide(e.target, true);
        }
        const sg = e.target.closest('.segmented-control');
        if (sg && e.button === 0) {
          segTarget = sg;
          segProp = sg.dataset.prop;
          segDragged = false;
        }
        const tg = e.target.closest('.toggle-switch');
        if (tg) {
          tgStart = e.clientX;
          tgTarget = tg;
          tgDragged = false;
          tgOrigChecked = tg.checked;
          tgFlipped = false;
        }
        const btn = e.target.closest('.anchor-btn');
        if (btn) {
          clearAnchorHold();
          holdFired = false;
          anchorHold = setTimeout(() => {
            holdFired = true;
            anchorHold = null;
            haptic([30, 50]);
            (SCHEMA_BY_KEY[ANCHOR_KEY].resets || []).forEach(k => {
              ui.store.setState(k, SCHEMA_BY_KEY[k].default);
            });
            if (ui.store.getState()[ANCHOR_KEY] !== +btn.dataset.value) {
              ui.store.setState(ANCHOR_KEY, +btn.dataset.value);
            }
          }, 500);
        } else if (
          e.button === 0 &&
          !e.target.closest('button, .settings-panel, .swatch-wrapper, input, .anchor-grid, .tc-group')
        ) {
          ui.touchStartX = e.clientX;
          ui.touchStartY = e.clientY;
          ui.exitApp(true);
        }
      }, { passive: true });

      on(document, 'pointermove', e => {
        const state = ui.store.getState();
        const own = e.pointerId === pId;
        const touchGesture = own && gestureInPanel && pType === 'touch';

        if (own) {
          const adx = Math.abs(e.clientX - startX);
          const ady = Math.abs(e.clientY - startY);
          const dist = Math.hypot(adx, ady);
          if (dist > maxMove) maxMove = dist;
          if (anchorHold && maxMove > 10) clearAnchorHold();

          if (touchGesture && intent === null && dist >= 10) {
            const dragEl = downTarget && downTarget.closest
              ? downTarget.closest('.toggle-switch, .segmented-control, input[type="range"]')
              : null;
            if (dragEl && adx > ady * 1.5 && adx >= 10) {
              intent = 'drag';
              if (rangeEl) {
                document.body.classList.add('is-dragging');
                commitRange();
                showSlide(rangeEl, true);
              }
            } else {
              intent = 'scroll';
              cancelGestureForScroll();
            }
          }
        }

        if (
          state.isHolding &&
          ui.touchStartX !== null &&
          Math.hypot(e.clientX - ui.touchStartX, e.clientY - ui.touchStartY) > 10
        ) {
          ui.exitApp(false);
        }
        if (state.clockMaterial === 3) trackGlassPtr(e);

        // Touch: no scrubbing / toggle dragging until horizontal intent is confirmed
        if (touchGesture && intent !== 'drag') return;

        if (segTarget) scrubSeg(e);
        if (tgTarget && tgStart !== null) {
          const dx = e.clientX - tgStart;
          if (Math.abs(dx) > 8) {
            tgDragged = true;
            const checkedState = dx > 0;
            if (tgTarget.checked !== checkedState) {
              tgTarget.checked = checkedState;
              tgTarget.dispatchEvent(new Event('change', { bubbles: true }));
              tgFlipped = !!tgTarget && tgTarget.checked !== tgOrigChecked;
            }
          }
        }
      }, { passive: true });

      const endGesture = () => {
        clearAnchorHold();
        ui.exitApp(false);
        document.body.classList.remove('is-dragging');
        endSlide();
        resetSeg();
        tgStart = null;
        gestureEnd = performance.now();
        pId = null;
        setTimeout(() => {
          tgTarget = null;
        }, 0);
      };

      on(document, 'pointerup', e => {
        if (rangeEl && e.pointerId === pId && pType === 'touch' && intent === null && maxMove <= 10) {
          // Plain tap on a touch slider: commit the value it landed on
          const hit = BINDING_BY_ID[rangeEl.id];
          if (hit) {
            const v = parseFloat(rangeEl.value);
            if (ui.store.getState()[hit[0]] !== v) ui.store.setState(hit[0], v);
          }
        }
        endGesture();
      }, { passive: true });

      on(document, 'pointercancel', e => {
        if (e.pointerId === pId) {
          revertToggle();
          rollbackRange();
          suppressNextClick = true;
          intent = 'scroll';
        }
        endGesture();
      }, { passive: true });

      on(document, 'contextmenu', e => {
        if (e.target.closest('.anchor-grid, .icon-btn') || ui.store.getState().isHolding) {
          e.preventDefault();
        }
      });

      on(document, 'input', e => {
        if (e.target.type === 'range') {
          // Touch slider: ignore until horizontal intent is confirmed (tap commit happens on pointerup)
          if (pId !== null && pType === 'touch' && gestureInPanel && intent !== 'drag') return;
          document.body.classList.add('is-dragging');
          showSlide(e.target, false);
          const t = e.target;
          const v = t.value;
          const isEdge = v === t.min || v === t.max;
          const now = Date.now();
          if (isEdge || now - lastHap > 40) {
            haptic(isEdge ? 20 : 5);
            lastHap = now;
          }
        }
        const entry = BINDING_BY_ID[e.target.id];
        if (entry && e.target.type !== 'checkbox') {
          ui.store.setState(entry[0], e.target.type === 'text' ? e.target.value : parseFloat(e.target.value));
        } else if (e.target.classList.contains('tc-input')) {
          ui.store.setState(e.target.dataset.prop, e.target.value);
        } else if (e.target.id === 'custom-color-input') {
          ui.store.setState(THEME_KEY, AA.UIManager.hexToRgb(e.target.value));
        }
      });

      // Capture-phase guards: registered before every other click/change listener
      on(document, 'click', e => {
        const dragged = (e.target.closest('.toggle-switch') && tgDragged) ||
          (segDragged && e.target.closest('.segmented-control'));
        if (dragged || shouldBlockPanelTap(e)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, { capture: true });

      on(document, 'change', e => {
        if (!shouldBlockPanelTap(e)) return;
        e.stopImmediatePropagation();
        if (e.target.type === 'checkbox') e.target.checked = !e.target.checked;
      }, { capture: true });

      on(document, 'change', e => {
        if (e.target.classList.contains('tc-input')) haptic(10);
        if (e.target.type === 'checkbox') {
          haptic(10);
          const entry = BINDING_BY_ID[e.target.id];
          if (entry) ui.store.setState(entry[0], e.target.checked);
        }
      });

      on(document, 'click', e => {
        const t = e.target;
        const isBg = t.id === 'custom-color-input';
        const isTc = !!(t.classList && t.classList.contains('tc-input'));
        if (!isBg && !isTc) return;
        e.preventDefault();
        cp.toggle(isBg ? THEME_KEY : t.dataset.prop, t, e.detail === 0);
      }, { capture: true });

      on(document, 'pointerdown', e => {
        if (!cp.isOpen()) return;
        const t = e.target;
        if (
          cp.el.contains(t) ||
          (t.classList && (t.classList.contains('tc-input') || t.id === 'custom-color-input'))
        ) {
          return;
        }
        cp.close();
      }, { passive: true });

      ui.store.subscribe('isPanelOpen', (_, val) => {
        if (!val) {
          cp.close();
          resetSeg();
          endSlide();
        }
      });

      on(window, 'resize', () => {
        segCache = null;
        cp.reposition();
      });

      on(document, 'click', e => {
        const segBtn = e.target.closest('.segment-btn');
        const swatch = e.target.closest('.swatch-wrapper[data-rgb]');
        const tabBtn = e.target.closest('.tab-nav-btn');
        const anchorBtn = e.target.closest('.anchor-btn');
        const mtgBtn = e.target.closest('.mtg-btn');

        if (e.target.closest('.icon-btn')) haptic(15);

        if (tabBtn) {
          const i = +tabBtn.dataset.tab;
          if (i !== ui.activeTab) {
            haptic(10);
            ui.setTab(i);
          }
        } else if (mtgBtn) {
          haptic(10);
          const p = mtgBtn.dataset.prop;
          ui.store.setState(p, !ui.store.getState()[p]);
        } else if (anchorBtn) {
          if (!holdFired && !anchorBtn.classList.contains('active')) {
            haptic(10);
            ui.store.setState(ANCHOR_KEY, +anchorBtn.dataset.value);
          }
          holdFired = false;
        } else if (segBtn && !segBtn.classList.contains('active')) {
          applySeg(segBtn.closest('.segmented-control').dataset.prop, segBtn);
        } else if (swatch) {
          haptic(10);
          ui.store.setState(THEME_KEY, swatch.dataset.rgb.split(',').map(Number));
        } else {
          ui._chrome.handleShellClick(e);
        }

        ui.wakeUp();
        ui.requestWakeLock();
      });

      on(window, 'blur', () => {
        ui.exitApp(false);
        endSlide();
      });
    }

    return { bindEvents, trackGlassPtr };
  };
})(window.AA);
