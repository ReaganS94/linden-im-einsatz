#!/usr/bin/env python3
"""Turn one saved FF Linden table into the small public display data."""

import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "activities.json"
OUTPUT = ROOT / "dist" / "data.json"


def is_service(event):
    """Conservative, visible-text-only rule for planned duties and exercises."""
    text = event.casefold()
    phrases = (
        "brandsicherheitswache",
        "wachbesetzung",
        "feuerwehrhaus besetzen",
        "silvesterbereitschaft",
        "absicherung schützenausmarsch",
        "absicherung karnevalsumzug",
        "absicherung fackelumzug",
        "anwohnerinformation",
        "anti-terror-übung",
        "bereitstellung polizei-lage",
    )
    return any(phrase in text for phrase in phrases)


def kind(keyword, event):
    code = keyword.casefold().strip()
    if code == "uw" or "unwetterlage" in event.casefold():
        return "Unwetter"
    if code.startswith("abc") or code.startswith("bg"):
        return "Gefahrstoffe und Gas"
    if code.startswith("b") or code in {"o", "ob", "ob/öel"}:
        return "Brand und Rauch"
    if code.startswith("h") or code in {"r", "r,n", "fr", "manv10", "manv50"}:
        return "Hilfe und Rettung"
    return "Weitere Anlässe"


def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    if source.get("columns") != ["date", "time", "category", "keyword", "event", "street", "district", "remarks"]:
        raise SystemExit("Unexpected source columns")
    raw = source["rows"]
    if len(raw) < 100 or any(len(row) != 8 for row in raw):
        raise SystemExit("Source table looks incomplete")
    if any(not re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", row[0]) for row in raw):
        raise SystemExit("Unexpected date in source")
    checked = datetime.strptime(source["checked_on"], "%Y-%m-%d").date()
    entries = []
    seen = set()
    raw_category = Counter(row[2] for row in raw)
    per_day = Counter(row[0] for row in raw if row[2] == "Einsatz")
    midnight_per_day = Counter(row[0] for row in raw if row[2] == "Einsatz" and row[1] == "00:00")
    bulk_midnight_days = {
        day for day, count in midnight_per_day.items()
        if count >= 10 and count / per_day[day] >= 0.8
    }
    for raw_row in raw:
        date_text, time, category, keyword, event, street, district, remarks = raw_row
        if category != "Einsatz":
            continue
        day = datetime.strptime(date_text, "%d.%m.%Y").date()
        if day > checked:
            raise SystemExit("Source has a date after the check date")
        bulk_placeholder = date_text in bulk_midnight_days and time == "00:00"
        signature = (date_text, time, keyword, event, street, district)
        duplicate = signature in seen and not bulk_placeholder
        seen.add(signature)
        service = is_service(event)
        entries.append({
            "date": day.isoformat(),
            "time": time,
            "kind": kind(keyword, event),
            "keyword": keyword,
            "event": event,
            "street": street,
            "district": district,
            "service": service,
            "duplicate": duplicate,
            "time_known": not bulk_placeholder,
        })
    latest = max(entry["date"] for entry in entries)
    payload = {
        "source": source["source"],
        "checked_on": source["checked_on"],
        "latest": latest,
        "all_rows": len(raw),
        "category_counts": raw_category,
        "entries": entries,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(entries)} Einsatz entries; {sum(e['service'] for e in entries)} service rows; {sum(e['duplicate'] for e in entries)} grouped repeats")


if __name__ == "__main__":
    main()
