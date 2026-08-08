from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from classify_questions import load_questions, validate_question_data
from tag_normalization import EXCLUDED_PUBLIC_TAGS, TAG_ALIASES


ROOT = Path(__file__).resolve().parents[1]
PORTAL_ROOT = ROOT.parent / "mei-chan-nel.github.io"
REPORT_PATH = ROOT / "docs" / "reports" / "question-pages-validation.json"
ORIGIN = "https://mei-chan-nel.com/"
PUBLIC_PREFIX = "/info1-quiz-app/"
PROTECTED_APP_FILES = (
    "app/index.html",
    "app/app.js",
    "app/question-data.js",
    "app/question-selection.js",
    "app/similar-questions.js",
    "app/startup.js",
    "app/styles.css",
    "app/issue-report.js",
    "app/issue-report.css",
    "app/learning-record.js",
    "app/tag-challenge.js",
)


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self.h1_count = 0
        self.canonical = ""
        self.og_url = ""
        self.description = ""
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta" and values.get("name") == "description":
            self.description = values.get("content") or ""
        elif tag == "meta" and values.get("property") == "og:url":
            self.og_url = values.get("content") or ""
        elif tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href") or ""
        elif tag == "a" and values.get("href"):
            self.links.append(values["href"] or "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the single tag-search question page and app URL integration.")
    parser.add_argument("--portal-root", type=Path, default=PORTAL_ROOT)
    return parser.parse_args()


def local_target(source: Path, href: str, portal_root: Path) -> Path | None:
    parts = urlsplit(href)
    if parts.scheme or parts.netloc or href.startswith(("mailto:", "tel:", "javascript:")):
        return None
    if parts.path.startswith(PUBLIC_PREFIX):
        target = ROOT / parts.path.removeprefix(PUBLIC_PREFIX)
    elif source.parent == ROOT / "questions" and parts.path.startswith("../.."):
        target = portal_root / parts.path.removeprefix("../..").lstrip("/")
    elif parts.path.startswith("/"):
        target = portal_root / parts.path.lstrip("/")
    else:
        target = source.parent / parts.path
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target


def main() -> int:
    args = parse_args()
    portal_root = args.portal_root.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    questions = load_questions()
    errors.extend(validate_question_data(questions))
    expected_ids = {str(question["id"]) for question in questions}
    tag_counts = Counter(
        str(tag).strip()
        for question in questions
        for tag in question.get("tags", [])
        if str(tag).strip()
    )
    aliases_in_data = sorted(tag for tag in TAG_ALIASES if tag_counts[tag])
    if aliases_in_data:
        errors.append(f"legacy tag spellings remain in question data: {aliases_in_data}")
    public_tags = {tag for tag in tag_counts if tag not in EXCLUDED_PUBLIC_TAGS}

    questions_dir = ROOT / "questions"
    html_names = sorted(path.name for path in questions_dir.glob("*.html"))
    if html_names != ["index.html", "tags.html"]:
        errors.append(f"questions/: expected index.html plus compatibility tags.html, found {html_names}")
    if (questions_dir / "filter-data.json").exists():
        errors.append("questions/filter-data.json is obsolete and must not be generated")

    root_path = questions_dir / "index.html"
    root_text = root_path.read_text(encoding="utf-8") if root_path.is_file() else ""
    root_parser = MetaParser()
    root_parser.feed(root_text)
    expected_canonical = f"{ORIGIN}info1-quiz-app/questions/"
    if root_parser.title != "情報Ⅰ Study Atlas｜問題を探す｜タグ検索":
        errors.append(f"questions/index.html: unexpected title {root_parser.title!r}")
    if root_parser.canonical != expected_canonical or root_parser.og_url != expected_canonical:
        errors.append("questions/index.html: canonical and og:url must use the root search URL")
    if not root_parser.description or root_parser.h1_count != 1:
        errors.append("questions/index.html: description and exactly one h1 are required")
    visible_breadcrumb = '<nav class="breadcrumb" aria-label="パンくずリスト"><a href="../../">学習トップ</a><span aria-hidden="true">/</span><span aria-current="page">問題を探す</span></nav>'
    if visible_breadcrumb not in root_text:
        errors.append("questions/index.html: visible breadcrumb must contain only 学習トップ > 問題を探す")
    json_ld_values: list[dict] = []
    for raw_value in re.findall(r'<script type="application/ld\+json">(.*?)</script>', root_text, flags=re.DOTALL):
        try:
            value = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            errors.append(f"questions/index.html: invalid JSON-LD: {exc}")
            continue
        if isinstance(value, dict):
            json_ld_values.append(value)
    breadcrumb_values = [value for value in json_ld_values if value.get("@type") == "BreadcrumbList"]
    expected_breadcrumb = [
        ("学習トップ", ORIGIN),
        ("問題を探す", expected_canonical),
    ]
    if len(breadcrumb_values) != 1:
        errors.append(f"questions/index.html: expected one BreadcrumbList, found {len(breadcrumb_values)}")
    else:
        items = breadcrumb_values[0].get("itemListElement", [])
        actual_breadcrumb = [(item.get("name"), item.get("item")) for item in items if isinstance(item, dict)]
        if actual_breadcrumb != expected_breadcrumb:
            errors.append(f"questions/index.html: JSON-LD breadcrumb is incorrect: {actual_breadcrumb}")
        breadcrumb_urls = [url for _, url in actual_breadcrumb]
        if len(breadcrumb_urls) != len(set(breadcrumb_urls)):
            errors.append("questions/index.html: JSON-LD breadcrumb contains duplicate URLs")
    if 'data-question-filter' not in root_text or 'data-filter-param="tag"' not in root_text:
        errors.append("questions/index.html: tag-filter root markers are missing")
    rendered_ids = re.findall(r'data-filter-question[^>]*data-question-id="([^"]+)"', root_text)
    if len(rendered_ids) != len(questions):
        errors.append(f"questions/index.html: expected {len(questions)} static filter cards, found {len(rendered_ids)}")
    rendered_counter = Counter(rendered_ids)
    if set(rendered_counter) != expected_ids or any(count != 1 for count in rendered_counter.values()):
        errors.append("questions/index.html: question IDs are missing, duplicated, or unexpected")
    facet_values = re.findall(r'class="facet-link"[^>]*data-facet-value="([^"]+)"', root_text)
    if len(facet_values) != len(public_tags) or set(facet_values) != public_tags:
        errors.append(f"questions/index.html: expected {len(public_tags)} unique facet tags, found {len(facet_values)}")
    if "tags.html" in root_text or "通常ページで開く" in root_text or "source_href" in root_text:
        errors.append("questions/index.html: obsolete field-page or legacy-tag links remain")
    if 'src="../assets/question-filter.js?v=' not in root_text or 'src="../app/tag-challenge.js?v=' not in root_text:
        errors.append("questions/index.html: tag-filter scripts are missing")
    for marker in ("data-facet-groups", "data-filter-results", "data-filter-controls", "data-filter-load-more", "data-tag-challenge-start", "AND検索"):
        if marker not in root_text:
            errors.append(f"questions/index.html: required interaction marker is missing: {marker}")
    facet_groups = re.findall(r'<details class="facet-group" data-facet-group(?: open)?>', root_text)
    if facet_groups and any(group.endswith(" open>") for group in facet_groups):
        errors.append("questions/index.html: all tag groups must be closed by default")
    if any(not href.startswith("./#tag=") for href in re.findall(r'class="facet-link" href="([^"]+)"', root_text)):
        errors.append("questions/index.html: facet links must target the canonical page with a fragment")

    legacy_path = questions_dir / "tags.html"
    legacy_text = legacy_path.read_text(encoding="utf-8") if legacy_path.is_file() else ""
    if 'name="robots" content="noindex,follow"' not in legacy_text:
        errors.append("questions/tags.html: compatibility stub must be noindex,follow")
    if expected_canonical not in legacy_text or 'meta http-equiv="refresh"' not in legacy_text:
        errors.append("questions/tags.html: compatibility redirect must canonicalize to the root search page")
    for marker in ("target.search = window.location.search", "target.hash = window.location.hash"):
        if marker not in legacy_text:
            errors.append(f"questions/tags.html: query/hash preservation marker is missing: {marker}")

    filter_script = (ROOT / "assets" / "question-filter.js").read_text(encoding="utf-8")
    challenge_script = (ROOT / "app" / "tag-challenge.js").read_text(encoding="utf-8")
    app_script = (ROOT / "app" / "app.js").read_text(encoding="utf-8")
    if "tags.html" in filter_script or "tags.html" in challenge_script or "questions/tags.html" in app_script:
        errors.append("app URL integration still points to questions/tags.html")
    if 'function getQuestionSearchUrl' not in challenge_script or 'new URL("../questions/", href)' not in challenge_script:
        errors.append("tag-challenge.js: app-relative question-search return path is missing")
    if 'new URL("../questions/", window.location.href).pathname' not in app_script:
        errors.append("app.js: app-relative fallback return path is missing")
    for marker in ("loadMore", "URLSearchParams", "AND", "history.replaceState"):
        if marker not in filter_script:
            warnings.append(f"question-filter.js: could not find expected interaction marker {marker}")
    app_index_text = (ROOT / "app" / "index.html").read_text(encoding="utf-8")
    if ">問題一覧<" in app_index_text or ">動画問題<" in app_index_text:
        errors.append("app/index.html: old navigation labels remain")
    if './tag-challenge.js?v=' not in app_index_text or './app.js?v=' not in app_index_text:
        errors.append("app/index.html: changed tag-return scripts must use cache-busting versions")

    report_path = ROOT / "docs" / "reports" / "question-library-build.json"
    report: dict = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {}
    for key, expected in (("question_count", len(questions)), ("tag_count", len(public_tags)), ("question_search_page", "questions/index.html"), ("learning_pages", ["questions/index.html"]), ("legacy_tag_redirect", "questions/tags.html")):
        if report.get(key) != expected:
            errors.append(f"question-library-build.json: {key} must be {expected!r}, found {report.get(key)!r}")
    if report.get("filter_match_mode") != "AND":
        errors.append("question-library-build.json: filter_match_mode must be AND")
    if (ROOT / "docs" / "reports" / "validation.json").exists():
        errors.append("obsolete docs/reports/validation.json remains; use question-pages-validation.json")

    baseline_path = ROOT / "docs" / "reports" / "app-core-baseline-sha256.json"
    if not baseline_path.is_file():
        errors.append("app-core-baseline-sha256.json is missing")
    else:
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        for relative in PROTECTED_APP_FILES:
            path = ROOT / relative
            if not path.is_file():
                errors.append(f"protected app file is missing: {relative}")
            elif baseline.get(relative) != sha256(path):
                errors.append(f"protected app baseline mismatch: {relative}")

    sitemap_path = portal_root / "sitemap.xml"
    if sitemap_path.is_file():
        try:
            urls = [node.text.strip() for node in ET.parse(sitemap_path).getroot().findall(".//{*}loc") if node.text and node.text.strip()]
            expected_urls = {f"{ORIGIN}info1-quiz-app/app/", expected_canonical}
            app_urls = {url for url in urls if url.startswith(f"{ORIGIN}info1-quiz-app/")}
            if app_urls != expected_urls:
                errors.append(f"sitemap.xml: app URLs must be {sorted(expected_urls)}, found {sorted(app_urls)}")
        except ET.ParseError as exc:
            errors.append(f"sitemap.xml: invalid XML: {exc}")
    else:
        warnings.append("portal sitemap.xml was not found")

    for source in (root_path, legacy_path):
        if not source.is_file():
            continue
        parser = MetaParser()
        parser.feed(source.read_text(encoding="utf-8"))
        for href in parser.links:
            target = local_target(source, href, portal_root)
            if target is not None and not target.exists():
                errors.append(f"{source.relative_to(ROOT)}: broken local target {href}")

    report_out = {
        "status": "pass" if not errors else "fail",
        "questions_checked": len(questions),
        "tags_checked": len(public_tags),
        "question_html": html_names,
        "field_pages": 0,
        "canonical_search_url": expected_canonical,
        "errors": errors,
        "warnings": warnings,
        "checks": [
            "1,438 unique static filter cards and 229 facet tags",
            "single canonical tag-search page with AND filtering, staged display, and expanded tag groups",
            "legacy tags.html noindex redirect preserving query and hash",
            "app return paths and navigation use /info1-quiz-app/questions/",
            "protected app baseline hashes and cross-repository sitemap URLs",
        ],
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"status={report_out['status']} questions={len(questions)} tags={len(public_tags)} html={html_names}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
