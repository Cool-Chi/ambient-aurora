#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ambient Aurora - Flat to Single-File HTML Builder
解析 flat 分支的 index.html，依序將所有本地 CSS 與 JS 內聯合併為單一 HTML 檔案。
打包時自動：
1. 偵測並擷取版本號，自動剝除 -flat 尾綴（包含 js/store/store.js 註釋與 AA.VERSION 賦值）。
2. 輸出至專案根目錄下的 dist/，並命名為 index_vX.Y.Z.html。
"""

import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def find_project_root(start_dir: Path) -> Path:
    candidates = [start_dir, start_dir.parent, Path.cwd()]
    for folder in candidates:
        if (folder / "index.html").is_file() and (folder / "js" / "store" / "store.js").is_file():
            return folder
    print("[ERROR] 找不到 Ambient Aurora 專案根目錄 (需包含 index.html 與 js/store/store.js)。", file=sys.stderr)
    sys.exit(1)


def resolve_css_imports(css_content: str, css_file_dir: Path, project_root: Path) -> str:
    """遞迴展開本地 CSS 中的 @import 語句"""
    import_pattern = re.compile(
        r'@import\s+(?:url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)|[\'"]([^\'"]+)[\'"])\s*;',
        re.IGNORECASE
    )

    def _replace_import(match: re.Match) -> str:
        rel_path = (match.group(1) or match.group(2)).strip()
        if rel_path.startswith(("http://", "https://", "//", "data:")):
            return match.group(0)

        target_path = (css_file_dir / rel_path).resolve()
        if not target_path.is_file():
            print(f"  [WARN] 找不到 @import 的 CSS 檔案: {target_path}", file=sys.stderr)
            return match.group(0)

        rel_display = target_path.relative_to(project_root).as_posix()
        print(f"  [CSS @import] 內聯: {rel_display}")
        sub_css = target_path.read_text(encoding="utf-8")
        sub_css = resolve_css_imports(sub_css, target_path.parent, project_root)
        return f"/* --- BEGIN {rel_display} --- */\n{sub_css.rstrip()}\n/* --- END {rel_display} --- */"

    return import_pattern.sub(_replace_import, css_content)


def extract_and_clean_version(store_js_content: str) -> tuple[str, str]:
    """
    從 js/store/store.js 提取版本號，並移除註釋與 AA.VERSION 中的 -flat 尾綴。
    返回: (clean_js_content, release_version)
    """
    # 擷取原始版本號 (例如 v3.14.2-flat 或 v3.14.2)
    ver_match = re.search(r"AA\.VERSION\s*=\s*['\"]([^'\"]+)['\"];", store_js_content)
    raw_version = ver_match.group(1) if ver_match else "unknown"
    release_version = re.sub(r"-flat$", "", raw_version, flags=re.IGNORECASE)

    # 1. 替換第二行（或開頭註釋）中的版本號尾綴：// Ambient Aurora vX.Y.Z-flat | ... -> // Ambient Aurora vX.Y.Z | ...
    cleaned_js = re.sub(
        r"(//\s*Ambient Aurora\s+v[0-9.]+(?:-[a-zA-Z0-9.]+)?)-flat",
        r"\1",
        store_js_content,
        count=1
    )

    # 2. 替換 AA.VERSION 賦值字串，剝除 -flat
    cleaned_js = re.sub(
        r"(AA\.VERSION\s*=\s*['\"][^'\"]+?)-flat(['\"];)",
        r"\1\2",
        cleaned_js,
        count=1
    )

    return cleaned_js, release_version


def build_single_html(project_root: Path):
    src_html_path = project_root / "index.html"
    html_content = src_html_path.read_text(encoding="utf-8")

    # 預先讀取 store.js 取得乾淨的正式版版本號
    store_js_path = project_root / "js" / "store" / "store.js"
    release_version = "latest"
    if store_js_path.is_file():
        _, release_version = extract_and_clean_version(store_js_path.read_text(encoding="utf-8"))

    # 目標輸出目錄為專案根目錄下的 dist/
    dist_dir = project_root / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)
    output_path = dist_dir / f"index_{release_version}.html"

    print(f"專案根目錄: {project_root}")
    print(f"來源 HTML : {src_html_path}")
    print(f"發布版本號: {release_version}")
    print("-" * 50)

    # 1. 合併所有本地 <link rel="stylesheet" href="...">
    link_pattern = re.compile(
        r'^([ \t]*)<link\b[^>]*?\brel=[\'"]stylesheet[\'"][^>]*?>[ \t]*\r?\n?',
        re.IGNORECASE | re.MULTILINE
    )
    href_attr_pattern = re.compile(r'\bhref=[\'"]([^\'"]+)[\'"]', re.IGNORECASE)
    css_blocks = []

    def _collect_or_replace_css(match: re.Match) -> str:
        full_tag = match.group(0)
        indent = match.group(1)
        href_match = href_attr_pattern.search(full_tag)
        if not href_match:
            return full_tag

        href = href_match.group(1).strip()
        if href.startswith(("http://", "https://", "//", "data:")):
            print(f"[SKIP] 保留外部樣式表: {href}")
            return full_tag

        css_path = (project_root / href).resolve()
        if not css_path.is_file():
            print(f"[ERROR] 找不到 CSS 檔案: {href}", file=sys.stderr)
            sys.exit(1)

        rel_display = css_path.relative_to(project_root).as_posix()
        print(f"[CSS] 讀取並合併: {rel_display}")
        raw_css = css_path.read_text(encoding="utf-8")
        resolved_css = resolve_css_imports(raw_css, css_path.parent, project_root)

        block = f"/* === {rel_display} === */\n{resolved_css.rstrip()}"
        css_blocks.append((indent, block))
        return "__AA_INLINE_STYLE_PLACEHOLDER__\n" if len(css_blocks) == 1 else ""

    html_content = link_pattern.sub(_collect_or_replace_css, html_content)

    if css_blocks:
        base_indent = css_blocks[0][0]
        combined_css = "\n\n".join(b[1] for b in css_blocks)
        style_tag = f"{base_indent}<style>\n{combined_css}\n{base_indent}</style>\n"
        html_content = html_content.replace("__AA_INLINE_STYLE_PLACEHOLDER__\n", style_tag, 1)

    # 2. 合併所有本地 <script src="..."></script>
    script_pattern = re.compile(
        r'^([ \t]*)<script\b[^>]*?\bsrc=[\'"]([^\'"]+)[\'"][^>]*?>\s*</script>[ \t]*\r?\n?',
        re.IGNORECASE | re.MULTILINE
    )
    js_blocks = []

    def _collect_or_replace_js(match: re.Match) -> str:
        full_tag = match.group(0)
        indent = match.group(1)
        src = match.group(2).strip()

        if src.startswith(("http://", "https://", "//", "data:")):
            print(f"[SKIP] 保留外部腳本: {src}")
            return full_tag

        js_path = (project_root / src).resolve()
        if not js_path.is_file():
            print(f"[ERROR] 找不到 JS 檔案: {src}", file=sys.stderr)
            sys.exit(1)

        rel_display = js_path.relative_to(project_root).as_posix()
        print(f"[JS]  依序讀取並合併: {rel_display}")
        raw_js = js_path.read_text(encoding="utf-8")

        # 若為 store.js，剝除 -flat 標記
        if rel_display == "js/store/store.js":
            raw_js, _ = extract_and_clean_version(raw_js)

        # 防止 JS 字串或註解中出現 "</script>" 導致 HTML 解析提前中斷
        safe_js = re.sub(r'</(script)', r'<\/\1', raw_js, flags=re.IGNORECASE)

        block = f"// === {rel_display} ===\n{safe_js.rstrip()}"
        js_blocks.append((indent, block))
        return "__AA_INLINE_SCRIPT_PLACEHOLDER__\n" if len(js_blocks) == 1 else ""

    html_content = script_pattern.sub(_collect_or_replace_js, html_content)

    if js_blocks:
        base_indent = js_blocks[0][0]
        combined_js = "\n\n".join(b[1] for b in js_blocks)
        script_tag = f"{base_indent}<script>\n{combined_js}\n{base_indent}</script>\n"
        html_content = html_content.replace("__AA_INLINE_SCRIPT_PLACEHOLDER__\n", script_tag, 1)

    # 3. 寫出單一 HTML 檔案至 dist/ 目錄
    output_path.write_text(html_content, encoding="utf-8", newline="\n")
    size_kb = output_path.stat().st_size / 1024
    print("-" * 50)
    print(f"[SUCCESS] 合併完成！共打包 {len(css_blocks)} 個 CSS 模組、{len(js_blocks)} 個 JS 模組。")
    print(f"[OUTPUT]  {output_path} ({size_kb:.2f} KB)")


if __name__ == "__main__":
    project_root = find_project_root(SCRIPT_DIR)
    build_single_html(project_root)
