# Specs Artifact Contract

## 目的

`specs/**/*.md` 定义 production system 应该做什么。只为有 OpenSpec delta 的 capability 创建 spec file；当整个 change 没有 spec-level delta 时，必须用 no-delta marker 显式完成 specs artifact。

## 写入前

- 读取 `trace/proposal.trace.json`，使用其中 source/scope coverage register 作为唯一 proposal scope-reading interface；不得从 `proposal.md` 推导 requirement、guard 或 no-delta completion。
- 若存在任一 `spec-requirement` 或 `spec-guard` direct atom，只为对应 capability 创建正常 `specs/<capability>/spec.md`。
- 修改 existing capability 前，读取对应 `openspec/specs/<capability>/spec.md`。
- 建立 capability-to-source/scope map：每个 spec-relevant item 必须落到 requirement/scenario、guard 或明确 handoff。
- 若整个 change 没有任何 `spec-requirement` 或 `spec-guard` direct atom，必须生成 `trace/specs/no-spec-delta/README.trace.json` no-delta trace，并由 renderer 生成 `specs/no-spec-delta/README.md` marker；不得生成任何 `specs/<capability>/spec.md`。marker 只表达“本 change 无 OpenSpec delta；projection closure 进入 design/runtime-acceptance/verification/tasks”，不得包含 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`、`### Requirement` 或 `#### Scenario`。
- 若 capability 没有直接的 `spec-requirement` 或 `spec-guard` item，不创建该 capability 的 spec file。`design-obligation` / `verification-obligation` 不得 fallback 派生成 requirement/guard。
- 建立 trace-backed capability-to-source/scope map、requirement/scenario model、guard model、design/proof/context-only handoff notes、existing requirement read set、spec-handling、no-scope-expansion checks 和 `delivery-plane` render payload。
- 正常 specs writer 只写 `trace/specs/<capability>.trace.json`；`specs/<capability>/spec.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。
- no-delta specs writer 只写 `trace/specs/no-spec-delta/README.trace.json`；`specs/no-spec-delta/README.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 使用 `--no-delta-specs` 从 trace 写入。
- 不得为了 notes 创建空 spec。

## Delta Rules

- no-delta marker 不是 delta spec，不能包含本节任何 delta heading。
- 新行为使用 `## ADDED Requirements`。
- 变化行为使用 `## MODIFIED Requirements`，修改前必须复制完整 existing requirement block。
- 删除行为只在有 Reason 和 Migration 时使用 `## REMOVED Requirements`。
- 重命名只在有 `FROM:` / `TO:` 时使用 `## RENAMED Requirements`。

## Requirement / Scenario

- 每个 requirement 使用 `### Requirement: <name>`。
- Requirement 正文使用 SHALL / MUST / MUST NOT 表达规范行为。
- Requirement 正文和 freeform Scenario body 可以写字符串或字符串数组；renderer 必须保留数组换行，不得隐式逗号拼接，也不得猜测拆分字符串。
- 每个 requirement 至少有一个 `#### Scenario: <name>`。
- 若 requirement 包含多个用户可见操作，scenario 必须逐项枚举或拆分；每个操作要定义触发、预期 UI/API/data 后果、持久化或 reload 后结果，以及 disabled/failure/recovery 行为。
- Design/proof/context-only item 不得伪造成 requirement。
- `design-obligation` / `verification-obligation` 只能作为 design、runtime、verification 或 tasks 的 handoff，不得伪造成 requirement/guard。
- 不得创建只包含 projection notes、只写“无”或没有 requirement 的空 spec；zero-delta completion 的 canonical source 只能使用 `trace/specs/no-spec-delta/README.trace.json`，Markdown marker 只由 renderer 投影生成。

## JSON Trace Plane

- 正常 delta spec 必须写入 `trace/specs/<capability>.trace.json`，包含 requirement source/scope trace，列出 requirement、scenario、source/scope item、concrete source/baseline path 或用户输入来源。
- no-delta marker 必须写入 `trace/specs/no-spec-delta/README.trace.json`，包含 `artifact-id: "specs"`、`artifact-path: "specs/no-spec-delta/README.md"`、`specs-completion-mode: "no-delta"`、`requirement-source-trace: []` 和空 `production-alignment-gate.blockers`。
- 如同一 capability 已有 delta spec 且存在 design/proof/context-only item，可在 JSON trace 中写 handoff notes；不得为了 notes 单独创建 spec file。
- `requirement-source-trace` 每行必须写 `spec-handling`。允许值仅为 `direct-spec-requirement`、`direct-spec-guard`。`source-projection` 必须为 `spec-requirement` 或 `spec-guard`；`design-obligation` / `verification-obligation` 出现在 specs trace 中是 validator error。
- no-delta marker 的 `requirement-source-trace` 必须为空；若 proposal register 中存在任一 `spec-requirement` / `spec-guard` direct atom，no-delta marker 是 validator error。
- Gate 必须确认 spec-relevant items 没有 orphan、range、source/scope 外 scenario 或 missing guard。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- 是否只创建必要 spec file。
- Requirement/scenario 是否保留所有 source/scope-backed operation、edge case、failure state、data/API/auth/security rule 和 guard。
- Guard 是否被膨胀为正向行为。
- Design/proof-only item 是否有明确下游 handoff。
