(function (AA) {
  const { EASE_OUT } = AA.CONST;
  const ANIM_OPT = { duration: 300, easing: EASE_OUT };

  const calmMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = () => !!(calmMQ && calmMQ.matches);

  const CALM_OLD = [{ opacity: 1 }, { opacity: 0 }];
  const CALM_NEW = [{ opacity: 0 }, { opacity: 1 }];
  const CALM_OPT = { duration: 150, easing: EASE_OUT };

  const withCalm = def => ({
    get old() {
      return calm() ? CALM_OLD : def.old;
    },
    get new() {
      return calm() ? CALM_NEW : def.new;
    },
    get opts() {
      return calm() ? CALM_OPT : def.opts;
    },
    get oldOpts() {
      return calm() ? undefined : def.oldOpts;
    },
    get newOpts() {
      return calm() ? undefined : def.newOpts;
    },
    get setup() {
      return calm() ? undefined : def.setup;
    }
  });

  const ANIM_REGISTRY = {
    1: withCalm({
      old: [
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
        { opacity: 0, transform: 'scale(0.9)', filter: 'blur(10px)' }
      ],
      new: [
        { opacity: 0, transform: 'scale(1.18)', filter: 'blur(12px)' },
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }
      ],
      opts: ANIM_OPT
    }),
    2: withCalm({
      old: [
        { transform: 'translateY(0%) scale(1)', opacity: 1, filter: 'blur(0px)', offset: 0 },
        { transform: 'translateY(-42%) scale(0.95)', opacity: 0.35, filter: 'blur(6px)', offset: 0.45 },
        { transform: 'translateY(-68%) scale(0.9)', opacity: 0, filter: 'blur(12px)', offset: 1 }
      ],
      new: [
        { transform: 'translateY(68%) scale(0.92)', opacity: 0, filter: 'blur(10px)', offset: 0 },
        { transform: 'translateY(-10%) scale(1.02)', opacity: 1, filter: 'blur(1.5px)', offset: 0.62 },
        { transform: 'translateY(0%) scale(1)', opacity: 1, filter: 'blur(0px)', offset: 1 }
      ],
      oldOpts: { duration: 280, easing: EASE_OUT },
      newOpts: { duration: 300, easing: EASE_OUT }
    }),
    3: withCalm({
      old: [
        { transform: 'rotateX(0deg)', filter: 'brightness(1) blur(0px)', opacity: 1 },
        { transform: 'rotateX(90deg)', filter: 'brightness(0.4) blur(3px)', opacity: 0 }
      ],
      new: [
        { transform: 'rotateX(-90deg)', filter: 'brightness(0.4) blur(3px)', opacity: 0 },
        { transform: 'rotateX(0deg)', filter: 'brightness(1) blur(0px)', opacity: 1 }
      ],
      opts: ANIM_OPT,
      setup: (oldEl, newEl, span) => {
        span.style.perspective = '600px';
        oldEl.style.transformOrigin = 'bottom center';
        newEl.style.transformOrigin = 'top center';
      }
    })
  };

  AA.CLOCK_ANIMS = { ANIM_OPT, ANIM_REGISTRY };
})(window.AA);
