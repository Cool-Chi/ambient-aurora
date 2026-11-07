/*
 * schema/clock.js - Tab 0 (Clock) settings schema entries
 *
 * Responsibility
 *   All entries with tab: 0, in original render order (block 0 .. block 5):
 *   fonts/colors/material, size/weight/opacity, time format & tick animation, date format & layout,
 *   custom text, anchor & offsets.
 *
 * Exports: AA.SCHEMA_CLOCK  (array; concatenated first by ui-config.js)
 *
 * Depends on: AA.SCHEMA_HELPERS (isBool, isInt, isNum, isHex, fmtInt, fmtPct, fmtSigned, anchorHook)
 *
 * Co-change guide
 *   clockMaterial / clockTickAnim / clockLayout / datePosition / lang-dependent labels also touch the
 *   files listed under "Coupled touchpoints" in the project rules (ui-fx.js, animations.js,
 *   clock-controller.js, clock-face.css, clock-text.css, index.html filters)
 */
(function (AA) {
  const { isBool, isInt, isNum, isHex, fmtInt, fmtPct, fmtSigned, anchorHook } = AA.SCHEMA_HELPERS;

  AA.SCHEMA_CLOCK = [
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
    }
  ];
})(window.AA);
