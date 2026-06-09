#!/usr/bin/env python3
"""Regression checks for the bundled tasks.md quality validator."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "references" / "agent-runtime" / "scripts" / "validate_tasks_quality.py"
FIXTURES = ROOT / "tests" / "fixtures" / "tasks-quality"


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_separator(cells: list[str]) -> bool:
    return bool(cells) and all(set(cell) <= {"-", ":"} for cell in cells)


def extract_table(markdown: str, heading: str) -> list[dict[str, str]]:
    lines = markdown.splitlines()
    start = None
    for idx, line in enumerate(lines):
        if line.strip() == f"### {heading}":
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


def materialize_ledgers(fixture: Path, cwd: Path) -> None:
    markdown = fixture.read_text(encoding="utf-8")
    deposits = {}
    for row in extract_table(markdown, "Regression Test Deposit"):
        for test_id in row.get("Test IDs", "").split():
            deposits[test_id] = row
    for row in extract_table(markdown, "Test Evidence Matrix"):
        test_id = row["Test ID"]
        deposit = deposits[test_id]
        ledger_path = cwd / row["Ledger File"].strip("` ")
        ledger_path.parent.mkdir(parents=True, exist_ok=True)
        (ledger_path.parent / "command.log").write_text("fixture command passed\n", encoding="utf-8")
        ledger = {
            "testId": test_id,
            "acId": row["AC ID"],
            "behaviorContract": deposit["Behavior Contract"],
            "assertionOracle": deposit["Assertion Oracle"],
            "fixedCommand": row["Fixed Command"],
            "redCommand": row["Red Command"],
            "expectedRedFailure": row["Expected Red Failure"],
            "observedRedFailure": row["Observed Red Failure"],
            "redResult": {"status": "failed-as-expected", "exitCode": 1},
            "greenCommand": row["Green Command"],
            "greenResult": {"status": "passed", "exitCode": 0},
            "regressionCommand": deposit["Regression Command"],
            "regressionResult": {"status": "passed", "exitCode": 0},
            "cwd": str(cwd),
            "exitCode": 0,
            "startedAt": "2026-01-01T00:00:00Z",
            "finishedAt": "2026-01-01T00:00:01Z",
            "artifacts": ["command.log", "ledger.json"],
            "defaultPathFacts": {"fixture": True},
            "fixtureBoundary": row["Fixture Boundary"],
            "tddStatus": row["TDD Status"],
            "notApplicableReason": None,
        }
        ledger_path.write_text(json.dumps(ledger, indent=2), encoding="utf-8")


def run_fixture(name: str) -> subprocess.CompletedProcess[str]:
    fixture = FIXTURES / name
    with tempfile.TemporaryDirectory() as tmp:
        cwd = Path(tmp)
        materialize_ledgers(fixture, cwd)
        return subprocess.run(
            [sys.executable, str(VALIDATOR), "--final", str(fixture)],
            capture_output=True,
            text=True,
            check=False,
            cwd=cwd,
        )


def main() -> int:
    failures: list[str] = []
    for fixture in [
        "non_runtime_simple.md",
        "ui_api_behavior.md",
        "security_data_behavior.md",
    ]:
        result = run_fixture(fixture)
        if result.returncode != 0:
            failures.append(f"{fixture} should pass:\n{result.stderr}")

    invalid = run_fixture("security_browser_only_invalid.md")
    expected = "不能只用 browser/smoke proof"
    if invalid.returncode == 0:
        failures.append("security_browser_only_invalid.md should fail")
    elif expected not in invalid.stderr:
        failures.append(
            "security_browser_only_invalid.md failed for the wrong reason:\n"
            f"{invalid.stderr}"
        )

    if failures:
        print("\n\n".join(failures), file=sys.stderr)
        return 1
    print("validate_tasks_quality fixtures passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
