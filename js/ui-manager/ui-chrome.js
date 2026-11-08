/*
 * ui-chrome.js - shell buttons, shortcuts and fullscreen/resize chrome
 *
 * Responsibility
 *   Renders the shell icon buttons, handles the shell click branches (low power, settings, fullscreen,
 *   outside-panel close) and binds global chrome events (Escape closes the color picker, window resize
 *   and fullscreenchange sync, Space hold-to-exit).
 *
 * Returned API: { initIcons, handleShellClick, bindEvents }
 *
 * ui.* usage
 *   Reads:  ui.store, ui.panel, ui._cp
 *   Writes: ui.touchStartX
 *   Calls:  ui.showHUD(text), ui.wakeUp(), ui.exitApp(isStarting)
 *
 * Global dependencies
 *   AA.util ($, on); AA.DICT; AA.UI_CONFIG (SETTINGS_SCHEMA, UI_ICONS); AA.UIManager.renderIcon
 *
 * Co-change guide
 *   Shell buttons / shortcuts -> ui-chrome.js + index.html + css/ui-manager/hud.css
 *   (+ ui-assets.js if UI_ICONS change, or schema/system.js if the low-power button schema entry changes)
 */
(function (AA) {
  const { $, qs, on } = AA.util;
  const { DICT } = AA;
  const { SETTINGS_SCHEMA, UI_ICONS } = AA.UI_CONFIG;

  const LOWPOWER_KEY = (SETTINGS_SCHEMA.find(s => s.type === 'button') || {}).key;

  AA.createChrome = function createChrome(ui) {
    const exitHint = qs(document, '.exit-hint');
    let exitMode = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'key';

    function syncExitHint(mode) {
      if (mode) exitMode = mode;
      if (!exitHint) return;
      const d = DICT[ui.store.getState().lang];
      if (d) exitHint.textContent = exitMode === 'touch' ? d.exitTouch : d.exitKey;
    }

    function initIcons() {
      UI_ICONS.forEach(([id, size, cls, paths]) => {
        $(id).innerHTML = AA.UIManager.renderIcon(paths, cls, size);
      });
      syncExitHint();
    }

    function handleShellClick(e) {
      if (e.target.closest('#btn-lowpower')) {
        const state = ui.store.getState();
        const newState = !state[LOWPOWER_KEY];
        ui.store.setState(LOWPOWER_KEY, newState);
        ui.showHUD(newState ? DICT[state.lang].lpOn : DICT[state.lang].lpOff);
        return true;
      }
      if (e.target.closest('#btn-settings')) {
        ui.panel.classList.toggle('active');
        ui.store.setState('isPanelOpen', ui.panel.classList.contains('active'));
        return true;
      }
      if (e.target.closest('#btn-fullscreen')) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
        return true;
      }
      if (
        !e.target.closest('.settings-panel') &&
        !e.target.closest('#custom-color-input') &&
        ui.panel.classList.contains('active')
      ) {
        ui.panel.classList.remove('active');
        ui.store.setState('isPanelOpen', false);
        return true;
      }
      return false;
    }

    function bindEvents() {
      on(document, 'pointerdown', e => {
        if (e.pointerType === 'touch') syncExitHint('touch');
      }, { passive: true });

      on(document, 'keydown', e => {
        if (e.key === 'Escape' && ui._cp && ui._cp.isOpen()) ui._cp.close();
      });

      on(window, 'resize', () => {
        document.body.classList.toggle(
          'is-fullscreen',
          (window.innerHeight >= window.screen.height - 1) || !!document.fullscreenElement
        );
        ui.wakeUp();
      });

      on(document, 'fullscreenchange', () => window.dispatchEvent(new Event('resize')));

      on(document, 'keydown', e => {
        if (e.target.tagName !== 'INPUT' && (e.code === 'Space' || e.key === ' ')) {
          e.preventDefault();
          if (!e.repeat) {
            ui.touchStartX = null;
            syncExitHint('key');
            ui.exitApp(true);
          }
        }
      });

      on(document, 'keyup', e => {
        if (e.code === 'Space' || e.key === ' ') ui.exitApp(false);
      });
    }

    return { initIcons, syncExitHint, handleShellClick, bindEvents };
  };
})(window.AA);
