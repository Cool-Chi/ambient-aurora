(function (AA) {
  const { $, qs, on, clamp } = AA.util;
  const { EASE_OUT } = AA.CONST;
  const { DICT } = AA;
  const { FONTS, THEMES, SLIDERS, UI_BINDINGS, BINDING_BY_ID, SETTINGS_SCHEMA, SCHEMA_BY_KEY, DEPENDENTS_BY_KEY } = AA.UI_CONFIG;

  const qsa = (el, sel) => el.querySelectorAll(sel);

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
  const LOWPOWER_KEY = keyOfType('button');

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
      if (el && el.type === 'range') ui.updateSliderFill(el);
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
        requestAnimationFrame(() => ui.updateSegmentHighlight(c, val, skipAnim));
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
        $('custom-color-input').value = UIManager.rgbToHex(...val);
        customEl.style.background = UIManager.rgbToHex(...val);
        customEl.classList.add('has-color');
      }
    }
  };

  class UIManager {
    static get DICT() {
      return DICT;
    }

    static get FONTS() {
      return FONTS;
    }

    static get THEMES() {
      return THEMES;
    }

    static get SLIDERS() {
      return SLIDERS;
    }

    static get UI_BINDINGS() {
      return UI_BINDINGS;
    }

    static BINDING_BY_ID = BINDING_BY_ID;

    static hexToRgb(h) {
      return [
        parseInt(h.slice(1, 3), 16) / 255,
        parseInt(h.slice(3, 5), 16) / 255,
        parseInt(h.slice(5, 7), 16) / 255
      ];
    }

    static rgbToHex(r, g, b) {
      return `#${[r, g, b].map(x => clamp(Math.round(x * 255), 0, 255).toString(16).padStart(2, '0')).join('')}`;
    }

    constructor(store) {
      this.store = store;
      this.panel = $('settings-panel');
      this.activeTab = 0;
      this.appContainer = $('app-container');
      this.hudToast = $('hud-toast');
      this.bgLayer = $('bg-layer');
      this.clockLayerObj = $('clock-layer');
      this.pixelShiftTimer = null;
      this.hudTimer = null;
      this.idleTimer = null;
      this.lastWake = 0;
      this.wakeLock = null;
      this.wakeLockPending = false;
      this.holdTimeout = null;
      this.exitCloseTimer = null;
      this.exitRecoverTimer = null;
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.tgStart = null;
      this.tgTarget = null;
      this.tgDragged = false;
      this.segTarget = null;
      this.segProp = null;
      this.segDragged = false;
      this.typoAnim = null;
      this.lAngle = Math.atan2(0.75, 0.65);
      this.lMag = Math.hypot(0.65, 0.75);
      this.clockEl = $('clock');
      this.clockWrapperEl = $('clock-wrapper');
      this.btnLowpower = $('btn-lowpower');
      this.ptrX = -0.65;
      this.ptrY = -0.75;
      this.ptrActiveUntil = 0;
      this.ptrW = 0;
      this.gyroX = 0;
      this.gyroY = 0;
      this.hasGyro = false;
      this.gyroAsked = false;
      this.gyroPending = false;
      this.glassPress = 0;
      this.glassRaf = null;
      this.lastGlassTick = 0;
      this.glassEls = null;
      this._kCache = {};
      this.tickGlassBound = this.tickGlass.bind(this);
      this.fpsRaf = null;
      this.fpsLast = 0;
      this.fpsBadge = null;
      this.fpsDot = null;
      this.fpsText = null;
      this.fpsTickBound = this.fpsTick.bind(this);

      this.store.subscribe(SETTINGS_SCHEMA.map(e => e.key), prop => {
        let skipAnim = false;
        if (prop === 'lang') {
          this.renderPanel();
          skipAnim = true;
        }
        this.syncUI(skipAnim, prop === 'lang' ? null : prop);
      });
    }

    init() {
      [
        [
          'btn-lowpower',
          24,
          '',
          `<rect x="2" y="7" width="16" height="10" rx="3" ry="3"/> <line x1="22" y1="11" x2="22" y2="13"/> <rect class="battery-level" x="4" y="9" width="12" height="6" rx="1" fill="currentColor" stroke="none"/>`
        ],
        [
          'btn-settings',
          20,
          '',
          `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`
        ],
        [
          'btn-fullscreen',
          20,
          'fs-icon',
          `<path class="fs-top-left" d="M8 3H5a2 2 0 0 0-2 2v3"/><path class="fs-top-right" d="M16 3h3a2 2 0 0 1 2 2v3"/><path class="fs-bottom-left" d="M8 21H5a2 2 0 0 1-2-2v-3"/><path class="fs-bottom-right" d="M16 21h3a2 2 0 0 0 2-2v-3"/>`
        ]
      ].forEach(([id, size, cls, paths]) => {
        $(id).innerHTML = UIManager.renderIcon(paths, cls, size);
      });

      this.glassEls = {
        bevelBlur: $('glass-bevel-blur'),
        crestBlur: $('glass-crest-blur'),
        mwOff: $('glass-mw-off'),
        meOff: $('glass-me-off'),
        mnOff: $('glass-mn-off'),
        msOff: $('glass-ms-off'),
        cwOff: $('glass-cw-off'),
        ceOff: $('glass-ce-off'),
        cnOff: $('glass-cn-off'),
        csOff: $('glass-cs-off'),
        causticX: $('glass-caustic-x'),
        causticY: $('glass-caustic-y'),
        crestX: $('glass-crest-x'),
        crestY: $('glass-crest-y'),
        whisperX: $('glass-whisper-x'),
        whisperY: $('glass-whisper-y'),
        prismCX: $('glass-prism-c-x'),
        prismCY: $('glass-prism-c-y'),
        prismWX: $('glass-prism-w-x'),
        prismWY: $('glass-prism-w-y'),
        prismCFlood: $('glass-prism-c-flood'),
        prismWFlood: $('glass-prism-w-flood'),
        bodyFlood: $('glass-body-flood'),
        bevelFlood: $('glass-bevel-flood'),
        causticFlood: $('glass-caustic-flood'),
        whisperFlood: $('glass-whisper-flood'),
        crestFlood: $('glass-crest-flood'),
        hollowBlur: $('hollow-blur'),
        hollowFlood: $('hollow-flood')
      };

      const host = this.appContainer || document.body;

      if (!$('fps-badge')) {
        const fb = document.createElement('div');
        fb.id = 'fps-badge';
        fb.className = 'fps-badge';
        fb.setAttribute('aria-hidden', 'true');
        fb.innerHTML = '<span class="fps-dot"></span><span class="fps-text">-- FPS</span>';
        host.appendChild(fb);
      }
      this.fpsBadge = $('fps-badge');
      this.fpsDot = qs(this.fpsBadge, '.fps-dot');
      this.fpsText = qs(this.fpsBadge, '.fps-text');

      if (!$('scale-badge')) {
        const sb = document.createElement('div');
        sb.id = 'scale-badge';
        sb.className = 'fps-badge scale-badge';
        sb.setAttribute('aria-hidden', 'true');
        sb.innerHTML = '<span class="fps-dot"></span><span class="fps-text">--</span>';
        host.appendChild(sb);
      }
      this.scaleBadge = $('scale-badge');
      this.scaleDot = qs(this.scaleBadge, '.fps-dot');
      this.scaleText = qs(this.scaleBadge, '.fps-text');
      this._scaleTxt = '';

      if (/flat/i.test(AA.VERSION || '') && !$('version-badge')) {
        const vb = document.createElement('div');
        vb.id = 'version-badge';
        vb.className = 'version-badge';
        vb.setAttribute('aria-hidden', 'true');
        vb.textContent = AA.VERSION;
        host.appendChild(vb);
      }

      this.renderPanel();
      this.syncUI(true);
      this.bindEvents();
      this.runPixelShift();
      this.wakeUp();
      this.requestWakeLock();
      window.dispatchEvent(new Event('resize'));
    }

    updateScaleText() {
      if (!this.scaleText) return;
      const { bgRenderScale } = this.store.getState();
      const fmt = s => {
        const n = Number(s) || 1;
        return (n === 1 ? '1.0' : String(n)) + 'x';
      };
      const text = bgRenderScale === 'auto' ? `AUTO · ${fmt(AA._activeScale || 1)}` : fmt(bgRenderScale);
      if (this._scaleTxt !== text) {
        this._scaleTxt = text;
        this.scaleText.textContent = text;
      }
      if (this.scaleDot) this.scaleDot.style.background = bgRenderScale === 'auto' ? '#0a84ff' : '';
    }

    syncFps(on) {
      const { showScale } = this.store.getState();
      const needLoop = !!on || !!showScale;

      if (needLoop) {
        if (this.fpsRaf === null) {
          if (this.fpsText) this.fpsText.textContent = '-- FPS';
          if (this.fpsDot) this.fpsDot.style.background = '';
          this._lastGlFrames = AA._glFrames || 0;
          this.fpsLast = performance.now();
          this.fpsRaf = requestAnimationFrame(this.fpsTickBound);
        }
      } else if (this.fpsRaf !== null) {
        cancelAnimationFrame(this.fpsRaf);
        this.fpsRaf = null;
      }

      if (this.fpsBadge) this.fpsBadge.classList.toggle('is-visible', !!on);
      if (this.scaleBadge) this.scaleBadge.classList.toggle('is-visible', !!showScale);
      if (showScale) this.updateScaleText();
    }

    fpsTick() {
      this.fpsRaf = requestAnimationFrame(this.fpsTickBound);
      const now = performance.now();
      const dt = now - this.fpsLast;
      if (dt < 500) return;

      const gf = AA._glFrames || 0;
      const { showFps, showScale } = this.store.getState();

      if (showFps && dt <= 2000) {
        const fps = Math.round((gf - (this._lastGlFrames || 0)) * 1000 / dt);
        this.fpsText.textContent = `${fps} FPS`;
        this.fpsDot.style.background = fps >= 50 ? '#30d158' : fps >= 30 ? '#ffd60a' : '#ff453a';
      }

      this._lastGlFrames = gf;
      this.fpsLast = now;
      if (showScale) this.updateScaleText();
    }

    renderPanel() {
      const state = this.store.getState();
      const { lang } = state;
      const d = UIManager.DICT[lang];
      const I = this.activeTab;

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
        return `<div class="slider-row" aria-label="${e.label[lang]}">${UIManager.renderIcon(e.svgMin, 'slider-icon min-icon')}<div class="range-container slider-wrap"><input type="range" id="${e.id}" min="${e.min}" max="${e.max}" step="${e.step}"><output class="slider-bubble" aria-hidden="true"></output></div>${UIManager.renderIcon(e.svgMax, 'slider-icon max-icon')}</div>`;
      };

      const theme = e => {
        return row(
          e.label[lang],
          `<div class="swatches-container">${UIManager.THEMES.map(t => `<button class="swatch-wrapper" data-rgb="${t.rgb}" aria-label="${t.label}"><div class="swatch-color" style="background: linear-gradient(135deg, ${t.grad});"></div></button>`).join('')}<div class="swatch-wrapper" id="custom-swatch-wrapper" aria-label="Custom Color"><div class="swatch-color custom-swatch-color" id="custom-swatch-color"></div><input type="color" id="custom-color-input" value="#ffffff"></div></div>`
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

      const renderBlock = list => {
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
      };

      const tabs = d.tabs.map((_, t) => {
        const blocks = [];
        SETTINGS_SCHEMA.filter(e => e.tab === t).forEach(e => {
          (blocks[e.block] = blocks[e.block] || []).push(e);
        });
        return blocks.filter(Boolean).map(renderBlock);
      });

      if (this._cp) this._cp.close();

      this.panel.innerHTML = `<div class="tab-header" role="tablist">${d.tabs.map((t, i) => `<button class="tab-nav-btn${i === I ? ' active' : ''}" data-tab="${i}" role="tab">${t}</button>`).join('')}</div><div class="tab-panes">${tabs.map((blocks, i) => `<div class="tab-pane${i === I ? ' active' : ''}">${blocks.map(b => `<div class="settings-block">${b.join('')}</div>`).join('')}</div>`).join('')}</div>`;
    }

    setTab(i) {
      if (this._cp) this._cp.close();

      const tp = qs(this.panel, '.tab-panes');
      if (tp) tp.scrollTop = 0;

      this.activeTab = i;
      const state = this.store.getState();

      qsa(this.panel, '.tab-nav-btn').forEach((b, j) => {
        b.classList.toggle('active', j === i);
      });

      qsa(this.panel, '.tab-pane').forEach((p, j) => {
        p.classList.toggle('active', j === i);
        if (j === i) {
          qsa(p, '.segmented-control').forEach(c => {
            this.updateSegmentHighlight(c, state[c.dataset.prop], true);
          });
        }
      });
    }

    updateSliderFill(el) {
      const p = (el.value - (el.min || 0)) / ((el.max || 100) - (el.min || 0));
      el.style.setProperty('--val', `${p * 100}%`);

      const w = el.parentElement;
      if (w && w.classList.contains('slider-wrap')) {
        w.style.setProperty('--p', p);
        const b = qs(w, '.slider-bubble');
        if (b) {
          const hit = UIManager.BINDING_BY_ID[el.id];
          const ent = hit && SCHEMA_BY_KEY[hit[0]];
          const v = Number(el.value);
          b.textContent = ent && ent.formatVal ? ent.formatVal(v) : String(v);
        }
      }
    }

    showHUD(text) {
      this.hudToast.textContent = text;
      this.hudToast.classList.add('is-visible');
      clearTimeout(this.hudTimer);
      this.hudTimer = setTimeout(() => this.hudToast.classList.remove('is-visible'), 2000);
    }

    updateSegmentHighlight(container, val, skipAnim = false) {
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

    syncUI(skipAnim = false, changedKey = null) {
      const state = this.store.getState();
      const full = changedKey === null;
      const changed = full ? null : SCHEMA_BY_KEY[changedKey];
      const ap = changed && changed.apply;
      const entries = full ? SETTINGS_SCHEMA : (changed ? [changed] : []);
      const root = document.documentElement;
      const sp = (k, v) => root.style.setProperty(k, v);

      if (!full && !skipAnim && ap && ap.typoTarget) {
        const targetEl = ap.typoTarget === 'wrapper' ? this.clockWrapperEl : this.clockEl;
        if (this.typoAnim) {
          this.typoAnim.cancel();
          this.typoAnim = null;
        }
        if (targetEl) {
          const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          const ease = EASE_OUT;
          const outAnim = this.typoAnim = targetEl.animate(
            calm
              ? [{ opacity: 1 }, { opacity: 0 }]
              : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
            { duration: 120, easing: ease, fill: 'forwards' }
          );
          outAnim.onfinish = () => {
            if (this.typoAnim !== outAnim) return;
            this.applyVisualVars(false);
            window.dispatchEvent(new Event('resize'));
            const inAnim = this.typoAnim = targetEl.animate(
              calm
                ? [{ opacity: 0 }, { opacity: 1 }]
                : [{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'scale(1)' }],
              { duration: 240, easing: ease }
            );
            outAnim.cancel();
            inAnim.onfinish = inAnim.oncancel = () => {
              if (this.typoAnim === inAnim) this.typoAnim = null;
            };
          };
        } else {
          this.applyVisualVars(false);
        }
      } else if (full || skipAnim || (ap && (ap.visual || ap.typoTarget))) {
        this.applyVisualVars(full);
      }

      const ran = new Set();
      entries.forEach(e => {
        const val = state[e.key];
        const a = e.apply;
        if (a) {
          if (a.cssVar) sp(a.cssVar, a.cssFormat ? a.cssFormat(val) : val);
          if (a.hook && !ran.has(a.hook)) {
            ran.add(a.hook);
            a.hook(val, state, this);
          }
        }
        SYNC_BY_TYPE[e.type]?.(e, val, state, this, skipAnim);
      });

      const syncDependentRow = (e, st, isFull) => {
        const ctrl = e.type === 'segmented' ? qs(this.panel, `.segmented-control[data-prop="${e.key}"]`) : $(e.id);
        const rowEl = ctrl && ctrl.closest(e.type === 'slider' ? '.slider-row' : '.settings-row');
        if (!rowEl) return;
        const vis = Boolean(st[e.dependsOn]);
        const wasHidden = rowEl.classList.contains('is-hidden');
        rowEl.classList.toggle('is-hidden', !vis);
        rowEl.style.display = vis ? '' : 'none';
        if (vis && e.type === 'segmented' && (isFull || wasHidden)) {
          this.updateSegmentHighlight(ctrl, st[e.key], true);
        }
      };

      if (full) {
        SETTINGS_SCHEMA.forEach(e => {
          if (e.dependsOn) syncDependentRow(e, state, true);
        });
      } else if (DEPENDENTS_BY_KEY[changedKey]) {
        DEPENDENTS_BY_KEY[changedKey].forEach(e => syncDependentRow(e, state, false));
      }
    }

    static renderIcon(paths, cls = '', size = 0) {
      return `<svg${cls ? ` class="${cls}"` : ''}${size ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 24 24"${size ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : ''}>${paths}</svg>`;
    }

    bindEvents() {
      let lastHap = 0;
      let anchorHold = null;
      let holdFired = false;
      let anchorX = 0;
      let anchorY = 0;
      let slideEl = null;
      let slideTimer = null;
      let slideHeld = false;

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
        if (!this.store.getState().showSliderVal) return;
        if (slideEl && slideEl !== range) setSlide(slideEl, false);
        slideEl = range;
        if (held) slideHeld = true;
        setSlide(range, true);
        clearTimeout(slideTimer);
        if (!slideHeld) slideTimer = setTimeout(endSlide, 400);
      };

      const cp = this._cp = AA.createColorPicker(this);

      const clearAnchorHold = () => {
        if (anchorHold) {
          clearTimeout(anchorHold);
          anchorHold = null;
        }
      };

      const segValue = b => (isNaN(b.dataset.value) ? b.dataset.value : Number(b.dataset.value));

      const applySeg = (prop, b) => {
        if (prop === 'clockMaterial' && +b.dataset.value === 3) this.tryRequestGyro();
        haptic(10);
        this.store.setState(prop, segValue(b));
      };

      const resetSeg = () => {
        this.segTarget = null;
        this.segProp = null;
      };

      const scrubSeg = e => {
        if (e.pointerType === 'mouse' && e.buttons === 0) {
          resetSeg();
          return;
        }
        if (!this.segTarget.isConnected) {
          this.segTarget = this.panel && this.panel.querySelector(`.segmented-control[data-prop="${this.segProp}"]`);
          if (!this.segTarget) {
            resetSeg();
            return;
          }
        }
        const btns = this.segTarget.querySelectorAll('.segment-btn');
        if (!btns.length) return;
        const x = e.clientX;
        const last = btns[btns.length - 1];
        let hit = null;
        if (x < btns[0].getBoundingClientRect().left) {
          hit = btns[0];
        } else if (x > last.getBoundingClientRect().right) {
          hit = last;
        } else {
          for (const b of btns) {
            const r = b.getBoundingClientRect();
            if (x >= r.left && x <= r.right) {
              hit = b;
              break;
            }
          }
        }
        if (!hit || String(segValue(hit)) === String(this.store.getState()[this.segProp])) return;
        this.segDragged = true;
        applySeg(this.segProp, hit);
      };

      const trackGlassPtr = e => {
        this.ptrX = clamp((e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
        this.ptrY = clamp((e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
        this.ptrActiveUntil = performance.now() + 900;
      };

      on(document, 'pointerdown', e => {
        if (this.store.getState().clockMaterial === 3) {
          trackGlassPtr(e);
          this.tryRequestGyro();
        }
        if (e.target.type === 'range') {
          document.body.classList.add('is-dragging');
          showSlide(e.target, true);
        }
        const sg = e.target.closest('.segmented-control');
        if (sg && e.button === 0) {
          this.segTarget = sg;
          this.segProp = sg.dataset.prop;
          this.segDragged = false;
        }
        const tg = e.target.closest('.toggle-switch');
        if (tg) {
          this.tgStart = e.clientX;
          this.tgTarget = tg;
          this.tgDragged = false;
        }
        const btn = e.target.closest('.anchor-btn');
        if (btn) {
          clearAnchorHold();
          holdFired = false;
          anchorX = e.clientX;
          anchorY = e.clientY;
          anchorHold = setTimeout(() => {
            holdFired = true;
            anchorHold = null;
            haptic([30, 50]);
            (SCHEMA_BY_KEY[ANCHOR_KEY].resets || []).forEach(k => {
              this.store.setState(k, SCHEMA_BY_KEY[k].default);
            });
            if (this.store.getState()[ANCHOR_KEY] !== +btn.dataset.value) {
              this.store.setState(ANCHOR_KEY, +btn.dataset.value);
            }
          }, 500);
        } else if (
          e.button === 0 &&
          !e.target.closest('button, .settings-panel, .swatch-wrapper, input, .anchor-grid, .tc-group')
        ) {
          this.touchStartX = e.clientX;
          this.touchStartY = e.clientY;
          this.exitApp(true);
        }
      }, { passive: true });

      on(document, 'pointermove', e => {
        if (anchorHold && (Math.abs(e.clientX - anchorX) > 12 || Math.abs(e.clientY - anchorY) > 12)) {
          clearAnchorHold();
        }
        const state = this.store.getState();
        if (
          state.isHolding &&
          this.touchStartX !== null &&
          Math.hypot(e.clientX - this.touchStartX, e.clientY - this.touchStartY) > 10
        ) {
          this.exitApp(false);
        }
        if (state.clockMaterial === 3) trackGlassPtr(e);
        if (this.segTarget) scrubSeg(e);
        if (this.tgTarget && this.tgStart !== null) {
          const dx = e.clientX - this.tgStart;
          if (Math.abs(dx) > 8) {
            this.tgDragged = true;
            const checkedState = dx > 0;
            if (this.tgTarget.checked !== checkedState) {
              this.tgTarget.checked = checkedState;
              this.tgTarget.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      }, { passive: true });

      const endPointer = () => {
        clearAnchorHold();
        this.exitApp(false);
        document.body.classList.remove('is-dragging');
        endSlide();
        resetSeg();
        this.tgStart = null;
        setTimeout(() => {
          this.tgTarget = null;
        }, 0);
      };

      ['pointerup', 'pointercancel'].forEach(t => on(document, t, endPointer, { passive: true }));

      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
        on(window, 'deviceorientation', e => this.handleGyro(e), { passive: true });
      }

      on(document, 'contextmenu', e => {
        if (e.target.closest('.anchor-grid, .icon-btn') || this.store.getState().isHolding) {
          e.preventDefault();
        }
      });

      on(document, 'input', e => {
        if (e.target.type === 'range') {
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
        const entry = UIManager.BINDING_BY_ID[e.target.id];
        if (entry && e.target.type !== 'checkbox') {
          this.store.setState(entry[0], e.target.type === 'text' ? e.target.value : parseFloat(e.target.value));
        } else if (e.target.classList.contains('tc-input')) {
          this.store.setState(e.target.dataset.prop, e.target.value);
        } else if (e.target.id === 'custom-color-input') {
          this.store.setState(THEME_KEY, UIManager.hexToRgb(e.target.value));
        }
      });

      on(document, 'change', e => {
        if (e.target.classList.contains('tc-input')) haptic(10);
        if (e.target.type === 'checkbox') {
          haptic(10);
          const entry = UIManager.BINDING_BY_ID[e.target.id];
          if (entry) this.store.setState(entry[0], e.target.checked);
        }
      });

      on(document, 'click', e => {
        if (
          (e.target.closest('.toggle-switch') && this.tgDragged) ||
          (this.segDragged && e.target.closest('.segmented-control'))
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, { capture: true });

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

      on(document, 'keydown', e => {
        if (e.key === 'Escape' && cp.isOpen()) cp.close();
      });

      this.store.subscribe('isPanelOpen', (_, val) => {
        if (!val) {
          cp.close();
          resetSeg();
          endSlide();
        }
      });

      on(window, 'resize', () => cp.reposition());

      on(document, 'click', e => {
        const state = this.store.getState();
        const segBtn = e.target.closest('.segment-btn');
        const swatch = e.target.closest('.swatch-wrapper[data-rgb]');
        const tabBtn = e.target.closest('.tab-nav-btn');
        const anchorBtn = e.target.closest('.anchor-btn');
        const mtgBtn = e.target.closest('.mtg-btn');

        if (e.target.closest('.icon-btn')) haptic(15);

        if (tabBtn) {
          const i = +tabBtn.dataset.tab;
          if (i !== this.activeTab) {
            haptic(10);
            this.setTab(i);
          }
        } else if (mtgBtn) {
          haptic(10);
          const p = mtgBtn.dataset.prop;
          this.store.setState(p, !this.store.getState()[p]);
        } else if (anchorBtn) {
          if (!holdFired && !anchorBtn.classList.contains('active')) {
            haptic(10);
            this.store.setState(ANCHOR_KEY, +anchorBtn.dataset.value);
          }
          holdFired = false;
        } else if (segBtn && !segBtn.classList.contains('active')) {
          applySeg(segBtn.closest('.segmented-control').dataset.prop, segBtn);
        } else if (swatch) {
          haptic(10);
          this.store.setState(THEME_KEY, swatch.dataset.rgb.split(',').map(Number));
        } else if (e.target.closest('#btn-lowpower')) {
          const newState = !state[LOWPOWER_KEY];
          this.store.setState(LOWPOWER_KEY, newState);
          this.showHUD(newState ? UIManager.DICT[state.lang].lpOn : UIManager.DICT[state.lang].lpOff);
        } else if (e.target.closest('#btn-settings')) {
          this.panel.classList.toggle('active');
          this.store.setState('isPanelOpen', this.panel.classList.contains('active'));
        } else if (e.target.closest('#btn-fullscreen')) {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        } else if (
          !e.target.closest('.settings-panel') &&
          !e.target.closest('#custom-color-input') &&
          this.panel.classList.contains('active')
        ) {
          this.panel.classList.remove('active');
          this.store.setState('isPanelOpen', false);
        }

        this.wakeUp();
        this.requestWakeLock();
      });

      on(window, 'resize', () => {
        document.body.classList.toggle(
          'is-fullscreen',
          (window.innerHeight >= window.screen.height - 1) || !!document.fullscreenElement
        );
        this.wakeUp();
      });

      on(document, 'fullscreenchange', () => window.dispatchEvent(new Event('resize')));

      ['mousemove', 'pointermove', 'touchstart', 'keydown'].forEach(evt => {
        on(window, evt, () => this.wakeUp(), { passive: true });
      });

      on(document, 'keydown', e => {
        if (e.target.tagName !== 'INPUT' && (e.code === 'Space' || e.key === ' ')) {
          e.preventDefault();
          if (!e.repeat) {
            this.touchStartX = null;
            this.exitApp(true);
          }
        }
      });

      on(document, 'keyup', e => {
        if (e.code === 'Space' || e.key === ' ') this.exitApp(false);
      });

      on(window, 'blur', () => {
        this.exitApp(false);
        endSlide();
      });
    }
  }

  Object.assign(UIManager.prototype, AA.UI_FX);
  AA.UIManager = UIManager;
})(window.AA);
