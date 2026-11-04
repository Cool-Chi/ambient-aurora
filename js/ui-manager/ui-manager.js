(function (AA) {
  const { $, qs, on, clamp } = AA.util;
  const { EASE_OUT } = AA.CONST;
  const { Store, DICT } = AA;
  const { FONTS, THEMES, SLIDERS, UI_BINDINGS, BINDING_BY_ID } = AA.UI_CONFIG;

  const qsa = (el, sel) => el.querySelectorAll(sel);

  const haptic = p => {
    try {
      navigator.vibrate?.(p);
    } catch (e) {}
  };

  const fmtSliderVal = (id, raw) => {
    const v = Number(raw);
    switch (id) {
      case 'ctrl-size':
      case 'ctrl-weight':
        return String(Math.round(v));
      case 'ctrl-speed':
        return v.toFixed(2) + 'x';
      case 'ctrl-bg-brightness':
      case 'ctrl-opacity':
        return Math.round(v * 100) + '%';
      case 'ctrl-offx':
      case 'ctrl-offy':
        return (v > 0 ? '+' : '') + Math.round(v);
      case 'ctrl-hue-shift':
        return (v > 0 ? '+' : '') + Math.round(v) + '°';
      default:
        return String(v);
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

    constructor(store, glEngine) {
      this.store = store;
      this.glEngine = glEngine;
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
      this.fpsFrames = 0;
      this.fpsLast = 0;
      this.fpsBadge = null;
      this.fpsDot = null;
      this.fpsText = null;
      this.fpsTickBound = this.fpsTick.bind(this);

      this.store.subscribe((prop, val) => {
        if (Store.TRANSIENT_KEYS.has(prop)) return;
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
      const { renderScale } = this.store.getState();
      const fmt = s => {
        const n = Number(s) || 1;
        return (n === 1 ? '1.0' : String(n)) + 'x';
      };
      const activeScale = this.glEngine ? this.glEngine.activeScale : 1;
      const text = renderScale === 0 ? `AUTO · ${fmt(activeScale || 1)}` : fmt(renderScale);
      if (this._scaleTxt !== text) {
        this._scaleTxt = text;
        this.scaleText.textContent = text;
      }
      if (this.scaleDot) this.scaleDot.style.background = renderScale === 0 ? '#0a84ff' : '';
    }

    syncFps(on) {
      const { showScale } = this.store.getState();
      const needLoop = !!on || !!showScale;

      if (needLoop) {
        if (this.fpsRaf === null) {
          if (this.fpsText) this.fpsText.textContent = '-- FPS';
          if (this.fpsDot) this.fpsDot.style.background = '';
          this.fpsFrames = 0;
          this._lastGlFrames = this.glEngine ? this.glEngine.frameCount : 0;
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

      const gf = this.glEngine ? this.glEngine.frameCount : 0;
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
      const { lang } = this.store.getState();
      const d = UIManager.DICT[lang];
      const I = this.activeTab;

      const row = (label, ctrl) => {
        return `<div class="settings-row"><span class="row-label" title="${label}">${label}</span>${ctrl}</div>`;
      };

      const tg = (id, label) => {
        return row(label, `<input type="checkbox" id="${id}" class="toggle-switch">`);
      };

      const seg = (label, prop, options, offset = 0, values = null) => {
        const isCol = options.length > 3;
        return `<div class="settings-row${isCol ? ' col-layout' : ''}"><span class="row-label" title="${label}">${label}</span><div class="segmented-control${isCol ? '' : ' inline-seg'}" data-prop="${prop}" role="radiogroup" aria-label="${label}"><div class="segmented-highlight"></div>${options.map((t, i) => `<button class="segment-btn" role="radio" aria-checked="false" data-value="${values ? values[i] : i + offset}">${t}</button>`).join('')}</div></div>`;
      };

      const mtg = (label, opts) => {
        return `<div class="settings-row"><span class="row-label" title="${label}">${label}</span><div class="mtg-control">${opts.map(o => `<button class="mtg-btn" aria-pressed="false" data-prop="${o.p}">${o.l}</button>`).join('')}</div></div>`;
      };

      const slider = (key, id) => {
        const s = UIManager.SLIDERS.find(s => s.key === key && (!id || s.id === id));
        return `<div class="slider-row" aria-label="${d[key]}">${UIManager.renderIcon(s.svgMin, 'slider-icon min-icon')}<div class="range-container slider-wrap"><input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}"><output class="slider-bubble" aria-hidden="true"></output></div>${UIManager.renderIcon(s.svgMax, 'slider-icon max-icon')}</div>`;
      };

      const langRow = row(
        d.lang,
        `<div class="segmented-control inline-seg" data-prop="lang" role="radiogroup" aria-label="${d.lang}" style="max-width:120px"><div class="segmented-highlight"></div><button class="segment-btn ${lang === 'en' ? 'active' : ''}" role="radio" aria-checked="${lang === 'en'}" data-value="en">EN</button><button class="segment-btn ${lang === 'zh' ? 'active' : ''}" role="radio" aria-checked="${lang === 'zh'}" data-value="zh">中</button></div>`
      );

      const theme = row(
        d.theme,
        `<div class="swatches-container">${UIManager.THEMES.map(t => `<button class="swatch-wrapper" data-rgb="${t.rgb}" aria-label="${t.label}"><div class="swatch-color" style="background: linear-gradient(135deg, ${t.grad});"></div></button>`).join('')}<div class="swatch-wrapper" id="custom-swatch-wrapper" aria-label="Custom Color"><div class="swatch-color custom-swatch-color" id="custom-swatch-color"></div><input type="color" id="custom-color-input" value="#ffffff"></div></div>`
      );

      const tcKeys = ['textColor', 'ampmColor', 'dateColor', 'customTextColor'];
      const tcState = this.store.getState();
      const tcRow = row(
        d.tc,
        `<div class="tc-group">${tcKeys.map((k, idx) => `<label class="tc-chip"><span class="tc-dot" id="swatch-${k}" style="background:${tcState[k]}"></span><span class="tc-lbl">${d.tcItems[idx]}</span><input type="color" class="tc-input" id="ctrl-${k}" data-prop="${k}" value="${tcState[k]}" aria-label="${d.tc} ${d.tcItems[idx]}"></label>`).join('')}</div>`
      );

      const anchorRow = `<div class="settings-row anchor-row"><span class="row-label" title="${d.anchor}">${d.anchor}</span><div class="anchor-grid" data-prop="anchor" role="radiogroup" aria-label="${d.anchor}">${[...Array(9)].map((_, i) => `<button class="anchor-btn" data-value="${i}" role="radio" aria-checked="false" aria-label="${d.anchor} ${i + 1}"></button>`).join('')}</div></div>`;

      const ctRow = `<div class="settings-row"><input type="text" id="ctrl-customtext" class="ct-input" maxlength="30" placeholder="${d.ctph}" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="${d.sct}"></div>`;

      const tabs = [
        // Tab 0: Clock
        [
          [
            seg(d.font, 'fontStyle', ['SF Pro', 'New York', 'Mono']),
            tcRow,
            seg(d.mat, 'material', d.mats)
          ],
          [
            slider('size'),
            slider('weight'),
            slider('opacity')
          ],
          [
            tg('ctrl-24hr', d.time),
            tg('ctrl-leadingzero', d.lz),
            tg('ctrl-seconds', d.sec),
            seg(d.tick, 'clockAnimMode', d.ticks)
          ],
          [
            tg('ctrl-date', d.date),
            mtg(d.df, [
              { l: d.dY, p: 'showY' },
              { l: d.dM, p: 'showM' },
              { l: d.dD, p: 'showD' },
              { l: d.dW, p: 'showW' }
            ]),
            seg(d.layout, 'clockLayout', d.layouts),
            seg(d.datePos, 'datePosition', d.datePositions)
          ],
          [
            tg('ctrl-showcustom', d.sct),
            ctRow
          ],
          [
            anchorRow,
            slider('offset', 'ctrl-offx'),
            slider('offset', 'ctrl-offy')
          ]
        ],
        // Tab 1: Background
        [
          [
            seg(d.mode, 'mode', d.modes, 1),
            theme,
            tg('ctrl-colormix', d.colorMix),
            slider('hueShift', 'ctrl-hue-shift')
          ],
          [
            tg('ctrl-huedrift', d.hueDrift),
            tg('ctrl-modecycle', d.modeCycle),
            seg(d.cycleInt, 'cycleInterval', d.cycleInts)
          ],
          [
            slider('speed'),
            slider('bgBrightness', 'ctrl-bg-brightness'),
            seg(d.vignette, 'vignette', d.vignettes),
            seg(d.renderScale, 'renderScale', [d.auto, '0.25x', '0.5x', '0.75x', '1.0x'], 0, [0, 0.25, 0.5, 0.75, 1])
          ]
        ],
        // Tab 2: System
        [
          [
            langRow,
            seg(d.idle, 'idleTimeout', d.idles),
            tg('ctrl-dimidle', d.dimIdle)
          ],
          [
            tg('ctrl-pixelshift', d.burn),
            tg('ctrl-nightmode', d.night),
            tg('ctrl-fps', d.showFps),
            tg('ctrl-scale', d.showScale),
            tg('ctrl-sliderval', d.showSliderVal)
          ]
        ]
      ];

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
        if (b) b.textContent = fmtSliderVal(el.id, el.value);
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
        return isNaN(b.dataset.value) ? b.dataset.value === val : Number(b.dataset.value) === Number(val);
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
      const { lowPower, colorTarget, anchor, offsetX, offsetY } = state;
      const root = document.documentElement;
      const sp = (k, v) => root.style.setProperty(k, v);
      const full = changedKey === null;

      if (!full && !skipAnim && (changedKey === 'material' || changedKey === 'fontStyle')) {
        const targetEl = changedKey === 'fontStyle' ? this.clockWrapperEl : this.clockEl;
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
      } else if (
        full ||
        skipAnim ||
        ['nightMode', 'textColor', 'ampmColor', 'dateColor', 'customTextColor', 'clockOpacity', 'size', 'colorTarget'].includes(changedKey)
      ) {
        this.applyVisualVars(full);
      }

      if (full || changedKey === 'anchor') {
        const ax = anchor % 3;
        const ay = Math.floor(anchor / 3);
        const F = ['flex-start', 'center', 'flex-end'];
        const O = ['4vmin', '50%', 'calc(100% - 4vmin)'];
        sp('--pos-x', F[ax]);
        sp('--pos-y', F[ay]);
        sp('--ox', O[ax]);
        sp('--oy', O[ay]);
        qsa(document, '.anchor-btn').forEach((b, i) => {
          b.classList.toggle('active', i === anchor);
          b.setAttribute('aria-checked', i === anchor ? 'true' : 'false');
        });
      }

      if (full || ['showY', 'showM', 'showD', 'showW'].includes(changedKey)) {
        qsa(document, '.mtg-btn').forEach(b => {
          const act = !!state[b.dataset.prop];
          b.classList.toggle('active', act);
          b.setAttribute('aria-pressed', act ? 'true' : 'false');
        });
      }

      if (full || changedKey === 'offsetX') sp('--off-x', `${offsetX}vw`);
      if (full || changedKey === 'offsetY') sp('--off-y', `${offsetY}vh`);

      ['textColor', 'ampmColor', 'dateColor', 'customTextColor'].forEach(k => {
        if (full || changedKey === k) {
          const inp = $(`ctrl-${k}`);
          const dot = $(`swatch-${k}`);
          if (inp) inp.value = state[k];
          if (dot) dot.style.background = state[k];
        }
      });

      if (full || changedKey === 'pixelShift') this.runPixelShift();
      if (full || changedKey === 'showFps' || changedKey === 'showScale' || changedKey === 'renderScale') {
        this.syncFps(!!state.showFps);
      }
      if (full || changedKey === 'dimOnIdle') {
        document.body.classList.toggle('no-idle-dim', !state.dimOnIdle);
      }

      if (full || changedKey === 'colorMix') {
        const hsEl = $('ctrl-hue-shift');
        if (hsEl) {
          const hsRow = hsEl.closest('.slider-row');
          if (hsRow) {
            hsRow.classList.toggle('is-hidden', !state.colorMix);
            hsRow.style.display = state.colorMix ? '' : 'none';
          }
        }
      }

      if (full || changedKey === 'modeCycle') {
        const ciEl = qs(this.panel, '.segmented-control[data-prop="cycleInterval"]');
        if (ciEl) {
          const ciRow = ciEl.closest('.settings-row');
          if (ciRow) {
            ciRow.classList.toggle('is-hidden', !state.modeCycle);
            ciRow.style.display = state.modeCycle ? '' : 'none';
          }
        }
        if (state.modeCycle && ciEl) this.updateSegmentHighlight(ciEl, state.cycleInterval, true);
      }

      if (full || changedKey === 'lowPower') {
        const btnLowpower = this.btnLowpower;
        if (btnLowpower) btnLowpower.classList.toggle('is-active', lowPower);
      }

      const bindings = UIManager.UI_BINDINGS;
      const bindKeys = full ? Object.keys(bindings) : (bindings[changedKey] ? [changedKey] : []);
      bindKeys.forEach(k => {
        const b = bindings[k];
        const el = $(b.id);
        if (el) {
          if (String(el[b.prop]) !== String(state[k])) el[b.prop] = state[k];
          if (b.cssVar) sp(b.cssVar, b.format ? b.format(state[k]) : state[k]);
          if (el.type === 'range') this.updateSliderFill(el);
        }
      });

      if (full) {
        qsa(document, '.segmented-control').forEach(c => {
          const val = state[c.dataset.prop];
          if (val !== undefined) {
            requestAnimationFrame(() => this.updateSegmentHighlight(c, val, skipAnim));
          }
        });
      } else {
        const c = qs(document, `.segmented-control[data-prop="${changedKey}"]`);
        const val = state[changedKey];
        if (c && val !== undefined) {
          requestAnimationFrame(() => this.updateSegmentHighlight(c, val, skipAnim));
        }
      }

      if (full || changedKey === 'colorTarget') {
        qsa(document, '.swatches-container .swatch-wrapper').forEach(s => s.classList.remove('active'));
        const activeSwatch = qs(document, `.swatch-wrapper[data-rgb="${colorTarget.join(',')}"]`);
        const customEl = $('custom-swatch-color');
        if (activeSwatch) {
          activeSwatch.classList.add('active');
          customEl.style.background = '';
          customEl.classList.remove('has-color');
        } else {
          $('custom-swatch-wrapper').classList.add('active');
          $('custom-color-input').value = UIManager.rgbToHex(...colorTarget);
          customEl.style.background = UIManager.rgbToHex(...colorTarget);
          customEl.classList.add('has-color');
        }
      }

      if (this._cp) this._cp.refresh(changedKey);
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
        if (prop === 'material' && +b.dataset.value === 3) this.tryRequestGyro();
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
        if (!hit || segValue(hit) === this.store.getState()[this.segProp]) return;
        this.segDragged = true;
        applySeg(this.segProp, hit);
      };

      const trackGlassPtr = e => {
        this.ptrX = clamp((e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
        this.ptrY = clamp((e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
        this.ptrActiveUntil = performance.now() + 900;
      };

      on(document, 'pointerdown', e => {
        if (this.store.getState().material === 3) {
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
            this.store.setState('offsetX', 0);
            this.store.setState('offsetY', 0);
            if (this.store.getState().anchor !== +btn.dataset.value) {
              this.store.setState('anchor', +btn.dataset.value);
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
        if (state.material === 3) trackGlassPtr(e);
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
          this.store.setState('colorTarget', UIManager.hexToRgb(e.target.value));
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
        cp.toggle(isBg ? 'colorTarget' : t.dataset.prop, t, e.detail === 0);
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

      this.store.subscribe((key, val) => {
        if (key === 'isPanelOpen' && !val) {
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
            this.store.setState('anchor', +anchorBtn.dataset.value);
          }
          holdFired = false;
        } else if (segBtn && !segBtn.classList.contains('active')) {
          applySeg(segBtn.closest('.segmented-control').dataset.prop, segBtn);
        } else if (swatch) {
          haptic(10);
          this.store.setState('colorTarget', swatch.dataset.rgb.split(',').map(Number));
        } else if (e.target.closest('#btn-lowpower')) {
          const newState = !state.lowPower;
          this.store.setState('lowPower', newState);
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
