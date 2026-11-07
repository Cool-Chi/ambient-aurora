(function (AA) {
  const { on } = AA.util;

  const haptic = p => {
    try {
      navigator.vibrate?.(p);
    } catch (e) {}
  };

  AA.createDisplayLifecycle = function createDisplayLifecycle(ui) {
    let pixelShiftTimer = null;
    let idleTimer = null;
    let lastWake = 0;
    let wakeLock = null;
    let wakeLockPending = false;
    let holdTimeout = null;
    let exitCloseTimer = null;
    let exitRecoverTimer = null;

    function runPixelShift() {
      const state = ui.store.getState();
      clearInterval(pixelShiftTimer);
      if (state.isPixelShift) {
        pixelShiftTimer = setInterval(() => {
          ui.appContainer.style.transform = `translate(${(Math.random() - 0.5) * 12}px, ${(Math.random() - 0.5) * 12}px)`;
        }, 60000);
      } else {
        ui.appContainer.style.transform = 'translate(0px, 0px)';
      }
    }

    function scheduleIdle() {
      const state = ui.store.getState();
      clearTimeout(idleTimer);
      if (state.idleTimeout !== 2) {
        idleTimer = setTimeout(() => setIdle(), state.idleTimeout === 0 ? 3000 : 10000);
      }
    }

    function wakeUp() {
      const now = Date.now();
      if (now - lastWake < 150) return;
      lastWake = now;
      document.body.classList.remove('is-idle');
      ui.store.setState('isIdle', false);
      scheduleIdle();
    }

    function setIdle() {
      if (!document.body.classList.contains('is-idle')) {
        document.body.classList.add('is-idle');
        ui.store.setState('isIdle', true);
        ui.panel.classList.remove('active');
        ui.store.setState('isPanelOpen', false);
        if (document.activeElement) document.activeElement.blur();
      }
    }

    function clearExitSequence() {
      clearTimeout(holdTimeout);
      holdTimeout = null;
      clearTimeout(exitCloseTimer);
      exitCloseTimer = null;
      clearTimeout(exitRecoverTimer);
      exitRecoverTimer = null;
      document.body.classList.remove('disconnected');
    }

    function recoverFromExit() {
      clearExitSequence();
      ui.bgLayer.classList.remove('exiting');
      ui.clockLayerObj.classList.remove('exiting');
      ui.store.setState('isHolding', false);
    }

    function exitApp(isStarting) {
      const state = ui.store.getState();
      if (state.isHolding === isStarting) return;
      if (isStarting) clearExitSequence();
      ui.store.setState('isHolding', isStarting);
      ui.bgLayer.classList.toggle('exiting', isStarting);
      ui.clockLayerObj.classList.toggle('exiting', isStarting);
      if (isStarting) {
        haptic(15);
        holdTimeout = setTimeout(() => {
          holdTimeout = null;
          ui.store.setState('isHolding', false);
          haptic([30, 50, 30]);
          document.body.classList.add('disconnected');
          exitCloseTimer = setTimeout(() => {
            exitCloseTimer = null;
            try {
              window.close();
            } catch (err) {}
            exitRecoverTimer = setTimeout(() => recoverFromExit(), 300);
          }, 800);
        }, 2000);
      } else {
        haptic(10);
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }
      if (ui.store.getState().clockMaterial === 3) ui.startGlassLoop();
    }

    async function requestWakeLock() {
      if (wakeLock || wakeLockPending) return;
      if (!('wakeLock' in navigator) || document.hidden) return;
      wakeLockPending = true;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (document.hidden) {
          sentinel.release().catch(() => {});
          return;
        }
        wakeLock = sentinel;
        on(sentinel, 'release', () => {
          if (wakeLock === sentinel) wakeLock = null;
        });
      } catch (e) {
      } finally {
        wakeLockPending = false;
      }
    }

    function releaseWakeLock() {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    }

    function bindEvents() {
      ['mousemove', 'pointermove', 'touchstart', 'keydown'].forEach(evt => {
        on(window, evt, () => wakeUp(), { passive: true });
      });
    }

    return {
      scheduleIdle,
      setIdle,
      wakeUp,
      exitApp,
      clearExitSequence,
      recoverFromExit,
      requestWakeLock,
      releaseWakeLock,
      runPixelShift,
      bindEvents
    };
  };
})(window.AA);
