#!/usr/bin/env python3
"""Regression tests for validate_tasks_quality.py phase gates."""

from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("validate_tasks_quality", SCRIPT_DIR / "validate_tasks_quality.py")
assert SPEC is not None and SPEC.loader is not None
validator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator
SPEC.loader.exec_module(validator)


def minimal_tasks(
    *,
    layer: str = "unit",
    default_path_level: str = "service-contract",
    tdd_status: str = "red-required",
    observed_red: str = "Pending apply red run",
    evidence_produced: str = "Pending apply execution evidence: command.log",
    ledger_file: str = "",
    deposit_status: str = "required",
    operation_row: str | None = None,
    test_file: str = "apps/example/example.test.ts",
) -> str:
    operation = operation_row or "| OP-001 | Not applicable: no runtime behavior; scope-backed reason. | T-001 |"
    return f"""# Implementation Tasks: schema-test

## Verification Appendix

### Runtime Surface Inventory

| Surface ID | Surface | Test IDs |
| --- | --- | --- |
| RS-001 | Not applicable: no runtime behavior; scope-backed reason. | T-001 |

### Operation Coverage Matrix

| Operation ID | Operation | Test IDs |
| --- | --- | --- |
{operation}

### State / Branch Coverage Matrix

| State ID | State | Test IDs |
| --- | --- | --- |
| ST-001 | Not applicable: no runtime behavior; scope-backed reason. | T-001 |

### Async / Realtime Chain Matrix

| Chain ID | Chain | Test IDs |
| --- | --- | --- |
| CH-001 | Not applicable: no runtime behavior; scope-backed reason. | T-001 |

### Test Layer Plan

| AC ID | Behavior / Boundary | Required Layers | Test IDs By Layer | Omitted Layers / Reason | Primary Proof Layer | Regression Entry | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | required behavior sample | {layer} | {layer}: T-001 | None | {layer} | `pnpm exec vitest run {test_file} -t "T-001 sample"` | no expansion |

### Test Evidence Matrix

| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path Level | Fixture Boundary | Red Command | Expected Red Failure | Observed Red Failure | Green Command | TDD Status | Requires Tests Passed | Evidence Directory | Evidence Produced | Ledger File | CI Runnable? | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | AC-001 | `pnpm exec vitest run {test_file} -t "T-001 sample"` | `{test_file}` / `T-001 sample` | {layer} | RS-001, OP-001, ST-001 | {default_path_level} | no mocks | `pnpm exec vitest run {test_file} -t "T-001 sample"` | behavior gap | {observed_red} | `pnpm exec vitest run {test_file} -t "T-001 sample"` | {tdd_status} | None | `test-results/schema-test/AC-001/T-001/` | {evidence_produced} | {ledger_file} | yes, root command | required behavior | no expansion |

### Regression Test Deposit

| AC ID | Test IDs | Permanent Test File | Regression Command | Behavior Contract | Assertion Oracle | Fixture Boundary | CI Tier | Not Testing | Deposit Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | T-001 | `{test_file}` | `pnpm exec vitest run {test_file} -t "T-001 sample"` | external behavior | observable result | no mocks | PR-fast | private helpers | {deposit_status} |
"""


class ValidateTasksQualityTests(unittest.TestCase):
    def run_in_temp(self, func) -> None:
        cwd = Path.cwd()
        with tempfile.TemporaryDirectory(prefix="openspec-validator-") as tmp:
            os.chdir(tmp)
            try:
                func(Path(tmp))
            finally:
                os.chdir(cwd)

    def messages(self, findings) -> str:
        return "\n".join(f"{finding.severity}: {finding.message}" for finding in findings)

    def test_plan_gate_allows_red_required_pending_apply(self) -> None:
        findings = validator.validate(minimal_tasks(), allow_template=False, final=False)
        self.assertEqual([], [f for f in findings if f.severity == "error"], self.messages(findings))

    def test_final_gate_rejects_pending_apply_tdd(self) -> None:
        findings = validator.validate(minimal_tasks(), allow_template=False, final=True, evidence=True)
        text = self.messages(findings)
        self.assertIn("red-required", text)
        self.assertIn("Observed Red Failure", text)

    def test_final_gate_allows_empty_optional_ledger(self) -> None:
        def scenario(root: Path) -> None:
            evidence = root / "test-results/schema-test/AC-001/T-001"
            evidence.mkdir(parents=True)
            (evidence / "command.log").write_text("passed\n", encoding="utf-8")
            (evidence / "green-result.json").write_text('{"status":"passed","exitCode":0}\n', encoding="utf-8")
            (evidence / "regression-result.json").write_text('{"status":"passed","exitCode":0}\n', encoding="utf-8")
            findings = validator.validate(
                minimal_tasks(
                    tdd_status="green-passed",
                    observed_red="red failed as expected: behavior gap",
                    evidence_produced="command.log, green-result.json, regression-result.json",
                    deposit_status="deposited",
                ),
                allow_template=False,
                final=True,
                evidence=True,
            )
            self.assertEqual([], [f for f in findings if f.severity == "error"], self.messages(findings))

        self.run_in_temp(scenario)

    def test_final_gate_rejects_declared_missing_ledger(self) -> None:
        def scenario(root: Path) -> None:
            evidence = root / "test-results/schema-test/AC-001/T-001"
            evidence.mkdir(parents=True)
            (evidence / "command.log").write_text("passed\n", encoding="utf-8")
            (evidence / "green-result.json").write_text('{"status":"passed","exitCode":0}\n', encoding="utf-8")
            (evidence / "regression-result.json").write_text('{"status":"passed","exitCode":0}\n', encoding="utf-8")
            findings = validator.validate(
                minimal_tasks(
                    tdd_status="green-passed",
                    observed_red="red failed as expected: behavior gap",
                    evidence_produced="command.log, green-result.json, regression-result.json",
                    ledger_file="`test-results/schema-test/AC-001/T-001/ledger.json`",
                    deposit_status="deposited",
                ),
                allow_template=False,
                final=True,
                evidence=True,
            )
            self.assertIn("文件不存在", self.messages(findings))

        self.run_in_temp(scenario)

    def test_route_api_controller_contract_requires_default_path_pair(self) -> None:
        operation = "| OP-001 | API route auth query tenant DI request contract | T-001 |"
        findings = validator.validate(
            minimal_tasks(
                layer="route/API contract",
                default_path_level="controller-contract",
                operation_row=operation,
            ),
            allow_template=False,
            final=False,
        )
        self.assertIn("controller-contract", self.messages(findings))

    def test_component_data_testid_primary_oracle_fails(self) -> None:
        def scenario(root: Path) -> None:
            path = root / "apps/console-web/test/component/problem.test.tsx"
            path.parent.mkdir(parents=True)
            path.write_text(
                "import { render, screen } from '@testing-library/react';\n"
                "test('T-001 sample', () => {\n"
                "  render(<button data-testid=\"save\">Save</button>);\n"
                "  expect(screen.getByTestId('save')).toBeVisible();\n"
                "});\n",
                encoding="utf-8",
            )
            findings = validator.validate(
                minimal_tasks(
                    layer="component",
                    default_path_level="component-user-flow",
                    test_file="apps/console-web/test/component/problem.test.tsx",
                ),
                allow_template=False,
                final=False,
            )
            self.assertIn("data-testid", self.messages(findings))

        self.run_in_temp(scenario)


if __name__ == "__main__":
    unittest.main()
