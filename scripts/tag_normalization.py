from __future__ import annotations

from collections.abc import Iterable


TAG_ALIASES = {
    "ディジタル署名": "デジタル署名",
    "公開かぎ暗号方式": "公開鍵暗号方式",
    "ディジタル": "デジタル",
    "firewall": "Firewall",
    "Java Script": "JavaScript",
}

CANONICAL_TAGS = tuple(dict.fromkeys(TAG_ALIASES.values()))


def normalize_tag(value: object) -> str:
    tag = str(value).strip()
    return TAG_ALIASES.get(tag, tag)


def normalize_tags(values: Iterable[object] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        tag = normalize_tag(value)
        if not tag or tag in seen:
            continue
        normalized.append(tag)
        seen.add(tag)
    return normalized
