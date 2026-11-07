# Ambient Aurora — flat (開發分支)

這是 Ambient Aurora 專案日常開發與模組化代碼實作的專用分支（`flat` 分支）。本分支採**多檔案模組化架構**（分離的 `css/`、`js/` 子目錄），維持程式碼的高可讀性與維護性。

正式生產環境採用單一 HTML 檔案發布（由 `build_single.py` 建置合成至 `dist/`，再發布至 `main` 分支）。公開線上展示與 GitHub Pages 部署請參閱 `main` 分支。

當前內部版本號定義於 `js/store/store.js` 第 2 行註釋與 `AA.VERSION`。

---

## 目錄結構

```text
├── index.html                     # HTML 骨架、SVG 濾鏡定義與 CSS/JS 模組載入順序
├── build_single.py                # 單檔建置腳本（合併 CSS/JS，自動剝除 -flat 標籤輸出至 dist/）
├── css/
│   ├── app-shell/
│   │   ├── tokens.css             # :root CSS 變數定義、設計權杖
│   │   └── base.css               # html/body、#app-container、全域狀態類與手勢設定
│   ├── webgl-engine/
│   │   └── background.css         # 背景層、Canvas 畫布與離場特效
│   ├── clock-controller/
│   │   ├── clock-layout.css       # 時鐘容器（.clock-layer）、避讓變數、空間位置與翻轉動效
│   │   ├── clock-face.css         # #clock 數字面版、字體材質與橫向/直列佈局
│   │   └── clock-text.css         # 日期顯示（#date）與自訂文字（#custom-text）樣式
│   └── ui-manager/
│       ├── hud.css                # 浮動 HUD、按鈕、Toast 提示、FPS/倍率/版本徽章
│       ├── settings-panel.css     # 設定面板外殼、分頁容器、隱藏列過渡動畫
│       ├── settings-controls.css  # 滑桿、分段開關、多選按鈕、九宮格、色票等控制項
│       └── color-picker.css       # 獨立色盤彈出視窗樣式
└── js/
    ├── store/
    │   └── store.js               # window.AA 初始化、Store 狀態管理（具版本 JSON 儲存與按鍵訂閱）
    ├── webgl-engine/
    │   ├── modes/                 # 獨立背景模式與註冊表 (registry.js, *.js)
    │   ├── shaders.js             # WebGL2 (GLSL ES 3.00) 著色器動態組裝、PCG 整數 Hash
    │   ├── color-utils.js         # 色彩推導 (HSV/RGB)、夜間配色、無記憶體配置緩漂推算
    │   └── webgl-engine.js        # WebGLEngine（管線排程、自適應倍率防震盪、集中常數 ENGINE_CFG）
    ├── clock-controller/
    │   ├── animations.js          # 跳秒貝茲曲線與動效預設 (AA.CLOCK_ANIMS)
    │   └── clock-controller.js    # ClockController（時鐘 Diff DOM、佈局翻轉動畫、智慧避讓）
    ├── ui-manager/
    │   ├── schema/                # 依分頁拆分的設定定義 (helpers.js, clock.js, background.js, system.js)
    │   ├── locales.js             # 多國語系通用字典（AA.DICT）
    │   ├── ui-assets.js           # 靜態視覺資產 (字體堆疊、色彩主題、SVG 圖示與玻璃濾鏡 ID)
    │   ├── ui-config.js           # 動態組裝 SETTINGS_SCHEMA 單一真相來源與衍生綁定
    │   ├── color-picker.js        # 自訂色盤彈出元件
    │   ├── hud.js                 # FPS / 渲染倍率徽章與 Toast 氣泡提示
    │   ├── ui-chrome.js           # 介面外殼 (全螢幕、低功耗按鈕、快捷鍵、面板外點擊)
    │   ├── display-lifecycle.js   # 顯示生命週期 (閒置、喚醒、長按退出、常亮鎖、OLED 防烙印)
    │   ├── ui-fx.js               # 玻璃動態反光、SVG 濾鏡向量運算、陀螺儀追蹤與材質套用
    │   ├── controls-registry.js   # 控制項渲染策略與雙向狀態鏡射 (SYNC_BY_TYPE)
    │   ├── panel-view.js          # 設定面板 DOM 骨架渲染、分頁切換與依賴列過渡動畫
    │   ├── gesture-manager.js     # 觸控意圖鎖定、手勢狀態機與 Capture 階段防誤觸攔截
    │   └── ui-manager.js          # UIManager (頂層介面協調器，掛載子系統與初始化流程)
    └── main.js                    # 應用程式啟動序列、PWA 註冊與可見度切換監聽
```

---

## 架構與協作規則

### 1. 全域命名空間與載入相依性
- 所有模組皆掛載於唯一的全域命名空間 `window.AA`，不使用 ES Modules 的 `import` / `export`，以確保能零建置成本直接在瀏覽器執行。
- `index.html` 內以原生 `<script src>` 與 `<link rel="stylesheet">` 載入，相依關係嚴格維持單向。
- **JS 載入順序（29 檔）**：
  1. `store.js`
  2. `locales.js`
  3. `modes/registry.js`
  4~8. `modes/*.js` (silk, glow, dust, liquid, horizon)
  9~12. `schema/*.js` (helpers, clock, background, system)
  13. `ui-assets.js`
  14. `ui-config.js`（確保 `SETTINGS_SCHEMA` 與預設狀態在引擎與介面啟動前就緒）
  15. `shaders.js`
  16. `color-utils.js`
  17. `webgl-engine.js`
  18. `animations.js`
  19. `clock-controller.js`
  20. `color-picker.js`
  21. `hud.js`
  22. `ui-chrome.js`
  23. `display-lifecycle.js`
  24. `ui-fx.js`
  25. `controls-registry.js`
  26. `panel-view.js`
  27. `gesture-manager.js`
  28. `ui-manager.js`
  29. `main.js`（最後掛載並啟動各控制器）

### 2. 設定系統（Schema-Driven Settings）
- `js/ui-manager/ui-config.js` 中的 `SETTINGS_SCHEMA` 為所有設定項目的**單一真相來源**（Single Source of Truth），由 `schema/` 目錄下的各個分頁定義動態組裝而成。
- 預設值（`buildDefaultState`）、數值驗證（`Store.validate`）、控制項綁定（`UI_BINDINGS`）、動態條件顯隱（`dependsOn`）與面板渲染均由 Schema 自動衍生。
- 新增設定項目只需在對應分頁的 `schema/*.js` 中追加一筆定義並補上多語系文案，不再需要跨多個檔案手寫重複的 `if` 判斷。

### 3. 按鍵訂閱與狀態持久化
- `Store.subscribe(keys, callback)` 採精確鍵值訂閱（Keyed Subscription），僅在關注的設定變更時觸發對應模組，避免全域廣播重算。
- 本地設定儲存於 `localStorage`（Key: `aurora_settings`），採單一含版本號的 JSON 包裝（`{ version: 2, state: { ... } }`）。版本不相符時會自動重置為預設狀態，不向下相容舊版零散的鍵值。

### 4. WebGL2 渲染引擎規範
- 全螢幕由 `gl_VertexID` 繪製單一大三角形（無須頂點緩衝與 Attribute 綁定）。
- 雜湊運算全面改用 1D/2D PCG 整數 Hash 演算法，改善噪訊與星點分佈品質。
- 背景模式拆分為獨立模組（`modes/*.js`）並依賴註冊表動態組合 Fragment Shader。
- 運算參數、升降級門檻與動畫週期集中由 `ENGINE_CFG` 管理，不保留除錯全域覆寫物件。

---

## 本地開發與除錯

本專案無需 Node.js、npm 或任何打包工具建置環境：
1. 複製專案後，以任何靜態檔案伺服器（例如 VS Code 的 Live Server，或 Python 指令：`python -m http.server 8080`）開啟根目錄。
2. 開發期間若版本號帶有 `-flat` 尾綴（例如 `v3.18.2-flat`），畫面右下角會自動顯示版本資訊徽章以利追溯。

---

## 合併與發布流程 (Build & Release)

當準備發布至正式生產環境時：

1. **執行單檔建置腳本**：
   ```bash
   python build_single.py
   ```
   腳本會依序將 `css/` 與 `js/` 下的所有模組內聯展開至單一 HTML 檔案中，並自動將版本標籤中的 `-flat` 尾綴剝除（版本徽章將自動隱藏）。
2. **輸出位置**：
   輸出檔案將存放於專案根目錄下的 `dist/`，命名規則為 `index_vX.Y.Z.html`。
3. **發布至 main 分支**：
   將生成出的單一 HTML 內容替換至 `main` 分支的 `index.html` 並打上正式標籤（例如 `v3.18.2`），將自動觸發 GitHub Pages 部署。

---

## 授權

MIT License，詳見 [LICENSE](LICENSE)。
