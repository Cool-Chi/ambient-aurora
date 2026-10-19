# Ambient Aurora - v2.14 Burgos(布爾戈斯)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-brightgreen.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Single--File_Modular-success.svg)](#)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg)](#)
[![Design Engineering](https://img.shields.io/badge/Craft-Emil%20Kowalski-8E75FF.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)

> **繁體中文**：一款汲取 **Apple Fluid Interface** 哲學與 **Emil Kowalski 設計工程動效原則** 的頂級環境時鐘與螢幕保護程式。v2.14 Burgos 以純 HTML 單檔實現「四大模組解耦 (Store, WebGLEngine, ClockController, UIManager)」，結合 5 種環境 Shader、4 種字體材質（含具備陀螺儀 / 指標光源的 Liquid Glass 玻璃材質）、4 種跳秒動效、3×3 空間定位、橫直佈局、自訂文字與多色字體、OLED 防烙印、PWA 安裝、螢幕常亮與硬體級觸覺回饋，實現極致的 OS 級沉浸美學。
>
> **English**: An Apple-inspired ambient web timepiece engineered with **Emil Kowalski's interaction & motion principles**. The v2.14 Burgos release keeps a single-file modular architecture (Store, WebGLEngine, ClockController, UIManager) and adds four typographic materials (including a gyroscope / pointer-lit Liquid Glass), a 3×3 spatial anchor grid with offsets, custom text, per-element colors, installable PWA support, Screen Wake Lock, OLED pixel-shift and throttled haptics — all with zero external dependencies.

[體驗線上展示 (Live Demo)](https://cool-chi.github.io/ambient-aurora/)

---

## 🆕 v2.14 Burgos 更新摘要 / What's New

*   **字體材質系統 (Material)**：新增 `Classic 實色`、`Hollow 鏤空`、`Glow 高光`、`Glass 玻璃` 四種材質，切換時伴隨失焦淡入淡出過渡。
*   **Liquid Glass 玻璃材質**：以 SVG `feComposite` 濾鏡組合出斜面、焦散、細緣高光與冷暖稜鏡色散；光源角度隨指標位置、陀螺儀（iOS 需授權）或緩慢環境漂移即時變化，長按畫面時玻璃產生「按壓收縮」回饋。
*   **空間定位 (Position)**：3×3 錨點格 + X / Y 軸偏移滑桿；**長按錨點 0.5 秒**可重設偏移並跳到該錨點，位置切換採 FLIP 動畫與動態模糊。
*   **字體與色彩**：3 種字體風格（SF Pro / New York / Mono）；時鐘、AM/PM、日期、自訂文字可**分別設定顏色**；新增整體透明度滑桿。
*   **自訂文字 (Custom Text)**：可顯示最多 30 字的自訂文字，並與日期共同切換「上方 / 下方」位置。
*   **日期格式化**：可獨立開關 年 / 月 / 日 / 週，中英文自動套用對應格式。
*   **時間顯示選項**：新增 24 小時制、補零顯示、顯示秒數的獨立開關。
*   **設定面板重構**：改為「時鐘 / 背景 / 系統」三分頁；開關支援**左右滑動手勢**；面板開啟時時鐘自動避讓（行動版自動上移或縮放）。
*   **PWA 與常亮**：自動產生 App 圖示、Manifest 與 Service Worker，可加入主畫面全螢幕執行；使用 Screen Wake Lock 防止螢幕休眠。
*   **渲染強化**：WebGL 無法使用時自動降級為漸層背景；背景加入微量抖動噪點（Dithering）避免色帶；長時間運行時以淡出 / 淡入重置時間軸，避免浮點精度劣化。
*   **無障礙**：尊重 `prefers-reduced-motion` 與 `prefers-reduced-transparency`。

---

## 🎨 視覺模式 / Visual Modes

底層搭載 **N-way Lerp 權重混合引擎 (Multi-Weight Blending)**，在多種模式與顏色間切換時，達成幀率獨立（Framerate-Independent）的光學級平滑過渡。

| 模式名稱 | 特徵描述 (Visual Features) | 幾何與光學原理 |
| :--- | :--- | :--- |
| **Silk (絲綢)** | 經典的物理高光與寬廣起伏 | 捨棄噪聲，使用多重旋轉正弦波疊加與定義域扭曲，模擬真實絲綢在空間中柔順折疊。 |
| **Glow (光暈)** | 邊界流光呼吸，高對比度易讀 | 致敬 Apple Intelligence，邊界流光呼吸，中央維持深邃以保證時鐘對比。 |
| **Dust (星塵)** | 深空星雲、微粒閃爍 | 基於 Procedural Hash 網格演算法的閃爍微粒，搭配 FBM 星雲與暗角。 |
| **Liquid (液態)** | 柔和交融、液態光暈擴散 | 致敬 Apple Music 動態光暈。依賴慢速游移的發光圓球與距離場營造無邊界液態感。 |
| **Horizon (天沿)** | 沉浸式地平線、微弱星塵 | 靈感來自 visionOS 空間環境。利用指數衰減函數模擬大氣邊界散射，配合慢速潮汐呼吸與頂部星光。 |

內建 **6 組主題色票**（Midnight Purple、Aurora Green、Deep Ocean、Sunset Orange、Crimson Velvet、Cyber Cyan）與**自訂顏色選擇器**；可調整背景流速（0.1× ~ 4×）。

---

## 🔠 字體材質 / Typographic Materials

| 材質 | 說明 |
| :--- | :--- |
| **Classic (實色)** | 純色字體搭配柔和投影，保留最高可讀性。 |
| **Hollow (鏤空)** | 以高斯模糊 + 透明度閾值濾鏡萃取字形輪廓環，描邊粗細隨字級自適應。 |
| **Glow (高光)** | `screen` 混合模式搭配多層 `drop-shadow` 與細描邊，呈現霓虹光暈。 |
| **Glass (玻璃)** | 多層 SVG 濾鏡合成：斜面、焦散、細緣高光、冷暖稜鏡；光源隨指標 / 陀螺儀 / 環境漂移，長按時產生壓縮回饋。 |

夜間護眼開啟時，所有材質自動轉為暖橘色調（並關閉稜鏡色散）。

---

## ⏱️ 物理級時鐘動態 / Kinetic Clock Animations

透過 `WAAPI (Web Animations API)` 與字元級 DOM Diff（僅更新變動的數字），打造 4 種跳秒微交互：

*   **Inst (瞬間)**：零延遲跳動，回歸最純淨的電子錶顯示。
*   **Depth (景深)**：visionOS 風格的光學失焦。舊數字縮小並虛化，新數字由微放大的失焦狀態凝結對焦。
*   **Spring (彈性)**：新數字由下方湧入，輕微過衝後柔和回彈（Overshoot & Settle），舊數字向上淡出。
*   **Flip (翻牌)**：3D 機械翻牌鐘。以 `rotateX` 搭配亮度與模糊漸變，模擬頂底軸心折疊。

材質為 Hollow / Glass 時，動畫的 `filter` 會自動串接對應材質濾鏡，避免切換瞬間閃爍。

---

## ⚙️ 核心系統亮點 / Core Highlights

### 1. 單檔模組化架構 (Single-File Modularization)
封裝於 IIFE 之內，達成「零全域變數污染」。四權分立：
*   `Store`：響應式狀態中樞 (Pub/Sub)、Copy-on-write 不可變狀態、LocalStorage 持久化（300ms 防抖寫入，頁面隱藏時立即 flush）與逐欄位 Schema 校驗；暫態欄位（閒置 / 長按 / 面板開啟）不寫入儲存。
*   `WebGLEngine`：幀率獨立的圖形黑盒；具備 Context Lost / Restored 自動救援、2.5MP 像素預算保護、無 WebGL 時的漸層降級，以及時間軸迴圈淡出重置。
*   `ClockController`：負責時間計算、DOM Diff、日期格式化（`Intl.DateTimeFormat` 快取）與面板動態避讓（`ResizeObserver`）。
*   `UIManager`：事件路由、設定面板渲染（中英雙語字典）、視覺變數套用、玻璃光源迴圈、Wake Lock 與退出流程。

### 2. 空間排佈與字體排印 (Spatial Typography & Layout)
*   **橫向 / 直列佈局**：直列模式將秒數與 AM/PM 縮為附標並錨定於分鐘右側；切換時伴隨「失焦模糊 (Blur Fade-Through)」過渡。
*   **3×3 錨點與偏移**：九宮格定位加上 ±50% 的 X / Y 偏移，錨點切換以 FLIP 技法產生連續位移動畫。
*   **幾何智慧避讓 (Dynamic Evasion)**：設定面板開啟時，時鐘即時計算碰撞並向右 / 上方退讓，空間不足時微縮（最小 0.35×）。
*   **彈性顯示**：各時鐘模組（補零、秒數、AM/PM、日期、自訂文字）以寬度 / 透明度 / 縮放過渡平滑顯示與隱藏。

### 3. 設計工程與觸覺哲學 (Haptics & Micro-interactions)
*   **四層級觸覺回饋 (Haptic Hierarchy)**：滑桿拖曳具 40ms 冷卻節流，於支援的設備上帶來實體機械感：
    *   *微觸感 (5ms)*：無極滑桿拖曳。
    *   *輕觸感 (10ms)*：開關、分頁、色票、分段控制切換。
    *   *中觸感 (15ms / 20ms)*：主按鈕點擊與滑桿撞擊邊界。
    *   *重觸序列*：長按退出成功 `[30, 50, 30]`、錨點長按重設 `[30, 50]`。
*   **非對稱時序退出 (Hold-to-Confirm)**：長按 2 秒退出，期間畫面緩慢放大並提亮；中途放開則即刻回彈，並具備關閉失敗時的自動救援機制。
*   **開關手勢**：Toggle 可點擊，亦可橫向拖曳切換。

### 4. 環境常駐防護 (Ambient Safeguards)
專為長時間掛機作為桌面時鐘而設計：
*   **Burn-in Protection (OLED 防烙印)**：預設開啟，每 60 秒將整個畫面隨機微移 ±6px。
*   **Night Mode (夜間護眼)**：背景壓為微弱琥珀色，時鐘與文字轉為暖橘光。
*   **Low Power Mode**：右上角電池按鈕，開啟時將渲染解析度降至 0.75× DPR 並限制約 24fps，附 HUD 提示。
*   **Idle Timeout**：3 秒 / 10 秒 / 永不；閒置時隱藏 UI、時鐘微縮淡化、背景降至 20fps 並降低亮度。
*   **Screen Wake Lock**：執行期間防止螢幕休眠，頁面隱藏時自動釋放、回到前景時重新取得。
*   **可見性管理**：分頁隱藏時暫停 WebGL、時鐘與玻璃迴圈，回到前景再恢復。

### 5. PWA 支援 (Installable)
無需任何外部檔案：App 圖示、Web App Manifest 與 Service Worker 皆於執行期自動產生，可「加入主畫面」並以全螢幕 Standalone 模式（`black-translucent` 狀態列）執行。

---

## 🕹️ 互動指南 / Controls

| 操作 (Action) | 觸發方式 (Trigger) |
| :--- | :--- |
| **呼出 / 關閉設置** | 點擊左下角齒輪按鈕；點擊面板外空白處即可關閉 |
| **切換分頁** | 面板頂部「時鐘 / 背景 / 系統」 |
| **自訂背景顏色** | 點擊「色彩主題」最右側的「＋」色環 |
| **自訂字體顏色** | 點擊「字體色彩」中的 時鐘 / AM / 日期 / 文字 色塊 |
| **調整位置** | 點選九宮格錨點；使用 X / Y 滑桿微調；**長按錨點 0.5 秒**可重設偏移 |
| **低功耗模式** | 點擊右上角電池圖示（顯示 HUD） |
| **切換全螢幕** | 點擊右下角按鈕 |
| **安全退出 / 關閉** | **長按 `Space`（空白鍵）2 秒** 或 **長按畫面空白處 2 秒** |
| **中斷退出** | 放開空白鍵或手指（即刻回彈與觸覺提示） |
| **玻璃材質互動** | 移動指標或傾斜裝置改變光源；長按畫面產生按壓效果 |
| **多國語言 (i18n)** | 「系統」分頁即時切換 EN / 中 |

> 全螢幕狀態下，設定與功能按鈕會自動隱藏，並顯示底部退出提示。

---

## 🛠️ 技術棧 / Tech Stack

本專案為 **「零依賴 (Zero Dependencies)」** 的純 HTML / CSS / JS 單檔應用程式。
*   **Graphics Core**：Raw WebGL 1.0（N-way Lerp Blending、GLSL Shaders、Procedural Noise / FBM、Dithering）。
*   **Typography FX**：SVG Filter Primitives（`feGaussianBlur` / `feComposite` / `feOffset` / `feFlood`）構成 Hollow 與 Glass 材質。
*   **Architecture**：ES6 Classes、Pub/Sub Pattern、Copy-on-write State、ResizeObserver。
*   **Platform APIs**：Web Animations API (WAAPI)、`navigator.vibrate`、Screen Wake Lock、Device Orientation、Fullscreen、Service Worker / Web App Manifest。
*   **Minification**：精簡壓縮為單一 HTML 檔案。

---

## 🚀 快速開始 / Getting Started

無需安裝 Node.js，亦無需任何打包工具。

1. Clone 儲存庫：
   ```bash
   git clone https://github.com/Cool-Chi/ambient-aurora.git
   cd ambient-aurora
   ```
2. 直接雙擊打開 `index.html` 即可在現代瀏覽器中流暢運行。
3. （選用）以 HTTPS 或 `localhost` 提供服務，即可啟用 PWA 安裝、Wake Lock 等安全情境功能。
