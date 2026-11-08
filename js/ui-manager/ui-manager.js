/*
 * ui-manager.js - central UI coordinator
 *
 * Role
 *   Owns the shared DOM/state fields, constructs and initializes every UI subsystem in a fixed
 *   order, runs the declarative syncUI (schema -> CSS vars / hooks / controls / dependent rows,
 *   including the typoAnim crossfade), and keeps the thin delegation methods that other modules
 *   (schema/*.js hooks, main.js, color-picker.js, ui-chrome.js, gesture-manager.js, panel-view.js)
 *   still call on the UIManager instance.
 *
 * Statics
 *   FONTS (font-family stacks), hexToRgb, rgbToHex, renderIcon. Everything else is read directly from
 *   AA.DICT / AA.UI_CONFIG by the modules that need it (no forwarding getters on UIManager).
 *
 * Subsystem construction order (constructor)
 *   _hud            <- AA.createHUD            (hud.js)
 *   _chrome         <- AA.createChrome         (ui-chrome.js)
 *   displayLifecycle<- AA.createDisplayLifecycle (display-lifecycle.js)
 *   fx              <- AA.createUIFx           (ui-fx.js)
 *   controls        <- AA.createControlsRegistry (controls-registry.js)
 *   panelView       <- AA.createPanelView      (panel-view.js)
 *   gestures        <- AA.createGestureManager (gesture-manager.js)
 *
 * Initialization order (init)
 *   _chrome.initIcons() -> fx.init() -> _hud.init() -> renderPanel() -> syncUI(true)
 *   -> this._cp = AA.createColorPicker(this) -> bindEvents() -> runPixelShift() -> wakeUp()
 *   -> requestWakeLock() -> synthetic window 'resize'
 *
 * Event binding order (bindEvents)
 *   1. gestures.bindEvents()          panel scroll (capture), pointer*, click/change capture guards,
 *                                     color-picker triggers, main bubble click, window blur
 *   2. _chrome.bindEvents()           Escape, window resize, fullscreenchange, Space hold-to-exit
 *   3. displayLifecycle.bindEvents()  user-activity wake listeners
 *
 * Shared this.* fields (read/written across submodules)
 *   store, panel
 *   activeTab                  written by panelView.setTab; read by panelView.renderPanel, gestures
 *   _cp                        created in init(); read by hud, ui-chrome, panelView, gestures
 *   ptrX, ptrY, ptrActiveUntil written by gestures.trackGlassPtr; read by fx.tickGlass
 *   touchStartX, touchStartY   written by gestures and ui-chrome; read by gestures
 *   glassEls                   populated by fx.init(); read by fx
 *   typoAnim                   managed by syncUI
 *   appContainer, bgLayer, clockLayerObj, clockEl, clockWrapperEl, btnLowpower  cached DOM refs
 */
(function (AA) {
  const { $, clamp } = AA.util;
  const { EASE_OUT } = AA.CONST;
  const { FONTS, SETTINGS_SCHEMA, SCHEMA_BY_KEY } = AA.UI_CONFIG;

  class UIManager {
    // === Static Accessors & Color/Icon Utilities ===
    static get FONTS() {
      return FONTS;
    }

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
      this.typoAnim = null;
      this.clockEl = $('clock');
      this.clockWrapperEl = $('clock-wrapper');
      this.btnLowpower = $('btn-lowpower');
      this.ptrX = -0.65;
      this.ptrY = -0.75;
      this.ptrActiveUntil = 0;
      this.glassEls = null;
      this._cp = null;
      this._hud = AA.createHUD(this);
      this._chrome = AA.createChrome(this);
      this.displayLifecycle = AA.createDisplayLifecycle(this);
      this.fx = AA.createUIFx(this);
      this.controls = AA.createControlsRegistry(this);
      this.panelView = AA.createPanelView(this);
      this.gestures = AA.createGestureManager(this);

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
      this._cp = AA.createColorPicker(this);
      this.bindEvents();
      this.runPixelShift();
      this.wakeUp();
      this.requestWakeLock();
      window.dispatchEvent(new Event('resize'));
    }

    // === HUD, FX & Display Lifecycle Delegation (logic in hud.js, ui-fx.js, display-lifecycle.js) ===
    syncFps(on) {
      this._hud.syncFps(on);
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

    tryRequestGyro() {
      this.fx.tryRequestGyro();
    }

    // === Display Lifecycle Delegation (display-lifecycle.js) ===
    scheduleIdle() {
      this.displayLifecycle.scheduleIdle();
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

    // === Slider, Toast & Segment Highlight Delegation (controls-registry.js) ===
    updateSliderFill(el) {
      this.controls.updateSliderFill(el);
    }

    showHUD(text) {
      this._hud.showHUD(text);
    }

    updateSegmentHighlight(container, val, skipAnim = false) {
      this.controls.updateSegmentHighlight(container, val, skipAnim);
    }

    // === Declarative UI Sync (dependent row animations in panel-view.js) ===
    syncUI(skipAnim = false, changedKey = null) {
      const state = this.store.getState();
      const full = changedKey === null;
      const changed = full ? null : SCHEMA_BY_KEY[changedKey];
      const ap = changed && changed.apply;
      const entries = full ? SETTINGS_SCHEMA : (changed ? [changed] : []);
      const layerEl = this.clockLayerObj || document.documentElement;
      const sp = (k, v) => layerEl.style.setProperty(k, v);

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
        this.controls.syncEntry(e, val, state, skipAnim);
      });

      this.panelView.syncDependents(state, full, changedKey, skipAnim);
    }

    static renderIcon(paths, cls = '', size = 0) {
      return `<svg${cls ? ` class="${cls}"` : ''}${size ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 24 24"${size ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : ''}>${paths}</svg>`;
    }

    // === Event Binding Delegation (gesture-manager.js) ===
    bindEvents() {
      this.gestures.bindEvents();
      this._chrome.bindEvents();
      this.displayLifecycle.bindEvents();
    }
  }

  AA.UIManager = UIManager;
})(window.AA);
