(function (AA) {
const FONTS = [
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "San Francisco", "Inter", system-ui, sans-serif',
  '"ui-serif", "New York", "Times New Roman", Times, serif',
  '"ui-monospace", "SF Mono", Menlo, Monaco, Consolas, monospace'
];
const THEMES = [
  {rgb: '0.21,0.11,0.47', grad: '#371e78, #0a0a0a', label: 'Midnight Purple'}, {rgb: '0.06,0.36,0.27', grad: '#105c45, #0a0a0a', label: 'Aurora Green'},
  {rgb: '0.05,0.23,0.42', grad: '#0e3b6d, #0a0a0a', label: 'Deep Ocean'}, {rgb: '0.47,0.14,0.11', grad: '#78261e, #0a0a0a', label: 'Sunset Orange'},
  {rgb: '0.45,0.05,0.15', grad: '#a31636, #0a0a0a', label: 'Crimson Velvet'}, {rgb: '0.02,0.35,0.45', grad: '#0a82a8, #0a0a0a', label: 'Cyber Cyan'}
];
const SLIDERS = [
  { id: 'ctrl-size', key: 'size', min: 5, max: 20, step: 1, svgMin: '<path d="M12 6L8 18M12 6L16 18M9.5 14H14.5" stroke-linecap="round" stroke-linejoin="round"/>', svgMax: '<path d="M12 3L5 21M12 3L19 21M8 15H16" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'ctrl-weight', key: 'weight', min: 100, max: 900, step: 100, svgMin: '<circle cx="12" cy="12" r="8" stroke-width="1"/>', svgMax: '<circle cx="12" cy="12" r="8" stroke-width="4"/>' },
  { id: 'ctrl-speed', key: 'speed', min: 0.1, max: 4, step: 0.01, svgMin: '<path d="M4 12h10M4 8h6M4 16h8" stroke-linecap="round"/>', svgMax: '<path d="M2 12h16M2 8h12M2 16h14M18 12a2 2 0 1 0-2-2M14 8a2 2 0 1 0-2-2M16 16a2 2 0 1 1-2 2" stroke-linecap="round"/>' },
  { id: 'ctrl-bg-brightness', key: 'bgBrightness', min: 0.1, max: 1.5, step: 0.05, svgMin: '<circle cx="12" cy="12" r="4" stroke-dasharray="2 2"/>', svgMax: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke-linecap="round"/>' },
  { id: 'ctrl-opacity', key: 'opacity', min: 0.1, max: 1, step: 0.05, svgMin: '<circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/>', svgMax: '<circle cx="12" cy="12" r="8" fill="rgba(255,255,255,.5)"/>' },
  { id: 'ctrl-offx', key: 'offset', min: -50, max: 50, step: 1, svgMin: '<path d="M15 18l-6-6 6-6"/>', svgMax: '<path d="M9 18l6-6-6-6"/>' },
  { id: 'ctrl-offy', key: 'offset', min: -50, max: 50, step: 1, svgMin: '<path d="M18 15l-6-6-6 6"/>', svgMax: '<path d="M18 9l-6 6-6-6"/>' }
];
const UI_BINDINGS = {
  size: { id: 'ctrl-size', prop: 'value', cssVar: '--clock-size', format: v => `clamp(4rem, ${v}vw, 20vw)` },
  weight: { id: 'ctrl-weight', prop: 'value', cssVar: '--clock-weight' }, speed: { id: 'ctrl-speed', prop: 'value' }, bgBrightness: { id: 'ctrl-bg-brightness', prop: 'value' }, clockOpacity: { id: 'ctrl-opacity', prop: 'value' }, showCustomText: { id: 'ctrl-showcustom', prop: 'checked' }, customText: { id: 'ctrl-customtext', prop: 'value' }, offsetX: { id: 'ctrl-offx', prop: 'value' }, offsetY: { id: 'ctrl-offy', prop: 'value' },
  is24Hour: { id: 'ctrl-24hr', prop: 'checked' }, leadingZero: { id: 'ctrl-leadingzero', prop: 'checked' },
  showSeconds: { id: 'ctrl-seconds', prop: 'checked' }, showDate: { id: 'ctrl-date', prop: 'checked' },
  pixelShift: { id: 'ctrl-pixelshift', prop: 'checked' }, nightMode: { id: 'ctrl-nightmode', prop: 'checked' }, showFps: { id: 'ctrl-fps', prop: 'checked' }
};
const BINDING_BY_ID = Object.assign(Object.create(null), Object.fromEntries(Object.entries(UI_BINDINGS).map(([k, b]) => [b.id, [k, b]])));
AA.UI_CONFIG = { FONTS, THEMES, SLIDERS, UI_BINDINGS, BINDING_BY_ID };
})(window.AA);
