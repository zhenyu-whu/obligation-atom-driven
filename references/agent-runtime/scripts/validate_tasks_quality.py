#!/usr/bin/env python3
"""Validate OpenSpec production tasks.md testing-quality gates.

This helper is intentionally lightweight. It checks structural invariants that
are easy to drift when agents edit a large tasks.md artifact by hand.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


TEST_ID_RE = re.compile(r"\bT-[0-9]{3}\b")
AC_ID_RE = re.compile(r"^AC-[0-9]{3}$")
AC_HEADING_RE = re.compile(r"^##\s+(AC-[0-9]{3})\b")
TASK_CHECKBOX_RE = re.compile(r"^-\s+\[[ xX]\]\s+(AC-[0-9]{3}\.[0-9]+)\b")
FIELD_HEADING_RE = re.compile(r"^[A-Za-z][A-Za-z /-]*:\s*(?:$|<!--)")
EVIDENCE_RE = re.compile(r"openspec-results/[^/]+/AC-[0-9]{3}/T-[0-9]{3}/?$")
BAD_TEST_ID_RE = re.compile(r"\bT-(?:AC[0-9]|[0-9]{3}[A-Za-z-])")
PNPM_TEST_FORWARDED_ARGS_RE = re.compile(
    r"\bpnpm\b[^\n|`]*\b(?:run\s+)?test(?::[A-Za-z0-9:_-]+)?\b[^\n|`]*\s--\s+"
)
PNPM_BROAD_TEST_RE = re.compile(
    r"^\s*`?pnpm(?:\s+--filter\s+\S+)?\s+(?:run\s+)?test(?::[A-Za-z0-9:_-]+)?\s*`?\s*$"
)
EVIDENCE_STATUSES = {"planned", "passed", "not-applicable", "blocked"}
FINAL_EVIDENCE_STATUSES = {"passed", "not-applicable", "blocked"}
DEPOSIT_STATUSES = {"required", "deposited", "not-applicable", "blocked"}
EXECUTION_EVIDENCE_FILES = {
    "command.log",
    "junit.xml",
    "results.xml",
    "report.json",
    "test-report.json",
    "results.json",
}
EXECUTION_EVIDENCE_NAME_RE = re.compile(
    r"(?:command|result|report|junit|vitest|playwright).*\.(?:log|json|xml)$",
    re.IGNORECASE,
)
BROWSER_E2E_MARKERS = [
    "@playwright/test",
    "chromium",
    "firefox",
    "webkit",
    "page.goto",
    "browser.newContext",
    "context.newPage",
    "getByRole(",
    "locator(",
]
COMPONENT_HARNESS_MARKERS = [
    "@testing-library/react",
    "render(",
    "mount(",
    "hydrateRoot(",
    "screen.getByRole",
    "screen.findByRole",
    "screen.getByLabelText",
    "userEvent.",
    "fireEvent.",
]
ACCESSIBLE_ORACLE_MARKERS = [
    "getByRole",
    "findByRole",
    "queryByRole",
    "getByLabelText",
    "findByLabelText",
    "getByText",
    "findByText",
    "toHaveTextContent",
    "toHaveAccessibleName",
    "toHaveURL",
]
IMPLEMENTATION_DETAIL_ASSERTION_MARKERS = [
    "getByTestId",
    "queryByTestId",
    "findByTestId",
    "data-testid",
    "toHaveClass",
    "className",
    "classList",
    "toMatchSnapshot",
]
DB_INTEGRATION_MARKERS = [
    "prisma",
    "db.",
    "database",
    "repository",
    "transaction",
    "$transaction",
    "sql",
    "postgres",
    "redis",
    "testcontainer",
]
SECURITY_NEGATIVE_MARKERS = [
    "unauthorized",
    "forbidden",
    "permission",
    "capability",
    "tenant",
    "redact",
    "privacy",
    "sensitive",
    "audit",
    "401",
    "403",
]
DEFAULT_PATH_LEVELS = {
    "http-app",
    "route-handler-real-service",
    "component-user-flow",
    "db-integration",
    "service-contract",
    "controller-contract",
    "browser-e2e",
    "static-analysis",
}
DEFAULT_PRODUCTION_PATH_LEVELS = {
    "http-app",
    "route-handler-real-service",
    "component-user-flow",
    "db-integration",
    "browser-e2e",
}
ROUTE_DEFAULT_REQUIRED_TERMS = [
    "route",
    "api",
    "auth",
    "authorization",
    "permission",
    "session",
    "query",
    "tenant",
    "di",
    "dependency",
    "request",
    "dto",
]
APPLY_PENDING_TERMS = [
    "pending apply",
    "apply 阶段",
    "待 apply",
    "tbd",
    "not run yet",
    "未执行",
]
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
    r"((?:apps|packages|tests|openspec/changes|openspec-results|test-results)/[^\s`|,;，。]+?\."
    r"(?:test|spec)\.(?:tsx|ts|jsx|js|mjs|cjs))"
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
    evidence_path = re.search(r"\bopenspec-results/([^/]+)/AC-[0-9]{3}/T-[0-9]{3}/", markdown)
    return evidence_path.group(1) if evidence_path else ""


def change_slug_prefixes(change_slug: str) -> set[str]:
    parts = [part for part in re.split(r"[-_]+", change_slug) if part]
    prefixes = {change_slug}
    prefixes.update("-".join(parts[:idx]) for idx in range(2, len(parts) + 1))
    prefixes.update("_".join(parts[:idx]) for idx in range(2, len(parts) + 1))
    return prefixes


def extract_test_file_paths(text: str) -> list[str]:
    return [match.strip("` ") for match in TEST_FILE_PATH_RE.findall(text)]


def strip_cell_markup(value: str) -> str:
    return value.strip().strip("`").strip()


def row_value(row: dict[str, str], *names: str) -> str:
    for name in names:
        value = row.get(name)
        if value is not None:
            return value
    return ""


def mentions_pending_apply(value: str) -> bool:
    lowered = value.lower()
    return any(term in lowered for term in APPLY_PENDING_TERMS)


def row_text(row: dict[str, str]) -> str:
    return " ".join(row.values())


def default_path_level(row: dict[str, str]) -> str:
    raw = strip_cell_markup(row_value(row, "Default Path Level", "Default Path?"))
    if not raw:
        return ""
    first = re.split(r"[\s,，;；:：]+", raw.lower(), maxsplit=1)[0]
    if first in DEFAULT_PATH_LEVELS:
        return first
    if raw.lower().startswith("yes"):
        return "legacy-yes"
    if raw.lower().startswith("no"):
        return "legacy-no"
    return first


def has_default_path_level_header(header: list[str]) -> bool:
    return "Default Path Level" in header


def route_default_path_required(row: dict[str, str]) -> bool:
    text = row_text(row).lower()
    return any(term in text for term in ROUTE_DEFAULT_REQUIRED_TERMS)


def text_has_default_path_pairing(value: str) -> bool:
    lowered = value.lower()
    return (
        "paired" in lowered
        or "default-path" in lowered
        or "default path" in lowered
        or "production path" in lowered
        or "http-app" in lowered
        or "route-handler-real-service" in lowered
    ) and bool(TEST_ID_RE.search(value))


def test_file_sources(test_file_field: str) -> list[tuple[str, str]]:
    sources: list[tuple[str, str]] = []
    for path_text in extract_test_file_paths(test_file_field):
        path = Path(path_text)
        if not path.exists() or not path.is_file():
            continue
        try:
            sources.append((path_text, path.read_text(encoding="utf-8")))
        except OSError:
            continue
    return sources


def source_has_implementation_detail_primary_oracle(source: str) -> bool:
    if not any(marker in source for marker in IMPLEMENTATION_DETAIL_ASSERTION_MARKERS):
        return False
    return not any(marker in source for marker in ACCESSIBLE_ORACLE_MARKERS)


def validate_fixed_command_shape(
    *, test_id: str, field_name: str, command: str, findings: list[Finding]
) -> None:
    normalized = strip_cell_markup(command)
    if not normalized:
        return
    if PNPM_BROAD_TEST_RE.match(normalized):
        findings.append(
            Finding(
                "error",
                f"{test_id} {field_name} 是 broad test command，不能作为单个 Test ID 的最小固定命令：{normalized}",
            )
        )
    if PNPM_TEST_FORWARDED_ARGS_RE.search(normalized):
        findings.append(
            Finding(
                "error",
                f"{test_id} {field_name} 通过 pnpm test/test:e2e 的 `--` 透传 file/filter；"
                "这类参数可能被 runner 当作 positional args 而不是 test-name filter。"
                "请使用 `pnpm exec vitest ... <file> -t <name>`、Playwright 直接命令，或专用 package script。",
            )
        )


def validate_browser_e2e_file(
    *, test_id: str, test_file_field: str, findings: list[Finding]
) -> None:
    paths = extract_test_file_paths(test_file_field)
    if not paths:
        findings.append(Finding("error", f"{test_id} browser E2E 缺少可检查的 Test File path"))
        return
    for path_text, source in test_file_sources(test_file_field):
        if not any(marker in source for marker in BROWSER_E2E_MARKERS):
            findings.append(
                Finding(
                    "error",
                    f"{test_id} Layer 标为 browser E2E，但 {path_text} 未发现 Playwright/browser runtime markers；"
                    "直接调用 route handler、repository 或状态机只能登记为 integration/component/unit 层，不能登记为 browser E2E。",
                )
            )
        if source_has_implementation_detail_primary_oracle(source):
            findings.append(
                Finding(
                    "error",
                    f"{test_id} browser E2E 的 {path_text} 主要使用 data-testid/className/snapshot 等实现细节断言，"
                    "必须改用用户可见 role/label/text/readback/URL 等行为 oracle。",
                )
            )


def validate_component_file(
    *, test_id: str, test_file_field: str, findings: list[Finding]
) -> None:
    paths = extract_test_file_paths(test_file_field)
    if not paths:
        findings.append(Finding("error", f"{test_id} component 测试缺少可检查的 Test File path"))
        return
    for path_text, source in test_file_sources(test_file_field):
        if not any(marker in source for marker in COMPONENT_HARNESS_MARKERS):
            findings.append(
                Finding(
                    "error",
                    f"{test_id} Layer 标为 component，但 {path_text} 未发现交互式 component harness markers；"
                    "静态 markup、状态机或 snapshot 只能登记为 unit/static supplemental proof。",
                )
            )
        if source_has_implementation_detail_primary_oracle(source):
            findings.append(
                Finding(
                    "error",
                    f"{test_id} component 测试的 {path_text} 主要使用 data-testid/className/snapshot 等实现细节断言，"
                    "必须改用 role/label/text/user event 后的可观察行为 oracle。",
                )
            )


def validate_layer_specific_test_file(
    *, test_id: str, layer: str, test_file_field: str, findings: list[Finding]
) -> None:
    normalized = layer.strip().lower()
    if normalized == "browser e2e":
        validate_browser_e2e_file(test_id=test_id, test_file_field=test_file_field, findings=findings)
        return
    if normalized == "component":
        validate_component_file(test_id=test_id, test_file_field=test_file_field, findings=findings)
        return

    for path_text, source in test_file_sources(test_file_field):
        lowered = source.lower()
        if normalized in {"db integration", "db/integration"}:
            if "mock" in lowered and not any(marker in lowered for marker in DB_INTEGRATION_MARKERS):
                findings.append(
                    Finding(
                        "error",
                        f"{test_id} DB integration 的 {path_text} 只呈现 mock/fixture 路径，缺少 DB/repository/transaction/readback marker。",
                    )
                )
        if normalized == "security/negative":
            if not any(marker in lowered for marker in SECURITY_NEGATIVE_MARKERS):
                findings.append(
                    Finding(
                        "error",
                        f"{test_id} security/negative 的 {path_text} 缺少 unauthorized/tenant/redaction/audit 等安全负向 marker。",
                    )
                )


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
        if path.startswith(("openspec-results/", "test-results/")):
            key = f"{test_id}|{path}|result-evidence"
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
    strict_evidence: bool,
    scope_ac: str | None,
    change_slug: str,
    reported_ownership: set[str],
) -> tuple[set[str], list[dict[str, str]]]:
    header, rows = extract_table(markdown, "Test Evidence Matrix")
    required_cols = {
        "Test ID",
        "AC ID",
        "Fixed Command",
        "Test File / Name",
        "Layer",
        "Covers Rows",
        "Fixture Boundary",
        "Verification Expectation",
        "Evidence Status",
        "Requires Tests Passed",
        "Evidence Directory",
        "Evidence Produced",
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
    if "Default Path Level" not in header and "Default Path?" not in header:
        findings.append(Finding("error", "Test Evidence Matrix 缺少列：Default Path Level（旧表可兼容 Default Path?）"))

    seen: set[str] = set()
    effective_rows: list[dict[str, str]] = []
    for row in rows:
        values = list(row.values())
        if allow_template and is_template_row(values):
            continue
        effective_rows.append(row)
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
        command_cols = ["Fixed Command"]
        for col in command_cols:
            validate_fixed_command_shape(
                test_id=test_id or "<unknown>",
                field_name=col,
                command=row.get(col, ""),
                findings=findings,
            )
        for col in ["Test File / Name", *command_cols]:
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
        evidence_produced = row.get("Evidence Produced", "")
        if (
            evidence_produced
            and not mentions_pending_apply(evidence_produced)
            and not text_mentions_execution_evidence(evidence_produced)
        ):
            findings.append(Finding("error", f"{test_id or '<unknown>'} Evidence Produced 必须包含 command.log 或等价 CI/runner 执行日志"))
        if not row.get("CI Runnable?", "").strip():
            findings.append(Finding("error", f"{test_id or '<unknown>'} 缺少 CI Runnable? 说明"))
        validate_layer_specific_test_file(
            test_id=test_id or "<unknown>",
            layer=layer,
            test_file_field=row.get("Test File / Name", ""),
            findings=findings,
        )
        if has_default_path_level_header(header):
            level = default_path_level(row)
            if level and level not in DEFAULT_PATH_LEVELS:
                findings.append(
                    Finding(
                        "error",
                        f"{test_id or '<unknown>'} Default Path Level 不合法：{row.get('Default Path Level', '')}",
                    )
                )
        scope_role = row.get("Scope Role", "").lower()
        evidence_status = row.get("Evidence Status", "")
        strict_this_row = strict_evidence and (
            final or scope_ac is None or strip_cell_markup(ac_id) == scope_ac
        )
        if evidence_status and evidence_status not in EVIDENCE_STATUSES:
            findings.append(Finding("error", f"{test_id or '<unknown>'} Evidence Status 不合法：{evidence_status}"))
        if "required behavior" in scope_role:
            if strict_this_row and evidence_status == "planned":
                findings.append(Finding("error", f"{test_id} evidence/final audit 时 required behavior 不能停留在 planned"))
            if final and evidence_status not in FINAL_EVIDENCE_STATUSES:
                findings.append(Finding("error", f"{test_id} final audit 时 required behavior Evidence Status 必须是 passed / not-applicable / blocked"))
            evidence_cols = ["Verification Expectation", "Evidence Status"]
            for col in evidence_cols:
                if not row.get(col, "").strip():
                    findings.append(Finding("error", f"{test_id} required behavior 缺少 verification 字段：{col}"))
    return seen, effective_rows


def validate_ac_local_test_id_ownership(
    markdown: str,
    evidence_rows: list[dict[str, str]],
    findings: list[Finding],
    allow_template: bool,
) -> None:
    evidence_owner_by_id = {
        strip_cell_markup(row.get("Test ID", "")): strip_cell_markup(row.get("AC ID", ""))
        for row in evidence_rows
        if strip_cell_markup(row.get("Test ID", ""))
    }
    if not evidence_owner_by_id:
        return

    def check_ids(owner_ac: str, label: str, text: str) -> None:
        if allow_template and "<!--" in text:
            return
        for test_id in TEST_ID_RE.findall(text):
            evidence_owner = evidence_owner_by_id.get(test_id)
            if evidence_owner is None:
                findings.append(Finding("error", f"{label} 引用了未登记的 Test ID：{test_id}"))
            elif evidence_owner != owner_ac:
                findings.append(
                    Finding(
                        "error",
                        f"{label} 引用了非 owning AC Test ID：{test_id} 属于 {evidence_owner}，不能出现在 {owner_ac}",
                    )
                )

    current_ac: str | None = None
    current_task: tuple[str, str] | None = None
    collecting_ac_test_ids = False

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        ac_heading = AC_HEADING_RE.match(line)
        if ac_heading:
            current_ac = ac_heading.group(1)
            current_task = None
            collecting_ac_test_ids = False
            continue
        if line.startswith("## "):
            current_ac = None
            current_task = None
            collecting_ac_test_ids = False
            continue
        if current_ac is None:
            continue

        checkbox = TASK_CHECKBOX_RE.match(line)
        if checkbox:
            task_id = checkbox.group(1)
            task_ac = task_id.split(".", 1)[0]
            if task_ac != current_ac:
                findings.append(Finding("error", f"{task_id} 不在 matching AC section 中：当前 section 是 {current_ac}"))
            current_task = (task_id, task_ac)
            collecting_ac_test_ids = False
            continue

        if current_task is not None:
            if not line.strip():
                current_task = None
                continue
            field = re.match(r"^\s*Test IDs:\s*(.*)$", line)
            if field:
                task_id, task_ac = current_task
                check_ids(task_ac, f"{task_id} checkbox Test IDs", field.group(1))
            continue

        field = re.match(r"^Test IDs:\s*(.*)$", line)
        if field:
            collecting_ac_test_ids = True
            check_ids(current_ac, f"{current_ac} section Test IDs", field.group(1))
            continue
        if collecting_ac_test_ids:
            if not line.strip():
                continue
            if FIELD_HEADING_RE.match(line):
                collecting_ac_test_ids = False
                continue
            if line.lstrip().startswith("-"):
                check_ids(current_ac, f"{current_ac} section Test IDs", line)
                continue
            collecting_ac_test_ids = False


def validate_regression_deposit(
    markdown: str,
    evidence_ids: set[str],
    findings: list[Finding],
    allow_template: bool,
    final: bool,
    change_slug: str,
    reported_ownership: set[str],
) -> dict[str, dict[str, str]]:
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
        return {}

    deposited_ids: set[str] = set()
    deposit_by_id: dict[str, dict[str, str]] = {}
    for row in rows:
        values = list(row.values())
        if allow_template and is_template_row(values):
            continue
        ids = TEST_ID_RE.findall(row.get("Test IDs", ""))
        for test_id in ids:
            if test_id not in evidence_ids:
                findings.append(Finding("error", f"Regression Deposit 引用了不存在的 Evidence row：{test_id}"))
            deposited_ids.add(test_id)
            deposit_by_id[test_id] = row
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
            if "openspec-results/" in permanent or "test-results/" in permanent:
                findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} Permanent Test File 不能指向一次性 evidence"))
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
            validate_fixed_command_shape(
                test_id=", ".join(ids) if ids else row.get("AC ID", "<unknown>"),
                field_name="Regression Command",
                command=row.get("Regression Command", ""),
                findings=findings,
            )
        oracle = row.get("Assertion Oracle", "")
        if any(term in oracle for term in IMPLEMENTATION_DETAIL_TERMS):
            findings.append(Finding("error", f"{row.get('AC ID', '<unknown>')} 使用了 implementation-detail assertion oracle"))
    missing_deposit = evidence_ids - deposited_ids
    if missing_deposit and not allow_template:
        findings.append(Finding("error", f"以下 Test ID 缺少 Regression Deposit 行：{', '.join(sorted(missing_deposit))}"))
    return deposit_by_id


def validate_evidence_deposit_consistency(
    evidence_rows: list[dict[str, str]],
    deposit_by_id: dict[str, dict[str, str]],
    findings: list[Finding],
    strict_ids: set[str],
) -> None:
    for row in evidence_rows:
        test_id = row.get("Test ID", "")
        deposit = deposit_by_id.get(test_id)
        if not deposit:
            continue
        evidence_status = row.get("Evidence Status", "")
        deposit_status = deposit.get("Deposit Status", "")
        scope_role = row.get("Scope Role", "").lower()
        if deposit_status == "deposited" and evidence_status == "blocked":
            findings.append(
                Finding(
                    "error",
                    f"{test_id} Regression Deposit 为 deposited，但 Test Evidence Evidence Status 仍是 blocked",
                )
            )
        if (
            test_id in strict_ids
            and "required behavior" in scope_role
            and deposit_status == "deposited"
            and evidence_status != "passed"
        ):
            findings.append(
                Finding(
                    "error",
                    f"{test_id} final audit 中 deposited required behavior 必须是 passed，当前为 {evidence_status or '<empty>'}",
                )
            )
        if test_id in strict_ids and "required behavior" in scope_role and deposit_status == "required":
            findings.append(
                Finding(
                    "error",
                    f"{test_id} evidence gate 中 required behavior 的 Regression Deposit 不能停留在 required",
                )
            )


def validate_default_path_contracts(
    evidence_rows: list[dict[str, str]],
    findings: list[Finding],
) -> None:
    route_default_path_ids_by_ac: dict[str, set[str]] = {}
    for row in evidence_rows:
        level = default_path_level(row)
        if level in {"http-app", "route-handler-real-service"} or level == "legacy-yes":
            route_default_path_ids_by_ac.setdefault(strip_cell_markup(row.get("AC ID", "")), set()).add(
                strip_cell_markup(row.get("Test ID", ""))
            )

    for row in evidence_rows:
        test_id = strip_cell_markup(row.get("Test ID", ""))
        ac_id = strip_cell_markup(row.get("AC ID", ""))
        layer = row.get("Layer", "").strip().lower()
        level = default_path_level(row)
        if layer != "route/api contract":
            continue
        if not route_default_path_required(row):
            continue
        if level in {"http-app", "route-handler-real-service", "legacy-yes"}:
            continue
        paired_ids = route_default_path_ids_by_ac.get(ac_id, set()) - {test_id}
        fixture = row.get("Fixture Boundary", "")
        if level == "controller-contract" and (paired_ids or text_has_default_path_pairing(fixture)):
            continue
        findings.append(
            Finding(
                "error",
                f"{test_id} route/API contract 涉及 route/auth/query/tenant/DI 等默认路径语义，"
                "不能只用 controller-contract；必须配对 http-app 或 route-handler-real-service Test ID。",
            )
        )


def read_json(path: Path) -> dict[str, object] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path} JSON 解析失败：{exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{path} 顶层必须是 JSON object")
    return value


def result_indicates_pass(value: object) -> bool:
    if isinstance(value, dict):
        status = str(value.get("status", "")).lower()
        exit_code = value.get("exitCode")
        if status in {"passed", "pass", "ok", "success"}:
            return True
        if exit_code == 0 and status not in {"failed", "error", "blocked"}:
            return True
    if isinstance(value, str):
        lowered = value.lower()
        return any(token in lowered for token in ["passed", "pass", "ok", "success", "exit 0", "exitcode 0"])
    return False


def text_mentions_execution_evidence(value: str) -> bool:
    lowered = value.lower()
    return any(
        token in lowered
        for token in [
            "command.log",
            "runner",
            "ci",
            "junit",
            "report",
            "result",
        ]
    )


def execution_evidence_artifact(evidence_dir: Path) -> str | None:
    if not evidence_dir.exists():
        return None
    if not evidence_dir.is_dir():
        return None
    for name in EXECUTION_EVIDENCE_FILES:
        candidate = evidence_dir / name
        if candidate.exists():
            return candidate.as_posix()
    for child in evidence_dir.iterdir():
        if child.is_file() and EXECUTION_EVIDENCE_NAME_RE.search(child.name):
            return child.as_posix()
    return None


def read_optional_result(path: Path, test_id: str, findings: list[Finding]) -> dict[str, object] | None:
    try:
        return read_json(path)
    except ValueError as exc:
        findings.append(Finding("error", f"{test_id} result evidence 无法读取：{exc}"))
        return None


def read_execution_result_artifact(evidence_dir: Path | None, test_id: str, findings: list[Finding]) -> object:
    if evidence_dir is None or not evidence_dir.exists() or not evidence_dir.is_dir():
        return None
    for name in EXECUTION_EVIDENCE_FILES:
        candidate = evidence_dir / name
        if not candidate.exists() or not candidate.is_file():
            continue
        if candidate.suffix == ".json":
            try:
                value = read_json(candidate)
            except ValueError:
                value = None
            if result_indicates_pass(value):
                return value
        try:
            text = candidate.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            findings.append(Finding("error", f"{test_id} execution evidence 无法读取：{candidate.as_posix()}：{exc}"))
            continue
        if result_indicates_pass(text):
            return text
    return None


def effective_fixed_command(row: dict[str, str]) -> str:
    return strip_cell_markup(row.get("Fixed Command", ""))


def validate_execution_evidence(
    *,
    evidence_rows: list[dict[str, str]],
    deposit_by_id: dict[str, dict[str, str]],
    findings: list[Finding],
    scope_ac: str | None = None,
) -> None:
    scoped_rows = [
        row
        for row in evidence_rows
        if not scope_ac or strip_cell_markup(row.get("AC ID", "")) == scope_ac
    ]
    for row in scoped_rows:
        test_id = row.get("Test ID", "")
        ac_id = row.get("AC ID", "")
        evidence_dir_field = strip_cell_markup(row.get("Evidence Directory", "")).rstrip("/")
        evidence_dir = Path(evidence_dir_field) if evidence_dir_field else None
        if evidence_dir is None:
            findings.append(Finding("error", f"{test_id} 缺少 Evidence Directory，无法校验执行证据"))
        else:
            artifact = execution_evidence_artifact(evidence_dir)
            if artifact is None:
                findings.append(
                    Finding(
                        "error",
                        f"{test_id} 缺少当前 worktree 执行证据：{evidence_dir.as_posix()} 下需要 command.log 或 runner/CI result/report",
                    )
                )
        execution_result = read_execution_result_artifact(evidence_dir, test_id, findings)
        deposit = deposit_by_id.get(test_id)
        if deposit:
            expected_regression = strip_cell_markup(deposit.get("Regression Command", ""))
            if deposit.get("Deposit Status", "") == "deposited":
                command_passed = result_indicates_pass(execution_result)
                regression_passed = command_passed
                fixed_command = effective_fixed_command(row)
                if expected_regression and fixed_command and expected_regression == fixed_command and command_passed:
                    regression_passed = True
                if not command_passed:
                    findings.append(
                        Finding(
                            "error",
                            f"{test_id} Regression Deposit 为 deposited，但 command.log 或 runner/CI result/report 未证明通过",
                        )
                    )
                if not regression_passed:
                    findings.append(
                        Finding(
                            "error",
                            f"{test_id} Regression Deposit 为 deposited，但 Fixed Command 或等价 runner/CI result/report 未证明 regression 通过",
                        )
                    )


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


def validate_high_risk_layers(
    markdown: str,
    findings: list[Finding],
    allow_template: bool,
    evidence_rows: list[dict[str, str]],
) -> None:
    evidence_by_id = {
        strip_cell_markup(row.get("Test ID", "")): row
        for row in evidence_rows
        if strip_cell_markup(row.get("Test ID", ""))
    }
    any_high_risk_runtime = False
    any_lower_layer = any(
        any(term in row.get("Layer", "").lower() for term in LOWER_LAYER_TERMS)
        for row in evidence_rows
    )
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
            if "Not applicable" in row_text:
                continue
            if "proof-only" in row.get("Scope Role", "").lower():
                continue
            lowered = row_text.lower()
            if not any(term in lowered for term in HIGH_RISK_RUNTIME_TERMS):
                continue
            any_high_risk_runtime = True
            test_ids = TEST_ID_RE.findall(row.get("Test IDs", ""))
            if not test_ids:
                continue
            matching_rows = [evidence_by_id[test_id] for test_id in test_ids if test_id in evidence_by_id]
            if not matching_rows:
                continue
            if not any(any(term in evidence.get("Layer", "").lower() for term in LOWER_LAYER_TERMS) for evidence in matching_rows):
                row_id = (
                    row.get("Surface ID")
                    or row.get("Operation ID")
                    or row.get("State ID")
                    or row.get("Chain ID")
                    or heading
                )
                findings.append(
                    Finding(
                        "error",
                        f"{row_id} 检测到 API/DB/auth/security/worker/storage 等高风险 runtime 语义，"
                        "但其 Test IDs 未包含可低层稳定断言的 unit/component/API/DB/security/config 测试层。",
                    )
                )

    if any_high_risk_runtime and not any_lower_layer:
        findings.append(
            Finding(
                "error",
                "检测到 API/DB/auth/security/worker/storage 等高风险 runtime 语义，但 Test Evidence Matrix 未登记可低层稳定断言的测试层；不能只用 browser/smoke proof",
            )
        )


def validate(
    markdown: str,
    allow_template: bool,
    final: bool,
    evidence: bool = False,
    ac_id: str | None = None,
) -> list[Finding]:
    findings: list[Finding] = []
    if ac_id and not AC_ID_RE.fullmatch(ac_id):
        findings.append(Finding("error", f"--ac 必须是单一 AC-###：{ac_id}"))
        return findings
    change_slug = extract_change_slug(markdown)
    reported_ownership: set[str] = set()
    add_missing_headings(markdown, findings)
    bad_id_source = re.sub(r"<!--.*?-->", "", markdown, flags=re.DOTALL) if allow_template else markdown
    if BAD_TEST_ID_RE.search(bad_id_source):
        findings.append(Finding("error", "发现带名称、AC 编号、slug 或字母后缀的非法 Test ID"))
    strict_evidence = final or evidence or ac_id is not None
    validate_test_layer_plan(markdown, findings, allow_template)
    evidence_ids, evidence_rows = validate_test_evidence(
        markdown,
        findings,
        allow_template,
        final,
        strict_evidence,
        ac_id,
        change_slug,
        reported_ownership,
    )
    validate_ac_local_test_id_ownership(markdown, evidence_rows, findings, allow_template)
    validate_default_path_contracts(evidence_rows, findings)
    deposit_by_id = validate_regression_deposit(
        markdown,
        evidence_ids,
        findings,
        allow_template,
        final,
        change_slug,
        reported_ownership,
    )
    final_ids = {row.get("Test ID", "") for row in evidence_rows} if final else set()
    scoped_ids = {
        row.get("Test ID", "")
        for row in evidence_rows
        if ac_id and strip_cell_markup(row.get("AC ID", "")) == ac_id
    }
    strict_ids = final_ids | scoped_ids
    validate_evidence_deposit_consistency(evidence_rows, deposit_by_id, findings, strict_ids)
    deposited_rows = [
        row
        for row in evidence_rows
        if deposit_by_id.get(row.get("Test ID", ""), {}).get("Deposit Status", "") == "deposited"
    ]
    if deposited_rows and not allow_template and not (final or evidence or ac_id):
        validate_execution_evidence(
            evidence_rows=deposited_rows,
            deposit_by_id=deposit_by_id,
            findings=findings,
        )
    if strict_evidence and not allow_template:
        scoped_rows = (
            [row for row in evidence_rows if strip_cell_markup(row.get("AC ID", "")) == ac_id]
            if ac_id
            else evidence_rows
        )
        validate_execution_evidence(
            evidence_rows=scoped_rows,
            deposit_by_id=deposit_by_id,
            findings=findings,
            scope_ac=ac_id,
        )
    validate_runtime_not_applicable(markdown, findings, allow_template)
    validate_high_risk_layers(markdown, findings, allow_template, evidence_rows)
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tasks_md", type=Path)
    parser.add_argument("--allow-template", action="store_true", help="ignore placeholder rows containing HTML comments")
    parser.add_argument("--final", action="store_true", help="treat required regression deposits as errors")
    parser.add_argument("--evidence", action="store_true", help="validate execution evidence for the selected scope")
    parser.add_argument("--ac", help="validate evidence only for one AC-### scope")
    parser.add_argument(
        "--gate",
        choices=["plan", "evidence", "final"],
        help="explicit validation gate; defaults to plan unless --evidence, --ac, or --final is used",
    )
    args = parser.parse_args()

    final = args.final
    evidence = args.evidence
    if args.gate == "final":
        final = True
        evidence = True
    elif args.gate == "evidence":
        evidence = True
    elif args.gate == "plan":
        final = False
        evidence = False

    markdown = args.tasks_md.read_text(encoding="utf-8")
    findings = validate(
        markdown,
        allow_template=args.allow_template,
        final=final,
        evidence=evidence,
        ac_id=args.ac,
    )
    for finding in findings:
        print(f"{finding.severity.upper()}: {finding.message}", file=sys.stderr)
    return 1 if any(f.severity == "error" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
