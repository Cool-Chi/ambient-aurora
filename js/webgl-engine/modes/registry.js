/*
 * Background mode registry.
 *
 * Contract 1 - Persistence rule:
 *   A mode `id` string is persisted in user saves (localStorage, key `bgMode`).
 *   NEVER rename an existing `id`. If a mode is retired, delete its entry instead of renaming it.
 *
 * Contract 2 - Mode shader convention:
 *   Each mode's `glsl` snippet must define `vec3 render<Id>(vec2 uv, float u_time)`, where <Id> is the
 *   `id` with its first letter capitalized (e.g. `silk` -> `renderSilk`).
 *   Shared GLSL helpers available to every mode: hash(float), hash(vec2), noise(vec2), fbm(vec2).
 *   Uniforms available to every mode: u_color (vec3), u_color2 (vec3), u_resolution (vec2), u_octaves (int).
 *   Return value: un-exposed vec3 linear color (exposure scaling is applied by evalScene).
 *
 * Registration order defines the mode index (u_weights[i]). UI_CONFIG, the shader assembly and the engine
 * all read it from AA.MODES / AA.MODE_IDS / AA.MODE_INDEX_BY_ID; AA.nextMode(id) steps through it in order.
 */
(function (AA) {
  const modes = [];
  const modeIds = [];
  const modeIndexById = Object.create(null);

  const isNonEmptyString = v => typeof v === 'string' && v.length > 0;

  function registerMode(def) {
    const fail = reason => {
      console.error('[AA.registerMode] Invalid mode definition:', reason, def);
      return false;
    };

    if (!def || typeof def !== 'object') return fail('definition must be an object');
    if (typeof def.id !== 'string' || !/^[a-z][a-z0-9]*$/.test(def.id)) {
      return fail('id must be a non-empty lowercase string matching /^[a-z][a-z0-9]*$/');
    }
    if (!def.label || typeof def.label !== 'object' || !isNonEmptyString(def.label.en) || !isNonEmptyString(def.label.zh)) {
      return fail('label must be an object with non-empty label.en and label.zh');
    }
    if (typeof def.exposure !== 'number' || !Number.isFinite(def.exposure) || !(def.exposure > 0)) {
      return fail('exposure must be a finite positive number');
    }
    if (!isNonEmptyString(def.glsl)) return fail('glsl must be a non-empty string');
    if (def.id in modeIndexById) return fail(`id "${def.id}" is already registered`);

    const fnName = 'render' + def.id[0].toUpperCase() + def.id.slice(1);
    const sig = new RegExp('\\bvec3\\s+' + fnName + '\\s*\\(\\s*vec2\\s+uv\\s*,\\s*float\\s+u_time\\s*\\)');
    if (!sig.test(def.glsl)) {
      return fail(`glsl must define "vec3 ${fnName}(vec2 uv, float u_time)"`);
    }

    const entry = Object.freeze({
      id: def.id,
      fnName,
      expConst: 'EXP_' + def.id.toUpperCase(),
      label: Object.freeze({ en: def.label.en, zh: def.label.zh }),
      exposure: def.exposure,
      glsl: def.glsl.trim()
    });
    modeIndexById[def.id] = modes.length;
    modes.push(entry);
    modeIds.push(def.id);
    return true;
  }

  // Next mode id in registration order, wrapping from the last entry back to the first
  function nextMode(currentId) {
    const count = modeIds.length;
    if (count === 0) return '';
    if (count === 1) return modeIds[0];
    if (!(currentId in modeIndexById)) return modeIds[0];
    return modeIds[(modeIndexById[currentId] + 1) % count];
  }

  AA.registerMode = registerMode;
  AA.nextMode = nextMode;
  Object.defineProperties(AA, {
    MODES: { get: () => modes, enumerable: true, configurable: true },
    MODE_IDS: { get: () => modeIds, enumerable: true, configurable: true },
    MODE_INDEX_BY_ID: { get: () => modeIndexById, enumerable: true, configurable: true }
  });
})(window.AA);
