# Proposal Writer Contract

本文件只适用于 `proposal-writer` 和 `proposal-repair-writer`。Writer 的核心任务是按当前 schema overlay 允许的上游输入建立 source/scope 语义模型；trace links 和 gate 是完成后的客观投影与自查结果，不是生成策略。

## 写入前

- 读取当前 schema 的 proposal writer overlay，确定本 change 使用 `GA-####` 还是 `SI-###` 作为 source/scope item。
- 读取 schema instruction 与 proposal writer overlay 指定的最小权威输入；不得读取 overlay 禁止的 source。
- 建立当前 change 的 material source/scope item 列表；每个 item 必须是 exact ID，不得使用 ranges、汇总行或主题计数。
- 给每个 item 分配 capability、projection/handling、source/scope fact、proposal 用途和 downstream expectation。
- 基于同一个 source/scope model 建立 schema-specific root register、boundary ref、`delivery-plane` render payload 和最小 gate。
- `openspec instructions proposal --json` 返回的 `template` 是 `trace/proposal.trace.json` 的 JSONC authoring guide，不是 `proposal.md` Markdown 模板。writer 必须把 JSONC 中的注释、占位符和示例值替换为严格 JSON 后写入 `trace/proposal.trace.json`。
- Writer 只写 `trace/proposal.trace.json`；`proposal.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。

## Upstream Input Model

- Proposal writer 必须按当前 schema 的 proposal writer overlay 解析上游输入权威；`instructions.template` 只提供 JSON shape 和字段示例，不提供 source/scope 语义权威。
- 所有 `trace/proposal.trace.json` sections 必须能回溯到 proposal writer overlay 允许的上游输入或明确 blocker；不得从 template 注释、旧 Markdown artifact、实现文件猜测或 reviewer 过程摘要发明 source/scope。
- Common contract 只定义通用生成顺序和 Delivery Plane / JSON Trace Plane 边界；具体上游输入、ID 体系、register 字段和 gate 形状由 schema-specific proposal writer overlay 约束。
- 下游 artifact writer/reviewer 只能把 proposal trace 作为 proposal 语义输入；`proposal.md` 是 renderer 投影后的 Delivery Plane，不得反向作为 source/scope register 或 coverage oracle。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 proposal trace：

1. 读取 schema-specific proposal writer overlay 允许的上游输入，并记录缺失、冲突或超出 scope 的 blocker。
2. 建立 material source/scope item set；每个 item 必须有 exact `GA-####` 或 `SI-###`。
3. 为每个 item 补齐 source/scope fact、capability、projection/handling、proposal 用途和 downstream expectation。
4. 生成 schema-specific proposal root register；该 register 是当前 proposal 的 source/scope 根。
5. 生成 schema-specific boundary ref；boundary ref 只表达 scope 限制，不得变成可传播 coverage。
6. 从同一 trace-backed model 投影 `delivery-plane` render payload。
7. 生成最小 gate；gate 只记录 blocker、orphan、source mismatch 或 boundary propagation violation，不复制完整 coverage 分组。
8. 在调用 renderer 前做 set-diff 自查：root register、boundary ref、Delivery Plane 和 gate 不得缺失、重复、跨类型漂移或出现 orphan。
9. 写入严格 JSON `trace/proposal.trace.json`，再调用 renderer 生成 `proposal.md`、Trace Appendix 和 manifest registry entry。

## Delivery Plane Projection Rules

- Delivery Plane 不得直接从 template 注释、旧 proposal Markdown、上游 Markdown 宽泛摘要、当前实现、测试文件或 apply 结果推导新行为。
- 若 Delivery Plane 需要表达的行为、boundary、capability、impact 或 readiness 无法追溯到 proposal trace root register 或 boundary ref，writer 必须修订 trace 或报告 blocker，不得只在 Markdown prose 中补写。
- Delivery Plane 中可以使用人类可读总结，但总结不得改变 register 中 item 的 projection/handling、scope role、capability 或 downstream expectation。

## Writer 提交前结构检查

调用 renderer 前，writer 只做结构一致性检查：

- `trace/proposal.trace.json` 是严格 JSON，且包含 `artifacts/proposal/trace-schema.md` 与 schema-specific overlay 允许的字段。
- Root register、boundary ref、Delivery Plane 和 gate 引用同一 source/scope item set，且没有 orphan、重复 ID、range、跨类型漂移或 scope 外行为。
- Delivery Plane 只保存 render payload，不泄漏 exhaustive source/scope coverage list、projection mix、register rows、coverage suffix 或 gate。
- Gate 是当前 trace-backed model 的最小闭合结果；writer 不得为了清空 gate 创建虚假 source/scope row、未登记 non-goal 或下游 coverage。

## Repair Writer

Repair-writer 必须重新读取最新上游输入、当前 proposal trace、contract bundle、validator hard error 和 reviewer blocker。修复时应重建受影响的 source/scope model、register、boundary ref、Delivery Plane 和 gate，而不是局部补字段来关闭 validator 或 reviewer finding。
