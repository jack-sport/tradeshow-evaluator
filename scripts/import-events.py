#!/usr/bin/env python3
"""Import events from the master workbook (2026-2027-events-v4.xlsx) into Supabase.

Usage:
    python3 scripts/import-events.py <workbook.xlsx> [--dry-run]

- Reads the "2026 Events" and "2027 Events" sheets (standard library only, no openpyxl).
- Skips rows without an Event ID and rows listed under "exclude" in data/config/event-import-config.json
  (kept out of git; see scripts/event-import-config.example.json).
- Upserts on the Event ID (events.source_id), so re-running after the workbook changes updates
  events instead of duplicating them. Only workbook-owned fields are written: name, dates,
  location, website and participation. Tier, costs and targets edited in the app are left alone.
- Target and key come from .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
import datetime
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ["2026 Events", "2027 Events"]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
EXCEL_EPOCH = datetime.date(1899, 12, 30)


def read_sheets(path):
    """Return {sheet name: [row dicts keyed by header]} for the workbook."""
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}

    def col_index(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group():
            n = n * 26 + ord(ch) - 64
        return n - 1

    result = {}
    for sheet in workbook.find("m:sheets", NS):
        target = rels[sheet.get("{%s}id" % NS["r"])].lstrip("/")
        target = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for row in ET.fromstring(z.read(target)).iter("{%s}row" % NS["m"]):
            cells = {}
            for c in row.findall("m:c", NS):
                v, kind = c.find("m:v", NS), c.get("t")
                if kind == "inlineStr":
                    value = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
                elif v is None:
                    continue
                elif kind == "s":
                    value = shared[int(v.text)] if v.text else ""
                else:
                    value = v.text
                cells[col_index(c.get("r"))] = (value or "").strip()  # empty <v/> elements read as None
            if cells:
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        if rows:
            header = [h.strip() for h in rows[0]]
            result[sheet.get("name")] = [dict(zip(header, r + [""] * (len(header) - len(r)))) for r in rows[1:]]
    return result


def excel_date(value):
    if value and re.fullmatch(r"\d+(\.0+)?", value):
        return (EXCEL_EPOCH + datetime.timedelta(days=int(float(value)))).isoformat()
    return None


def participation_from_flags(row):
    if row.get("Exhibit", "").lower() == "x":
        return "exhibited"
    if row.get("Attend", "").lower() == "x":
        return "attended"
    return "unknown"


def build_events(sheets, config):
    events, skipped = [], []
    for name in SHEETS:
        for row in sheets.get(name, []):
            source_id = row.get("Event ID", "")
            if not source_id:
                skipped.append((row.get("Event", ""), "no Event ID"))
                continue
            if source_id in config["exclude"]:
                skipped.append((row["Event"], config["exclude"][source_id]))
                continue
            override = config["participation"].get(source_id, {})
            starts = excel_date(row.get("Start Date"))
            events.append({
                "source_id": source_id,
                "name": row["Event"],
                "location": row.get("Graphic Location") or row.get("Location") or None,
                "starts_on": starts,
                "ends_on": excel_date(row.get("End Date")) or starts,
                "web_address": row.get("Web Address") or None,
                "participation": override.get("participation") or participation_from_flags(row),
                "participation_notes": override.get("notes"),
            })
    return events, skipped


def env(key):
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{key} missing from .env.local")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    config = json.loads((ROOT / "data/config/event-import-config.json").read_text())
    events, skipped = build_events(read_sheets(args[0]), config)
    print(f"{len(events)} events to import, {len(skipped)} rows skipped:")
    for name, reason in skipped:
        print(f"  - {name} ({reason})")
    if "--dry-run" in sys.argv:
        for e in events:
            print(f"  {e['starts_on'] or 'TBD':10}  {e['participation']:15} {e['name']}")
        return
    url = env("NEXT_PUBLIC_SUPABASE_URL")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    print(f"Target: {url}")
    request = urllib.request.Request(
        f"{url}/rest/v1/events?on_conflict=source_id",
        data=json.dumps(events).encode(),
        method="POST",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    with urllib.request.urlopen(request) as response:
        print(f"Upserted {len(events)} events (HTTP {response.status}).")


if __name__ == "__main__":
    main()
