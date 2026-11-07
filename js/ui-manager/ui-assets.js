/*
 * ui-assets.js - static visual and icon tables
 *
 * Responsibility
 *   Pure data with no logic: no schema, no DOM access at load time.
 *
 * Exports: AA.UI_ASSETS = { FONTS, THEMES, UI_ICONS, GLASS_FX_IDS }
 *   FONTS         font-family stacks indexed by clockFont (0..2)
 *   THEMES        6 background theme swatches { rgb, grad, label }; the custom swatch is built in the UI
 *   UI_ICONS      icon buttons rendered by UIManager._chrome.initIcons: [button id, size, svg class, svg paths]
 *   GLASS_FX_IDS  SVG filter element ids for the Hollow / Glass materials: UIManager.glassEls key -> DOM id
 *
 * Co-change guide
 *   New theme swatch        -> THEMES here, then css/ui-manager/settings-controls.css if layout changes
 *   New icon button         -> UI_ICONS here + index.html button + css/app-shell/base.css / hud.css
 *   New SVG filter element  -> GLASS_FX_IDS here + index.html filter + ui-fx.js
 */
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

  AA.UI_ASSETS = { FONTS, THEMES, UI_ICONS, GLASS_FX_IDS };
})(window.AA);
