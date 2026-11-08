/*
 * schema/background.js - Tab 1 (Background) settings schema entries
 *
 * Responsibility
 *   All entries with tab: 1, in original render order (block 0 .. block 2): mode, theme color, color
 *   blend, hue shift/drift, mode cycle & interval, speed, brightness, vignette, render scale.
 *   The bgMode entry derives its options/values from the mode registry (AA.MODES / AA.MODE_IDS), which
 *   loads before this file; add a background mode by registering it in js/webgl-engine/modes/.
 *
 * Exports: AA.SCHEMA_BACKGROUND  (array; concatenated second by ui-config.js)
 *
 * Depends on: AA.MODES, AA.MODE_IDS, AA.SCHEMA_HELPERS (isBool, isInt, isNum, isRgb, oneOf, fmtPct,
 *             fmtSigned, syncFpsHook)
 *
 * Co-change guide
 *   bgMode enum -> modes/registry.js, modes/*.js, index.html (this file reads the registry automatically)
 *   bgMode wrap: true -> controls-registry.js (seg renderer, highlight), gesture-manager.js (scrubSeg),
 *                        css/ui-manager/settings-controls.css (.segmented-control.is-wrapped)
 *   bgRenderScale -> webgl-engine.js (ENGINE_CFG) and hud.js (scale badge)
 */
(function (AA) {
  const { isBool, isInt, isNum, isRgb, oneOf, fmtPct, fmtSigned, syncFpsHook } = AA.SCHEMA_HELPERS;

  // Background modes come from the mode registry (js/webgl-engine/modes/*.js), which loads before this file
  const MODES = AA.MODES || [];
  const MODE_IDS = AA.MODE_IDS || [];

  let DEFAULT_BG_MODE = 'horizon';
  if (MODE_IDS.length === 0) {
    DEFAULT_BG_MODE = '';
  } else if (!MODE_IDS.includes('horizon')) {
    console.warn('[AA.UI_CONFIG] Default bgMode "horizon" is not in registered MODE_IDS; falling back to:', MODE_IDS[0]);
    DEFAULT_BG_MODE = MODE_IDS[0];
  }

  AA.SCHEMA_BACKGROUND = [
    // ---- Tab 1: Background / Block 0 ----
    {
      key: 'bgMode',
      default: DEFAULT_BG_MODE,
      validate: oneOf(MODE_IDS),
      type: 'segmented',
      tab: 1,
      block: 0,
      label: { en: 'Mode', zh: '背景模式' },
      options: { en: MODES.map(m => m.label.en), zh: MODES.map(m => m.label.zh) },
      values: MODE_IDS,
      // Renders as balanced multi-row chips when 6+ modes are registered (5 or fewer stay a single row)
      wrap: true
    },
    // Dedicated RGB float array [0..1] for WebGL background theme; unrelated to CSS --bg-color (pure black #000 body background).
    {
      key: 'bgColor',
      default: [0.06, 0.36, 0.27],
      validate: isRgb,
      type: 'theme',
      tab: 1,
      block: 0,
      label: { en: 'Theme', zh: '色彩主題' },
      apply: { visual: true }
    },
    {
      key: 'isBgColorMix',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 1,
      block: 0,
      id: 'ctrl-colormix',
      label: { en: 'Color Blend', zh: '雙色混色' }
    },
    {
      key: 'bgHueShift',
      default: 67,
      validate: isNum(-180, 180),
      type: 'slider',
      tab: 1,
      block: 0,
      id: 'ctrl-hue-shift',
      label: { en: 'Hue Shift', zh: '色相偏移' },
      min: -180,
      max: 180,
      step: 1,
      svgMin: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5" stroke-dasharray="2 2"/>',
      svgMax: '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
      formatVal: v => fmtSigned(v) + '°',
      dependsOn: 'isBgColorMix'
    },
    // ---- Tab 1: Background / Block 1 ----
    {
      key: 'isBgHueDrift',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 1,
      block: 1,
      id: 'ctrl-huedrift',
      label: { en: 'Hue Drift', zh: '色相緩漂' }
    },
    {
      key: 'isBgModeCycle',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 1,
      block: 1,
      id: 'ctrl-modecycle',
      label: { en: 'Mode Cycle', zh: '模式輪播' }
    },
    {
      key: 'bgCycleInterval',
      default: 1,
      validate: isInt(0, 2),
      type: 'segmented',
      tab: 1,
      block: 1,
      label: { en: 'Interval', zh: '輪播間隔' },
      options: { en: ['5m', '15m', '1h'], zh: ['5分', '15分', '1時'] },
      values: [0, 1, 2],
      dependsOn: 'isBgModeCycle'
    },
    // ---- Tab 1: Background / Block 2 ----
    {
      key: 'bgSpeed',
      default: 2,
      validate: isNum(0.1, 4),
      type: 'slider',
      tab: 1,
      block: 2,
      id: 'ctrl-speed',
      label: { en: 'Speed', zh: '背景流速' },
      min: 0.1,
      max: 4,
      step: 0.01,
      svgMin: '<path d="M4 12h10M4 8h6M4 16h8" stroke-linecap="round"/>',
      svgMax: '<path d="M2 12h16M2 8h12M2 16h14M18 12a2 2 0 1 0-2-2M14 8a2 2 0 1 0-2-2M16 16a2 2 0 1 1-2 2" stroke-linecap="round"/>',
      formatVal: v => v.toFixed(2) + 'x'
    },
    {
      key: 'bgBrightness',
      default: 1,
      validate: isNum(0.1, 1.5),
      type: 'slider',
      tab: 1,
      block: 2,
      id: 'ctrl-bg-brightness',
      label: { en: 'Brightness', zh: '背景亮度' },
      min: 0.1,
      max: 1.5,
      step: 0.05,
      svgMin: '<circle cx="12" cy="12" r="4" stroke-dasharray="2 2"/>',
      svgMax: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke-linecap="round"/>',
      formatVal: fmtPct
    },
    {
      key: 'bgVignette',
      default: 1,
      validate: isInt(0, 2),
      type: 'segmented',
      tab: 1,
      block: 2,
      label: { en: 'Vignette', zh: '邊緣暗角' },
      options: { en: ['Off', 'Subtle', 'Strong'], zh: ['關', '輕微', '強烈'] },
      values: [0, 1, 2]
    },
    {
      key: 'bgRenderScale',
      default: 'auto',
      validate: oneOf(['auto', 0.25, 0.5, 0.75, 1]),
      type: 'segmented',
      tab: 1,
      block: 2,
      label: { en: 'Render Scale', zh: '渲染倍率' },
      options: { en: ['Auto', '0.25x', '0.5x', '0.75x', '1.0x'], zh: ['自動', '0.25x', '0.5x', '0.75x', '1.0x'] },
      values: ['auto', 0.25, 0.5, 0.75, 1],
      apply: { hook: syncFpsHook }
    }
  ];
})(window.AA);
