# Ambient Aurora — v3.11.0 Valencia (瓦倫西亞)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-brightgreen.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Dual--Track_Modular-success.svg)](#)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)

> **繁體中文**：基於 WebGL 1.0 與原生 Web API 建構的環境時鐘與螢幕保護程式。採用「多檔模組開發 (`flat`)、單檔打包發佈 (`main`)」的雙軌架構，無任何外部依賴。內建 5 種流體背景 Shader、雙色補色渲染、動態效能自適應引擎、4 種字體材質、即時狀態 HUD、深度閒置節能與 PWA 離線安裝支援。
>
> **English**: A zero-dependency WebGL ambient clock and screensaver built with vanilla HTML, CSS, and JavaScript. Engineered with a dual-track workflow, featuring 5 procedural GLSL backgrounds with bi-color complementary blending, an adaptive auto-resolution performance engine, live HUD badges, deep idle states, spatial positioning, and installable PWA support.

[線上展示 (Live Demo)](https://cool-chi.github.io/ambient-aurora/)

---

## 🆕 v3.11.0 Valencia 重點更新 / What's New

相較於 v3.3.0 Barcelona，本次 Valencia 帶來涵蓋光學渲染、效能自適應與介面互動的全面升級：

*   **雙色混色與動態色彩 (Bi-color & Dynamics)**：
    *   底層 Shader 全面重構，引入雙色互補混色 (`mix(u_color, u_color2)`)，告別單色輸出
    *   新增**色相偏移滑桿 (Hue Shift)**，並支援 **40 分鐘週期色相緩漂 (Continuous Hue Drift)**
    *   新增**背景模式自動輪播 (Mode Cycling)**（支援 5分 / 15分 / 1小時 間隔）
*   **效能自適應引擎 (Adaptive Performance Engine)**：
    *   新增 **Auto 渲染倍率** (Render Scale)，透過 EMA (指數移動平均) 幀時間分析，在 0.25x 至 1.0x 間動態升降階，過載時自動降頻、穩定時自動恢復
    *   針對低功耗模式於初始化時動態注入 `#define LOW_POWER`，編譯專屬的輕量級 GLSL 變體
    *   引入**深度閒置 (Deep Idle)**：閒置 5 分鐘後，幀距進一步降至 75ms 並將背景亮度壓至 0.45x
*   **即時 HUD 與介面強化 (HUD & UI)**：
    *   新增對齊真實 WebGL Render Loop 的 **FPS 幀率徽章**與**動態倍率徽章** (毛玻璃膠囊設計)
    *   範圍滑桿 (Range Slider) 拖曳時新增**即時數值氣泡提示 (Slider Bubbles)**
    *   新增獨立的**背景亮度**與全域**邊緣暗角 (Vignette)** 調整滑桿
*   **底層光學與時間軸優化 (Core Engine Polish)**：
    *   實作 3600 秒連續時間軸交疊循環 (Time-wrapping crossfade)，根絕長時間運作的 WebGL Float32 精度抖動
    *   支援系統 `prefers-reduced-motion`，啟用時背景流速自動乘載 `0.3x` 降速，並關閉不必要的動畫
    *   針對面板開啟狀態動態限制 WebGL 幀率上限 (約 24~30fps) 以保障 UI 流暢度

---

## 🎨 背景模式 / Background Modes

底層透過 **Multi-Weight Lerp 權重混合**，在切換背景與雙色色相漂移時，皆以幀率獨立的方式平滑過渡，並根據模式動態平衡曝光常數 (`EXP_SILK` 等)。

| 模式 | 視覺效果 | GLSL 實作方式 |
| :--- | :--- | :--- |
| **Silk (絲綢)** | 柔和起伏的流體波紋與光澤 | 多重旋轉正弦波疊加與定義域扭曲，呈現互補色交織的高光折疊 |
| **Glow (光暈)** | 螢幕邊緣流光呼吸，中央深色高對比 | 邊界距離場搭配動態雙色梯度，確保中央時鐘區域清晰易讀 |
| **Dust (星塵)** | 深空星雲與閃爍微粒 | Procedural Hash 網格粒子搭配低功耗優化的 FBM 星雲與暗角 |
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
*   **`Store`**：Pub/Sub 狀態管理中樞，採用 Copy-on-write 確保狀態不可變性，內建 LocalStorage 防抖寫入
*   **`WebGLEngine`**：包含動態 GLSL 編譯、EMA 效能自適應引擎、連續時間軸交疊 (Time-wrapping crossfade)，與閒置降頻機制
*   **`ClockController`**：處理字元級 DOM Diff、`Intl.DateTimeFormat` 快取，與面板開啟時的時鐘幾何避讓
*   **`UIManager`**：負責設定面板、HSV 拾色器、玻璃光影向量計算、動態滑桿氣泡與即時 HUD 狀態徽章

### 2. 環境常駐與螢幕保護機制
*   **動態效能自適應 (Auto Render Scale)**：偵測到掉幀過載 (連續 2 秒) 時自動降低解析度，效能餘裕 (連續 10 秒) 時自動恢復
*   **深度閒置 (Deep Idle)**：一般閒置 (50ms 幀距) 達 5 分鐘後，進入深度閒置 (75ms 幀距) 並進一步調暗背景亮度
*   **OLED 防烙印 (Burn-in Protection)**：每 60 秒將主容器在 `±6px` 範圍內隨機微移
*   **低功耗模式 (Low Power Mode)**：編譯低耗能 Shader 變體，將渲染解析度鎖定降級，並嚴格限制幀率
*   **螢幕常亮與背景暫停**：透過 `navigator.wakeLock` 防止裝置休眠；分頁隱藏時自動暫停 WebGL 節省電力

---

## 🕹️ 操作一覽 / Controls

| 功能 | 操作方式 |
| :--- | :--- |
| **開啟 / 關閉設定面板** | 點擊左下角齒輪按鈕，或點擊面板外部空白區域 |
| **分段控制與滑桿** | 分段按鈕支援**按住左右滑動 (Scrubbing)**；滑桿支援**即時數值氣泡顯示** |
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
git clone [https://github.com/Cool-Chi/ambient-aurora.git](https://github.com/Cool-Chi/ambient-aurora.git)
cd ambient-aurora

```

直接以瀏覽器開啟 `index.html`，或使用任意本地伺服器（如 VS Code Live Server、`python -m http.server`）執行以啟用 PWA 與 Wake Lock 功能。

### 模組化開發與單檔打包 (`flat` 分支)

日常開發於 `flat` 分支進行，發佈前透過 Python 腳本依序將 CSS 與 `js/` 下的模組內聯合併為單一 `index.html`：

```bash
git checkout flat
python dist/build_single.py
```
