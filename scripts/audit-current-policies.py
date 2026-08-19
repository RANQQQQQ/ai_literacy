import argparse
import json
import re
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def section_for(node) -> str:
    current = node
    section_names = {
        "conai": "政府",
        "govai": "行业组织",
        "uniai": "高校",
        "artai": "科研院所",
    }
    while current:
        element_id = current.attrs.get("id") if getattr(current, "attrs", None) else None
        if element_id in section_names:
            return section_names[element_id]
        current = current.parent
    return "出版机构"


def subsection_for(node) -> str:
    candidate = node.find_previous(lambda tag: tag.name in {"h1", "h2", "h3", "p"} and clean(tag.get_text(" ", strip=True)))
    return clean(candidate.get_text(" ", strip=True)) if candidate else ""


def extract_entries(html: str, default_section: str | None = None):
    soup = BeautifulSoup(html, "html.parser")
    entries = []
    seen = set()
    sections = soup.select("#conai, #govai, #uniai, #artai")
    items = [item for section in sections for item in section.find_all("li")] if sections else soup.find_all("li")
    for item in items:
        if item.find("li"):
            continue
        text = clean(item.get_text(" ", strip=True))
        links = [anchor.get("href", "").strip() for anchor in item.find_all("a") if anchor.get("href")]
        if not text or not links:
            continue
        key = (text, tuple(links))
        if key in seen:
            continue
        seen.add(key)
        date_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
        entries.append({
            "section": default_section or section_for(item),
            "subsection": subsection_for(item),
            "text": text,
            "date": date_match.group(1) if date_match else "",
            "links": links,
            "new": any((image.get("alt") or "").lower().startswith("new") for image in item.find_all("img")),
        })
    return entries


def extract_publisher_policies(html: str):
    soup = BeautifulSoup(html, "html.parser")
    policies = []

    cope_link = soup.select_one("blockquote a[href]")
    cope_block = cope_link.find_parent(class_="tpl_box") if cope_link else None
    if cope_link and cope_block:
        policies.append({
            "publisher": clean(cope_link.get_text(" ", strip=True)),
            "url": cope_link.get("href", "").strip(),
            "clauses": [clean(item.get_text(" ", strip=True)) for item in cope_block.find_all("li") if clean(item.get_text(" ", strip=True))],
        })

    for panel in soup.select(".layui-colla-item"):
        title_link = panel.select_one(".layui-colla-title a[href]")
        content = panel.select_one(".layui-colla-content")
        if not title_link or not content:
            continue
        clauses = [clean(item.get_text(" ", strip=True)) for item in content.find_all("p") if clean(item.get_text(" ", strip=True))]
        policies.append({
            "publisher": clean(title_link.get_text(" ", strip=True)),
            "url": title_link.get("href", "").strip(),
            "clauses": clauses,
        })
    return policies


parser = argparse.ArgumentParser(description="Audit the live CNU AI policy catalogue snapshot.")
parser.add_argument("--main-html", type=Path, default=Path("/tmp/cnu-live-main.html"))
parser.add_argument("--publisher-html", type=Path, default=Path("/tmp/cnu-live-publishers.html"))
parser.add_argument("--retrieved-at", default=date.today().isoformat())
args = parser.parse_args()

main_html = args.main_html.read_text()
publisher_html = args.publisher_html.read_text()
current_entries = extract_entries(main_html)
publisher_policies = extract_publisher_policies(publisher_html)

rules = json.loads((ROOT / "app/rules.json").read_text())
old_sources = sorted({rule["source"].split(" + ")[0].strip() for rule in rules})

result = {
    "snapshot": {
        "retrievedAt": args.retrieved_at,
        "mainArticleDate": "2025-06-04",
        "mainArticleId": "1930168339607363584",
        "mainHtml": str(args.main_html),
        "publisherHtml": str(args.publisher_html),
    },
    "currentEntries": current_entries,
    "publisherPolicies": publisher_policies,
    "oldRuleSourceDocuments": old_sources,
}

output = ROOT / "work" / "current-policy-audit.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False, indent=2))

print(json.dumps({
    "currentEntryCount": len(current_entries),
    "sectionCounts": {section: sum(1 for entry in current_entries if entry["section"] == section) for section in sorted({entry["section"] for entry in current_entries})},
    "datedEntries": sum(1 for entry in current_entries if entry["date"]),
    "newMarkedEntries": sum(1 for entry in current_entries if entry["new"]),
    "publisherPolicyCount": len(publisher_policies),
    "publisherClauseCount": sum(len(item["clauses"]) for item in publisher_policies),
    "oldSourceDocumentCount": len(old_sources),
    "output": str(output),
}, ensure_ascii=False, indent=2))
