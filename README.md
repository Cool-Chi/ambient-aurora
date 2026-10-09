# Ambient Aurora - v2.1.6 Sevilla(塞維利亞)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-brightgreen.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Single--File_Modular-success.svg)](#)
[![Design Engineering](https://img.shields.io/badge/Craft-Emil%20Kowalski-8E75FF.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)

> **繁體中文**：一款汲取 **Apple Fluid Interface** 哲學與 **Emil Kowalski 設計工程動效原則** 的環境時鐘與螢幕保護程式。以純 HTML 單檔實現了徹底的「四大模組解耦 (State, WebGL, Clock, UI)」。結合 5 種環境 Shader、4 種物理微交互、OLED 防烙印、硬體級觸覺回饋 (Haptic Feedback) 與無縫多國語言，實現極致的 OS 級別沉浸美學。
>
> **English**: An Apple-inspired ambient web timepiece engineered with **Emil Kowalski's interaction & motion principles**. Features an epic single-file modular architecture decoupling State, WebGL, Clock, and UI. Powered by 5 ambient shaders, 4 physical kinetic animations, OLED pixel-shift, hardware Haptic Feedback, and zero external dependencies for a true OS-level experience.

[體驗線上展示 (Live Demo)](https://cool-chi.github.io/ambient-aurora/)

---

## 🎨 視覺模式 / Visual Modes

底層搭載 **N-way Lerp 權重混合引擎 (Multi-Weight Blending)**，確保在多種模式間無縫切換時，達成幀率獨立（Framerate-Independent）的光學級平滑過渡。

| 模式名稱 | 特徵描述 (Visual Features) | 幾何與光學原理 |
| :--- | :--- | :--- |
| **Silk (絲綢)** | 經典的物理高光與寬廣起伏 | 捨棄噪聲，使用多重旋轉正弦波疊加與定義域扭曲，模擬真實絲綢在空間中柔順折疊。 |
| **Glow (光暈)** | 邊界流光呼吸，高對比度易讀 | 致敬 Apple Intelligence，邊界流光呼吸，中央維持深邃以保證時鐘對比。 |
| **Dust (星塵)** | 深空星雲、微粒向外漂浮 | 基於 Procedural Hash 網格演算法的閃爍微粒，搭配深空星雲暗角。 |
| **Liquid (液態)** | 柔和交融、液態光暈擴散 | 致敬 Apple Music 動態光暈。依賴慢速游移的發光高斯圓球與距離場 (SDF) 營造無邊界液態感。 |
| **Horizon (天沿)** | 沉浸式地平線、微弱星塵 | 靈感來自 visionOS 空間環境。利用指數衰減函數模擬大氣邊界散射，配合慢速潮汐呼吸與頂部星光。 |

---

## ⏱️ 物理級時鐘動態 / Kinetic Clock Animations

透過 `WAAPI (Web Animations API)` 與字元級的 DOM Pool 回收機制（Garbage Collection），打造出 4 種不同物理法則的極致時間切換微交互：

*   **Inst (瞬間)**：零延遲跳動，回歸最純淨的電子錶顯示。
*   **Depth (景深)**：visionOS 風格的光學失焦。舊數字向深處散焦虛化 `blur(8px)`，新數字從前景微放大失焦狀態迅速凝結對焦，帶來空靈感。
*   **Spring (彈性)**：iOS 招牌物理阻尼。新數字從下方湧入，伴隨精密的 `cubic-bezier(0.34, 1.56, 0.64, 1)` 實現「過衝後柔和回彈 (Overshoot & Settle)」。
*   **Flip (翻牌)**：現代感 3D 機械翻牌鐘。捨棄笨重實體陰影，純靠 `brightness` 亮度漸變與 `rotateX` 模擬 3D 空間光線折射，以頂底軸心折疊。

---

## ⚙️ 核心系統亮點 / Core Highlights

### 1. 單檔模組化架構 (Single-File Modularization)
徹底告別腳本編程，將專案封裝入 IIFE，達成「零全域變數污染」。實作嚴格的四權分立：
*   `Store`：響應式狀態中樞 (Pub/Sub)，具備 LocalStorage 持久化與暫態保護驗證。
*   `WebGLEngine`：純粹的圖形黑盒，幀率獨立運作 (支援 120Hz/144Hz)，具備 Context Lost 救援與像素預算 (Pixel Budget) 保護。
*   `ClockController`：負責時間計算、DOM Diffing 與動態幾何避讓。
*   `UIManager`：純粹的事件路由與介面渲染 (One-way Data Flow)。

### 2. 設計工程與互動哲學 (Design Engineering Principles)
*   **四層級觸覺回饋 (Haptic Hierarchy)**：基於漸進式增強原則 (Progressive Enhancement) 結合 `navigator.vibrate`，在支援的設備（如 Android）上帶來實體機械感：
    *   *微觸感 (Micro Tick - 5ms)*：滑桿拖曳時的微小齒輪感。
    *   *輕觸感 (Light Tap - 10ms)*：開關切換、色票點擊的清脆確認。
    *   *中觸感 (Medium Tap - 15ms/20ms)*：主按鈕點擊與滑桿撞擊邊界的物理阻尼。
    *   *重觸序列 (Heavy Sequence)*：長按解鎖成功的明確物理宣告 `[30ms, 50ms, 30ms]`。
*   **幾何智慧避讓 (Dynamic Evasion)**：時鐘能即時感知右側設定面板的啟閉與螢幕寬度，如同具備實體般進行精確的退讓與微縮。
*   **非對稱時序退出 (Asymmetric Hold-to-Confirm)**：長按 2 秒退出具備防卡死救援機制；中途鬆開則即刻以 `200ms ease-out` 敏捷回彈。

### 3. 環境常駐防護 (Ambient Safeguards)
專為長時間掛機作為桌面時鐘而設計的系統級保護：
*   **Burn-in Protection (OLED 防烙印)**：硬體級軟體實現，每 60 秒極其緩慢地微移整個視窗，人眼無法察覺，有效保護 OLED 像素。
*   **Night Mode (夜間護眼)**：靈感來自 Apple Watch Ultra。開啟後強制壓制 WebGL 背景為微弱琥珀色，時鐘字體轉為暖橘光，保護暗適應視力。
*   **Low Power Mode HUD**：獨立的 iOS 風格電池按鈕，開啟時降低圖形解析度 (DPR) 並限制渲染幀率，配有原生質感的 HUD 提示。
*   **Idle Timeout**：3秒/10秒/永不隱藏，閒置自動虛化 UI 並降低背景幀率至 20fps 以節省運算資源。

---

## 🕹️ 互動指南 / Controls

| 操作 (Action) | 觸發方式 (Trigger) |
| :--- | :--- |
| **呼出 / 關閉設置** | 點擊左下角齒輪按鈕 (或任意空白處閒置隱藏) |
| **自訂顏色** | 點擊 Theme 右側的「彩虹色環」 |
| **低功耗模式** | 點擊右上角電池圖示 (觸發 HUD) |
| **切換全螢幕** | 點擊右下角按鈕 或 按 `F11` |
| **安全退出 / 關閉** | **長按 `Space`（空白鍵）2 秒** 或 **長按畫面空白處 2 秒** (支援防卡死救援機制) |
| **中斷退出** | 放開空白鍵或手指（即刻敏捷回彈與觸覺提示） |
| **多國語言 (i18n)** | 設置面板頂部即時熱切換 (EN / 繁中) |

---

## 🛠️ 技術棧 / Tech Stack

本專案為 **「零依賴 (Zero Dependencies)」** 的純 HTML/CSS/JS 架構。
*   **Graphics Core**：Raw WebGL 1.0 (N-way Lerp Blending, GLSL Shaders, Procedural Noise).
*   **Architecture**：ES6 Classes, Pub/Sub Pattern, Copy-on-write State, ResizeObserver.
*   **Motion & Haptics**：Web Animations API (WAAPI), `navigator.vibrate`, `will-change` Hardware Acceleration.

---

## 🚀 快速開始 / Getting Started

無需安裝 Node.js，亦無需任何打包工具。

1. Clone 儲存庫：
   ```bash
   git clone [https://github.com/Cool-Chi/ambient-aurora.git](https://github.com/Cool-Chi/ambient-aurora.git)
   cd ambient-aurora
2. 直接雙擊打開 `index.html` 即可在現代瀏覽器中流暢運行。