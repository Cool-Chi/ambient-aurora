/*
 * schema/system.js - Tab 2 (System) and shell (tab: null) settings schema entries
 *
 * Responsibility
 *   All entries with tab: 2 (language, idle behavior, burn-in protection, night mode, FPS/scale/slider
 *   value displays) followed by the top-bar low power button (tab: null), in original order.
 *
 * Exports: AA.SCHEMA_SYSTEM  (array; concatenated last by ui-config.js)
 *
 * Depends on: AA.SCHEMA_HELPERS (isBool, isInt, oneOf, syncFpsHook)
 *
 * Co-change guide
 *   lang -> ui-config assembler, locales.js, clock-controller.js (zh-TW / en-US)
 *   Hooks here call UIManager methods (syncFps, runPixelShift) and fields (btnLowpower); keep those on
 *   UIManager.prototype / instance
 */
(function (AA) {
  const { isBool, isInt, oneOf, syncFpsHook } = AA.SCHEMA_HELPERS;

  AA.SCHEMA_SYSTEM = [
    // ---- Tab 2: System / Block 0 ----
    {
      key: 'lang',
      default: 'zh',
      validate: oneOf(['en', 'zh']),
      type: 'segmented',
      tab: 2,
      block: 0,
      label: { en: 'Language', zh: '語言' },
      options: { en: ['EN', '中'], zh: ['EN', '中'] },
      values: ['en', 'zh'],
      style: 'max-width:120px',
      prerender: true
    },
    {
      key: 'idleTimeout',
      default: 1,
      validate: isInt(0, 2),
      type: 'segmented',
      tab: 2,
      block: 0,
      label: { en: 'Idle Timeout', zh: '閒置隱藏' },
      options: { en: ['3s', '10s', 'Never'], zh: ['3秒', '10秒', '永不'] },
      values: [0, 1, 2]
    },
    {
      key: 'isDimOnIdle',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 2,
      block: 0,
      id: 'ctrl-dimidle',
      label: { en: 'Dim on Idle', zh: '閒置自動壓暗' },
      apply: { hook: (v) => document.body.classList.toggle('no-idle-dim', !v) }
    },
    // ---- Tab 2: System / Block 1 ----
    {
      key: 'isPixelShift',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 2,
      block: 1,
      id: 'ctrl-pixelshift',
      label: { en: 'Burn-in Protection', zh: 'OLED 防烙印' },
      apply: { hook: (v, s, ui) => ui.runPixelShift() }
    },
    {
      key: 'isNightMode',
      default: false,
      validate: isBool,
      type: 'toggle',
      tab: 2,
      block: 1,
      id: 'ctrl-nightmode',
      label: { en: 'Night Mode', zh: '夜間護眼' },
      apply: { visual: true }
    },
    {
      key: 'showFps',
      default: false,
      validate: isBool,
      type: 'toggle',
      tab: 2,
      block: 1,
      id: 'ctrl-fps',
      label: { en: 'FPS Display', zh: '幀率顯示' },
      apply: { hook: syncFpsHook }
    },
    {
      key: 'showScale',
      default: false,
      validate: isBool,
      type: 'toggle',
      tab: 2,
      block: 1,
      id: 'ctrl-scale',
      label: { en: 'Scale Display', zh: '倍率顯示' },
      apply: { hook: syncFpsHook }
    },
    {
      key: 'showSliderVal',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 2,
      block: 1,
      id: 'ctrl-sliderval',
      label: { en: 'Slider Value', zh: '拉條數值' }
    },
    // ---- Top bar (no tab): low power button ----
    {
      key: 'isLowPower',
      default: false,
      validate: isBool,
      type: 'button',
      tab: null,
      block: null,
      id: 'btn-lowpower',
      label: { en: 'Low Power Mode', zh: '低功耗模式' },
      apply: { hook: (v, s, ui) => { if (ui.btnLowpower) ui.btnLowpower.classList.toggle('is-active', !!v); } }
    }
  ];
})(window.AA);
