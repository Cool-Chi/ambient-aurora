/*
 * ui-chrome.js — App Shell Buttons, SVG Icons, Keyboard Shortcuts & Outside-Panel Close
 *   Factory: AA.createChrome(ui) -> mounted at ui._chrome
 *   Returned API: { initIcons, handleShellClick, bindEvents }
 *   Reads / writes on ui:
 *     - Reads: ui.store, ui.panel, ui._cp (isOpen, close)
 *     - Writes: ui.touchStartX (sets to null on Space keydown hold-to-exit)
 *     - Calls: ui.showHUD(text), ui.wakeUp(), ui.exitApp(isStarting), AA.UIManager.renderIcon(...)
 *   Private state: LOWPOWER_KEY (resolved from SETTINGS_SCHEMA)
 *   Globals: AA.util ($, on), AA.DICT, AA.UI_CONFIG (SETTINGS_SCHEMA, UI_ICONS)
 *   Co-change guide: Bottom shell buttons / shortcuts -> ui-chrome.js + css/ui-manager/hud.css
 *     (+ ui-config.js if UI_ICONS change)
 */
(function (AA) {
  const { $, on } = AA.util;
  const { DICT } = AA;
  const { SETTINGS_SCHEMA, UI_ICONS } = AA.UI_CONFIG;

  const LOWPOWER_KEY = (SETTINGS_SCHEMA.find(s => s.type === 'button') || {}).key;

  AA.createChrome = function createChrome(ui) {
    function initIcons() {
      UI_ICONS.forEach(([id, size, cls, paths]) => {
        $(id).innerHTML = AA.UIManager.renderIcon(paths, cls, size);
      });
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
            ui.exitApp(true);
          }
        }
      });

      on(document, 'keyup', e => {
        if (e.code === 'Space' || e.key === ' ') ui.exitApp(false);
      });
    }

    return { initIcons, handleShellClick, bindEvents };
  };
})(window.AA);
