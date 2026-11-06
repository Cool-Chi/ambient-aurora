(function (AA) {
  const FONTS = [
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "San Francisco", "Inter", system-ui, sans-serif',
    '"ui-serif", "New York", "Times New Roman", Times, serif',
    '"ui-monospace", "SF Mono", Menlo, Monaco, Consolas, monospace'
  ];

  const THEMES = [
    { rgb: '0.21,0.11,0.47', grad: '#371e78, #0a0a0a', label: 'Midnight Purple' },
    { rgb: '0.06,0.36,0.27', grad: '#105c45, #0a0a0a', label: 'Aurora Green' },
    { rgb: '0.05,0.23,0.42', grad: '#0e3b6d, #0a0a0a', label: 'Deep Ocean' },
    { rgb: '0.47,0.14,0.11', grad: '#78261e, #0a0a0a', label: 'Sunset Orange' },
    { rgb: '0.45,0.05,0.15', grad: '#a31636, #0a0a0a', label: 'Crimson Velvet' },
    { rgb: '0.02,0.35,0.45', grad: '#0a82a8, #0a0a0a', label: 'Cyber Cyan' }
  ];

  // Icon buttons rendered by UIManager.init: [button id, size, svg class, svg paths]
  const UI_ICONS = [
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
  ];

  // SVG filter elements used by the Hollow / Glass clock materials: UIManager.glassEls key -> DOM id
  const GLASS_FX_IDS = {
    bevelBlur: 'glass-bevel-blur',
    crestBlur: 'glass-crest-blur',
    mwOff: 'glass-mw-off',
    meOff: 'glass-me-off',
    mnOff: 'glass-mn-off',
    msOff: 'glass-ms-off',
    cwOff: 'glass-cw-off',
    ceOff: 'glass-ce-off',
    cnOff: 'glass-cn-off',
    csOff: 'glass-cs-off',
    causticX: 'glass-caustic-x',
    causticY: 'glass-caustic-y',
    crestX: 'glass-crest-x',
    crestY: 'glass-crest-y',
    whisperX: 'glass-whisper-x',
    whisperY: 'glass-whisper-y',
    prismCX: 'glass-prism-c-x',
    prismCY: 'glass-prism-c-y',
    prismWX: 'glass-prism-w-x',
    prismWY: 'glass-prism-w-y',
    prismCFlood: 'glass-prism-c-flood',
    prismWFlood: 'glass-prism-w-flood',
    bodyFlood: 'glass-body-flood',
    bevelFlood: 'glass-bevel-flood',
    causticFlood: 'glass-caustic-flood',
    whisperFlood: 'glass-whisper-flood',
    crestFlood: 'glass-crest-flood',
    hollowBlur: 'hollow-blur',
    hollowFlood: 'hollow-flood'
  };

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

  const isBool = v => typeof v === 'boolean';
  const isInt = (lo, hi) => v => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  const isNum = (lo, hi) => v => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const isHex = v => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
  const isRgb = v => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1);
  const oneOf = list => v => list.includes(v);

  const fmtInt = v => String(Math.round(v));
  const fmtPct = v => Math.round(v * 100) + '%';
  const fmtSigned = v => (v > 0 ? '+' : '') + Math.round(v);

  const syncFpsHook = (v, s, ui) => ui.syncFps(!!s.showFps);

  const anchorHook = val => {
    const ax = val % 3;
    const ay = Math.floor(val / 3);
    const F = ['flex-start', 'center', 'flex-end'];
    const O = ['4vmin', '50%', 'calc(100% - 4vmin)'];
    const st = document.documentElement.style;
    st.setProperty('--pos-x', F[ax]);
    st.setProperty('--pos-y', F[ay]);
    st.setProperty('--ox', O[ax]);
    st.setProperty('--oy', O[ay]);
    document.querySelectorAll('.anchor-btn').forEach((b, i) => {
      b.classList.toggle('active', i === val);
      b.setAttribute('aria-checked', i === val ? 'true' : 'false');
    });
  };

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
  const SETTINGS_SCHEMA = [
    // ---- Tab 0: Clock / Block 0 ----
    {
      key: 'clockFont',
      default: 0,
      validate: isInt(0, 2),
      type: 'segmented',
      tab: 0,
      block: 0,
      label: { en: 'Font', zh: '字體風格' },
      options: { en: ['SF Pro', 'New York', 'Mono'], zh: ['SF Pro', 'New York', 'Mono'] },
      values: [0, 1, 2],
      apply: { typoTarget: 'wrapper' }
    },
    {
      key: 'clockColor',
      default: '#ffffff',
      validate: isHex,
      type: 'color-chip',
      tab: 0,
      block: 0,
      id: 'ctrl-clockColor',
      group: 'tc',
      label: { en: 'Clock', zh: '時鐘' },
      apply: { visual: true }
    },
    {
      key: 'clockAmpmColor',
      default: '#b3b3b3',
      validate: isHex,
      type: 'color-chip',
      tab: 0,
      block: 0,
      id: 'ctrl-clockAmpmColor',
      group: 'tc',
      label: { en: 'AM', zh: 'AM' },
      apply: { visual: true }
    },
    {
      key: 'dateColor',
      default: '#b3b3b3',
      validate: isHex,
      type: 'color-chip',
      tab: 0,
      block: 0,
      id: 'ctrl-dateColor',
      group: 'tc',
      label: { en: 'Date', zh: '日期' },
      apply: { visual: true }
    },
    {
      key: 'clockCustomTextColor',
      default: '#b3b3b3',
      validate: isHex,
      type: 'color-chip',
      tab: 0,
      block: 0,
      id: 'ctrl-clockCustomTextColor',
      group: 'tc',
      label: { en: 'Text', zh: '文字' },
      apply: { visual: true }
    },
    {
      key: 'clockMaterial',
      default: 2,
      validate: isInt(0, 3),
      type: 'segmented',
      tab: 0,
      block: 0,
      label: { en: 'Material', zh: '字體材質' },
      options: { en: ['Classic', 'Hollow', 'Glow', 'Glass'], zh: ['實色', '鏤空', '高光', '玻璃'] },
      values: [0, 1, 2, 3],
      apply: { typoTarget: 'clock' }
    },
    // ---- Tab 0: Clock / Block 1 ----
    {
      key: 'clockSize',
      default: 12,
      validate: isNum(5, 20),
      type: 'slider',
      tab: 0,
      block: 1,
      id: 'ctrl-size',
      label: { en: 'Size', zh: '時鐘尺寸' },
      min: 5,
      max: 20,
      step: 1,
      svgMin: '<path d="M12 6L8 18M12 6L16 18M9.5 14H14.5" stroke-linecap="round" stroke-linejoin="round"/>',
      svgMax: '<path d="M12 3L5 21M12 3L19 21M8 15H16" stroke-linecap="round" stroke-linejoin="round"/>',
      formatVal: fmtInt,
      apply: { visual: true, cssVar: '--clock-size', cssFormat: v => `clamp(4rem, ${v}vw, 20vw)` }
    },
    {
      key: 'clockWeight',
      default: 500,
      validate: isNum(100, 900),
      type: 'slider',
      tab: 0,
      block: 1,
      id: 'ctrl-weight',
      label: { en: 'Weight', zh: '字體粗細' },
      min: 100,
      max: 900,
      step: 100,
      svgMin: '<circle cx="12" cy="12" r="8" stroke-width="1"/>',
      svgMax: '<circle cx="12" cy="12" r="8" stroke-width="4"/>',
      formatVal: fmtInt,
      apply: { cssVar: '--clock-weight' }
    },
    {
      key: 'clockOpacity',
      default: 0.75,
      validate: isNum(0.1, 1),
      type: 'slider',
      tab: 0,
      block: 1,
      id: 'ctrl-opacity',
      label: { en: 'Opacity', zh: '透明度' },
      min: 0.1,
      max: 1,
      step: 0.05,
      svgMin: '<circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/>',
      svgMax: '<circle cx="12" cy="12" r="8" fill="rgba(255,255,255,.5)"/>',
      formatVal: fmtPct,
      apply: { visual: true }
    },
    // ---- Tab 0: Clock / Block 2 ----
    {
      key: 'is24Hour',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 0,
      block: 2,
      id: 'ctrl-24hr',
      label: { en: '24-Hour Time', zh: '24小時制' }
    },
    {
      key: 'isLeadingZero',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 0,
      block: 2,
      id: 'ctrl-leadingzero',
      label: { en: 'Leading Zero', zh: '補零顯示' }
    },
    {
      key: 'showSeconds',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 0,
      block: 2,
      id: 'ctrl-seconds',
      label: { en: 'Show Seconds', zh: '顯示秒數' }
    },
    {
      key: 'clockTickAnim',
      default: 1,
      validate: isInt(0, 3),
      type: 'segmented',
      tab: 0,
      block: 2,
      label: { en: 'Tick Anim', zh: '跳秒動效' },
      options: { en: ['Inst', 'Depth', 'Spring', 'Flip'], zh: ['瞬間', '景深', '彈性', '翻牌'] },
      values: [0, 1, 2, 3]
    },
    // ---- Tab 0: Clock / Block 3 ----
    {
      key: 'showDate',
      default: true,
      validate: isBool,
      type: 'toggle',
      tab: 0,
      block: 3,
      id: 'ctrl-date',
      label: { en: 'Show Date', zh: '顯示日期' }
    },
    {
      key: 'showYear',
      default: true,
      validate: isBool,
      type: 'mtg-item',
      tab: 0,
      block: 3,
      group: 'df',
      label: { en: 'Y', zh: '年' }
    },
    {
      key: 'showMonth',
      default: true,
      validate: isBool,
      type: 'mtg-item',
      tab: 0,
      block: 3,
      group: 'df',
      label: { en: 'M', zh: '月' }
    },
    {
      key: 'showDay',
      default: true,
      validate: isBool,
      type: 'mtg-item',
      tab: 0,
      block: 3,
      group: 'df',
      label: { en: 'D', zh: '日' }
    },
    {
      key: 'showWeekday',
      default: true,
      validate: isBool,
      type: 'mtg-item',
      tab: 0,
      block: 3,
      group: 'df',
      label: { en: 'W', zh: '週' }
    },
    {
      key: 'clockLayout',
      default: 0,
      validate: isInt(0, 1),
      type: 'segmented',
      tab: 0,
      block: 3,
      label: { en: 'Layout', zh: '時鐘排佈' },
      options: { en: ['Horizontal', 'Vertical'], zh: ['橫向', '直列'] },
      values: [0, 1]
    },
    {
      key: 'datePosition',
      default: 0,
      validate: isInt(0, 1),
      type: 'segmented',
      tab: 0,
      block: 3,
      label: { en: 'Date Pos', zh: '日期位置' },
      options: { en: ['Below', 'Above'], zh: ['下方', '上方'] },
      values: [0, 1]
    },
    // ---- Tab 0: Clock / Block 4 ----
    {
      key: 'showCustomText',
      default: false,
      validate: isBool,
      type: 'toggle',
      tab: 0,
      block: 4,
      id: 'ctrl-showcustom',
      label: { en: 'Custom Text', zh: '自定義文字' }
    },
    {
      key: 'clockCustomText',
      default: 'Ambient Aurora',
      validate: v => typeof v === 'string',
      normalize: v => v.slice(0, 30),
      type: 'custom-text',
      tab: 0,
      block: 4,
      id: 'ctrl-customtext',
      maxLength: 30,
      label: { en: 'Custom Text', zh: '自定義文字' },
      placeholder: { en: 'Enter text...', zh: '輸入文字...' },
      dependsOn: 'showCustomText'
    },
    // ---- Tab 0: Clock / Block 5 ----
    {
      key: 'clockAnchor',
      default: 4,
      validate: isInt(0, 8),
      type: 'anchor',
      tab: 0,
      block: 5,
      label: { en: 'Position', zh: '空間位置' },
      resets: ['clockOffsetX', 'clockOffsetY'],
      apply: { hook: anchorHook }
    },
    {
      key: 'clockOffsetX',
      default: 0,
      validate: isNum(-50, 50),
      type: 'slider',
      tab: 0,
      block: 5,
      id: 'ctrl-offx',
      label: { en: 'Offset X / Y', zh: 'X / Y 軸偏移' },
      min: -50,
      max: 50,
      step: 1,
      svgMin: '<path d="M15 18l-6-6 6-6"/>',
      svgMax: '<path d="M9 18l6-6-6-6"/>',
      formatVal: fmtSigned,
      apply: { cssVar: '--off-x', cssFormat: v => `${v}vw` }
    },
    {
      key: 'clockOffsetY',
      default: 0,
      validate: isNum(-50, 50),
      type: 'slider',
      tab: 0,
      block: 5,
      id: 'ctrl-offy',
      label: { en: 'Offset X / Y', zh: 'X / Y 軸偏移' },
      min: -50,
      max: 50,
      step: 1,
      svgMin: '<path d="M18 15l-6-6-6 6"/>',
      svgMax: '<path d="M18 9l-6 6-6-6"/>',
      formatVal: fmtSigned,
      apply: { cssVar: '--off-y', cssFormat: v => `${v}vh` }
    },
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
      values: MODE_IDS
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
    },
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
