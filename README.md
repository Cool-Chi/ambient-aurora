# Ambient Aurora — flat (開發分支)

這是 Ambient Aurora 專案日常開發與模組化代碼實作的專用分支（`flat` 分支）。本分支採**多檔案模組化架構**（10 個 CSS 樣式表與 31 個 JavaScript 模組），維持程式碼的高度模組化、可讀性與可維護性，同時支援零打包工具直接在瀏覽器靜態執行。

正式生產環境採用單一 HTML 檔案發布（由 `build_single.py` 建置合成至 `dist/`，再發布至 `main` 分支）。公開線上展示與 GitHub Pages 部署請參閱 `main` 分支。

當前內部版本號定義於 `js/store/store.js` 第 2 行註釋與 `AA.VERSION`（當前為 `v3.20.7-flat`）。

---

## 核心架構亮點

1. **零建置運行 (Zero-Build Native Pipeline)**：
   - 全專案完全採用原生 HTML5、CSS3 與 ES2020+ 標準撰寫，掛載於唯一的全域命名空間 `window.AA`。
   - 無須 Node.js、npm 或任何打包工具即可透過任何靜態檔案伺服器即時預覽與除錯。
2. **WebGL2 動態光影渲染引擎 (WebGL2 Engine)**：
   - 內建 6 種背景動效模式：**絲綢** (Silk)、**流光** (Glow)、**星塵** (Dust)、**流體** (Liquid)、**地平線** (Horizon) 與 **極光** (Aurora)。
   - 著色器動態組裝：採用 1D/2D PCG 整數雜湊、雙層波浪干涉與動態光效模擬。
   - 效能與節電防護：內建自適應動態解析度控制（`PIXEL_BUDGET=2500000`）、幀率平滑降級、低功耗模式（Low Power Mode）與常駐閒置變暗（Idle Dimming）。
3. **智慧避讓系統 (Smart Evasion)**：
   - 設定面板開啟時，時鐘圖層自動避開面板障礙物，並根據視窗邊界自動計算最適縮放係數（Scale Clamping）。
   - 確定性退路與防震盪機制：拖曳調整時鐘大小時自動凍結重算，操作結束後單次平順收斂；寬螢幕固定於右側邊界可用區，直向螢幕固定於面板上方，杜絕跨幀反向縮放震盪。
4. **原生級觸控與動效體驗 (Native-Grade Motion & Gestures)**：
   - 嚴格遵守 Composite 屬性（`transform`, `opacity`）動畫原則，全介面零 Layout Thrashing。
   - 精確手勢狀態機：行動端滑桿（Slider）宣告 `touch-action: none` 防止脫軌，分段控制器（Segmented Control）支援平衡多列換行與 2D 滑動選取。
   - 控制項觸控熱區擴充至 $\ge 44 \times 44\text{px}$，並完整支援橫向螢幕瀏海安全區（Safe Area Insets）防護。
5. **Schema-Driven 集中狀態架構 (Single Source of Truth)**：
   - 全專案 48 項設定（45 項持久化設定 + 3 項暫態設定）由 `js/ui-manager/ui-config.js` 統一管理。
   - 預設值、雙向綁定、依賴顯隱、數值驗證（含 Emoji Surrogate Pair 安全截斷）及多語系切換皆由 Schema 自動衍生。

---

## 目錄結構

```text
├── index.html                     # HTML 骨架、SVG 濾鏡定義與 CSS/JS 模組載入順序
├── build_single.py                # 單檔建置腳本（合併 CSS/JS，自動剝除 -flat 標籤輸出至 dist/）
├── README.md                      # 開發分支說明文件
├── css/
│   ├── app-shell/
│   │   ├── tokens.css             # :root CSS 變數定義、設計權杖、動效貝茲曲線
│   │   └── base.css               # html/body、#app-container、視窗鎖定與手勢防誤觸
│   ├── webgl-engine/
│   │   └── background.css         # 背景層容器、Canvas 畫布與長按退出縮放過渡
│   ├── clock-controller/
│   │   ├── clock-layout.css       # 時鐘容器（.clock-layer）、空間避讓變數與翻轉鎖定
│   │   ├── clock-face.css         # #clock 數字面版、字體材質、光學尺寸與橫向/直列佈局
│   │   └── clock-text.css         # 日期顯示（#date）與自訂文字（#custom-text）樣式
│   └── ui-manager/
│       ├── hud.css                # 浮動 HUD、按鈕、Toast 提示、FPS/倍率/版本徽章
│       ├── settings-panel.css     # 設定面板外殼、分頁容器、隱藏列過渡動畫
│       ├── settings-controls.css  # 滑桿、分段開關、多選按鈕、九宮格、色票等控制項
│       └── color-picker.css       # 獨立色盤彈出視窗樣式（具出發原點感知展開）
└── js/
    ├── store/
    │   └── store.js               # window.AA 初始化、Store 狀態管理（具版本 JSON 儲存與精確鍵值訂閱）
    ├── webgl-engine/
    │   ├── modes/
    │   │   ├── registry.js        # 背景動效模式註冊表與輪播序列
    │   │   ├── silk.js            # 模式 1：絲綢 (Silk)
    │   │   ├── glow.js            # 模式 2：流光 (Glow)
    │   │   ├── dust.js            # 模式 3：星塵 (Dust)
    │   │   ├── liquid.js          # 模式 4：流體 (Liquid)
    │   │   ├── horizon.js         # 模式 5：地平線 (Horizon)
    │   │   ├── aurora.js          # 模式 6：極光 (Aurora)
    │   │   └── diagnostics.js     # 模式診斷工具與著色器編譯效能分析
    │   ├── shaders.js             # WebGL2 (GLSL ES 3.00) 著色器動態組裝、PCG 雜湊噪訊
    │   ├── color-utils.js         # 色彩推導 (HSV/RGB)、夜間配色、無記憶體配置色相緩漂
    │   └── webgl-engine.js        # WebGLEngine（管線排程、自適應倍率防震盪、ENGINE_CFG）
    ├── clock-controller/
    │   ├── animations.js          # 跳秒貝茲曲線與動效預設 (AA.CLOCK_ANIMS)
    │   └── clock-controller.js    # ClockController（時鐘 Diff DOM、佈局翻轉動畫、智慧避讓）
    ├── ui-manager/
    │   ├── schema/
    │   │   ├── helpers.js         # 驗證器、格式化器與共用 Hook (AA.SCHEMA_HELPERS)
    │   │   ├── clock.js           # 分頁 0：時鐘設定 (字體、色彩、材質、尺寸、時間/日期格式)
    │   │   ├── background.js      # 分頁 1：背景設定 (動態模式、渲染倍率、暗角、速度、亮度)
    │   │   └── system.js          # 分頁 2：系統設定 (語言、閒置防烙印、FPS 監控、重置)
    │   ├── locales.js             # 多國語系通用字典（AA.DICT）
    │   ├── ui-assets.js           # 靜態視覺資產 (字體堆疊、色彩主題、SVG 圖示與玻璃濾鏡 ID)
    │   ├── ui-config.js           # 動態組裝 SETTINGS_SCHEMA 單一真相來源與衍生綁定
    │   ├── color-picker.js        # 自訂色盤彈出元件（Origin-aware 展開與防遮擋定位）
    │   ├── hud.js                 # FPS / 渲染倍率徽章與 Toast 氣泡提示
    │   ├── ui-chrome.js           # 介面外殼 (全螢幕、低功耗按鈕、快捷鍵、長按退出提示)
    │   ├── display-lifecycle.js   # 顯示生命週期 (閒置、喚醒、長按退出、常亮鎖、OLED 防烙印)
    │   ├── ui-fx.js               # 玻璃動態反光、SVG 濾鏡向量運算、陀螺儀追蹤與材質套用
    │   ├── controls-registry.js   # 控制項渲染策略與雙向狀態鏡射 (SYNC_BY_TYPE)
    │   ├── panel-view.js          # 設定面板 DOM 骨架渲染、分頁切換與依賴列過渡動畫
    │   ├── gesture-manager.js     # 觸控意圖鎖定、手勢狀態機與 Capture 階段防誤觸攔截
    │   └── ui-manager.js          # UIManager (頂層介面協調器，掛載子系統與初始化流程)
    └── main.js                    # 應用程式啟動序列、PWA 註冊與可見度切換監聽
```

---

## 架構與協作契約

### 1. 全域命名空間與載入契約
- 所有模組皆掛載於唯一的全域命名空間 `window.AA`，不使用 ES Modules 的 `import` / `export`，以確保能零建置成本直接在瀏覽器執行。
- `index.html` 內以原生 `<link rel="stylesheet">` 與 `<script src>` 載入，相依關係嚴格維持單向無循環。
- **CSS 載入順序（10 檔）**：
  1. `tokens.css`
  2. `base.css`
  3. `background.css`
  4. `clock-layout.css`
  5. `clock-face.css`
  6. `clock-text.css`
  7. `hud.css`
  8. `settings-panel.css`
  9. `settings-controls.css`
  10. `color-picker.css`
- **JS 載入順序（31 檔）**：
  1. `store.js`
  2. `locales.js`
  3. `modes/registry.js`
  4~9. `modes/*.js` (`silk`, `glow`, `dust`, `liquid`, `horizon`, `aurora`)
  10~13. `schema/*.js` (`helpers`, `clock`, `background`, `system`)
  14. `ui-assets.js`
  15. `ui-config.js`（確保 `SETTINGS_SCHEMA` 與預設狀態在引擎與介面啟動前就緒）
  16. `shaders.js`
  17. `color-utils.js`
  18. `webgl-engine.js`
  19. `modes/diagnostics.js`
  20. `animations.js`
  21. `clock-controller.js`
  22. `color-picker.js`
  23. `hud.js`
  24. `ui-chrome.js`
  25. `display-lifecycle.js`
  26. `ui-fx.js`
  27. `controls-registry.js`
  28. `panel-view.js`
  29. `gesture-manager.js`
  30. `ui-manager.js`
  31. `main.js`（最後掛載並啟動各控制器）

### 2. 設定系統（Schema-Driven Settings）
- `js/ui-manager/ui-config.js` 中的 `SETTINGS_SCHEMA` 為所有設定項目的**單一真相來源**（Single Source of Truth），由 `schema/` 目錄下的各個分頁定義動態組裝而成。
- 預設值（`buildDefaultState`）、數值驗證（`Store.validate`）、控制項綁定（`UI_BINDINGS`）、動態條件顯隱（`dependsOn`）與面板渲染均由 Schema 自動衍生。
- 支援極端資料防護（Break-UI Resilience）：
  - 自訂文字（`clockCustomText`）採用 `Array.from(v).slice(0, 30).join('')` 以避免 Emoji Surrogate Pair 截斷產生亂碼。
  - 時鐘尺寸公式納入 `28dvh` 視窗高度邊界夾制（`clamp(3rem, min(${v}vw, 28dvh), 20vw)`），防止大字級溢出。

### 3. 按鍵訂閱與狀態持久化
- `Store.subscribe(keys, callback)` 採精確鍵值訂閱（Keyed Subscription），僅在關注的設定變更時觸發對應模組，避免全域廣播重算。
- 本地設定儲存於 `localStorage`（Key: `aurora_settings`），採單一含版本號的 JSON 包裝（`{ version: Store.STORAGE_VERSION, state }`）。版本不相符時會自動重置為預設狀態，不向下相容舊版零散的鍵值。

### 4. WebGL2 渲染引擎規範
- 全螢幕由 `gl_VertexID` 繪製單一大三角形（無須頂點緩衝與 Attribute 綁定）。
- 雜湊運算全面改用 1D/2D PCG 整數 Hash 演算法，改善噪訊與星點分佈品質。
- 背景模式拆分為獨立模組（`modes/*.js`）並依賴註冊表動態組合 Fragment Shader。新增模式只需於 `modes/<id>.js` 呼叫 `AA.registerMode(def)` 並於 `index.html` 引進即可。
- 運算參數、升降級門檻與動畫週期集中由 `ENGINE_CFG` 管理，不保留除錯全域覆寫物件。

---

## 本地開發與除錯

本專案無需 Node.js、npm 或任何打包工具建置環境：
1. 複製專案後，以任何靜態檔案伺服器（例如 VS Code 的 Live Server，或 Python 指令：`python -m http.server 8080`）開啟根目錄。
2. 開發期間若版本號帶有 `-flat` 尾綴（例如 `v3.20.7-flat`），畫面右上角會自動顯示版本資訊徽章以利追溯。

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
   將生成出的單一 HTML 內容替換至 `main` 分支的 `index.html` 並打上正式標籤（例如 `v3.20.7`），將自動觸發 GitHub Pages 部署。

---

## 授權

MIT License，詳見 [LICENSE](LICENSE)。
