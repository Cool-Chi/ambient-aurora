/*
 * schema/helpers.js - shared building blocks for the per-tab settings schema
 *
 * Responsibility
 *   Validators, formatters and shared apply-hooks used by schema/clock.js, schema/background.js and
 *   schema/system.js. Loaded before those files; has no DOM or state side effects at load time.
 *
 * Exports: AA.SCHEMA_HELPERS
 *   Validators   isBool, isInt(lo, hi), isNum(lo, hi), isHex, isRgb, oneOf(list)
 *   Formatters   fmtInt, fmtPct, fmtSigned
 *   Hooks        syncFpsHook   shared by showFps / showScale / bgRenderScale (same function reference,
 *                              so syncUI runs it once per sync via its hook de-dupe set)
 *                anchorHook    applies clockAnchor CSS vars and the anchor grid active state
 *
 * Co-change guide
 *   New validator / formatter / shared hook -> here, then destructure it in the schema file that uses it
 *   Entry-specific one-off hooks and normalize functions stay inline in their schema entry
 *   Per-tab entries -> schema/clock.js (tab 0), schema/background.js (tab 1), schema/system.js (tab 2 + shell)
 */
(function (AA) {
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

  const anchorHook = (val, s, ui) => {
    const ax = val % 3;
    const ay = Math.floor(val / 3);
    const F = ['flex-start', 'center', 'flex-end'];
    const O = ['4vmin', '50%', 'calc(100% - 4vmin)'];
    const st = (ui && ui.clockLayerObj ? ui.clockLayerObj : document.documentElement).style;
    st.setProperty('--pos-x', F[ax]);
    st.setProperty('--pos-y', F[ay]);
    st.setProperty('--ox', O[ax]);
    st.setProperty('--oy', O[ay]);
    document.querySelectorAll('.anchor-btn').forEach((b, i) => {
      b.classList.toggle('active', i === val);
      b.setAttribute('aria-checked', i === val ? 'true' : 'false');
    });
  };

  AA.SCHEMA_HELPERS = {
    isBool,
    isInt,
    isNum,
    isHex,
    isRgb,
    oneOf,
    fmtInt,
    fmtPct,
    fmtSigned,
    syncFpsHook,
    anchorHook
  };
})(window.AA);
