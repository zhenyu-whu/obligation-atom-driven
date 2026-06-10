#!/usr/bin/env python3
"""Write an optional OpenSpec audit ledger for one Test ID.

The tool reads Test Evidence Matrix and Regression Test Deposit from tasks.md,
then merges those canonical fields with an existing ledger or result JSON files.
It avoids hand-written drift when an apply/reviewer/archive audit receipt is
useful. Ordinary test commands are not required to generate this file.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


TEST_ID_RE = re.compile(r"^T-[0-9]{3}$")


def split_row(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return []
    return [cell.strip() for cell in stripped.strip("|").split("|")]


def is_separator(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in cells)


def extract_table(markdown: str, heading: str) -> list[dict[str, str]]:
    lines = markdown.splitlines()
    start = None
    heading_re = re.compile(rf"^###\s+{re.escape(heading)}\s*$")
    for idx, line in enumerate(lines):
        if heading_re.match(line.strip()):
            start = idx + 1
            break
    if start is None:
        return []

    table_lines: list[str] = []
    for line in lines[start:]:
        if line.startswith("### ") or line.startswith("## "):
            break
        if line.strip().startswith("|"):
            table_lines.append(line)
    if not table_lines:
        return []

    header = split_row(table_lines[0])
    rows: list[dict[str, str]] = []
    for line in table_lines[1:]:
        cells = split_row(line)
        if not cells or is_separator(cells):
            continue
        if len(cells) < len(header):
            cells += [""] * (len(header) - len(cells))
        rows.append(dict(zip(header, cells[: len(header)])))
    return rows


def strip_cell_markup(value: str) -> str:
    return value.strip().strip("`").strip()


def row_value(row: dict[str, str], *names: str) -> str:
    for name in names:
        value = row.get(name)
        if value is not None:
            return value
    return ""


def extract_change_slug(markdown: str) -> str:
    title = re.search(r"^#\s+Implementation Tasks:\s*([A-Za-z0-9_.-]+)\s*$", markdown, re.MULTILINE)
    if title:
        return title.group(1)
    evidence_path = re.search(r"\btest-results/([^/]+)/AC-[0-9]{3}/T-[0-9]{3}/", markdown)
    return evidence_path.group(1) if evidence_path else ""


def read_json_file(path: str | None) -> object:
    if not path:
        return None
    return json.loads(Path(path).read_text(encoding="utf-8"))


def artifact_names(existing: object, extras: list[str]) -> list[str]:
    names: list[str] = []
    if isinstance(existing, list):
        for item in existing:
            names.append(Path(str(item)).name)
    for item in extras:
        names.append(Path(item).name)
    names.extend(["command.log"])
    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        if name and name not in seen:
            ordered.append(name)
            seen.add(name)
    return ordered


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def find_one(rows: list[dict[str, str]], test_id: str, column: str) -> dict[str, str] | None:
    for row in rows:
        if test_id in re.findall(r"\bT-[0-9]{3}\b", row.get(column, "")):
            return row
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tasks_md", type=Path)
    parser.add_argument("--test-id", required=True)
    parser.add_argument("--output", type=Path, help="ledger path; defaults to Test Evidence Matrix Ledger File or Evidence Directory/ledger.json")
    parser.add_argument("--no-merge-existing", action="store_true")
    parser.add_argument("--red-result-json")
    parser.add_argument("--green-result-json")
    parser.add_argument("--regression-result-json")
    parser.add_argument("--use-green-as-regression", action="store_true")
    parser.add_argument("--exit-code", type=int)
    parser.add_argument("--artifact", action="append", default=[])
    parser.add_argument("--stdout", action="store_true")
    args = parser.parse_args()

    if not TEST_ID_RE.fullmatch(args.test_id):
        print(f"ERROR: --test-id 必须匹配 T-###：{args.test_id}", file=sys.stderr)
        return 1

    markdown = args.tasks_md.read_text(encoding="utf-8")
    evidence_row = find_one(extract_table(markdown, "Test Evidence Matrix"), args.test_id, "Test ID")
    if evidence_row is None:
        print(f"ERROR: Test Evidence Matrix 中找不到 {args.test_id}", file=sys.stderr)
        return 1
    deposit_row = find_one(extract_table(markdown, "Regression Test Deposit"), args.test_id, "Test IDs")
    if deposit_row is None:
        print(f"ERROR: Regression Test Deposit 中找不到 {args.test_id}", file=sys.stderr)
        return 1

    ledger_field = strip_cell_markup(evidence_row.get("Ledger File", ""))
    evidence_dir = strip_cell_markup(evidence_row.get("Evidence Directory", "")).rstrip("/")
    ledger_path = args.output
    if ledger_path is None and ledger_field:
        ledger_path = Path(ledger_field)
    if ledger_path is None and evidence_dir:
        ledger_path = Path(evidence_dir) / "ledger.json"
    if ledger_path is None:
        print(f"ERROR: {args.test_id} 缺少 Ledger File 或 Evidence Directory，无法推导 optional audit ledger 输出路径", file=sys.stderr)
        return 1

    existing: dict[str, object] = {}
    if not args.no_merge_existing and ledger_path.exists():
        loaded = json.loads(ledger_path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            existing = loaded

    red_result = read_json_file(args.red_result_json)
    green_result = read_json_file(args.green_result_json)
    regression_result = read_json_file(args.regression_result_json)
    if red_result is None:
        red_result = existing.get("redResult")
    if green_result is None:
        green_result = existing.get("greenResult")
    if regression_result is None:
        regression_result = existing.get("regressionResult")

    green_command = strip_cell_markup(evidence_row.get("Green Command", ""))
    regression_command = strip_cell_markup(deposit_row.get("Regression Command", ""))
    if regression_result is None and args.use_green_as_regression and green_result is not None and green_command == regression_command:
        if isinstance(green_result, dict):
            regression_result = dict(green_result)
            regression_result["equivalentToGreenCommand"] = True
        else:
            regression_result = green_result

    exit_code = args.exit_code
    if exit_code is None:
        existing_exit = existing.get("exitCode")
        exit_code = existing_exit if isinstance(existing_exit, int) else None
    for result in [regression_result, green_result]:
        if exit_code is None and isinstance(result, dict) and isinstance(result.get("exitCode"), int):
            exit_code = int(result["exitCode"])

    ledger: dict[str, object] = dict(existing)
    ledger.update(
        {
            "change": existing.get("change") or extract_change_slug(markdown),
            "testId": args.test_id,
            "acId": strip_cell_markup(evidence_row.get("AC ID", "")),
            "behaviorContract": deposit_row.get("Behavior Contract", "") or existing.get("behaviorContract", ""),
            "assertionOracle": deposit_row.get("Assertion Oracle", "") or existing.get("assertionOracle", ""),
            "fixedCommand": strip_cell_markup(evidence_row.get("Fixed Command", "")),
            "redCommand": strip_cell_markup(evidence_row.get("Red Command", "")),
            "expectedRedFailure": evidence_row.get("Expected Red Failure", ""),
            "observedRedFailure": evidence_row.get("Observed Red Failure", ""),
            "redResult": red_result,
            "greenCommand": green_command,
            "greenResult": green_result,
            "regressionCommand": regression_command,
            "regressionResult": regression_result,
            "cwd": existing.get("cwd") or os.getcwd(),
            "exitCode": exit_code,
            "startedAt": existing.get("startedAt") or now_iso(),
            "finishedAt": existing.get("finishedAt") or now_iso(),
            "artifacts": artifact_names(
                existing.get("artifacts"),
                [
                    *args.artifact,
                    *[
                        path
                        for path in [args.red_result_json, args.green_result_json, args.regression_result_json]
                        if path
                    ],
                ],
            ),
            "defaultPathFacts": existing.get("defaultPathFacts")
            or {"defaultPathLevel": row_value(evidence_row, "Default Path Level", "Default Path?")},
            "fixtureBoundary": evidence_row.get("Fixture Boundary", "") or deposit_row.get("Fixture Boundary", ""),
            "tddStatus": evidence_row.get("TDD Status", ""),
            "notApplicableReason": existing.get("notApplicableReason"),
        }
    )

    rendered = json.dumps(ledger, ensure_ascii=False, indent=2) + "\n"
    if args.stdout:
        print(rendered, end="")
        return 0

    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger_path.write_text(rendered, encoding="utf-8")
    print(ledger_path.as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
