# Ambient Aurora — v3.19.1 Valencia (瓦倫西亞)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 2.0](https://img.shields.io/badge/WebGL-2.0-brightgreen.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Dual--Track_Modular-success.svg)](#)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)

> **繁體中文**：基於 WebGL 2.0 (GLSL ES 3.00) 與原生 Web API 建構的高效能環境時鐘與螢幕保護程式。採用「多檔模組開發 (`flat`)、單檔打包發佈 (`main`)」雙軌架構，零任何第三方依賴。內建 5 種程序化流體背景 Shader、動態背景模式註冊表、雙色補色渲染、智慧效能自適應引擎、4 種字體材質、獨立手勢意圖防誤觸狀態機、即時狀態 HUD、深度閒置節能與 PWA 離線安裝支援。
>
> **English**: A zero-dependency ambient clock and screensaver built on WebGL 2.0 and vanilla Web APIs. Engineered with a dual-track workflow, featuring 5 procedural GLSL backgrounds with bi-color complementary blending, a dynamic background mode registry, an adaptive auto-resolution performance engine, live HUD badges, deep idle states, spatial positioning, multi-tier touch gesture guards, and installable PWA support.

[線上展示 (Live Demo)](https://cool-chi.github.io/ambient-aurora/)

---

## 🆕 v3.19.1 Valencia 重點更新 / What's New

相較於 v3.11.0 Valencia 初期版本，本次 v3.19.1 完成了底層圖形管線升級、動態模式架構重塑、設定系統規格化以及介面子系統深度解耦：

*   **WebGL 2.0 管線全面升級 (WebGL 2.0 Pipeline)**：
    *   底層著色器升級至 **GLSL ES 3.00**，採用 `gl_VertexID` 繪製超大三角形，實現零頂點緩衝與零屬性綁定配置（Bufferless Rendering）。
    *   雜湊運算全面改用 **1D/2D PCG 整數雜湊演算法**（Integer Hash），徹底解決邊界與長時間運作下的浮點條帶噪訊。
    *   **動態模式註冊表 (`AA.registerMode`)**：背景模式改由模組獨立宣告，並在註冊時實施 GLSL 命名契約檢查（`<id>_` 前綴、禁止全域宏污染）。
    *   **著色器錯誤精確行號映射 (`formatShaderError`)** 與離屏開發者診斷工具 (`AA.diagnoseModes()`)，可自動測量各模式的編譯耗時、繪製微秒與平均亮度。
*   **設定系統規格化 (Schema-Driven Settings & Storage v2)**：
    *   由 `js/ui-manager/schema/` 依分頁管理單一真相來源，預設值、驗證器（`validate`）與數值規格化（`normalize`）全面自動衍生。
    *   狀態持久化升級為**具版本號 JSON 包裝 (Storage Version: 2)**，過期或異常設定自動重置，防止格式崩潰。
    *   實作具備捲動防護（Scroll Guard）的可逆高度展開/收起動畫與最後可見列分隔線裁切。
*   **介面核心子系統高內聚解耦 (UI Subsystem Modularization)**：
    *   將過往龐雜的 `ui-manager.js` 拆解重構，核心協調器收斂至簡潔架構，抽離出 7 大專責子系統：
        *   `hud.js`：管理 FPS/倍率/版本徽章及 Toast 提示氣泡。
        *   `ui-chrome.js`：外殼控制項（全螢幕、低功耗切換、鍵盤快捷鍵、面板外點擊關閉）。
        *   `display-lifecycle.js`：閒置昏暗、長按 2 秒退出倒數、常亮鎖 (`WakeLock`) 與 OLED 防烙印。
        *   `ui-fx.js`：專注於文字材質變數、SVG 玻璃折射光影向量與陀螺儀追蹤。
        *   `controls-registry.js`：控制項生成策略與雙向狀態鏡射（`SYNC_BY_TYPE`）。
        *   `panel-view.js`：面板 DOM 骨架渲染與分頁導航。
        *   `gesture-manager.js`：封裝 10px 觸控意圖鎖定（`drag` vs `scroll`）、Capture 階段防誤觸攔截器與滑桿操作回滾。
*   **換行晶片格與 2D 手勢滑選 (Wrapped Segmented Controls & 2D Scrubbing)**：
    *   針對 6 項以上的分段控制項實作 **`.is-wrapped`** 網格佈局，利用最小公倍數（LCM）精確分配列寬與跨欄數（`--seg-cols`, `--seg-span`），維持等寬且無小數像素抖動。
    *   高亮膠囊支援 2D 平移與動態高度適配，並支援 **2D 手勢滑選（2D Scrubbing）**，在多列按鈕間橫向與縱向平滑過渡。

---

## 🎨 背景模式 / Background Modes

底層透過 **Multi-Weight Lerp 權重混合**，在切換背景與雙色色相漂移時，皆以幀率獨立的方式平滑過渡，並根據模式動態平衡曝光常數 (`EXP_*`)。

| 模式 | 視覺效果 | GLSL 實作方式 |
| :--- | :--- | :--- |
| **Silk (絲綢)** | 柔和起伏的流體波紋與光澤 | 多重旋轉正弦波疊加與定義域扭曲，呈現互補色交織的高光折疊 |
| **Glow (光暈)** | 螢幕邊緣流光呼吸，中央深色高對比 | 邊界距離場搭配動態雙色梯度，確保中央時鐘區域清晰易讀 |
| **Dust (星塵)** | 深空星雲與閃爍微粒 | PCG 網格微粒搭配低功耗優化的 FBM 星雲與暗角 |
| **Liquid (液態)** | 大面積慢速游移的柔和光球 | 多重發光球體距離場混合，營造無邊界的液態擴散感 |
| **Horizon (天沿)** | 地平線大氣散射與頂部微弱星光 | 指數衰減函數模擬大氣弧光，結合雙色潮汐呼吸與頂部星塵 |

*   支援**雙色混色 (Color Blend)** 開關與 **-180° ~ 180° 色相偏移**。
*   支援背景流速無段調整（`0.1×` ~ `4.0×`），並可開啟**色相緩漂**與**模式輪播**。

---

## 🔠 字體材質 / Typographic Materials

| 材質 | 實作說明 |
| :--- | :--- |
| **Classic (實色)** | 純色字體搭配雙層柔和陰影，提供最佳基礎可讀性 |
| **Hollow (鏤空)** | 透過 SVG 高斯模糊與 Alpha 通道差集萃取字形外框，描邊粗細自動縮放 |
| **Glow (高光)** | 採用 `screen` 混合模式搭配多層 `drop-shadow` 與細描邊，呈現霓虹發光 |
| **Glass (玻璃)** | 多層 SVG 濾鏡合成。光源隨滑鼠指標、裝置陀螺儀或環境漂移計算；長按畫面時產生按壓收縮回饋，並透過 `_kCache` 大幅優化 SVG 屬性快取效能 |

> 開啟「夜間護眼 (Night Mode)」時，所有材質與背景會自動轉為低亮度琥珀暖色調，並關閉玻璃的冷暖稜鏡色散。

---

## ⏱️ 跳秒動效 / Tick Animations

基於 `Web Animations API (WAAPI)` 與字元級 DOM Diff：

*   **Inst (瞬間)**：無過渡動畫，直接切換數字
*   **Depth (景深)**：舊數字縮小模糊淡出，新數字由微放大失焦狀態收斂對焦
*   **Spring (彈性)**：新數字由下方滑入並帶有微幅過衝回彈 (Overshoot)，舊數字向上淡出
*   **Flip (翻牌)**：以 3D 透視 `rotateX` 搭配亮度漸變，模擬機械翻頁鐘效果

> 當系統開啟 `prefers-reduced-motion: reduce` 時，所有跳秒動效自動簡化為純透明度淡入淡出，背景流速同步降至 0.3x。

---

## ⚙️ 系統架構與功能特性 / Architecture & Features

### 1. 模組化雙軌設計 (`window.AA`)
*   **`Store` (Storage Version: 2)**：Pub/Sub 狀態管理中樞，採用不可變快照（Copy-on-write）與鍵值訂閱（Keyed Subscription），內建防抖保存與結構校驗。
*   **`WebGLEngine`**：WebGL 2.0 渲染管線，包含動態模組化著色器組裝、EMA 效能自適應引擎、連續時間軸交疊 (Time-wrapping crossfade)，與閒置降頻機制。
*   **`ClockController`**：處理字元級 DOM Diff、`Intl.DateTimeFormat` 快取，與面板開啟時的時鐘幾何動態避讓 (`Smart Evasion`)。
*   **`UIManager` 協調器**：
    *   `schema/` & `ui-config.js`：由分頁模組自動組裝出所有設定項、預設值、驗證與 DOM 綁定。
    *   `gesture-manager.js`：10px 水平/垂直觸控意圖鎖定，滾動中即時取消並回滾控制項狀態，徹底防止手機誤觸。
    *   `display-lifecycle.js`：集中管控閒置昏暗、長按 2 秒退出倒數、常亮鎖與防烙印平移。
    *   `hud.js` & `color-picker.js`：提供獨立的膠囊徽章與彈出式 HSV 拾色器。

### 2. 環境常駐與螢幕保護機制
*   **動態效能自適應 (Auto Render Scale)**：偵測到連續掉幀過載時自動降階，效能餘裕時自動回升；短時間內頻繁震盪時自動倍增升階門檻防抖動。
*   **深度閒置 (Deep Idle)**：一般閒置 (50ms 幀距) 達 5 分鐘後，進入深度閒置 (75ms 幀距) 並進一步調暗背景亮度。
*   **OLED 防烙印 (Burn-in Protection)**：每 60 秒將主容器在 `±6px` 範圍內隨機微移。
*   **低功耗模式 (Low Power Mode)**：將 fbm 八度降至 2，鎖定渲染倍率上限並限制幀率。
*   **螢幕常亮與背景暫停**：透過 `navigator.wakeLock` 防止休眠；分頁隱藏時自動暫停 WebGL 節省電力。

---

## 🕹️ 操作一覽 / Controls

| 功能 | 操作方式 |
| :--- | :--- |
| **開啟 / 關閉設定面板** | 點擊左下角齒輪按鈕，或點擊面板外部空白區域 |
| **分段控制與晶片滑選** | 支援**按住滑動選取 (1D/2D Scrubbing)**；超過 6 項自動轉為換行晶片格佈局 |
| **自訂背景與文字顏色** | 點擊背景主題最右側「＋」或字體色彩標籤，呼出 HSV 拾色器 |
| **快速重設位置偏移** | 於設定面板中**長按九宮格任一錨點 0.5 秒** |
| **狀態 HUD 切換** | 系統分頁內可開關 **FPS 顯示**、**倍率顯示**與**拉條數值** |
| **全螢幕切換** | 點擊右下角全螢幕按鈕（全螢幕下自動隱藏按鈕） |
| **安全退出應用程式** | **長按空白鍵 (`Space`) 2 秒** 或 **長按畫面空白處 2 秒**（放開即取消） |

---

## 🚀 快速開始與建置 / Getting Started & Build

本專案無需安裝 Node.js 或任何第三方套件。

### 直接執行 (`main` 分支)
```bash
git clone https://github.com/Cool-Chi/ambient-aurora.git
cd ambient-aurora
```

直接以瀏覽器開啟 `index.html`，或使用任意本地伺服器（如 VS Code Live Server、`python -m http.server 8080`）執行以啟用 PWA 與 Wake Lock 功能。

### 模組化開發與單檔打包 (`flat` 分支)

日常開發於 `flat` 分支進行，發佈前透過根目錄之 Python 腳本將 CSS 與 `js/` 下的模組內聯合併為單一 HTML：

```bash
git checkout flat
python build_single.py
```

輸出之單一 HTML 檔案位於 `dist/index_vX.Y.Z.html`，驗收完成後發佈至 `main` 分支的 `index.html`。

---

## 授權

MIT License，詳見 [LICENSE](LICENSE)。
