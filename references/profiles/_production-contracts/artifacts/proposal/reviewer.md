# Proposal Reviewer Contract

本文件只适用于 `proposal-reviewer` 和 integration reviewer 中针对 proposal artifact 的审查。Reviewer 的任务是判断 proposal trace 是否真实表达当前 change boundary，并处理 validator warning；不得直接修改 artifact。

## Reviewer 输入

- 必须读取当前 artifact trace：`trace/proposal.trace.json`。
- 必须读取 proposal contract bundle：common contracts、`artifacts/proposal/index.md`、`artifacts/proposal/trace-schema.md`、本文件和当前 schema 的 proposal reviewer overlay。
- 必须读取 partial validator 报告并逐条处理 warning。
- 不得把当前或上游 Markdown Delivery Plane 当作语义输入；Markdown 只可作为 renderer projection 的人读结果，不得替代 trace 审查。
- 不得读取当前实现、测试文件、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle。

## 审查顺序

1. 确认 trace schema、artifact identity、schema-specific root register、boundary ref、delivery-plane 和 gate 结构符合 `artifacts/proposal/trace-schema.md` 与 schema-specific trace-schema overlay。
2. 读取 schema-specific reviewer overlay，确认 proposal 使用的上游 source/scope 权威没有越界。
3. 对每个 material source/scope item 审查其是否有 exact ID、source/scope fact、capability、projection/handling、proposal 用途和 downstream expectation。
4. 审查 boundary ref 是否只表达 scope 限制，没有传播下游 coverage、projection、reconciliation 或 implementation obligation。
5. 审查 Delivery Plane 是否由同一个 trace-backed source/scope model 投影，且没有 coverage、gate、register rows 或 scope suffix 泄漏。
6. 反查 Non-Goals 是否来自已登记 source/scope boundary，不得引入未登记的 future capability、UI、API、workflow、test/e2e 场景或其它 owner scope。
7. 审查 gate 是否只记录最小闭合结果，并确认 validator warning 已处理。

## 必须 Blocker 的情况

- Change boundary 不是来自 proposal overlay 允许的权威输入。
- 任一 material source/scope item 缺少 root register row、projection/handling、source/scope fact、proposal 用途或 downstream expectation。
- Source/scope item 使用 range、汇总行、主题计数、多 ID 单元格或跨 schema ID。
- Boundary ref 传播为下游 coverage、projection、reconciliation 或 implementation obligation。
- Delivery Plane 泄漏 exhaustive source/scope coverage list、projection mix、register rows、coverage suffix、gate 或 trace pointer。
- Delivery Plane、Non-Goals、Impact 或 Rollout / Readiness 引入无法追溯到 proposal trace root register 或 boundary ref 的行为、boundary、capability 或 readiness。
- 存在 orphan source/scope item、scope 外行为、未登记 source/scope 外 non-goal，或应表达但漏失的 registered non-goal boundary。
- Validator warning 未处理，或 reviewer 仅以 validator pass / empty gate / coverage closure 作为语义通过依据。

## Pass 条件

Reviewer 只能在同时满足以下条件时输出 `Pass`：

- 已读取的 contract bundle 文件和 trace 输入完整。
- Validator warning 已处理或不存在。
- Change boundary 来自 proposal overlay 允许的权威输入。
- 每个 material source/scope item 均有真实 register row、proposal 用途和 downstream expectation。
- Delivery Plane 是同一 trace-backed source/scope model 的人读投影，没有 coverage 泄漏或 scope expansion。
- 未发现 orphan/range、boundary propagation、source/scope drift、未登记 non-goal 或 artifact-local contract violation。

## 输出协议

Reviewer 输出必须遵守 `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`：只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和所需修复方向。
