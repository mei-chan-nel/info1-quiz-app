from __future__ import annotations

import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from classify_questions import FIELD_LABELS, load_questions, validate_field_ids


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "docs" / "reports"
AD_SCRIPT_MARKER = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.description = ""
        self.canonical = ""
        self.h1_count = 0
        self.links: list[str] = []
        self.assets: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta" and values.get("name") == "description":
            self.description = values.get("content") or ""
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href") or ""
        if tag == "link" and values.get("href"):
            self.assets.append(values["href"])
        if tag == "script" and values.get("src"):
            self.assets.append(values["src"])
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag == "h1":
            self.h1_count += 1
        if values.get("id"):
            self.ids.add(values["id"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self.title_parts).strip()


def app_hashes() -> dict[str, str]:
    return {
        path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted((ROOT / "app").glob("*"))
        if path.is_file()
    }


def local_target(source: Path, href: str) -> tuple[Path, str] | None:
    split = urlsplit(href)
    if split.scheme or split.netloc or href.startswith(("mailto:", "tel:", "javascript:")):
        return None
    path_part = unquote(split.path)
    if path_part.startswith("/"):
        target = ROOT / path_part.lstrip("/")
    elif path_part:
        target = source.parent / path_part
    else:
        target = source
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target, unquote(split.fragment)


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    questions = load_questions()
    errors.extend(validate_field_ids(questions))
    expected_ids = {str(question["id"]) for question in questions}

    html_paths = sorted(ROOT.glob("*.html")) + sorted((ROOT / "questions").glob("*.html"))
    parsed: dict[Path, PageParser] = {}
    canonicals: list[str] = []
    for path in html_paths:
        text = path.read_text(encoding="utf-8")
        parser = PageParser()
        parser.feed(text)
        parsed[path.resolve()] = parser
        relative = path.relative_to(ROOT).as_posix()
        if not parser.title:
            errors.append(f"{relative}: missing title")
        if not parser.description:
            errors.append(f"{relative}: missing meta description")
        if not parser.canonical:
            errors.append(f"{relative}: missing canonical URL")
        else:
            canonicals.append(parser.canonical)
        if parser.h1_count != 1:
            errors.append(f"{relative}: expected one h1, found {parser.h1_count}")
        if re.search(r"\{[a-zA-Z_][^}]*\}", text):
            errors.append(f"{relative}: unresolved template placeholder")

    duplicates = [url for url, count in Counter(canonicals).items() if count > 1]
    if duplicates:
        errors.append(f"Duplicate canonical URLs: {duplicates}")

    for source, parser in list(parsed.items()):
        for href in parser.links + parser.assets:
            target_data = local_target(source, href)
            if target_data is None:
                continue
            target, fragment = target_data
            if not target.exists():
                errors.append(f"{source.relative_to(ROOT)}: broken local target {href}")
                continue
            if fragment and target.suffix.lower() == ".html":
                target_parser = parsed.get(target.resolve())
                if target_parser is None:
                    target_parser = PageParser()
                    target_parser.feed(target.read_text(encoding="utf-8"))
                    parsed[target.resolve()] = target_parser
                if fragment not in target_parser.ids:
                    errors.append(f"{source.relative_to(ROOT)}: missing fragment target {href}")

    generated_question_pages = [path for path in html_paths if path.parent == ROOT / "questions" and path.name != "index.html"]
    rendered_ids: list[str] = []
    page_counts: dict[str, int] = {}
    for path in generated_question_pages:
        text = path.read_text(encoding="utf-8")
        ids = re.findall(r'<article class="question-card" id="q-([^"]+)">', text)
        rendered_ids.extend(ids)
        page_counts[path.relative_to(ROOT).as_posix()] = len(ids)
        if not 1 <= len(ids) <= 30:
            errors.append(f"{path.relative_to(ROOT)}: question count must be 1-30, found {len(ids)}")
    rendered_counter = Counter(rendered_ids)
    missing_ids = sorted(expected_ids - set(rendered_counter))
    duplicate_ids = sorted(question_id for question_id, count in rendered_counter.items() if count != 1)
    unexpected_ids = sorted(set(rendered_counter) - expected_ids)
    if missing_ids:
        errors.append(f"Questions missing from generated pages: {missing_ids[:10]} (total {len(missing_ids)})")
    if duplicate_ids:
        errors.append(f"Questions rendered more than once: {duplicate_ids[:10]} (total {len(duplicate_ids)})")
    if unexpected_ids:
        errors.append(f"Unexpected rendered question IDs: {unexpected_ids[:10]}")

    ad_required = [ROOT / "index.html", ROOT / "questions" / "index.html", *generated_question_pages]
    for path in ad_required:
        if AD_SCRIPT_MARKER not in path.read_text(encoding="utf-8"):
            errors.append(f"{path.relative_to(ROOT)}: AdSense script missing from learning content")
    for path in (ROOT / "about.html", ROOT / "privacy.html"):
        if AD_SCRIPT_MARKER in path.read_text(encoding="utf-8"):
            errors.append(f"{path.relative_to(ROOT)}: informational page must be ad-free")

    baseline_path = REPORT_DIR / "app-baseline-sha256.json"
    if not baseline_path.exists():
        errors.append("Missing app baseline hash report")
    else:
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        current = app_hashes()
        if current != baseline:
            changed = sorted(set(baseline) | set(current))
            changed = [name for name in changed if baseline.get(name) != current.get(name)]
            errors.append(f"Protected app files changed: {changed}")

    sitemap_path = ROOT / "sitemap.xml"
    try:
        sitemap = ET.parse(sitemap_path)
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        sitemap_urls = [node.text for node in sitemap.findall("s:url/s:loc", namespace)]
        if len(sitemap_urls) != len(set(sitemap_urls)):
            errors.append("sitemap.xml contains duplicate URLs")
        expected_sitemap_count = len(generated_question_pages) + 5
        if len(sitemap_urls) != expected_sitemap_count:
            errors.append(f"sitemap.xml: expected {expected_sitemap_count} URLs, found {len(sitemap_urls)}")
    except (ET.ParseError, OSError) as exc:
        errors.append(f"Invalid sitemap.xml: {exc}")

    if (ROOT / "ads.txt").read_text(encoding="utf-8").strip() != "google.com, pub-6257644709224446, DIRECT, f08c47fec0942fa0":
        errors.append("ads.txt does not contain the expected publisher record")
    if "Sitemap: https://mei-chan-nel.github.io/info1-quiz-app/sitemap.xml" not in (ROOT / "robots.txt").read_text(encoding="utf-8"):
        errors.append("robots.txt does not advertise the production sitemap")

    report = {
        "status": "pass" if not errors else "fail",
        "question_count": len(questions),
        "rendered_question_count": len(rendered_ids),
        "generated_question_pages": len(generated_question_pages),
        "html_pages_checked": len(html_paths),
        "field_counts": dict(Counter(question["field_ids"][0] for question in questions)),
        "errors": errors,
        "warnings": warnings,
        "checks": [
            "field_ids completeness and allowed values",
            "unique question IDs and exactly-once publication",
            "maximum 30 questions per generated page",
            "titles, descriptions, canonicals, and one h1 per page",
            "local links, assets, and fragments",
            "AdSense included only on generated learning pages",
            "protected app file SHA-256 baseline",
            "sitemap, robots.txt, and ads.txt",
        ],
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"status={report['status']} questions={len(questions)} rendered={len(rendered_ids)} pages={len(html_paths)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
