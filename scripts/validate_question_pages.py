from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

from classify_questions import FIELD_LABELS, load_questions, validate_field_ids
from tag_normalization import CANONICAL_TAGS, TAG_ALIASES


ROOT = Path(__file__).resolve().parents[1]
PORTAL_ROOT = ROOT.parent / "mei-chan-nel.github.io"
REPORT_DIR = ROOT / "docs" / "reports"
AD_SCRIPT_MARKER = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
SHARED_STYLESHEET = "../../assets/site.css"
SHARED_FAVICON = "../../assets/favicon.svg"
SHARED_SHELL_SCRIPT = "../../assets/site-header.js"
PUBLIC_REPOSITORY_PREFIX = "/info1-quiz-app/"
PORTAL_ORIGIN = "https://mei-chan-nel.github.io/"
MIN_PUBLIC_TAG_QUESTIONS = 4
PROTECTED_APP_FILES = (
    "app/index.html",
    "app/app.js",
    "app/startup.js",
    "app/styles.css",
    "app/issue-report.js",
    "app/issue-report.css",
    "app/learning-record.js",
)


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


def normalized_text_sha256(path: Path) -> str:
    content = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(content).hexdigest()


def protected_app_hashes() -> dict[str, str]:
    return {
        relative: normalized_text_sha256(ROOT / relative)
        for relative in PROTECTED_APP_FILES
    }


def local_target(source: Path, href: str) -> tuple[Path, str] | None:
    split = urlsplit(href)
    if split.scheme or split.netloc or href.startswith(("mailto:", "tel:", "javascript:")):
        return None
    source_public_path = PUBLIC_REPOSITORY_PREFIX + source.relative_to(ROOT).as_posix()
    resolved = urlsplit(urljoin(f"https://preview.invalid{source_public_path}", href))
    path_part = unquote(resolved.path)
    if path_part.startswith(PUBLIC_REPOSITORY_PREFIX):
        target = ROOT / path_part.removeprefix(PUBLIC_REPOSITORY_PREFIX)
    else:
        if not PORTAL_ROOT.is_dir():
            return None
        target = PORTAL_ROOT / path_part.lstrip("/")
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target, unquote(resolved.fragment)


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    questions = load_questions()
    errors.extend(validate_field_ids(questions))
    expected_ids = {str(question["id"]) for question in questions}
    raw_tag_counts = Counter(
        str(tag).strip()
        for question in questions
        for tag in question.get("tags", [])
        if str(tag).strip()
    )
    remaining_aliases = sorted(tag for tag in TAG_ALIASES if raw_tag_counts[tag])
    if remaining_aliases:
        errors.append(f"Question tags still use legacy spellings: {remaining_aliases}")
    duplicate_tag_ids = [
        str(question["id"])
        for question in questions
        if len(question.get("tags", [])) != len(set(map(str, question.get("tags", []))))
    ]
    if duplicate_tag_ids:
        errors.append(f"Questions contain duplicate tags: {duplicate_tag_ids[:10]}")
    expected_tags = {
        tag for tag, count in raw_tag_counts.items() if count >= MIN_PUBLIC_TAG_QUESTIONS
    }
    expected_tags.update(tag for tag in CANONICAL_TAGS if raw_tag_counts[tag])
    forced_public_tags = {
        tag for tag in CANONICAL_TAGS if 0 < raw_tag_counts[tag] < MIN_PUBLIC_TAG_QUESTIONS
    }
    expected_tag_links = sum(
        sum(str(tag).strip() in expected_tags for tag in question.get("tags", []))
        for question in questions
    )

    html_paths = sorted((ROOT / "questions").glob("*.html"))
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
        if SHARED_STYLESHEET not in text:
            errors.append(f"{relative}: shared portal stylesheet is missing")
        if SHARED_FAVICON not in text:
            errors.append(f"{relative}: shared portal favicon is missing")
        if SHARED_SHELL_SCRIPT not in text:
            errors.append(f"{relative}: shared site header/footer script is missing")
        for marker in ('property="og:title"', 'property="og:description"', 'property="og:url"'):
            if marker not in text:
                errors.append(f"{relative}: missing Open Graph metadata {marker}")
        if '"@type":"BreadcrumbList"' not in text:
            errors.append(f"{relative}: BreadcrumbList structured data is missing")
        absolute_internal_links = [href for href in parser.links if href.startswith(PORTAL_ORIGIN)]
        if absolute_internal_links:
            errors.append(f"{relative}: internal navigation must use relative paths: {absolute_internal_links[:3]}")

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

    generated_question_pages = [
        path
        for path in html_paths
        if path.parent == ROOT / "questions" and path.name not in {"index.html", "tags.html"}
    ]
    rendered_ids: list[str] = []
    page_counts: dict[str, int] = {}
    for path in generated_question_pages:
        text = path.read_text(encoding="utf-8")
        ids = re.findall(r'<article class="question-card" id="q-([^"]+)">', text)
        rendered_ids.extend(ids)
        page_counts[path.relative_to(ROOT).as_posix()] = len(ids)
        if not 1 <= len(ids) <= 10:
            errors.append(f"{path.relative_to(ROOT)}: question count must be 1-10, found {len(ids)}")
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

    question_html = "\n".join(path.read_text(encoding="utf-8") for path in generated_question_pages)
    if question_html.count('class="tag-link"') != expected_tag_links:
        errors.append("Every eligible question tag must be published exactly once as a link")
    if 'href="tags.html?tag=' not in question_html:
        errors.append("Generated question tags do not link to the tag filter")
    if question_html.count("&amp;question=") + question_html.count("&question=") != expected_tag_links:
        errors.append("Every question tag link must preserve its source question")
    questions_with_public_tags = sum(
        any(str(tag).strip() in expected_tags for tag in question.get("tags", []))
        for question in questions
    )
    if question_html.count('class="tag-row"') != questions_with_public_tags:
        errors.append("Question pages must omit the entire tag row when no eligible tag remains")
    rendered_tag_values = {
        unquote(value)
        for value in re.findall(r'class="tag-link" href="tags\.html\?tag=([^"&]+)', question_html)
    }
    if rendered_tag_values != expected_tags:
        errors.append("Question pages expose a missing or low-frequency tag")

    tag_page = ROOT / "questions" / "tags.html"
    filter_data_path = ROOT / "questions" / "filter-data.json"
    filter_script_path = ROOT / "assets" / "question-filter.js"
    if not tag_page.is_file() or not filter_data_path.is_file() or not filter_script_path.is_file():
        errors.append("Tag filter page, data, or script is missing")
    else:
        tag_text = tag_page.read_text(encoding="utf-8")
        if tag_text.count('class="facet-link"') != len(expected_tags):
            errors.append("tags.html: expected one link for every unique tag")
        if tag_text.count('class="facet-group"') != len(FIELD_LABELS):
            errors.append("tags.html: tags must be grouped into all six learning fields")
        if "data-question-filter" not in tag_text or "data-filter-param=\"tag\"" not in tag_text:
            errors.append("tags.html: OR filter configuration is missing")
        static_filter_cards = re.findall(r'<article[^>]*data-filter-question[^>]*>', tag_text)
        static_filter_ids = re.findall(r'data-question-id="([^"]+)"', tag_text)
        if len(static_filter_cards) != len(questions) or set(static_filter_ids) != expected_ids:
            errors.append("tags.html: all questions must be retained as static filter cards")
        if any(re.search(r"\shidden(?:\s|=|>)", card) for card in static_filter_cards):
            errors.append("tags.html: static question cards must remain readable without JavaScript")
        if tag_text.count("正答と解説を確認") < len(questions):
            errors.append("tags.html: static question cards must retain answer and explanation controls")
        if "data-filter-load-more" not in tag_text or 'aria-live="polite"' not in tag_text:
            errors.append("tags.html: staged result controls or live status are missing")
        payload = json.loads(filter_data_path.read_text(encoding="utf-8"))
        if payload.get("question_count") != len(questions) or payload.get("tag_count") != len(expected_tags):
            errors.append("filter-data.json: question or tag counts are invalid")
        if payload.get("match_mode") != "OR" or len(payload.get("questions", [])) != len(questions):
            errors.append("filter-data.json: OR filter payload is invalid")
        if payload.get("tag_aliases") != TAG_ALIASES:
            errors.append("filter-data.json: legacy tag aliases are not synchronized")
        payload_tags = {
            str(tag)
            for question in payload.get("questions", [])
            for tag in question.get("tags", [])
        }
        if payload_tags != expected_tags:
            errors.append("filter-data.json: missing or low-frequency tags are exposed")
        if any(
            any(
                raw_tag_counts[str(tag)] < MIN_PUBLIC_TAG_QUESTIONS and str(tag) not in forced_public_tags
                for tag in question.get("tags", [])
            )
            for question in payload.get("questions", [])
        ):
            errors.append("filter-data.json: a tag used by three or fewer questions remains")
        filter_script = filter_script_path.read_text(encoding="utf-8")
        if "URLSearchParams" not in filter_script:
            errors.append("question-filter.js: URL-based multi-tag filter is missing")
        if "focusId" not in filter_script or "scrollIntoView" not in filter_script:
            errors.append("question-filter.js: source-question prioritization or result scrolling is missing")
        if "filter-hit-count" not in filter_script:
            errors.append("question-filter.js: visible filtered-result count is missing from the heading")
        if "PAGE_SIZE = 10" not in filter_script or "visibleCount += PAGE_SIZE" not in filter_script:
            errors.append("question-filter.js: staged display must add ten questions at a time")
        if "popstate" not in filter_script or "normalizeTag" not in filter_script:
            errors.append("question-filter.js: history or legacy-tag compatibility is missing")

    ad_required = [ROOT / "questions" / "index.html", ROOT / "questions" / "tags.html", *generated_question_pages]
    for path in ad_required:
        page_text = path.read_text(encoding="utf-8")
        if AD_SCRIPT_MARKER not in page_text:
            errors.append(f"{path.relative_to(ROOT)}: AdSense script missing from learning content")
        if 'href="../../sitemap.html"' not in page_text:
            errors.append(f"{path.relative_to(ROOT)}: footer sitemap link missing")
    for obsolete_name in ("index.html", "about.html", "privacy.html", "sitemap.html", "ads.txt", "robots.txt", "sitemap.xml"):
        if (ROOT / obsolete_name).exists():
            errors.append(f"Repository-boundary violation: {obsolete_name} belongs to mei-chan-nel.github.io")
    for obsolete_app_page in ("app/about.html", "app/privacy.html"):
        if (ROOT / obsolete_app_page).exists():
            errors.append(f"Obsolete app information page still exists: {obsolete_app_page}")

    app_index = (ROOT / "app" / "index.html").read_text(encoding="utf-8")
    expected_footer_links = (
        'href="../../index.html"',
        'href="../../about.html"',
        'href="../../privacy.html"',
    )
    for expected_link in expected_footer_links:
        if expected_link not in app_index:
            errors.append(f"app/index.html: missing consolidated footer link {expected_link}")
    if SHARED_FAVICON not in app_index:
        errors.append("app/index.html: shared portal favicon is missing")
    if SHARED_STYLESHEET not in app_index:
        errors.append("app/index.html: shared portal stylesheet is missing")
    if SHARED_SHELL_SCRIPT not in app_index:
        errors.append("app/index.html: shared site footer script is missing")
    if re.search(r'<a[^>]+href="https://mei-chan-nel\.github\.io/', app_index):
        errors.append("app/index.html: internal navigation must use relative paths")
    if 'href="./about.html"' in app_index or 'href="./privacy.html"' in app_index:
        errors.append("app/index.html: obsolete local information-page link remains")

    baseline_path = REPORT_DIR / "app-core-baseline-sha256.json"
    if not baseline_path.exists():
        errors.append("Missing app baseline hash report")
    else:
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        current = protected_app_hashes()
        if current != baseline:
            changed = sorted(set(baseline) | set(current))
            changed = [name for name in changed if baseline.get(name) != current.get(name)]
            errors.append(f"Protected app files changed: {changed}")

    build_report_path = REPORT_DIR / "question-library-build.json"
    if not build_report_path.is_file():
        errors.append("Missing question-library build report")
    else:
        build_report = json.loads(build_report_path.read_text(encoding="utf-8"))
        expected_without_public_tags = len(questions) - questions_with_public_tags
        if (
            build_report.get("raw_tag_count") != len(raw_tag_counts)
            or build_report.get("tag_count") != len(expected_tags)
            or build_report.get("minimum_public_tag_questions") != MIN_PUBLIC_TAG_QUESTIONS
            or set(build_report.get("forced_public_tags", [])) != forced_public_tags
            or build_report.get("tag_aliases") != TAG_ALIASES
            or build_report.get("hidden_low_frequency_tag_count") != len(raw_tag_counts) - len(expected_tags)
            or build_report.get("questions_without_public_tags") != expected_without_public_tags
        ):
            errors.append("question-library-build.json: public-tag audit metadata is not synchronized")

    report = {
        "status": "pass" if not errors else "fail",
        "question_count": len(questions),
        "rendered_question_count": len(rendered_ids),
        "generated_question_pages": len(generated_question_pages),
        "html_pages_checked": len(html_paths),
        "field_counts": dict(Counter(question["field_ids"][0] for question in questions)),
        "raw_tag_count": len(raw_tag_counts),
        "tag_count": len(expected_tags),
        "minimum_public_tag_questions": MIN_PUBLIC_TAG_QUESTIONS,
        "forced_public_tags": sorted(forced_public_tags),
        "tag_aliases": TAG_ALIASES,
        "hidden_low_frequency_tag_count": len(raw_tag_counts) - len(expected_tags),
        "questions_without_public_tags": sum(
            not any(str(tag).strip() in expected_tags for tag in question.get("tags", []))
            for question in questions
        ),
        "errors": errors,
        "warnings": warnings,
        "checks": [
            "field_ids completeness and allowed values",
            "unique question IDs and exactly-once publication",
            "maximum 10 questions per generated page",
            "titles, descriptions, canonicals, and one h1 per page",
            "Open Graph and BreadcrumbList structured metadata",
            "local links, assets, and fragments",
            "normalized tags shown at the public threshold or as compatibility targets, with multi-tag OR filtering",
            "six-field tag grouping, source-question-first navigation, and static no-JavaScript question cards",
            "ten-question staged display, remaining-count control, and legacy tag URL aliases",
            "AdSense included on every generated question-library page",
            "protected app core-file SHA-256 baseline",
            "consolidated app footer links and removal of old information pages",
            "shared portal stylesheet, favicon, and header/footer script references",
            "absence of portal-owned root files",
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
