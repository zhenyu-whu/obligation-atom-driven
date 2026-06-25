# Specs Artifact Contract

## 目的

`specs/**/*.md` 定义 production system 应该做什么。只为有 OpenSpec delta 的 capability 创建 spec file。

## 写入前

- 读取 `proposal.md`，使用 `trace/proposal.trace.json` 的 source/scope coverage register 作为 scope-reading interface。
- 只为存在 spec-level delta 的 capability 创建 spec file。
- 修改 existing capability 前，读取对应 `openspec/specs/<capability>/spec.md`。
- 建立 capability-to-source/scope map：每个 spec-relevant item 必须落到 requirement/scenario、guard 或明确 handoff。
- 若 capability 没有直接的 spec-level item，但存在可归档的规范性 design obligation，可以执行 capability-level fallback，派生成最小 requirement/guard；不得把原始 projection 改写为 spec projection。
- 建立 trace-backed capability-to-source/scope map、requirement/scenario model、guard model、design/proof/context-only handoff notes、existing requirement read set、spec-handling、no-scope-expansion checks 和 `delivery-plane` render payload。
- writer 只写 `trace/specs/<capability>.trace.json`；`specs/<capability>/spec.md`、Trace Appendix 和 manifest digest 必须由 renderer 从 trace 写入；不得为了 notes 创建空 spec。

## Delta Rules

- 新行为使用 `## ADDED Requirements`。
- 变化行为使用 `## MODIFIED Requirements`，修改前必须复制完整 existing requirement block。
- 删除行为只在有 Reason 和 Migration 时使用 `## REMOVED Requirements`。
- 重命名只在有 `FROM:` / `TO:` 时使用 `## RENAMED Requirements`。

## Requirement / Scenario

- 每个 requirement 使用 `### Requirement: <name>`。
- Requirement 正文使用 SHALL / MUST / MUST NOT 表达规范行为。
- 每个 requirement 至少有一个 `#### Scenario: <name>`。
- 若 requirement 包含多个用户可见操作，scenario 必须逐项枚举或拆分；每个操作要定义触发、预期 UI/API/data 后果、持久化或 reload 后结果，以及 disabled/failure/recovery 行为。
- Design/proof/context-only item 不得伪造成 requirement。
- 从 design obligation 派生的 requirement/guard 只能承载稳定 capability contract：可观察、可验证、后续 change 必须消费。纯实现细节、临时 smoke 形态、helper 名称、测试策略和 proof-only 内容不得派生。
- 不得创建只包含 projection notes、只写“无”或没有 requirement 的空 spec。

## JSON Trace Plane

- 必须写入 `trace/specs/<capability>.trace.json`，包含 requirement source/scope trace，列出 requirement、scenario、source/scope item、concrete source/baseline path 或用户输入来源。
- 如同一 capability 已有 delta spec 且存在 design/proof/context-only item，可在 JSON trace 中写 handoff notes；不得为了 notes 单独创建 spec file。
- `requirement-source-trace` 每行必须写 `spec-handling`。允许值为 `direct-spec-requirement`、`direct-spec-guard`、`derived-capability-contract-requirement`、`derived-capability-contract-guard`。派生行还必须写原始 `source-projection`、`derivation-reason` 和 `no-scope-expansion-check`。
- Gate 必须确认 spec-relevant items 没有 orphan、range、source/scope 外 scenario 或 missing guard。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。

## Reviewer Focus

- 是否只创建必要 spec file。
- Requirement/scenario 是否保留所有 source/scope-backed operation、edge case、failure state、data/API/auth/security rule 和 guard。
- Guard 是否被膨胀为正向行为。
- Design/proof-only item 是否有明确下游 handoff。
