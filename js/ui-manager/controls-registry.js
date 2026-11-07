(function (AA) {
  const { $, qs } = AA.util;
  const { DICT } = AA;
  const { THEMES, UI_BINDINGS, BINDING_BY_ID, SCHEMA_BY_KEY } = AA.UI_CONFIG;

  const qsa = (el, sel) => el.querySelectorAll(sel);

  AA.createControlsRegistry = function createControlsRegistry(ui) {
    function updateSliderFill(el) {
      const p = (el.value - (el.min || 0)) / ((el.max || 100) - (el.min || 0));
      el.style.setProperty('--val', `${p * 100}%`);

      const w = el.parentElement;
      if (w && w.classList.contains('slider-wrap')) {
        w.style.setProperty('--p', p);
        const b = qs(w, '.slider-bubble');
        if (b) {
          const hit = BINDING_BY_ID[el.id];
          const ent = hit && SCHEMA_BY_KEY[hit[0]];
          const v = Number(el.value);
          b.textContent = ent && ent.formatVal ? ent.formatVal(v) : String(v);
        }
      }
    }

    function updateSegmentHighlight(container, val, skipAnim = false) {
      const btn = Array.from(qsa(container, '.segment-btn')).find(b => {
        return String(b.dataset.value) === String(val);
      });

      if (btn) {
        qsa(container, '.segment-btn').forEach(b => {
          const act = b === btn;
          b.classList.toggle('active', act);
          b.setAttribute('aria-checked', act ? 'true' : 'false');
        });

        const highlight = qs(container, '.segmented-highlight');
        if (skipAnim) highlight.style.transition = 'none';
        highlight.style.width = `${btn.offsetWidth}px`;
        highlight.style.transform = `translateX(${btn.offsetLeft}px)`;
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
        const style = e.style ? ` style="${e.style}"` : '';
        const btns = options.map((t, i) => {
          const act = !!e.prerender && String(e.values[i]) === String(state[e.key]);
          return `<button class="segment-btn${act ? ' active' : ''}" role="radio" aria-checked="${act}" data-value="${e.values[i]}">${t}</button>`;
        }).join('');
        return `<div class="settings-row${isCol ? ' col-layout' : ''}"><span class="row-label" title="${label}">${label}</span><div class="segmented-control${isCol ? '' : ' inline-seg'}" data-prop="${e.key}" role="radiogroup" aria-label="${label}"${style}><div class="segmented-highlight"></div>${btns}</div></div>`;
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
