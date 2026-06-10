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


def clear_declared_ledgers(markdown: str) -> str:
    lines: list[str] = []
    in_matrix = False
    header: list[str] | None = None
    ledger_idx: int | None = None
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped == "### Test Evidence Matrix":
            in_matrix = True
            header = None
            ledger_idx = None
            lines.append(line)
            continue
        if in_matrix and (stripped.startswith("### ") or stripped.startswith("## ")):
            in_matrix = False
        if in_matrix and stripped.startswith("|"):
            cells = split_row(line)
            if header is None:
                header = cells
                ledger_idx = header.index("Ledger File") if "Ledger File" in header else None
            elif ledger_idx is not None and cells and not is_separator(cells):
                cells[ledger_idx] = ""
                line = "| " + " | ".join(cells) + " |"
        lines.append(line)
    return "\n".join(lines) + "\n"


def materialize_evidence(fixture: Path, cwd: Path, *, with_ledgers: bool = True) -> None:
    markdown = fixture.read_text(encoding="utf-8")
    deposits = {}
    for row in extract_table(markdown, "Regression Test Deposit"):
        for test_id in row.get("Test IDs", "").split():
            deposits[test_id] = row
    for row in extract_table(markdown, "Test Evidence Matrix"):
        test_id = row["Test ID"]
        deposit = deposits[test_id]
        evidence_dir = cwd / row["Evidence Directory"].strip("` ")
        evidence_dir.mkdir(parents=True, exist_ok=True)
        ledger_field = row["Ledger File"].strip("` ")
        ledger_path = cwd / ledger_field if ledger_field else evidence_dir / "ledger.json"
        (evidence_dir / "command.log").write_text("fixture command passed\n", encoding="utf-8")
        (evidence_dir / "green-result.json").write_text(
            json.dumps({"status": "passed", "exitCode": 0}),
            encoding="utf-8",
        )
        (evidence_dir / "regression-result.json").write_text(
            json.dumps({"status": "passed", "exitCode": 0}),
            encoding="utf-8",
        )
        if not with_ledgers:
            continue
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
            "artifacts": ["command.log"],
            "defaultPathFacts": {"fixture": True},
            "fixtureBoundary": row["Fixture Boundary"],
            "tddStatus": row["TDD Status"],
            "notApplicableReason": None,
        }
        ledger_path.write_text(json.dumps(ledger, indent=2), encoding="utf-8")


def run_fixture(name: str, *, with_ledgers: bool = True) -> subprocess.CompletedProcess[str]:
    fixture = FIXTURES / name
    with tempfile.TemporaryDirectory() as tmp:
        cwd = Path(tmp)
        fixture_for_run = fixture
        if not with_ledgers:
            fixture_for_run = cwd / fixture.name
            fixture_for_run.write_text(clear_declared_ledgers(fixture.read_text(encoding="utf-8")), encoding="utf-8")
        materialize_evidence(fixture_for_run, cwd, with_ledgers=with_ledgers)
        return subprocess.run(
            [sys.executable, str(VALIDATOR), "--final", str(fixture_for_run)],
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

    optional_ledger = run_fixture("ui_api_behavior.md", with_ledgers=False)
    if optional_ledger.returncode != 0:
        failures.append(
            "ui_api_behavior.md should pass with execution evidence and no ledger:\n"
            f"{optional_ledger.stderr}"
        )

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
