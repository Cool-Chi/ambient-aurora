/*
 * controls-registry.js — Control HTML Generators, SYNC_BY_TYPE Dispatch, Slider Fill & Segment Highlight
 *   Factory: AA.createControlsRegistry(ui) -> mounted at ui.controls
 *   Returned API: { renderBlock, syncEntry, updateSliderFill, updateSegmentHighlight, SYNC_BY_TYPE }
 *   Reads / calls on ui:
 *     - Reads: ui.store
 *     - Calls: AA.UIManager.renderIcon(...), AA.UIManager.rgbToHex(...)
 *   Private helpers: qsa, wrapRows, gcd, lcm, syncBoundValue, buildRenderers (row, tg, seg, mtg, chips, slider, theme, anchorRow, ctRow)
 *   Globals: AA.util ($, qs), AA.DICT, AA.UI_CONFIG (THEMES, UI_BINDINGS, BINDING_BY_ID, SCHEMA_BY_KEY)
 *   Co-change guide:
 *     - Tweaking existing control markup or sync -> controls-registry.js + css/ui-manager/settings-controls.css
 *     - Wrapped segmented grid (wrap: true, 6+ items) -> controls-registry.js + gesture-manager.js (pickWrappedBtn) + css/ui-manager/settings-controls.css (.is-wrapped)
 *     - Adding a new control type -> controls-registry.js + gesture-manager.js (input/click dispatch)
 *       + ui-config.js (BOUND_PROP / SETTINGS_SCHEMA) + css/ui-manager/settings-controls.css
 */
(function (AA) {
  const { $, qs } = AA.util;
  const { DICT } = AA;
  const { THEMES, UI_BINDINGS, BINDING_BY_ID, SCHEMA_BY_KEY } = AA.UI_CONFIG;

  const qsa = (el, sel) => el.querySelectorAll(sel);

  // Balanced chip rows for a wrapped segmented control (max 5 per row, earlier rows never shorter than later ones):
  // 6 -> [3,3], 7 -> [4,3], 8 -> [4,4], 9 -> [5,4], 10 -> [5,5], 11 -> [4,4,3]
  const wrapRows = n => {
    const rows = Math.ceil(n / 5);
    const base = Math.floor(n / rows);
    const rem = n % rows;
    return Array.from({ length: rows }, (_, r) => (r < rem ? base + 1 : base));
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => (a / gcd(a, b)) * b;

  AA.createControlsRegistry = function createControlsRegistry(ui) {
    function updateSliderFill(el) {
      const p = (el.value - (el.min || 0)) / ((el.max || 100) - (el.min || 0));
      el.style.setProperty('--val', `${p * 100}%`);

      const w = el.parentElement;
      if (w && w.classList.contains('slider-wrap')) {
        w.style.setProperty('--p', p);
        const b = qs(w, '.slider-bubble');
        if (b) {
          b.style.setProperty('--p', p);
          const hit = BINDING_BY_ID[el.id];
          const ent = hit && SCHEMA_BY_KEY[hit[0]];
          const v = Number(el.value);
          b.textContent = ent && ent.formatVal ? ent.formatVal(v) : String(v);
        }
      }
    }

    function updateSegmentHighlight(container, val, skipAnim = false) {
      const btns = Array.from(qsa(container, '.segment-btn'));
      const btn = btns.find(b => {
        return String(b.dataset.value) === String(val);
      });

      if (btn) {
        btns.forEach(b => {
          const act = b === btn;
          b.classList.toggle('active', act);
          b.setAttribute('aria-checked', act ? 'true' : 'false');
        });

        const highlight = qs(container, '.segmented-highlight');
        if (skipAnim) highlight.style.transition = 'none';
        highlight.style.width = `${btn.offsetWidth}px`;
        if (container.classList.contains('is-wrapped')) {
          // Multi-row chips: the pill follows the chip in both axes and matches its height
          highlight.style.height = `${btn.offsetHeight}px`;
          highlight.style.transform = `translate3d(${btn.offsetLeft}px, ${btn.offsetTop}px, 0)`;
        } else {
          highlight.style.transform = `translate3d(${btn.offsetLeft}px, 0, 0)`;
        }
        if (skipAnim) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            highlight.style.transition = '';
          }));
        }
      }
    }

    // Per-type control syncing: (entry, value, state, ui, skipAnim)
    const syncBoundValue = (e, val) => {
      const b = UI_BINDINGS[e.key];
      const el = b && $(b.id);
      if (el && String(el[b.prop]) !== String(val)) el[b.prop] = val;
      return el;
    };

    const SYNC_BY_TYPE = {
      slider: (e, val, state, ui) => {
        const el = syncBoundValue(e, val);
        if (el && el.type === 'range') updateSliderFill(el);
      },
      toggle: (e, val) => {
        syncBoundValue(e, val);
      },
      'custom-text': (e, val) => {
        syncBoundValue(e, val);
      },
      segmented: (e, val, state, ui, skipAnim) => {
        const c = qs(document, `.segmented-control[data-prop="${e.key}"]`);
        if (c && val !== undefined) {
          requestAnimationFrame(() => updateSegmentHighlight(c, val, skipAnim));
        }
      },
      'color-chip': (e, val) => {
        const inp = $(e.id);
        const dot = $(`swatch-${e.key}`);
        if (inp) inp.value = val;
        if (dot) dot.style.background = val;
      },
      'mtg-item': (e, val) => {
        const btn = qs(document, `.mtg-btn[data-prop="${e.key}"]`);
        if (!btn) return;
        const act = !!val;
        btn.classList.toggle('active', act);
        btn.setAttribute('aria-pressed', act ? 'true' : 'false');
      },
      theme: (e, val) => {
        qsa(document, '.swatches-container .swatch-wrapper').forEach(s => s.classList.remove('active'));
        const activeSwatch = qs(document, `.swatch-wrapper[data-rgb="${val.join(',')}"]`);
        const customEl = $('custom-swatch-color');
        if (activeSwatch) {
          activeSwatch.classList.add('active');
          customEl.style.background = '';
          customEl.classList.remove('has-color');
        } else {
          $('custom-swatch-wrapper').classList.add('active');
          $('custom-color-input').value = AA.UIManager.rgbToHex(...val);
          customEl.style.background = AA.UIManager.rgbToHex(...val);
          customEl.classList.add('has-color');
        }
      }
    };

    function syncEntry(e, val, state, skipAnim = false) {
      SYNC_BY_TYPE[e.type]?.(e, val, state, ui, skipAnim);
    }

    function buildRenderers(lang, state) {
      const d = DICT[lang];

      const row = (label, ctrl) => {
        return `<div class="settings-row"><span class="row-label" title="${label}">${label}</span>${ctrl}</div>`;
      };

      const tg = e => {
        return row(e.label[lang], `<input type="checkbox" id="${e.id}" class="toggle-switch">`);
      };

      const seg = e => {
        const label = e.label[lang];
        const options = e.options[lang];
        const isCol = options.length > 3;
        // Balanced multi-row chips: only when the schema entry opts in with wrap: true and has 6+ options.
        // Rows live on a column grid of lcm(row sizes) columns; every chip spans (grid columns / its row size),
        // so chips stay flat children of .segmented-control and equal-width within their row.
        const isWrap = !!e.wrap && options.length >= 6;
        let style = e.style ? ` style="${e.style}"` : '';
        let spans = null;
        if (isWrap) {
          const rows = wrapRows(options.length);
          const cols = rows.reduce((a, c) => lcm(a, c), 1);
          spans = rows.flatMap(c => Array(c).fill(cols / c));
          style = ` style="--seg-cols:${cols}${e.style ? ';' + e.style : ''}"`;
        }
        const btns = options.map((t, i) => {
          const act = !!e.prerender && String(e.values[i]) === String(state[e.key]);
          const span = isWrap ? ` style="--seg-span:${spans[i]}"` : '';
          return `<button class="segment-btn${act ? ' active' : ''}" role="radio" aria-checked="${act}" data-value="${e.values[i]}"${span}>${t}</button>`;
        }).join('');
        return `<div class="settings-row${isCol ? ' col-layout' : ''}"><span class="row-label" title="${label}">${label}</span><div class="segmented-control${isWrap ? ' is-wrapped' : (isCol ? '' : ' inline-seg')}" data-prop="${e.key}" role="radiogroup" aria-label="${label}"${style}><div class="segmented-highlight"></div>${btns}</div></div>`;
      };

      const mtg = grp => {
        return row(d[grp[0].group], `<div class="mtg-control">${grp.map(e => `<button class="mtg-btn" aria-pressed="false" data-prop="${e.key}">${e.label[lang]}</button>`).join('')}</div>`);
      };

      const chips = grp => {
        return row(
          d[grp[0].group],
          `<div class="tc-group">${grp.map(e => `<label class="tc-chip"><span class="tc-dot" id="swatch-${e.key}" style="background:${state[e.key]}"></span><span class="tc-lbl">${e.label[lang]}</span><input type="color" class="tc-input" id="${e.id}" data-prop="${e.key}" value="${state[e.key]}" aria-label="${d[e.group]} ${e.label[lang]}"></label>`).join('')}</div>`
        );
      };

      const slider = e => {
        return `<div class="slider-row" aria-label="${e.label[lang]}">${AA.UIManager.renderIcon(e.svgMin, 'slider-icon min-icon')}<div class="range-container slider-wrap"><input type="range" id="${e.id}" min="${e.min}" max="${e.max}" step="${e.step}"><output class="slider-bubble" aria-hidden="true"></output></div>${AA.UIManager.renderIcon(e.svgMax, 'slider-icon max-icon')}</div>`;
      };

      const theme = e => {
        return row(
          e.label[lang],
          `<div class="swatches-container">${THEMES.map(t => `<button class="swatch-wrapper" data-rgb="${t.rgb}" aria-label="${t.label}"><div class="swatch-color" style="background: linear-gradient(135deg, ${t.grad});"></div></button>`).join('')}<div class="swatch-wrapper" id="custom-swatch-wrapper" aria-label="Custom Color"><div class="swatch-color custom-swatch-color" id="custom-swatch-color"></div><input type="color" id="custom-color-input" value="#ffffff"></div></div>`
        );
      };

      const anchorRow = e => {
        const label = e.label[lang];
        return `<div class="settings-row anchor-row"><span class="row-label" title="${label}">${label}</span><div class="anchor-grid" data-prop="${e.key}" role="radiogroup" aria-label="${label}">${[...Array(9)].map((_, i) => `<button class="anchor-btn" data-value="${i}" role="radio" aria-checked="false" aria-label="${label} ${i + 1}"></button>`).join('')}</div></div>`;
      };

      const ctRow = e => {
        return `<div class="settings-row"><input type="text" id="${e.id}" class="ct-input" maxlength="${e.maxLength}" placeholder="${e.placeholder[lang]}" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="${e.label[lang]}"></div>`;
      };

      const RENDER = {
        toggle: tg,
        segmented: seg,
        slider,
        theme,
        anchor: anchorRow,
        'custom-text': ctRow
      };

      return { RENDER, mtg, chips };
    }

    function renderBlock(list, lang = ui.store.getState().lang, state = ui.store.getState()) {
      const { RENDER, mtg, chips } = buildRenderers(lang, state);
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.type === 'color-chip' || e.type === 'mtg-item') {
          const grp = [e];
          while (i + 1 < list.length && list[i + 1].type === e.type && list[i + 1].group === e.group) {
            grp.push(list[++i]);
          }
          out.push(e.type === 'color-chip' ? chips(grp) : mtg(grp));
        } else if (RENDER[e.type]) {
          out.push(RENDER[e.type](e));
        }
      }
      return out;
    }

    return { renderBlock, syncEntry, updateSliderFill, updateSegmentHighlight, SYNC_BY_TYPE };
  };
})(window.AA);
