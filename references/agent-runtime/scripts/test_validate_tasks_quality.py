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
    evidence_status: str = "planned",
    evidence_produced: str = "Pending apply execution evidence: command.log",
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

| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path Level | Fixture Boundary | Verification Expectation | Evidence Status | Requires Tests Passed | Evidence Directory | Evidence Produced | CI Runnable? | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | AC-001 | `pnpm exec vitest run {test_file} -t "T-001 sample"` | `{test_file}` / `T-001 sample` | {layer} | RS-001, OP-001, ST-001 | {default_path_level} | no mocks | behavior contract evidence | {evidence_status} | None | `openspec-results/schema-test/AC-001/T-001/` | {evidence_produced} | yes, root command | required behavior | no expansion |

### Regression Test Deposit

| AC ID | Test IDs | Permanent Test File | Regression Command | Behavior Contract | Assertion Oracle | Fixture Boundary | CI Tier | Not Testing | Deposit Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | T-001 | `{test_file}` | `pnpm exec vitest run {test_file} -t "T-001 sample"` | external behavior | observable result | no mocks | PR-fast | private helpers | {deposit_status} |
"""


def with_ac_section(markdown: str, *, ac_id: str, task_id: str, test_ids: str) -> str:
    section = f"""## {ac_id} sample

Test IDs:

- {test_ids}

- [ ] {task_id} 验证 sample。
      Trace: inherits {ac_id}
      Runtime Rows: RS-001
      Test IDs: {test_ids}
      Acceptance: sample behavior
      Proof: observable evidence
      Overrides: None

"""
    return markdown.replace("## Verification Appendix", section + "## Verification Appendix")


def with_pending_second_ac_evidence(markdown: str) -> str:
    row = (
        '| T-002 | AC-002 | `pnpm exec vitest run apps/example/example.test.ts -t "T-002 sample"` '
        '| `apps/example/example.test.ts` / `T-002 sample` | unit | RS-001, OP-001, ST-001 '
        '| service-contract | no mocks | behavior contract evidence '
        '| planned | None | `openspec-results/schema-test/AC-002/T-002/` '
        '| Pending apply execution evidence: command.log | yes, root command | required behavior | no expansion |'
    )
    return markdown.replace("\n### Regression Test Deposit", f"\n{row}\n\n### Regression Test Deposit")


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

    def test_plan_gate_allows_planned_pending_apply(self) -> None:
        findings = validator.validate(minimal_tasks(), allow_template=False, final=False)
        self.assertEqual([], [f for f in findings if f.severity == "error"], self.messages(findings))

    def test_plan_gate_rejects_legacy_test_results_evidence_directory(self) -> None:
        markdown = minimal_tasks().replace(
            "openspec-results/schema-test/AC-001/T-001/",
            "test-results/schema-test/AC-001/T-001/",
        )
        findings = validator.validate(markdown, allow_template=False, final=False)
        self.assertIn("Evidence Directory 不符合 canonical 路径", self.messages(findings))

    def test_plan_gate_rejects_result_directories_as_permanent_tests(self) -> None:
        markdown = minimal_tasks().replace(
            "`apps/example/example.test.ts` | `pnpm exec vitest",
            "`test-results/schema-test/AC-001/T-001/example.test.ts` | `pnpm exec vitest",
        )
        findings = validator.validate(markdown, allow_template=False, final=False)
        self.assertIn("Permanent Test File 不能指向一次性 evidence", self.messages(findings))

    def test_plan_gate_rejects_checkbox_test_id_owned_by_other_ac(self) -> None:
        findings = validator.validate(
            with_ac_section(minimal_tasks(), ac_id="AC-002", task_id="AC-002.1", test_ids="T-001"),
            allow_template=False,
            final=False,
        )
        text = self.messages(findings)
        self.assertIn("非 owning AC Test ID", text)
        self.assertIn("AC-001", text)
        self.assertIn("AC-002", text)

    def test_final_gate_rejects_planned_status(self) -> None:
        findings = validator.validate(minimal_tasks(), allow_template=False, final=True, evidence=True)
        text = self.messages(findings)
        self.assertIn("planned", text)
        self.assertIn("Evidence Status", text)

    def test_scoped_evidence_gate_ignores_pending_rows_from_other_ac(self) -> None:
        findings = []
        markdown = with_pending_second_ac_evidence(
            minimal_tasks(
                evidence_status="passed",
                evidence_produced="command.log",
                deposit_status="deposited",
            )
        )
        validator.validate_test_evidence(
            markdown,
            findings,
            False,
            False,
            True,
            "AC-001",
            "schema-test",
            set(),
        )
        self.assertNotIn("T-002 evidence/final audit", self.messages(findings))

    def test_final_test_evidence_gate_remains_global_for_pending_rows(self) -> None:
        findings = []
        markdown = with_pending_second_ac_evidence(
            minimal_tasks(
                evidence_status="passed",
                evidence_produced="command.log",
                deposit_status="deposited",
            )
        )
        validator.validate_test_evidence(
            markdown,
            findings,
            False,
            True,
            True,
            "AC-001",
            "schema-test",
            set(),
        )
        text = self.messages(findings)
        self.assertIn("T-002 evidence/final audit", text)
        self.assertIn("T-002 final audit", text)

    def test_final_gate_accepts_command_logs(self) -> None:
        def scenario(root: Path) -> None:
            evidence = root / "openspec-results/schema-test/AC-001/T-001"
            evidence.mkdir(parents=True)
            (evidence / "command.log").write_text("passed\n", encoding="utf-8")
            findings = validator.validate(
                minimal_tasks(
                    evidence_status="passed",
                    evidence_produced="command.log",
                    deposit_status="deposited",
                ),
                allow_template=False,
                final=True,
                evidence=True,
            )
            self.assertEqual([], [f for f in findings if f.severity == "error"], self.messages(findings))

        self.run_in_temp(scenario)

    def test_final_gate_rejects_missing_command_log(self) -> None:
        def scenario(root: Path) -> None:
            evidence = root / "openspec-results/schema-test/AC-001/T-001"
            evidence.mkdir(parents=True)
            findings = validator.validate(
                minimal_tasks(
                    evidence_status="passed",
                    evidence_produced="command.log",
                    deposit_status="deposited",
                ),
                allow_template=False,
                final=True,
                evidence=True,
            )
            self.assertIn("command.log", self.messages(findings))

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
