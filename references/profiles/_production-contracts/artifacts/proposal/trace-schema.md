# Proposal Trace Schema Contract

本文件定义 `trace/proposal.trace.json` 的共享结构约束。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的语义生成策略，也不替代 reviewer 的语义审查规则。

## JSON Trace Plane

`trace/proposal.trace.json` 顶层必须包含通用 proposal 语义字段：

- `trace-schema`
- `artifact-id`
- `artifact-path`
- `change-name`
- `schema-name`
- `agent-role`
- `delivery-plane`

每个 schema 还必须按 schema-specific proposal overlay 写入对应 root register、boundary ref 和最小 gate：

- `production-obligation-atom-driven`：`source-interface`、`change-ga-register`、`non-direct-boundary-ref`、`proposal-gate`。
- `production-default-acceptance-driven`：`baseline-input-read-set`、`change-scope-coverage`、`proposal-alignment-gate`。

`trace-schema` 必须为 `openspec-trace-v1`，`artifact-id` 必须为 `proposal`，`artifact-path` 必须为 `proposal.md`。

## Delivery Plane

- `delivery-plane.why`、`change-plan-boundary`、`what-changes`、`capabilities`、`non-goals`、`impact` 和 `rollout-readiness` 必须全部由同一个 trace-backed source/scope model 投影。
- `Why` 说明 change 解决的 production capability、product gap、architecture gap、readiness gap 或 verification gap。
- `Change Plan Boundary` 必须说明当前 change 的 closed-loop outcome、in scope、out of scope 和 dependencies；这些内容必须来自 proposal overlay 允许的上游输入与 trace-backed boundary model。
- `What Changes` 只写 source/scope-backed product surfaces、routes、domain commands、APIs、database entities/migrations、worker jobs、events/SSE streams、storage/assets、auth/security rules、billing/entitlement rules、observability/ops surfaces、deployment constraints 和 verification surfaces 的行为边界。
- `What Changes` 可以由字符串或字符串数组承载；renderer 只按既有类型渲染，不得把字符串按长度或分号拆分。
- 当 source/scope 描述用户可见操作时，必须保留每个 operation verb 及其可观察结果：触发入口、作用对象、API/data mutation、成功后的页面或持久化变化，以及 disabled/failure/recovery 边界。
- `Capabilities` 必须匹配 schema-specific capability boundary。
- `Non-Goals` 必须表达当前 proposal overlay 允许的 registered source/scope boundary，例如 explicit non-goal、later-change、preserve、prototype-only、superseded 或其它明确边界。
- `Non-Goals` 不得为了补全边界而引入未登记的 future capability、UI、API、workflow、test/e2e 场景或其它 source/scope owner 的 non-goal；source-backed 但未注册到当前 proposal source/scope item 的内容仍属于 scope 外。
- `Impact` 必须只列当前 trace-backed model 触达的 app/package/API/database/runtime/security/ops/downstream 边界。
- `Rollout / Readiness` 必须只列当前 change 需要或保留的 migration ordering、config、compatibility、operations 和 archive readiness；不得写入 apply evidence、测试执行状态或未登记的未来运维计划。
- 主体不得包含 exhaustive source/scope coverage list、projection mix、register rows、coverage suffix 或 gate。

## JSON Trace / Markdown Boundary

- JSON Trace Plane 必须写入 schema-specific root register、boundary ref、Delivery Plane render payload 和最小 gate。
- 每个 material source/scope item 正好有一行 root register，不得使用 ranges、汇总行或主题计数。
- 每行必须记录 projection/handling、capability、source/scope fact、proposal 用途和 downstream expectation。
- Boundary ref 必须明确不传播身份，不得产生下游 coverage、projection、reconciliation 或 implementation obligation。
- `proposal.md` 只承载 renderer 从 `delivery-plane` 投影的人读正文；artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 trace 不写入 Markdown。
- Archived change 中旧 Markdown `Trace digest` 只能作为历史输出参考；新生成 proposal Markdown 的 Trace Appendix 继续遵守 renderer/contract 的短指针规则。
