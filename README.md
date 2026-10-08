# Ambient Aurora - v2.1.0 Sevilla

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-brightgreen.svg)](#)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-orange.svg)](#)
[![Apple Design](https://img.shields.io/badge/Design-Apple%20Fluid-black.svg)](#)
[![Design Engineering](https://img.shields.io/badge/Craft-Emil%20Kowalski-8E75FF.svg)](#)

> **繁體中文**：一款汲取 **Apple Fluid Interface** 哲學與 **Emil Kowalski 設計工程動效原則** 的單檔網頁環境時鐘與螢幕保護程式。結合原生 GLSL 片段著色器、次像素級抗色階抖動（Dithering）、字元級數字滾輪、幾何智慧避讓與極致節能架構，實現零外部依賴、純粹且低負載的沉浸美學。
>
> **English**: An Apple-inspired ambient web screensaver and digital timepiece engineered with **Emil Kowalski's interaction & motion principles**. Powered by raw WebGL GLSL fragment shaders, sub-pixel dithering, character-level number tickers, geometry-aware dynamic evasion, and zero external dependencies.

[體驗線上展示 (Live Demo)](https://cool-chi.github.io/ambient-aurora/)

---

## 視覺模式 / Visual Modes

| Silk (經典絲綢) | Glow (邊界光暈) | Dust (深空星塵) |
| :---: | :---: | :---: |
| **Rotational Wave Field** | **Edge Caustics** | **Volumetric Dust & Rays** |
| 捨棄碎裂的噪聲，改用多重旋轉正弦波疊加與定義域扭曲，模擬真實絲綢在空間中柔順折疊的物理高光 (Specular Sheen) 與寬廣起伏。 | 致敬 Apple Intelligence 語彙，邊界流光呼吸，中央維持深邃以保證時鐘具備極高的對比度與易讀性。 | 基於 Procedural Hash 網格演算法的閃爍微粒，搭配非常緩慢的向外漂浮與深空星雲暗角。 |

---

## 時鐘動態 / Clock Micro-Interactions

*   **Inst (即時)**：零延遲跳動，回歸最純粹的電子錶顯示。
*   **Smooth (絲滑過渡)**：利用 Web Animations API 驅動 `opacity` 與極微小的 `scale(0.95)` 變化，創造出數字輕巧融化並重新凝結的錯覺，帶來零殘影的視覺連貫性。
*   **Roll (物理滾輪)**：精確的 `250ms ease-out` 垂直輪換滾輪 ``，嚴格依賴 `tabular-nums` 等寬字體特性確保版面零抖動 ``。透過字元級 Diffing 引擎即時 GC (垃圾回收)，無 DOM 節點殘留。

---

## 核心亮點 / Key Highlights

### 1. 頂級圖形渲染與光學防禦 (Graphics & Optical Safeguards)
*   **Drop-Shadow 剝離渲染 (Zero-Artifact Shadows)**：徹底廢棄易引發 Alpha 疊加與裁切瑕疵的 `text-shadow`。將陰影提升至父層 `filter: drop-shadow` 統一投射，確保數字在重疊、滾動時邊緣依然純淨無黑塊殘影。
*   **硬體級抗色階雜訊 (Anti-Banding Dithering)**：在 GLSL 輸出層注入高頻微噪點，徹底消除大尺寸螢幕上的漸層色階斷層（Color Banding）。
*   **零跳幀時間軸 (Anti-Jitter Phase Engine)**：採用 `requestAnimationFrame` 搭配每幀時間差（$\Delta t$）正規化流體速度，完美適配 ProMotion 120Hz 高刷螢幕。

### 2. 設計工程與互動哲學 (Design Engineering Principles)
*   **幾何智慧避讓 (Dynamic Evasion)**：捨棄死硬的 CSS 位移腳本，依靠 JavaScript 即時讀取面板幾何空間與視窗剩餘尺寸。當設定面板開啟時，時鐘如同具備實體般順應空間自動退讓與微縮 ``。
*   **非對稱時序退出 (Asymmetric Hold-to-Confirm)**：
    *   **蓄力階段 (Press)**：觸發破壞性操作時，採用嚴格的 `2s linear` 緩慢推近，給予使用者決策時間 ``。
    *   **中斷復原 (Release)**：任意時刻鬆開，立即以 `200ms ease-out` 極速敏捷回彈，落實「思維與手勢並行」的打斷機制 ``。
*   **空間層級秩序 (Inset Grouped UI)**：面板佈局嚴格落實 Apple 的卡片群組與內聯控制項規範。頂部邊緣微光 (Rim Highlight)、`0.5px` 分隔線與實心進度填充 (Active Track) 交織出極致的物理厚度與層次。

### 3. 行動端原生標準 (Mobile-Native Engineering)
*   **無極自訂色環 (Apple Color Ring)**：在支援預設色盤之餘，隱藏原生 `<input type="color">` 於 `-webkit-mask-image` 挖空的彩虹環之下，選中時自動產生 `2px` 透明呼吸間隙。
*   **觸控設備防禦**：
    *   全局配置 `100dvh` 與 `overscroll-behavior: none` 阻斷橡皮筋回彈 ``。
    *   Hover 樣式全面收攏於 `@media (hover: hover) and (pointer: fine)`，杜絕行動端點擊殘留高光 ``。
    *   絕對隱藏原生滾動條，保護毛玻璃材質的沉浸觀感。保證所有微縮控制項（如 Toggle, Swatches）均有隱形的 `44px` 觸控防誤觸熱區 ``。

### 4. 系統級節能與持久化 (Efficiency & Persistence)
*   **螢幕防休眠 (Screen Wake Lock API)**：待機時自動請求常亮，並在視窗可見性改變時無縫重獲。
*   **後台零消耗 (Page Visibility)**：分頁切換至背景時，完全凍結 WebGL 渲染迴圈與字元級 DOM 動畫，杜絕無謂耗能。
*   **狀態持久化 (State Persistence)**：透過 LocalStorage 即時資料驅動 (Data-Driven)，記住使用者的主題、大小、動效偏好，下次載入時 UI 與狀態完美同步無縫歸位。

---

## 互動指南 / Controls

| 操作 (Action) | 桌面端 (Desktop) | 行動端 (Touch Device) |
| :--- | :--- | :--- |
| **呼出 / 關閉設置** | 點擊左下角齒輪按鈕 | 點擊左下角齒輪按鈕 |
| **自訂顏色** | 點擊 Theme 右側的「彩虹色環」 | 點擊 Theme 右側的「彩虹色環」 |
| **切換全螢幕** | 點擊右下角按鈕 或 按 `F11` | 點擊全螢幕按鈕 |
| **安全退出 / 關閉** | **長按 `Space`（空白鍵）2 秒** | **長按畫面空白處 2 秒** |
| **中斷退出** | 放開空白鍵（即時平滑回彈） | 手指離開螢幕 或 拖曳超過容差 |
| **喚醒介面** | 移動滑鼠或按任意鍵 | 輕觸螢幕 |

---

## 技術棧 / Tech Stack

*   **Graphics Core**：Raw WebGL 1.0 (Custom GLSL Shaders, Rotational Wave Field, Edge Caustics)
*   **Styling Architecture**：Modern CSS3 (`backdrop-filter`, `clip-path`, `drop-shadow`, CSS Variables)
*   **Runtime Logic**：Vanilla JavaScript (ES6+, Web Animations API, Event Delegation)
*   **Zero Dependencies**：純 HTML/CSS/JS 單檔架構，無任何外部框架或函式庫。
*   **Typography**：System Font Stack (`-apple-system`, `SF Pro Display`, `tabular-nums`)

---

## 快速開始 / Getting Started

本專案為完全自包含的單檔架構，無需安裝 Node.js，亦無需任何打包工具。

### 本地運行 (Local Run)

1. Clone 儲存庫：
   ```bash
   git clone [https://github.com/Cool-Chi/ambient-aurora.git](https://github.com/Cool-Chi/ambient-aurora.git)
   cd ambient-aurora