(function (AA) {
  const { clamp } = AA.util;

  const NIGHT_COLOR = [0.16, 0.08, 0.0];
  const NIGHT_COLOR2 = [0.24, 0.05, 0.0];

  // NOTE: hue `h` in AA.COLOR_UTILS is in normalized turns [0, 1),
  // unlike color-picker.js which uses degrees [0, 360) for UI slider math.
  function rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
      if (h < 0) h += 1;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  // NOTE: hue `h` is normalized turns [0, 1) (see rgbToHsv).
  // `out` is an optional pre-allocated 3-element array that receives the result.
  function hsvToRgb(h, s, v, out) {
    const o = out || [0, 0, 0];
    const hh = ((h % 1) + 1) % 1 * 6;
    const i = Math.floor(hh);
    const f = hh - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    switch (i % 6) {
      case 0:
        o[0] = v;
        o[1] = t;
        o[2] = p;
        break;
      case 1:
        o[0] = q;
        o[1] = v;
        o[2] = p;
        break;
      case 2:
        o[0] = p;
        o[1] = v;
        o[2] = t;
        break;
      case 3:
        o[0] = p;
        o[1] = q;
        o[2] = v;
        break;
      case 4:
        o[0] = t;
        o[1] = p;
        o[2] = v;
        break;
      default:
        o[0] = v;
        o[1] = p;
        o[2] = q;
        break;
    }
    return o;
  }

  // `out` is an optional pre-allocated 3-element array that receives the result.
  function applyHueDrift(rgb, driftOffset, out) {
    const o = out || [0, 0, 0];
    const r = clamp(Number(rgb[0]) || 0, 0, 1);
    const g = clamp(Number(rgb[1]) || 0, 0, 1);
    const b = clamp(Number(rgb[2]) || 0, 0, 1);
    if (!driftOffset) {
      o[0] = r;
      o[1] = g;
      o[2] = b;
      return o;
    }
    let [h, s, v] = rgbToHsv(r, g, b);
    if (s < 0.02) s = 0.18;
    return hsvToRgb((h + driftOffset) % 1, s, v, o);
  }

  function deriveSecondaryColor(rgb, nightMode, colorMix, hueShift) {
    if (nightMode) return colorMix ? NIGHT_COLOR2.slice() : NIGHT_COLOR.slice();
    const r = rgb[0];
    const g = rgb[1];
    const b = rgb[2];
    if (!colorMix) return [r, g, b];
    const [h, s, v] = rgbToHsv(r, g, b);
    const shift = ((hueShift / 360 % 1) + 1) % 1;
    let h2 = (h + shift) % 1;
    let s2;
    let v2;
    if (s < 0.12 && v > 0.85) {
      if (s < 0.02) h2 = 0.08;
      s2 = 0.22;
      v2 = 0.95;
    } else if (v < 0.08) {
      s2 = clamp(s * 0.9 + 0.15, 0.2, 0.85);
      v2 = Math.max(v * 2.2, 0.06);
    } else {
      s2 = clamp(s * 0.92 + 0.12, 0.18, 0.92);
      v2 = clamp(v * 1.15 + 0.08, 0.16, 1.0);
    }
    return hsvToRgb(h2, s2, v2);
  }

  AA.COLOR_UTILS = { NIGHT_COLOR, NIGHT_COLOR2, rgbToHsv, hsvToRgb, applyHueDrift, deriveSecondaryColor };
})(window.AA);
