# Ambient Aurora — develop

這是開發用的多檔分支。正式發布為單一 HTML,由合併腳本產生,再手動上傳到 `main`。
公開說明、展示連結與部署設定請見 `main` 分支。版本號請見 `js/store.js` 第 2 行。

## 目錄結構

| 檔案 | 職責 |
| :--- | :--- |
| `index.html` | HTML 結構與載入順序 |
| `css/style.css` | 全部樣式 |
| `js/store.js` | `window.AA` 初始化、`Store`、`AA.util`、`AA.CONST` |
| `js/webgl-engine.js` | `WebGLEngine` |
| `js/clock-controller.js` | `ClockController` |
| `js/ui-manager/color-picker.js` | 色彩選擇器元件(`AA.createColorPicker`) |
| `js/ui-manager/ui-fx.js` | 視覺變數、玻璃光影、閒置/喚醒/退出、防烙印(`AA.UI_FX`) |
| `js/main.js` | 預設狀態、`initPWA`、啟動序列 |

## 載入規則

- 以經典 `<script src>` 依序載入,順序為 store → webgl-engine → clock-controller → ui-manager → main。
- 檔案之間只透過全域命名空間 `window.AA` 溝通,不使用 `import` / `export`。
- 新增設定鍵時,`main.js` 的 `defaultState`、`store.js` 的 `Store.validate`、`ui-manager.js` 的 `SLIDERS` / `UI_BINDINGS` 必須同步修改。

## 執行

不需要 Node.js、不需要伺服器,直接雙擊 `index.html` 即可。

## 發布

1. 由合併腳本將 CSS 與 JS 依載入順序內嵌,輸出單一 HTML。
2. 手動上傳到 `main`,只替換 `index.html`。

## 授權

MIT,詳見 `LICENSE`。
