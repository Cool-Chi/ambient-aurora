# Ambient Aurora

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-brightgreen.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)
[![Apple Design](https://img.shields.io/badge/Design-Apple%20Fluid-black.svg)](#)
[![Design Engineering](https://img.shields.io/badge/Craft-Emil%20Kowalski-8E75FF.svg)](#)

> **繁體中文**：一款汲取 **Apple Fluid Interface** 哲學與 **Emil Kowalski 設計工程動效原則** 的單檔網頁環境時鐘與螢幕保護程式。結合原生 GLSL 片段著色器、次像素級抗色階抖動（Dithering）、非對稱長按退出機制與極致節能架構，實現零外部依賴、純粹且低負載的沉浸美學。
>
> **English**: An Apple-inspired ambient web screensaver and digital timepiece engineered with **Emil Kowalski's interaction & motion principles**. Powered by raw WebGL GLSL fragment shaders, sub-pixel dithering, asymmetric hold-to-confirm exit mechanics, and zero external dependencies.

[體驗線上展示 (Live Demo)](https://Cool-Chi.github.io/ambient-aurora/)

---

## 視覺模式 / Visual Modes

| Silk (經典絲綢) | Glow (邊界光暈) | Dust (深空星塵) |
| :---: | :---: | :---: |
| **Domain Warping fBM** | **Edge Caustics** | **Volumetric Dust & Rays** |
| 多重柏林噪聲與座標扭曲，呈現有機交融的絲綢光感 | 致敬 Apple Intelligence 語彙，邊界流光呼吸，中央維持深邃保證時鐘易讀性 | 基於 Procedural Hash 網格演算法的閃爍微粒與深空星雲暗角 |

---

## 核心亮點 / Key Highlights

### 1. 圖形渲染與光學防禦 (Graphics & Optical Safeguards)
- **硬體級抗色階雜訊 (Anti-Banding Dithering)**：在 GLSL Fragment Shader 輸出層注入高頻微噪點，徹底消除 OLED 與大尺寸高動態螢幕上的色階斷層（Color Banding）。
- **零跳幀時間軸 (Anti-Jitter Phase Engine)**：廢棄易引發時間軸重置跳動的 CSS Keyframes，全面採用 `requestAnimationFrame` 搭配每幀時間差（$\Delta t$）正規化速度，完美適配 ProMotion 120Hz 高刷螢幕。
- **無縫交叉淡化 (Blur-Masked Crossfade)**：動效模式切換時套用 `1500ms cubic-bezier(0.77, 0, 0.175, 1)` 雙向混合，並輔以動態高斯模糊掩飾重疊過渡。

### 2. 精準動態與互動哲學 (Emil Kowalski's Motion Principles)
- **非對稱時序退出 (Asymmetric Hold-to-Confirm)**：
  - **蓄力階段 (Press)**：長按空白鍵（桌面端）或長按螢幕（觸控端）觸發嚴格 `2s linear` 線性進度與畫面推近動態。
  - **中斷復原 (Release)**：任意時刻鬆開，立即以 `200ms cubic-bezier(0.23, 1, 0.32, 1)` 敏捷回彈，杜絕「磚牆式」生硬中斷。
- **物理級按壓回饋 (Tactile Scale Feedback)**：所有控制項與主題色盤在 `:active` 下觸發 `scale(0.97)`，並透過微正向字距提升小字辨識度。
- **環境感知狀態機 (Idle State Engine)**：無操作 3 秒後平滑沉浸退場（UI 完全淡出、時鐘降至 35% 亮度），喚醒時以 `200ms` 瞬間響應，並在閒置時自動解除焦點挾持。

### 3. 行動端原生標準 (Mobile-Native Engineering)
- **觸控設備防禦**：
  - 全局配置 `100dvh` 與 `overscroll-behavior: none`，消除滾動穿透與橡皮筋回彈。
  - Hover 樣式全面收攏於 `@media (hover: hover) and (pointer: fine)`，阻斷行動端點擊殘留高光（Sticky Hover）。
  - 設定面板在小螢幕自動轉換為緊湊型 **Bottom Sheet**，保證 `min-height: 44px` 觸控熱區同時不遮擋中央時鐘。
- **無抖動排版 (Jitter Prevention)**：時鐘宣告 `font-variant-numeric: tabular-nums`，日期欄位以 `calc()` 等比連動字級，防止秒數跳動造成版面橫向震顫。

### 4. 系統層節能調度 (System-Level Energy Efficiency)
- **螢幕防休眠 (Screen Wake Lock API)**：待機時自動請求常亮，並在視窗可見性改變時無縫重新獲取。
- **後台零消耗 (Page Visibility API)**：分頁切換至背景或最小化時，完全凍結 rAF 渲染迴圈與時鐘定時器，杜絕無謂電量消耗。

---

## 互動指南 / Controls

| 操作 (Action) | 桌面端 (Desktop) | 行動端 (Touch Device) |
| :--- | :--- | :--- |
| **呼出 / 關閉設置面板** | 點擊左下角齒輪按鈕 | 點擊左下角齒輪按鈕 |
| **切換全螢幕** | 點擊右下角按鈕 或 按 `F11` | 點擊全螢幕按鈕 |
| **安全退出 / 關閉** | **長按 `Space`（空白鍵）2 秒** | **長按畫面空白處 2 秒** |
| **中斷退出** | 放開空白鍵（立即平滑取消） | 手指離開螢幕 或 滑動（即時取消） |
| **喚醒介面** | 移動滑鼠或按任意鍵 | 輕觸螢幕 |

---

## 技術棧 / Tech Stack

- **Graphics Core**：Raw WebGL 1.0 (Custom GLSL Shaders, FBM, Domain Warping)
- **Styling Architecture**：Modern CSS3 (`backdrop-filter`, CSS Variables, `100dvh`, Safe Area Insets)
- **Runtime Logic**：Vanilla JavaScript (ES6+), **Zero Dependencies (零外部依賴、單檔架構)**
- **Typography**：System Font Stack (`-apple-system`, `SF Pro Display`, `tabular-nums`)

---

## 快速開始 / Getting Started

本專案為完全自包含的單檔架構，無需安裝 Node.js，亦無需任何打包工具。

### 本地運行 (Local Run)

1. Clone 儲存庫：
   ```bash
   git clone [https://github.com/Cool-Chi/ambient-aurora.git](https://github.com/Cool-Chi/ambient-aurora.git)
   cd ambient-aurora
