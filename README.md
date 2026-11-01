# Ambient Aurora — v3.3.0 Barcelona (巴塞隆納)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-brightgreen.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Dual--Track_Modular-success.svg)](#)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)

> **繁體中文**：基於 WebGL 1.0 與原生 Web API 建構的環境時鐘與螢幕保護程式。採用「多檔模組開發 (`flat`)、單檔打包發佈 (`main`)」的雙軌架構，無任何外部依賴。內建 5 種流體與粒子背景 Shader、4 種字體材質（含支援陀螺儀與指標光影互動的玻璃材質）、4 種跳秒動效、自訂 HSV 拾色器、3×3 空間錨點定位、OLED 防烙印與 PWA 離線安裝支援。
>
> **English**: A zero-dependency WebGL ambient clock and screensaver built with vanilla HTML, CSS, and JavaScript. Engineered with a dual-track workflow (modular multi-file development on `flat`, single-file production bundle on `main`), featuring 5 procedural GLSL backgrounds, 4 typographic materials (including gyroscope and pointer-reactive Glass), 4 tick animations, a custom HSV color picker popover, spatial anchor positioning, OLED burn-in protection, and installable PWA support.

[線上展示 (Live Demo)](https://cool-chi.github.io/ambient-aurora/)

---

## 🆕 v3.3.0 Barcelona 重點更新 / What's New

*   **自訂 HSV 拾色器 (Color Picker Popover)**：攔截原有的系統原生選色器，改為內建的毛玻璃彈出式拾色器。提供 2D 飽和度/明度畫布、色相滑桿、Hex 色碼輸入與 8 組預設色票，具備視窗邊界智慧防溢出（Smart Clamping）與完整方向鍵無障礙操作。
*   **分段控制項滑動切換 (Segmented Control Scrubbing)**：所有分段控制項（字體、材質、跳秒動效、背景模式、語言等）皆支援滑鼠按住拖曳與觸控橫向滑動切換；切換語言導致 DOM 重新渲染時可自動重新綁定目標，並防止拖曳結束時誤觸點擊事件。
*   **玻璃材質 (Glass FX) 效能與光學重構**：
    *   將 SVG `#glass-fx` 濾鏡作用範圍收斂至 `x="-4%" y="-8%" width="108%" height="116%"`，並把濾鏡掛載點由個別數字提升至 `#clock` 容器層級，大幅降低合成開銷。
    *   SVG 遮罩運算改用 `feComposite` 的 `arithmetic` 模式，並加入 `_kCache` 屬性快取與動態更新頻率節流（互動時 36ms、一般 110ms、閒置/低功耗 240ms）。
*   **UI 排版與防抖修正**：
    *   修正窄螢幕與多語系下設定列標籤被截斷或與色票按鈕重疊的問題，色票容器支援彈性縮放。
    *   長按空白處退出的中斷判定改為 **10px 歐幾里得距離閾值**（`Math.hypot`），消除手指微幅抖動導致退出中斷的問題。
    *   字體、材質與橫直佈局切換動畫移除高 GPU 負擔的動態 `blur()`，改為純 `opacity` 與 `scale` 過渡。
*   **雙軌模組化架構 (`window.AA`)**：將程式碼細分為 `store`、`shaders`、`webgl-engine`、`animations`、`clock-controller`、`locales`、`ui-config`、`color-picker`、`ui-fx`、`ui-manager` 與 `main` 共 11 個模組，透過建置腳本無縫合併為生產環境的單一 `index.html`。

---

## 🎨 背景模式 / Background Modes

底層透過 **Multi-Weight Lerp 權重混合**，在不同背景模式與色票之間切換時，皆以幀率獨立（Framerate-Independent）的方式平滑過渡。

| 模式 | 視覺效果 | GLSL 實作方式 |
| :--- | :--- | :--- |
| **Silk (絲綢)** | 柔和起伏的流體波紋與光澤 | 多重旋轉正弦波疊加與定義域扭曲（Domain Warping），不使用隨機噪聲。 |
| **Glow (光暈)** | 螢幕邊緣流光呼吸，中央維持深色高對比 | 邊界距離場搭配動態色相偏移，確保中央時鐘區域清晰易讀。 |
| **Dust (星塵)** | 深空星雲與閃爍微粒 | Procedural Hash 網格粒子搭配 FBM（分形布朗運動）星雲與暗角。 |
| **Liquid (液態)** | 大面積慢速游移的柔和光球 | 多重發光球體距離場混合，營造無邊界的液態擴散感。 |
| **Horizon (天沿)** | 地平線大氣散射與頂部微弱星光 | 指數衰減函數模擬大氣弧光，結合慢速潮汐呼吸與頂部星塵。 |

*   內建 **6 組預設色票**（Midnight Purple、Aurora Green、Deep Ocean、Sunset Orange、Crimson Velvet、Cyber Cyan）與自訂背景顏色。
*   支援背景流速無段調整（`0.1×` ~ `4.0×`）。

---

## 🔠 字體材質 / Typographic Materials

| 材質 | 實作說明 |
| :--- | :--- |
| **Classic (實色)** | 純色字體搭配雙層柔和陰影，提供最佳基礎可讀性。 |
| **Hollow (鏤空)** | 透過 SVG 高斯模糊與 Alpha 通道差集萃取字形外框，描邊粗細隨字體大小自動縮放。 |
| **Glow (高光)** | 採用 `screen` 混合模式搭配多層 `drop-shadow` 與細描邊，呈現霓虹發光效果。 |
| **Glass (玻璃)** | 多層 SVG 濾鏡合成（斜面、焦散、邊緣高光與冷暖稜鏡色散）。光源方向隨滑鼠指標、裝置陀螺儀（iOS 支援授權請求）或環境自動漂移即時計算；長按畫面時產生玻璃按壓收縮回饋。 |

> 開啟「夜間護眼 (Night Mode)」時，所有材質與背景會自動轉為低亮度琥珀暖色調，並關閉玻璃材質的冷暖稜鏡色散。

---

## ⏱️ 跳秒動效 / Tick Animations

基於 `Web Animations API (WAAPI)` 與字元級 DOM Diff（僅對數值改變的位數執行補間動畫）：

*   **Inst (瞬間)**：無過渡動畫，直接切換數字。
*   **Depth (景深)**：舊數字縮小模糊淡出，新數字由微放大失焦狀態收斂對焦。
*   **Spring (彈性)**：新數字由下方滑入並帶有微幅過衝回彈（Overshoot），舊數字向上淡出。
*   **Flip (翻牌)**：以 3D 透視 `rotateX` 搭配亮度漸變，模擬機械翻頁鐘效果。

> 當系統開啟 `prefers-reduced-motion: reduce`（減少動態效果）時，所有跳秒動效會自動簡化為 150ms 的純透明度淡入淡出。

---

## ⚙️ 系統架構與功能特性 / Architecture & Features

### 1. 模組化雙軌設計 (`window.AA`)
*   **`Store` (`js/store/`)**：Pub/Sub 狀態管理中樞。採用 Copy-on-write 確保狀態不可變性，內建 LocalStorage 300ms 防抖寫入（頁面隱藏時立即 flush）與欄位型別校驗；暫態屬性（`isIdle`, `isHolding`, `isPanelOpen`）不寫入本地端。
*   **`WebGLEngine` (`js/webgl-engine/`)**：管理 GLSL 編譯、Uniform 更新與渲染迴圈。具備 2.5MP 最大像素預算限制、WebGL Context Lost/Restored 自動恢復、無 WebGL 環境漸層降級，以及長時間運行防止浮點數精度劣化的時間軸淡出重置機制。
*   **`ClockController` (`js/clock-controller/`)**：處理時間計算、字元級 DOM Diff、`Intl.DateTimeFormat` 快取，以及透過 `ResizeObserver` 計算設定面板開啟時的時鐘幾何避讓（Dynamic Evasion）。
*   **`UIManager` & `UI_FX` (`js/ui-manager/`)**：負責三分頁設定面板渲染、中英雙語字典、自訂 HSV 拾色器、玻璃光影向量計算、Screen Wake Lock 與長按退出流程。

### 2. 空間定位與版面配置
*   **橫向 / 直列佈局**：直列模式下，秒數與 AM/PM 自動轉為附標並對齊分鐘右側。
*   **3×3 空間錨點 + X/Y 偏移**：提供九宮格快速定位與 `±50%` 的 X/Y 軸微調滑桿；切換錨點時採用 FLIP 動畫平滑移動。**長按任一錨點 0.5 秒**即可將 X/Y 偏移歸零。
*   **面板智慧避讓**：開啟設定面板時，若面板與時鐘重疊，時鐘會自動計算碰撞距離並向右或向上退讓；小螢幕空間不足時自動微幅縮小。
*   **獨立色彩與格式控制**：時鐘本體、AM/PM、日期與自訂文字（最多 30 字）皆可獨立設定顏色；日期支援「年 / 月 / 日 / 週」多選開關與上/下方位置切換。

### 3. 環境常駐與螢幕保護機制
*   **OLED 防烙印 (Burn-in Protection)**：預設開啟，每 60 秒將主容器在 `±6px` 範圍內隨機微移。
*   **低功耗模式 (Low Power Mode)**：點擊右上角電池按鈕開啟，將 WebGL 渲染解析度降至 `0.75× DPR` 並將幀率上限鎖定於約 24fps。
*   **閒置自動隱藏 (Idle Timeout)**：支援 3 秒 / 10 秒 / 永不。進入閒置時自動隱藏所有 UI 按鈕、關閉面板與拾色器、降低時鐘透明度並將背景幀率降至 20fps。
*   **螢幕常亮與背景暫停**：透過 `navigator.wakeLock` 防止裝置休眠；當瀏覽器分頁切換至背景時，自動暫停 WebGL 與玻璃光影計算以節省電力。
*   **動態 генерирован PWA**：於執行期動態生成 512×512 Canvas 圖示、Manifest 與 Service Worker，支援加入手機或桌面主畫面以全螢幕獨立視窗執行。

---

## 🕹️ 操作一覽 / Controls

| 功能 | 操作方式 |
| :--- | :--- |
| **開啟 / 關閉設定面板** | 點擊左下角齒輪按鈕，或點擊面板外部空白區域關閉 |
| **分段控制與開關** | 支援直接點擊，或**按住直接左右滑動 (Scrubbing)** 切換選項 |
| **自訂背景與文字顏色** | 點擊背景主題最右側「＋」或字體色彩標籤，呼出 HSV 拾色器 |
| **快速重設位置偏移** | 於設定面板中**長按九宮格任一錨點 0.5 秒** |
| **低功耗模式切換** | 點擊右上角電池按鈕（頂部顯示 HUD 狀態提示） |
| **全螢幕切換** | 點擊右下角全螢幕按鈕（全螢幕下自動隱藏按鈕） |
| **安全退出應用程式** | **長按空白鍵 (`Space`) 2 秒** 或 **長按畫面空白處 2 秒**（放開即取消並回彈） |

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
