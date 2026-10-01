#!/usr/bin/env python3
"""Check FF Linden's one public table and refresh the saved copy safely."""

import argparse
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "activities.json"
URL = "https://www.ff-linden.de/veranstaltungsliste/"
COLUMNS = ["date", "time", "category", "keyword", "event", "street", "district", "remarks"]


class ActivityTable(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.table = False
        self.body = False
        self.row = None
        self.cell = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table" and "activity-table" in attrs.get("class", "").split():
            self.table = True
        elif self.table and tag == "tbody":
            self.body = True
        elif self.body and tag == "tr":
            self.row = []
        elif self.row is not None and tag == "td":
            self.cell = []
        elif self.cell is not None and tag == "br":
            self.cell.append(" ")

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag == "td" and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                if len(self.row) != len(COLUMNS):
                    raise ValueError("The public table changed its columns")
                self.rows.append(self.row)
            self.row = None
        elif tag == "tbody" and self.body:
            self.body = False
        elif tag == "table" and self.table:
            self.table = False


def parse(html):
    parser = ActivityTable()
    parser.feed(html)
    if len(parser.rows) < 500:
        raise ValueError("The public table looks incomplete")
    for row in parser.rows:
        datetime.strptime(row[0] + " " + row[1], "%d.%m.%Y %H:%M")
    return parser.rows


def main():
    options = argparse.ArgumentParser()
    options.add_argument("--dry-run", action="store_true")
    options.add_argument("--accept-edits", action="store_true", help="Accept source corrections after a human comparison")
    options.add_argument("--html-file", type=Path)
    args = options.parse_args()
    if args.html_file:
        html = args.html_file.read_text(encoding="utf-8")
    else:
        request = Request(URL, headers={"User-Agent": "LindenImEinsatz/1.0 (public statistics site)", "Accept": "text/html"})
        with urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8")
    rows = parse(html)
    old = json.loads(SOURCE.read_text(encoding="utf-8"))
    removed = Counter(map(tuple, old["rows"])) - Counter(map(tuple, rows))
    if removed and not args.accept_edits:
        report = {"checked_on": datetime.now(ZoneInfo("Europe/Berlin")).date().isoformat(), "missing_or_edited_rows": sum(removed.values()), "examples": [list(row) for row in list(removed)[:8]]}
        if not args.dry_run:
            (ROOT / "source" / "review_required.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        raise SystemExit("Some published rows disappeared or changed. Review the source before replacing public numbers.")
    if removed:
        print(f"Human-approved source correction: {sum(removed.values())} former rows disappeared or changed")
    checked = datetime.now(ZoneInfo("Europe/Berlin")).date().isoformat()
    added = sum((Counter(map(tuple, rows)) - Counter(map(tuple, old["rows"]))).values())
    print(f"Checked {len(rows)} activities; {added} new rows; {checked}")
    if args.dry_run:
        return
    snapshot = {"source": URL, "checked_on": checked, "columns": COLUMNS, "rows": rows}
    SOURCE.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "forecast.py")], check=True)
    review = ROOT / "source" / "review_required.json"
    if review.exists():
        review.unlink()


if __name__ == "__main__":
    main()
