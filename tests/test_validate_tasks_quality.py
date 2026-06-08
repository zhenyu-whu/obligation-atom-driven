#!/usr/bin/env python3
"""Regression checks for the bundled tasks.md quality validator."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "references" / "agent-runtime" / "scripts" / "validate_tasks_quality.py"
FIXTURES = ROOT / "tests" / "fixtures" / "tasks-quality"


def run_fixture(name: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(VALIDATOR), "--final", str(FIXTURES / name)],
        capture_output=True,
        text=True,
        check=False,
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
