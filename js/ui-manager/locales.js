(function (AA) {
const DICT = {
  en: {
    lang: "Language", time: "24-Hour Time", sec: "Show Seconds", tick: "Tick Anim",
    mode: "Mode", theme: "Theme", size: "Size", weight: "Weight", speed: "Speed", bgBrightness: 'Brightness',
    lp: "Low Power Mode", idle: "Idle Timeout", burn: "Burn-in Protection", night: "Night Mode",
    font: "Font", lz: "Leading Zero", date: "Show Date", lpOn: "Low Power Mode: On", lpOff: "Low Power Mode: Off",
    modes: ['Silk', 'Glow', 'Dust', 'Liquid', 'Horizon'],
    ticks: ['Inst', 'Depth', 'Spring', 'Flip'],
    layout: "Layout", layouts: ['Horizontal', 'Vertical'],
    tabs: ['Clock', 'Background', 'System'],
    tc: "Color", tcItems: ['Clock', 'AM', 'Date', 'Text'], mat: "Material", mats: ['Classic', 'Hollow', 'Glow', 'Glass'], sct: "Custom Text", ctph: "Enter text...", anchor: "Position", offset: "Offset X / Y",
    opacity: "Opacity", datePos: "Date Pos", datePositions: ['Below', 'Above'],
    df: "Format", dY: "Y", dM: "M", dD: "D", dW: "W",
    renderScale: "Render Scale", showFps: "FPS Display",
    idles: ['3s', '10s', 'Never']
  },
  zh: {
    lang: "語言", time: "24小時制", sec: "顯示秒數", tick: "跳秒動效",
    mode: "背景模式", theme: "色彩主題", size: "時鐘尺寸", weight: "字體粗細", speed: "背景流速", bgBrightness: '背景亮度',
    lp: "低功耗模式", idle: "閒置隱藏", burn: "OLED 防烙印", night: "夜間護眼",
    font: "字體風格", lz: "補零顯示", date: "顯示日期", lpOn: "低功耗模式：已開啟", lpOff: "低功耗模式：已關閉",
    modes: ['絲綢', '光暈', '星塵', '液態', '天沿'],
    ticks: ['瞬間', '景深', '彈性', '翻牌'],
    layout: "時鐘排佈", layouts: ['橫向', '直列'],
    tabs: ['時鐘', '背景', '系統'],
    tc: "字體色彩", tcItems: ['時鐘', 'AM', '日期', '文字'], mat: "字體材質", mats: ['實色', '鏤空', '高光', '玻璃'], sct: "自定義文字", ctph: "輸入文字...", anchor: "空間位置", offset: "X / Y 軸偏移",
    opacity: "透明度", datePos: "日期位置", datePositions: ['下方', '上方'],
    df: "格式", dY: "年", dM: "月", dD: "日", dW: "週",
    renderScale: "渲染倍率", showFps: "幀率顯示",
    idles: ['3秒', '10秒', '永不']
  }
};
AA.DICT = DICT;
})(window.AA);
