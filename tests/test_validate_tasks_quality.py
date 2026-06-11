#!/usr/bin/env python3
"""Regression checks for the bundled tasks.md quality validator."""

from __future__ import annotations

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


def materialize_evidence(fixture: Path, cwd: Path) -> None:
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
        (evidence_dir / "command.log").write_text("fixture command passed\n", encoding="utf-8")
        assert deposit


def run_fixture(name: str) -> subprocess.CompletedProcess[str]:
    fixture = FIXTURES / name
    with tempfile.TemporaryDirectory() as tmp:
        cwd = Path(tmp)
        materialize_evidence(fixture, cwd)
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
