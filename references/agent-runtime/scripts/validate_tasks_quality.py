#!/usr/bin/env python3
"""Validate OpenSpec production tasks.md testing-quality gates.

This helper is intentionally lightweight. It checks structural invariants that
are easy to drift when agents edit a large tasks.md artifact by hand.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


TEST_ID_RE = re.compile(r"\bT-[0-9]{3}\b")
AC_ID_RE = re.compile(r"^AC-[0-9]{3}$")
EVIDENCE_RE = re.compile(r"test-results/[^/]+/AC-[0-9]{3}/T-[0-9]{3}/?$")
LEDGER_RE = re.compile(r"test-results/[^/]+/AC-[0-9]{3}/T-[0-9]{3}/ledger\.json$")
BAD_TEST_ID_RE = re.compile(r"\bT-(?:AC[0-9]|[0-9]{3}[A-Za-z-])")
TDD_STATUSES = {
    "red-required",
    "red-observed",
    "green-passed",
    "not-applicable",
    "blocked",
}
FINAL_TDD_STATUSES = {"green-passed", "not-applicable", "blocked"}
DEPOSIT_STATUSES = {"required", "deposited", "not-applicable", "blocked"}
IMPLEMENTATION_DETAIL_TERMS = [
    "private helper",
    "mock call",
    "mock 调用",
    "调用次数",
    "DOM 层级",
    "className",
    "snapshot",
    "快照全文",
    "data-testid",
    "按钮 enabled",
    "当前实现输出",
]
HIGH_RISK_RUNTIME_TERMS = [
    "route handler",
    "api",
    "data mutation",
    "mutation",
    "auth",
    "authorization",
    "permission",
    "security",
    "privacy",
    "session",
    "db",
    "database",
    "repository",
    "worker",
    "queue",
    "storage",
]
LOWER_LAYER_TERMS = [
    "unit",
    "component",
    "api",
    "contract",
    "db",
    "integration",
    "security",
    "negative",
    "config",
    "ops",
]
TEST_FILE_PATH_RE = re.compile(
    r"(?:^|[\s`])"
    r"((?:apps|packages|tests|openspec/changes|test-results)/[^\s`|,;，。]+?\."
    r"(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs))"
)
OWNER_LOCAL_LAYERS = {
    "unit",
    "component",
    "route/api contract",
    "db integration",
    "db/integration",
    "security/negative",
}
REPO_LEVEL_TEST_DIR_ALLOWLIST = {
    "e2e",
    "runtime",
    "smoke",
    "ops",
}


@dataclass
class Finding:
    severity: str
    message: str


def split_row(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|"):
        return []
    return [cell.strip() for cell in stripped.strip("|").split("|")]


def is_separator(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in cells)


def is_template_row(cells: list[str]) -> bool:
    return any("<!--" in cell for cell in cells)


def extract_change_slug(markdown: str) -> str:
    title = re.search(r"^#\s+Implementation Tasks:\s*([A-Za-z0-9_.-]+)\s*$", markdown, re.MULTILINE)
    if title:
        return title.group(1)
    evidence_path = re.search(r"\btest-results/([^/]+)/AC-[0-9]{3}/T-[0-9]{3}/", markdown)
    return evidence_path.group(1) if evidence_path else ""


def change_slug_prefixes(change_slug: str) -> set[str]:
    parts = [part for part in re.split(r"[-_]+", change_slug) if part]
    prefixes = {change_slug}
    prefixes.update("-".join(parts[:idx]) for idx in range(2, len(parts) + 1))
    prefixes.update("_".join(parts[:idx]) for idx in range(2, len(parts) + 1))
    return prefixes


def extract_test_file_paths(text: str) -> list[str]:
    return [match.strip("` ") for match in TEST_FILE_PATH_RE.findall(text)]


def validate_test_file_ownership(
    *,
    test_id: str,
    layer: str,
    field_name: str,
    field_value: str,
    change_slug: str,
    findings: list[Finding],
    reported: set[str],
) -> None:
    prefixes = change_slug_prefixes(change_slug) if change_slug else set()
    normalized_layer = layer.strip().lower()
    for path in extract_test_file_paths(field_value):
        if path.startswith("openspec/changes/"):
            key = f"{test_id}|{path}|openspec-change"
            if key not in reported:
                findings.append(Finding("error", f"{test_id} {field_name} 不能把永久测试代码放在 openspec/changes：{path}"))
                reported.add(key)
            continue
        if path.startswith("test-results/"):
            key = f"{test_id}|{path}|test-results"
            if key not in reported:
                findings.append(Finding("error", f"{test_id} {field_name} 不能把 evidence 目录当作永久测试文件：{path}"))
                reported.add(key)
            continue
        if not path.startswith("tests/"):
            continue

        parts = path.split("/")
        test_bucket = parts[1] if len(parts) > 1 else ""
        if test_bucket in prefixes:
            key = f"{test_id}|{path}|change-scope"
            if key not in reported:
                findings.append(
                    Finding(
                        "error",
                        f"{test_id} {field_name} 使用了按 change slug 聚合的测试目录：{path}；"
                        "永久测试应按 packages/apps owner 放置，或放入 tests/e2e、tests/runtime 等长期入口",
                    )
                )
                reported.add(key)
        if normalized_layer in OWNER_LOCAL_LAYERS and test_bucket not in REPO_LEVEL_TEST_DIR_ALLOWLIST:
            key = f"{test_id}|{path}|owner-local-{normalized_layer}"
            if key not in reported:
                findings.append(
                    Finding(
                        "error",
                        f"{test_id} 的 {layer or '<unknown layer>'} 测试不应放在仓库级 feature 测试目录：{path}；"
                        "请靠近对应 packages/apps production owner 放置",
                    )
                )
                reported.add(key)


def extract_table(markdown: str, heading: str) -> tuple[list[str], list[dict[str, str]]]:
    lines = markdown.splitlines()
    start = None
    heading_re = re.compile(rf"^###\s+{re.escape(heading)}\s*$")
    for idx, line in enumerate(lines):
        if heading_re.match(line.strip()):
            start = idx + 1
            break
    if start is None:
        return [], []

    table_lines: list[str] = []
    for line in lines[start:]:
        if line.startswith("### ") or line.startswith("## "):
            break
        if line.strip().startswith("|"):
            table_lines.append(line)

    if not table_lines:
        return [], []

    header = split_row(table_lines[0])
    rows: list[dict[str, str]] = []
    for line in table_lines[1:]:
        cells = split_row(line)
        if not cells or is_separator(cells):
            continue
        if len(cells) < len(header):
            cells += [""] * (len(header) - len(cells))
        rows.append(dict(zip(header, cells[: len(header)])))
    return header, rows


def add_missing_headings(markdown: str, findings: list[Finding]) -> None:
    required = [
        "## Verification Appendix",
        "### Runtime Surface Inventory",
        "### Operation Coverage Matrix",
        "### State / Branch Coverage Matrix",
        "### Async / Realtime Chain Matrix",
        "### Test Layer Plan",
        "### Test Evidence Matrix",
        "### Regression Test Deposit",
    ]
    for heading in required:
        if heading not in markdown:
            findings.append(Finding("error", f"缺少必需章节：{heading}"))


def validate_test_layer_plan(markdown: str, findings: list[Finding], allow_template: bool) -> None:
    header, rows = extract_table(markdown, "Test Layer Plan")
    required_cols = {
        "AC ID",
        "Behavior / Boundary",
        "Required Layers",
        "Test IDs By Layer",
        "Omitted Layers / Reason",
        "Primary Proof Layer",
        "Regression Entry",
        "No-Scope-Expansion Check",
    }
    missing = sorted(required_cols - set(header))
    if missing:
        findings.append(Finding("error", f"Test Layer Plan 缺少列：{', '.join(missing)}"))
    if not rows:
        findings.append(Finding("error", "Test Layer Plan 必须存在至少一行 layer decision"))
        return

    for row in rows:
        if allow_template and is_template_row(list(row.values())):
            continue
        role_text = " ".join(row.values()).lower()
        if "required behavior" in role_text or "preserve boundary" in role_text or "proof-only" in role_text:
            test_ids = TEST_ID_RE.findall(row.get("Test IDs By Layer", ""))
            if not test_ids:
                findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} 缺少 Test IDs By Layer"))
            if len(test_ids) != len(set(test_ids)):
                findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} 复用了同一个 Test ID 表示多个测试层"))
        omitted = row.get("Omitted Layers / Reason", "")
        if "已有 smoke 覆盖" in omitted or "需要真实 readback" == omitted.strip():
            findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} 的 omitted layer 理由过弱"))


def validate_test_evidence(
    markdown: str,
    findings: list[Finding],
    allow_template: bool,
    final: bool,
    change_slug: str,
    reported_ownership: set[str],
) -> set[str]:
    header, rows = extract_table(markdown, "Test Evidence Matrix")
    required_cols = {
        "Test ID",
        "AC ID",
        "Fixed Command",
        "Test File / Name",
        "Layer",
        "Covers Rows",
        "Default Path?",
        "Fixture Boundary",
        "Red Command",
        "Expected Red Failure",
        "Observed Red Failure",
        "Green Command",
        "TDD Status",
        "Requires Tests Passed",
        "Evidence Directory",
        "Evidence Produced",
        "Ledger File",
        "CI Runnable?",
        "Scope Role",
        "No-Scope-Expansion Check",
    }
    if "Source Basis" in header:
        required_cols.add("Source Basis")
    if "Scope Basis" in header:
        required_cols.add("Scope Basis")
    missing = sorted(required_cols - set(header))
    if missing:
        findings.append(Finding("error", f"Test Evidence Matrix 缺少列：{', '.join(missing)}"))

    seen: set[str] = set()
    for row in rows:
        values = list(row.values())
        if allow_template and is_template_row(values):
            continue
        test_id = row.get("Test ID", "")
        ac_id = row.get("AC ID", "")
        if not TEST_ID_RE.fullmatch(test_id):
            findings.append(Finding("error", f"Test Evidence Matrix Test ID 不合法：{test_id or '<empty>'}"))
        elif test_id in seen:
            findings.append(Finding("error", f"Test ID 重复：{test_id}"))
        else:
            seen.add(test_id)
        if not AC_ID_RE.fullmatch(ac_id):
            findings.append(Finding("error", f"{test_id or '<unknown>'} 的 AC ID 必须是单一 AC-###"))
        layer = row.get("Layer", "")
        if "+" in layer or "," in layer:
            findings.append(Finding("error", f"{test_id or '<unknown>'} 的 Layer 必须是单一层级"))
        if not row.get("Fixed Command", "").strip():
            findings.append(Finding("error", f"{test_id or '<unknown>'} 缺少 Fixed Command"))
        for col in ["Test File / Name", "Fixed Command", "Red Command", "Green Command"]:
            validate_test_file_ownership(
                test_id=test_id or "<unknown>",
                layer=layer,
                field_name=col,
                field_value=row.get(col, ""),
                change_slug=change_slug,
                findings=findings,
                reported=reported_ownership,
            )
        evidence_dir = row.get("Evidence Directory", "").strip("` ")
        if evidence_dir and not EVIDENCE_RE.search(evidence_dir):
            findings.append(Finding("error", f"{test_id or '<unknown>'} Evidence Directory 不符合 canonical 路径：{evidence_dir}"))
        ledger_file = row.get("Ledger File", "").strip("` ")
        if ledger_file and not LEDGER_RE.search(ledger_file):
            findings.append(Finding("error", f"{test_id or '<unknown>'} Ledger File 必须是 canonical ledger.json 路径：{ledger_file}"))
        if evidence_dir and ledger_file:
            expected_prefix = evidence_dir.rstrip("/") + "/"
            if not ledger_file.startswith(expected_prefix):
                findings.append(Finding("error", f"{test_id or '<unknown>'} Ledger File 不在 Evidence Directory 下"))
        evidence_produced = row.get("Evidence Produced", "")
        if evidence_produced and ("command.log" not in evidence_produced or "ledger.json" not in evidence_produced):
            findings.append(Finding("error", f"{test_id or '<unknown>'} Evidence Produced 必须包含 command.log 和 ledger.json"))
        if not row.get("CI Runnable?", "").strip():
            findings.append(Finding("error", f"{test_id or '<unknown>'} 缺少 CI Runnable? 说明"))
        scope_role = row.get("Scope Role", "").lower()
        tdd_status = row.get("TDD Status", "")
        if tdd_status and tdd_status not in TDD_STATUSES:
            findings.append(Finding("error", f"{test_id or '<unknown>'} TDD Status 不合法：{tdd_status}"))
        if "required behavior" in scope_role:
            if tdd_status == "red-required":
                findings.append(Finding("error", f"{test_id} required behavior 不能停留在 red-required"))
            if final and tdd_status not in FINAL_TDD_STATUSES:
                findings.append(Finding("error", f"{test_id} final audit 时 required behavior TDD Status 必须是 green-passed / not-applicable / blocked"))
            for col in ["Red Command", "Expected Red Failure", "Observed Red Failure", "Green Command", "TDD Status"]:
                if not row.get(col, "").strip():
                    findings.append(Finding("error", f"{test_id} required behavior 缺少 TDD 字段：{col}"))
    return seen


def validate_regression_deposit(
    markdown: str,
    evidence_ids: set[str],
    findings: list[Finding],
    allow_template: bool,
    final: bool,
    change_slug: str,
    reported_ownership: set[str],
) -> None:
    header, rows = extract_table(markdown, "Regression Test Deposit")
    required_cols = {
        "AC ID",
        "Test IDs",
        "Permanent Test File",
        "Regression Command",
        "Behavior Contract",
        "Assertion Oracle",
        "Fixture Boundary",
        "CI Tier",
        "Not Testing",
        "Deposit Status",
    }
    missing = sorted(required_cols - set(header))
    if missing:
        findings.append(Finding("error", f"Regression Test Deposit 缺少列：{', '.join(missing)}"))
    if not rows:
        findings.append(Finding("error", "Regression Test Deposit 必须存在至少一行"))
        return

    deposited_ids: set[str] = set()
    for row in rows:
        values = list(row.values())
        if allow_template and is_template_row(values):
            continue
        ids = TEST_ID_RE.findall(row.get("Test IDs", ""))
        for test_id in ids:
            if test_id not in evidence_ids:
                findings.append(Finding("error", f"Regression Deposit 引用了不存在的 Evidence row：{test_id}"))
            deposited_ids.add(test_id)
        status = row.get("Deposit Status", "")
        if status and status not in DEPOSIT_STATUSES:
            findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} Deposit Status 不合法：{status}"))
        if final and status == "required":
            findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} 完成状态不能停留在 required"))
        if status in {"required", "deposited"}:
            for col in [
                "Permanent Test File",
                "Regression Command",
                "Behavior Contract",
                "Assertion Oracle",
                "CI Tier",
            ]:
                if not row.get(col, "").strip():
                    findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} Regression Deposit 缺少 {col}"))
            permanent = row.get("Permanent Test File", "")
            if "test-results/" in permanent or "ledger" in permanent.lower():
                findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} Permanent Test File 不能指向一次性 evidence 或 ledger"))
            validate_test_file_ownership(
                test_id=", ".join(ids) if ids else row.get("AC ID", "<unknown>"),
                layer="",
                field_name="Permanent Test File",
                field_value=permanent,
                change_slug=change_slug,
                findings=findings,
                reported=reported_ownership,
            )
            validate_test_file_ownership(
                test_id=", ".join(ids) if ids else row.get("AC ID", "<unknown>"),
                layer="",
                field_name="Regression Command",
                field_value=row.get("Regression Command", ""),
                change_slug=change_slug,
                findings=findings,
                reported=reported_ownership,
            )
        oracle = row.get("Assertion Oracle", "")
        if any(term in oracle for term in IMPLEMENTATION_DETAIL_TERMS):
            findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} 使用了 implementation-detail assertion oracle"))
    missing_deposit = evidence_ids - deposited_ids
    if missing_deposit and not allow_template:
        findings.append(Finding("error", f"以下 Test ID 缺少 Regression Deposit 行：{', '.join(sorted(missing_deposit))}"))


def validate_runtime_not_applicable(markdown: str, findings: list[Finding], allow_template: bool) -> None:
    for heading in [
        "Runtime Surface Inventory",
        "Operation Coverage Matrix",
        "State / Branch Coverage Matrix",
        "Async / Realtime Chain Matrix",
    ]:
        _header, rows = extract_table(markdown, heading)
        if not rows:
            findings.append(Finding("error", f"{heading} 缺少行；无 runtime 行为时也必须保留 Not applicable 最小行"))
            continue
        for row in rows:
            if allow_template and is_template_row(list(row.values())):
                continue
            text = " ".join(row.values())
            if "Not applicable" in text and not ("理由" in text or "source" in text.lower() or "scope" in text.lower() or "依据" in text):
                findings.append(Finding("error", f"{heading} 的 Not applicable 行缺少 source/scope-backed 理由"))


def validate_high_risk_layers(markdown: str, findings: list[Finding], allow_template: bool) -> None:
    runtime_text_parts: list[str] = []
    for heading in [
        "Runtime Surface Inventory",
        "Operation Coverage Matrix",
        "State / Branch Coverage Matrix",
        "Async / Realtime Chain Matrix",
    ]:
        _header, rows = extract_table(markdown, heading)
        for row in rows:
            if allow_template and is_template_row(list(row.values())):
                continue
            row_text = " ".join(row.values())
            if "Not applicable" not in row_text:
                runtime_text_parts.append(row_text)

    runtime_text = " ".join(runtime_text_parts).lower()
    if not any(term in runtime_text for term in HIGH_RISK_RUNTIME_TERMS):
        return

    _header, rows = extract_table(markdown, "Test Evidence Matrix")
    layer_text = " ".join(
        row.get("Layer", "").lower()
        for row in rows
        if not (allow_template and is_template_row(list(row.values())))
    )
    if not any(term in layer_text for term in LOWER_LAYER_TERMS):
        findings.append(
            Finding(
                "error",
                "检测到 API/DB/auth/security/worker/storage 等高风险 runtime 语义，但 Test Evidence Matrix 未登记可低层稳定断言的测试层；不能只用 browser/smoke proof",
            )
        )


def validate(markdown: str, allow_template: bool, final: bool) -> list[Finding]:
    findings: list[Finding] = []
    change_slug = extract_change_slug(markdown)
    reported_ownership: set[str] = set()
    add_missing_headings(markdown, findings)
    bad_id_source = re.sub(r"<!--.*?-->", "", markdown, flags=re.DOTALL) if allow_template else markdown
    if BAD_TEST_ID_RE.search(bad_id_source):
        findings.append(Finding("error", "发现带名称、AC 编号、slug 或字母后缀的非法 Test ID"))
    validate_test_layer_plan(markdown, findings, allow_template)
    evidence_ids = validate_test_evidence(markdown, findings, allow_template, final, change_slug, reported_ownership)
    validate_regression_deposit(markdown, evidence_ids, findings, allow_template, final, change_slug, reported_ownership)
    validate_runtime_not_applicable(markdown, findings, allow_template)
    validate_high_risk_layers(markdown, findings, allow_template)
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tasks_md", type=Path)
    parser.add_argument("--allow-template", action="store_true", help="ignore placeholder rows containing HTML comments")
    parser.add_argument("--final", action="store_true", help="treat required regression deposits as errors")
    args = parser.parse_args()

    markdown = args.tasks_md.read_text(encoding="utf-8")
    findings = validate(markdown, allow_template=args.allow_template, final=args.final)
    for finding in findings:
        print(f"{finding.severity.upper()}: {finding.message}", file=sys.stderr)
    return 1 if any(f.severity == "error" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
