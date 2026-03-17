"""Amplify SDK v1 ドキュメント参照 MCP サーバー"""

import json
import re
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, NavigableString
from mcp.server.fastmcp import FastMCP

BASE_URL = "https://amplify.fixstars.com/ja/docs/amplify/v1/"
PAGES_FILE = Path(__file__).parent / "pages.json"

mcp = FastMCP("amplify-docs")


def _load_pages() -> list[dict]:
    if PAGES_FILE.exists():
        text = PAGES_FILE.read_text(encoding="utf-8")
        if text.strip():
            return json.loads(text)
    return []


def _save_pages(pages: list[dict]) -> None:
    PAGES_FILE.write_text(
        json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _html_to_markdown(html: str, base_url: str) -> str:
    """HTML の本文領域を Markdown に変換する。"""
    soup = BeautifulSoup(html, "html.parser")

    # Sphinx の本文領域を取得
    article = soup.select_one("article.bd-article") or soup.select_one(
        "[role='main']"
    )
    if article is None:
        article = soup.body or soup

    # 不要な要素を除去
    for tag in article.select(
        "script, style, nav, .headerlink, .toctree-wrapper, .admonition-todo"
    ):
        tag.decompose()

    lines: list[str] = []

    def _walk(element, depth=0):
        if isinstance(element, NavigableString):
            text = str(element)
            if text.strip():
                lines.append(text)
            return

        tag = element.name
        if tag is None:
            for child in element.children:
                _walk(child, depth)
            return

        # 見出し
        if re.match(r"^h[1-6]$", tag):
            level = int(tag[1])
            text = element.get_text(strip=True)
            if text:
                lines.append(f"\n{'#' * level} {text}\n")
            return

        # コードブロック
        if tag == "pre":
            code = element.get_text()
            lines.append(f"\n```\n{code}\n```\n")
            return

        # インラインコード
        if tag == "code" and element.parent and element.parent.name != "pre":
            lines.append(f"`{element.get_text()}`")
            return

        # リンク
        if tag == "a":
            href = element.get("href", "")
            text = element.get_text(strip=True)
            if href and text and not href.startswith("#"):
                full_url = urljoin(base_url, href)
                lines.append(f"[{text}]({full_url})")
                return
            elif text:
                lines.append(text)
                return

        # リスト
        if tag == "li":
            text_parts: list[str] = []
            for child in element.children:
                if isinstance(child, NavigableString):
                    t = str(child).strip()
                    if t:
                        text_parts.append(t)
                else:
                    text_parts.append(child.get_text(strip=True))
            lines.append(f"- {' '.join(text_parts)}")
            return

        # 段落
        if tag == "p":
            text = element.get_text(strip=True)
            if text:
                lines.append(f"\n{text}\n")
            return

        # テーブル
        if tag == "table":
            rows = element.find_all("tr")
            if rows:
                for i, row in enumerate(rows):
                    cells = row.find_all(["th", "td"])
                    cell_texts = [c.get_text(strip=True) for c in cells]
                    lines.append("| " + " | ".join(cell_texts) + " |")
                    if i == 0:
                        lines.append("|" + "|".join(["---"] * len(cell_texts)) + "|")
            return

        # その他: 子要素を再帰処理
        for child in element.children:
            _walk(child, depth + 1)

    _walk(article)

    # 連続する空行を整理
    result = "\n".join(lines)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


@mcp.tool()
async def list_pages() -> str:
    """ローカルキャッシュからページ一覧（タイトル＋URL）を返す。"""
    pages = _load_pages()
    if not pages:
        return "ページ一覧が未取得です。update_pages を実行してください。"
    result = []
    for p in pages:
        result.append(f"- {p['title']}: {p['url']}")
    return "\n".join(result)


@mcp.tool()
async def get_page(url: str) -> str:
    """指定URLのページをフェッチしてMarkdownに変換して返す。"""
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    return _html_to_markdown(resp.text, url)


@mcp.tool()
async def update_pages() -> str:
    """起点URL（index.html）をフェッチしてサイドバーを解析し、pages.json を更新する。"""
    index_url = BASE_URL + "index.html"
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        resp = await client.get(index_url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # サイドバーのリンクを収集
    pages: list[dict] = []
    seen: set[str] = set()

    # Sphinx の サイドバーナビゲーション内のリンクを探す
    sidebar = soup.select_one("nav.bd-links") or soup.select_one(
        ".sidebar-primary-items"
    )
    if sidebar is None:
        # フォールバック: 全ナビゲーション内のリンク
        sidebar = soup

    for a_tag in sidebar.find_all("a", href=True):
        href = a_tag["href"]
        title = a_tag.get_text(strip=True)
        if not title or href.startswith("#") or href.startswith("mailto:"):
            continue

        full_url = urljoin(index_url, href)
        # v1 ドキュメント内のリンクのみ
        if not full_url.startswith(BASE_URL):
            continue
        # アンカー除去
        full_url = full_url.split("#")[0]
        if full_url in seen:
            continue
        seen.add(full_url)
        pages.append({"title": title, "url": full_url})

    _save_pages(pages)
    return f"{len(pages)} ページを取得して pages.json を更新しました。"


if __name__ == "__main__":
    mcp.run()
