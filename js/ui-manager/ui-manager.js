/*
 * ui-manager.js - responsibility index (sections appear in this order)
 *   1. Module Helpers & Control Sync Dispatch (SYNC_BY_TYPE)
 *   2. Static Accessors & Color/Icon Utilities
 *   3. Lifecycle & Initialization (constructor, init)
 *   4. HUD, FX & Display Lifecycle Delegation (logic in hud.js, ui-fx.js, display-lifecycle.js)
 *   5. Panel Rendering & Tab Navigation (delegated to panel-view.js)
 *   6. Slider, Toast & Segment Highlight Helpers
 *   7. Declarative UI Sync (dependent row animations in panel-view.js)
 *   8. Event Binding, Touch Intent Lock & Click Dispatch
 */
(function (AA) {
  const { $, qs, on, clamp } = AA.util;
  const { EASE_OUT } = AA.CONST;
  const { DICT } = AA;
  const { FONTS, THEMES, UI_BINDINGS, BINDING_BY_ID, SETTINGS_SCHEMA, SCHEMA_BY_KEY } = AA.UI_CONFIG;

  // === Module Helpers & Control Sync Dispatch (SYNC_BY_TYPE) ===
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
    // === Static Accessors & Color/Icon Utilities ===
    static get DICT() {
      return DICT;
    }

    static get FONTS() {
      return FONTS;
    }

    static get THEMES() {
      return THEMES;
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

    // === Lifecycle & Initialization ===
    constructor(store) {
      this.store = store;
      this.panel = $('settings-panel');
      this.activeTab = 0;
      this.appContainer = $('app-container');
      this.bgLayer = $('bg-layer');
      this.clockLayerObj = $('clock-layer');
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.tgStart = null;
      this.tgTarget = null;
      this.tgDragged = false;
      this.tgOrigChecked = false;
      this.tgFlipped = false;
      this.segTarget = null;
      this.segProp = null;
      this.segDragged = false;
      this.typoAnim = null;
      this.clockEl = $('clock');
      this.clockWrapperEl = $('clock-wrapper');
      this.btnLowpower = $('btn-lowpower');
      this.ptrX = -0.65;
      this.ptrY = -0.75;
      this.ptrActiveUntil = 0;
      this.glassEls = null;
      this._hud = AA.createHUD(this);
      this._chrome = AA.createChrome(this);
      this.displayLifecycle = AA.createDisplayLifecycle(this);
      this.fx = AA.createUIFx(this);
      this.panelView = AA.createPanelView(this);

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
      this._chrome.initIcons();

      this.fx.init();

      this._hud.init();

      this.renderPanel();
      this.syncUI(true);
      this.bindEvents();
      this.runPixelShift();
      this.wakeUp();
      this.requestWakeLock();
      window.dispatchEvent(new Event('resize'));
    }

    // === HUD, FX & Display Lifecycle Delegation (logic in hud.js, ui-fx.js, display-lifecycle.js) ===
    updateScaleText() {
      this._hud.updateScaleText();
    }

    syncFps(on) {
      this._hud.syncFps(on);
    }

    fpsTick() {
      this._hud.fpsTick();
    }

    // === FX Delegation (ui-fx.js) ===
    applyVisualVars(full) {
      this.fx.applyVisualVars(full);
    }

    startGlassLoop() {
      this.fx.startGlassLoop();
    }

    stopGlassLoop() {
      this.fx.stopGlassLoop();
    }

    tickGlass(now) {
      this.fx.tickGlass(now);
    }

    updateGlassVectors(force) {
      this.fx.updateGlassVectors(force);
    }

    tryRequestGyro() {
      this.fx.tryRequestGyro();
    }

    handleGyro(e) {
      this.fx.handleGyro(e);
    }

    // === Display Lifecycle Delegation (display-lifecycle.js) ===
    scheduleIdle() {
      this.displayLifecycle.scheduleIdle();
    }

    setIdle() {
      this.displayLifecycle.setIdle();
    }

    wakeUp() {
      this.displayLifecycle.wakeUp();
    }

    exitApp(isStarting) {
      this.displayLifecycle.exitApp(isStarting);
    }

    clearExitSequence() {
      this.displayLifecycle.clearExitSequence();
    }

    recoverFromExit() {
      this.displayLifecycle.recoverFromExit();
    }

    requestWakeLock() {
      return this.displayLifecycle.requestWakeLock();
    }

    releaseWakeLock() {
      this.displayLifecycle.releaseWakeLock();
    }

    runPixelShift() {
      this.displayLifecycle.runPixelShift();
    }

    // === Panel Rendering & Tab Navigation (delegated to panel-view.js) ===
    renderPanel() {
      this.panelView.renderPanel();
    }

    setTab(i) {
      this.panelView.setTab(i);
    }

    // === Slider, Toast & Segment Highlight Helpers ===
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
      this._hud.showHUD(text);
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

    // === Declarative UI Sync (dependent row animations in panel-view.js) ===
    syncUI(skipAnim = false, changedKey = null) {
      const state = this.store.getState();
      const full = changedKey === null;
      const changed = full ? null : SCHEMA_BY_KEY[changedKey];
      const ap = changed && changed.apply;
      const entries = full ? SETTINGS_SCHEMA : (changed ? [changed] : []);
      const root = document.documentElement;
      const sp = (k, v) => root.style.setProperty(k, v);

      if (full) this.panelView.cancelRowAnims();

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

      this.panelView.syncDependents(state, full, changedKey, skipAnim);
    }

    static renderIcon(paths, cls = '', size = 0) {
      return `<svg${cls ? ` class="${cls}"` : ''}${size ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 24 24"${size ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : ''}>${paths}</svg>`;
    }

    // === Event Binding, Touch Intent Lock & Click Dispatch ===
    bindEvents() {
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

      const getPanes = () => qs(this.panel, '.tab-panes');

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

      const revertToggle = () => {
        const tg = this.tgTarget;
        if (!tg || !this.tgFlipped) return;
        this.tgFlipped = false;
        tg.checked = this.tgOrigChecked;
        const entry = UIManager.BINDING_BY_ID[tg.id];
        if (entry) this.store.setState(entry[0], this.tgOrigChecked);
      };

      const commitRange = () => {
        if (!rangeEl) return;
        const hit = UIManager.BINDING_BY_ID[rangeEl.id];
        if (hit) this.store.setState(hit[0], parseFloat(rangeEl.value));
        rangeCommitted = true;
      };

      const rollbackRange = () => {
        const el = rangeEl;
        if (!el || rangeOrigVal === null) return;
        const hit = UIManager.BINDING_BY_ID[el.id];
        if (rangeCommitted && hit) this.store.setState(hit[0], parseFloat(rangeOrigVal));
        if (el.value !== rangeOrigVal) {
          el.value = rangeOrigVal;
          this.updateSliderFill(el);
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
        this.tgStart = null;
        this.tgTarget = null;
        rollbackRange();
        endSlide();
        document.body.classList.remove('is-dragging');
      };

      const shouldBlockPanelTap = e => {
        if (!this.panel.contains(e.target)) return false;
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

      // Panel scroll (capture: scroll events do not bubble) cancels any pending control gesture
      on(this.panel, 'scroll', () => {
        const now = performance.now();
        if (this.panelView.isScrollGuarded(now)) return;
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
          gestureInPanel = this.panel.contains(e.target);
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
        if (this.store.getState().clockMaterial === 3) {
          trackGlassPtr(e);
          this.tryRequestGyro();
        }
        if (e.target.type === 'range' && e.pointerType !== 'touch') {
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
          this.tgOrigChecked = tg.checked;
          this.tgFlipped = false;
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
        const state = this.store.getState();
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
          this.touchStartX !== null &&
          Math.hypot(e.clientX - this.touchStartX, e.clientY - this.touchStartY) > 10
        ) {
          this.exitApp(false);
        }
        if (state.clockMaterial === 3) trackGlassPtr(e);

        // Touch: no scrubbing / toggle dragging until horizontal intent is confirmed
        if (touchGesture && intent !== 'drag') return;

        if (this.segTarget) scrubSeg(e);
        if (this.tgTarget && this.tgStart !== null) {
          const dx = e.clientX - this.tgStart;
          if (Math.abs(dx) > 8) {
            this.tgDragged = true;
            const checkedState = dx > 0;
            if (this.tgTarget.checked !== checkedState) {
              this.tgTarget.checked = checkedState;
              this.tgTarget.dispatchEvent(new Event('change', { bubbles: true }));
              this.tgFlipped = !!this.tgTarget && this.tgTarget.checked !== this.tgOrigChecked;
            }
          }
        }
      }, { passive: true });

      const endGesture = () => {
        clearAnchorHold();
        this.exitApp(false);
        document.body.classList.remove('is-dragging');
        endSlide();
        resetSeg();
        this.tgStart = null;
        gestureEnd = performance.now();
        pId = null;
        setTimeout(() => {
          this.tgTarget = null;
        }, 0);
      };

      on(document, 'pointerup', e => {
        if (rangeEl && e.pointerId === pId && pType === 'touch' && intent === null && maxMove <= 10) {
          // Plain tap on a touch slider: commit the value it landed on
          const hit = UIManager.BINDING_BY_ID[rangeEl.id];
          if (hit) {
            const v = parseFloat(rangeEl.value);
            if (this.store.getState()[hit[0]] !== v) this.store.setState(hit[0], v);
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
        if (e.target.closest('.anchor-grid, .icon-btn') || this.store.getState().isHolding) {
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
        const entry = UIManager.BINDING_BY_ID[e.target.id];
        if (entry && e.target.type !== 'checkbox') {
          this.store.setState(entry[0], e.target.type === 'text' ? e.target.value : parseFloat(e.target.value));
        } else if (e.target.classList.contains('tc-input')) {
          this.store.setState(e.target.dataset.prop, e.target.value);
        } else if (e.target.id === 'custom-color-input') {
          this.store.setState(THEME_KEY, UIManager.hexToRgb(e.target.value));
        }
      });

      // Capture-phase guards: registered before every other click/change listener
      on(document, 'click', e => {
        const dragged = (e.target.closest('.toggle-switch') && this.tgDragged) ||
          (this.segDragged && e.target.closest('.segmented-control'));
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
          const entry = UIManager.BINDING_BY_ID[e.target.id];
          if (entry) this.store.setState(entry[0], e.target.checked);
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

      this.store.subscribe('isPanelOpen', (_, val) => {
        if (!val) {
          cp.close();
          resetSeg();
          endSlide();
        }
      });

      on(window, 'resize', () => cp.reposition());

      on(document, 'click', e => {
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
        } else {
          this._chrome.handleShellClick(e);
        }

        this.wakeUp();
        this.requestWakeLock();
      });

      this._chrome.bindEvents();

      this.displayLifecycle.bindEvents();

      on(window, 'blur', () => {
        this.exitApp(false);
        endSlide();
      });
    }
  }

  AA.UIManager = UIManager;
})(window.AA);
