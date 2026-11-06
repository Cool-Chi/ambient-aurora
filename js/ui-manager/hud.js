(function (AA) {
  const { $, qs } = AA.util;

  AA.createHUD = function createHUD(ui) {
    const hudToast = $('hud-toast');
    let hudTimer = null;
    let fpsRaf = null;
    let fpsLast = 0;
    let _lastGlFrames = 0;
    let fpsBadge = null;
    let fpsDot = null;
    let fpsText = null;
    let scaleBadge = null;
    let scaleDot = null;
    let scaleText = null;
    let _scaleTxt = '';

    function init() {
      const host = ui.appContainer || document.body;

      if (!$('fps-badge')) {
        const fb = document.createElement('div');
        fb.id = 'fps-badge';
        fb.className = 'fps-badge';
        fb.setAttribute('aria-hidden', 'true');
        fb.innerHTML = '<span class="fps-dot"></span><span class="fps-text">-- FPS</span>';
        host.appendChild(fb);
      }
      fpsBadge = $('fps-badge');
      fpsDot = qs(fpsBadge, '.fps-dot');
      fpsText = qs(fpsBadge, '.fps-text');

      if (!$('scale-badge')) {
        const sb = document.createElement('div');
        sb.id = 'scale-badge';
        sb.className = 'fps-badge scale-badge';
        sb.setAttribute('aria-hidden', 'true');
        sb.innerHTML = '<span class="fps-dot"></span><span class="fps-text">--</span>';
        host.appendChild(sb);
      }
      scaleBadge = $('scale-badge');
      scaleDot = qs(scaleBadge, '.fps-dot');
      scaleText = qs(scaleBadge, '.fps-text');
      _scaleTxt = '';

      if (/flat/i.test(AA.VERSION || '') && !$('version-badge')) {
        const vb = document.createElement('div');
        vb.id = 'version-badge';
        vb.className = 'version-badge';
        vb.setAttribute('aria-hidden', 'true');
        vb.textContent = AA.VERSION;
        host.appendChild(vb);
      }
    }

    function updateScaleText() {
      if (!scaleText) return;
      const { bgRenderScale } = ui.store.getState();
      const fmt = s => {
        const n = Number(s) || 1;
        return (n === 1 ? '1.0' : String(n)) + 'x';
      };
      const text = bgRenderScale === 'auto' ? `AUTO · ${fmt(AA._activeScale || 1)}` : fmt(bgRenderScale);
      if (_scaleTxt !== text) {
        _scaleTxt = text;
        scaleText.textContent = text;
      }
      if (scaleDot) scaleDot.style.background = bgRenderScale === 'auto' ? '#0a84ff' : '';
    }

    function fpsTick() {
      fpsRaf = requestAnimationFrame(fpsTickBound);
      const now = performance.now();
      const dt = now - fpsLast;
      if (dt < 500) return;

      const gf = AA._glFrames || 0;
      const { showFps, showScale } = ui.store.getState();

      if (showFps && dt <= 2000) {
        const fps = Math.round((gf - (_lastGlFrames || 0)) * 1000 / dt);
        fpsText.textContent = `${fps} FPS`;
        fpsDot.style.background = fps >= 50 ? '#30d158' : fps >= 30 ? '#ffd60a' : '#ff453a';
      }

      _lastGlFrames = gf;
      fpsLast = now;
      if (showScale) updateScaleText();
    }

    const fpsTickBound = fpsTick;

    function syncFps(on) {
      const { showScale } = ui.store.getState();
      const needLoop = !!on || !!showScale;

      if (needLoop) {
        if (fpsRaf === null) {
          if (fpsText) fpsText.textContent = '-- FPS';
          if (fpsDot) fpsDot.style.background = '';
          _lastGlFrames = AA._glFrames || 0;
          fpsLast = performance.now();
          fpsRaf = requestAnimationFrame(fpsTickBound);
        }
      } else if (fpsRaf !== null) {
        cancelAnimationFrame(fpsRaf);
        fpsRaf = null;
      }

      if (fpsBadge) fpsBadge.classList.toggle('is-visible', !!on);
      if (scaleBadge) scaleBadge.classList.toggle('is-visible', !!showScale);
      if (showScale) updateScaleText();

      const badgeCount = (on ? 1 : 0) + (showScale ? 1 : 0);
      document.documentElement.style.setProperty(
        '--badge-top-reserve',
        badgeCount === 2
          ? 'calc(env(safe-area-inset-top, 16px) + 172px)'
          : badgeCount === 1
            ? 'calc(env(safe-area-inset-top, 16px) + 140px)'
            : '120px'
      );
      if (ui._cp && ui._cp.isOpen()) {
        requestAnimationFrame(() => ui._cp.reposition());
      }
    }

    function showHUD(text) {
      hudToast.textContent = text;
      hudToast.classList.add('is-visible');
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => hudToast.classList.remove('is-visible'), 2000);
    }

    return { init, updateScaleText, syncFps, fpsTick, showHUD };
  };
})(window.AA);
