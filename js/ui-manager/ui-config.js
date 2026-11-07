/*
 * ui-config.js - settings schema assembler and derived lookups
 *
 * Responsibility
 *   Assembles SETTINGS_SCHEMA from the per-tab files (schema/clock.js, schema/background.js,
 *   schema/system.js), pulls the static asset tables from ui-assets.js, and builds the derived lookups
 *   (SCHEMA_BY_KEY, DEPENDENTS_BY_KEY, UI_BINDINGS, BINDING_BY_ID) plus buildDefaultState().
 *
 * Load order: modes/*.js -> schema/helpers.js -> schema/clock.js -> schema/background.js
 *             -> schema/system.js -> ui-assets.js -> ui-config.js
 *
 * Exports: AA.UI_CONFIG = { FONTS, THEMES, UI_ICONS, GLASS_FX_IDS, SETTINGS_SCHEMA, SCHEMA_BY_KEY,
 *                           DEPENDENTS_BY_KEY, UI_BINDINGS, BINDING_BY_ID, buildDefaultState }
 *
 * Co-change guide
 *   Add / edit a setting      -> the matching schema/<tab>.js (SETTINGS_SCHEMA order = tab, block, position)
 *   Shared validator/formatter -> schema/helpers.js
 *   Fonts / themes / icons / glass filter ids -> ui-assets.js
 *   New control type bound to a DOM prop -> BOUND_PROP below + controls-registry.js + gesture-manager.js
 */
(function (AA) {
  const { FONTS, THEMES, UI_ICONS, GLASS_FX_IDS } = AA.UI_ASSETS;

  /*
   * Setting key naming convention (SETTINGS_SCHEMA is the single source of truth)
   *
   * Rule 1 (is*): State & feature toggles use is*
   *   (is24Hour, isLeadingZero, isLowPower, isNightMode, isPixelShift, isDimOnIdle,
   *    isBgColorMix, isBgHueDrift, isBgModeCycle).
   *   NOTE: transient runtime flags (isIdle, isHolding, isPanelOpen) also start with is*,
   *   so Store.TRANSIENT_KEYS MUST always be an explicit Set and never inferred by prefix.
   * Rule 2 (show*): Visibility / display toggles use show*
   *   (showSeconds, showDate, showYear, showMonth, showDay, showWeekday,
   *    showCustomText, showFps, showScale, showSliderVal).
   * Rule 3 (clock*, bg*, date*, lang, idleTimeout): all other settings use their group prefix
   *   (clock* for clock typography/color/layout/position, bg* for the WebGL background,
   *    date* for date layout, plus system-level lang and idleTimeout).
   *
   * One setting = one entry: key, default, validate, type, tab, block, id, label, ...
   * Entries are listed in render order (tab, then block, then position inside the block).
   * dependsOn: key of a boolean setting that controls this row's visibility.
   * normalize: optional (v => v), applied by Store.validate / Store.setState after validate() passes.
   *
   * How to add a standard setting:
   *   1. Pick a key name following Rule 1 / 2 / 3.
   *   2. Add one entry in SETTINGS_SCHEMA with key, default, validate, type, tab, block, id, label
   *      (plus optional dependsOn / apply / normalize).
   *   3. If the engine or clock controller needs it, subscribe to the key in webgl-engine.js
   *      or clock-controller.js.
   *
   * The bgMode entry is generated from the mode registry (AA.MODES / AA.MODE_IDS); add a new background
   * mode by registering it in js/webgl-engine/modes/ rather than editing this file.
   */
  const SETTINGS_SCHEMA = [...AA.SCHEMA_CLOCK, ...AA.SCHEMA_BACKGROUND, ...AA.SCHEMA_SYSTEM];

  const SCHEMA_BY_KEY = Object.fromEntries(SETTINGS_SCHEMA.map(e => [e.key, e]));

  const DEPENDENTS_BY_KEY = {};
  SETTINGS_SCHEMA.forEach(e => {
    if (e.dependsOn) {
      (DEPENDENTS_BY_KEY[e.dependsOn] = DEPENDENTS_BY_KEY[e.dependsOn] || []).push(e);
    }
  });

  const BOUND_PROP = { slider: 'value', toggle: 'checked', 'custom-text': 'value' };

  const UI_BINDINGS = Object.fromEntries(
    SETTINGS_SCHEMA
      .filter(e => BOUND_PROP[e.type] && e.id)
      .map(e => {
        const b = { id: e.id, prop: BOUND_PROP[e.type] };
        if (e.apply && e.apply.cssVar) {
          b.cssVar = e.apply.cssVar;
          if (e.apply.cssFormat) b.format = e.apply.cssFormat;
        }
        return [e.key, b];
      })
  );

  const BINDING_BY_ID = Object.assign(
    Object.create(null),
    Object.fromEntries(
      Object.entries(UI_BINDINGS).map(([k, b]) => [b.id, [k, b]])
    )
  );

  const buildDefaultState = () => {
    const state = {};
    SETTINGS_SCHEMA.forEach(e => {
      state[e.key] = Array.isArray(e.default) ? e.default.slice() : e.default;
    });
    return Object.assign(state, { isIdle: false, isHolding: false, isPanelOpen: false });
  };

  AA.UI_CONFIG = {
    FONTS,
    THEMES,
    UI_ICONS,
    GLASS_FX_IDS,
    SETTINGS_SCHEMA,
    SCHEMA_BY_KEY,
    DEPENDENTS_BY_KEY,
    UI_BINDINGS,
    BINDING_BY_ID,
    buildDefaultState
  };
})(window.AA);
