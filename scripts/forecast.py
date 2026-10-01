#!/usr/bin/env python3
"""Log tomorrow's guess before tomorrow, and score only mature past guesses."""

import json
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = ROOT / "dist" / "data.json"
LEDGER = ROOT / "source" / "forecasts.json"
PUBLIC_FORECAST = ROOT / "dist" / "forecast.json"
WAIT_DAYS = 60
MIN_SCORED = 30


def estimate(entries, checked, target):
    years = sorted({int(entry["date"][:4]) for entry in entries if int(entry["date"][:4]) < checked.year and date(int(entry["date"][:4]), 12, 31) <= checked - timedelta(days=WAIT_DAYS)})
    if not years:
        return None
    incident_days = {entry["date"] for entry in entries if not entry["service"] and not entry["duplicate"] and int(entry["date"][:4]) in years}
    same_weekday = total = same_hits = hits = 0
    for year in years:
        day = date(year, 1, 1)
        while day.year == year:
            has_entry = day.isoformat() in incident_days
            total += 1
            hits += has_entry
            if day.weekday() == target.weekday():
                same_weekday += 1
                same_hits += has_entry
            day += timedelta(days=1)
    return {
        "chance": round(same_hits / same_weekday, 6),
        "comparison": round(hits / total, 6),
        "years": years,
        "matching_days": same_weekday,
        "matching_with_entry": same_hits,
    }


def main():
    data = json.loads(PUBLIC_DATA.read_text(encoding="utf-8"))
    checked = date.fromisoformat(data["checked_on"])
    entries = data["entries"]
    ledger = json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else []
    target = checked + timedelta(days=1)
    if not any(row["target"] == target.isoformat() for row in ledger):
        guess = estimate(entries, checked, target)
        if guess:
            ledger.append({"issued": checked.isoformat(), "target": target.isoformat(), "latest_at_issue": data["latest"], **guess})
    ledger.sort(key=lambda row: row["target"])

    actual_days = {entry["date"] for entry in entries if not entry["service"] and not entry["duplicate"]}
    for row in ledger:
        if "observed_at_score" not in row and date.fromisoformat(row["target"]) <= checked - timedelta(days=WAIT_DAYS):
            row["observed_at_score"] = int(row["target"] in actual_days)
            row["scored_on"] = checked.isoformat()
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    scored = [row for row in ledger if "observed_at_score" in row]
    score = lambda key: sum((row[key] - row["observed_at_score"]) ** 2 for row in scored) / len(scored) if scored else None
    today_guess = next((row for row in ledger if row["target"] == checked.isoformat()), None)
    public = {
        "checked_on": checked.isoformat(),
        "wait_days": WAIT_DAYS,
        "minimum_scored": MIN_SCORED,
        "logged": len(ledger),
        "scored": len(scored),
        "first_score_date": (date.fromisoformat(ledger[0]["target"]) + timedelta(days=WAIT_DAYS)).isoformat() if ledger else None,
        "mean_error": score("chance"),
        "simple_mean_error": score("comparison"),
        "today": today_guess if len(scored) >= MIN_SCORED else None,
    }
    PUBLIC_FORECAST.write_text(json.dumps(public, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Logged {len(ledger)} advance guesses; {len(scored)} are old enough to check")


if __name__ == "__main__":
    main()
