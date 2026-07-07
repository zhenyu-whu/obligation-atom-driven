# Proposal Artifact Contract

## 目的

`proposal.md` 定义 change 的 WHY、WHAT、capability boundary、non-goal、影响面和 readiness。Delivery Plane 只写 reviewer 能直接判断的产品/技术边界；source/scope 根集合、boundary ref 和闭合问题只写入 `trace/proposal.trace.json`。

## 写入前

- 读取当前 schema profile contract，确定本 change 使用 `GA-####` 还是 `SI-###` 作为 source/scope item。
- 读取 schema instruction 指定的最小权威输入；不得读取 profile 禁止的 source。
- 建立当前 change 的 material source/scope item 列表；每个 item 必须是 exact ID，不得使用 ranges、汇总行或主题计数。
- 给每个 item 分配 capability、projection/handling、source/scope fact、proposal 用途和 downstream expectation。
- 基于同一个 source/scope model 建立 profile-defined root register、boundary ref、`delivery-plane` render payload 和最小 gate。
- `openspec instructions proposal --json` 返回的 `template` 是 `trace/proposal.trace.json` 的 JSONC authoring guide，不是 `proposal.md` Markdown 模板。writer 必须把 JSONC 中的注释、占位符和示例值替换为严格 JSON 后写入 `trace/proposal.trace.json`。
- writer 只写 `trace/proposal.trace.json`；`proposal.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。

## Upstream Input Model

- Proposal writer 必须按当前 schema profile 与 overlay 解析上游输入权威；`instructions.template` 只提供 JSON shape 和字段示例，不提供 source/scope 语义权威。
- 所有 `trace/proposal.trace.json` sections 必须能回溯到 profile 允许的上游输入或明确 blocker；不得从 template 注释、旧 Markdown artifact、实现文件猜测或 reviewer 过程摘要发明 source/scope。
- Common contract 只定义通用生成顺序和 Delivery Plane / JSON Trace Plane 边界；具体上游输入、ID 体系、register 字段和 gate 形状由 profile contract 与 schema overlay 约束。
- 下游 artifact writer/reviewer 只能把 proposal trace 作为 proposal 语义输入；`proposal.md` 是 renderer 投影后的 Delivery Plane，不得反向作为 source/scope register 或 coverage oracle。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 proposal trace：

1. 读取 profile/overlay 允许的上游输入，并记录缺失、冲突或超出 scope 的 blocker。
2. 建立 material source/scope item set；每个 item 必须有 exact `GA-####` 或 `SI-###`。
3. 为每个 item 补齐 source/scope fact、capability、projection/handling、proposal 用途和 downstream expectation。
4. 生成 profile-defined root register；该 register 是当前 proposal 的 source/scope 根。
5. 生成 profile-defined boundary ref；boundary ref 只表达 scope 限制，不得变成可传播 coverage。
6. 从同一 trace-backed model 投影 `delivery-plane` render payload。
7. 生成最小 gate；gate 只记录 blocker、orphan、source mismatch 或 boundary propagation violation，不复制完整 coverage 分组。
8. 在调用 renderer 前做 set-diff 自查：root register、boundary ref、Delivery Plane 和 gate 不得缺失、重复、跨类型漂移或出现 orphan。
9. 写入严格 JSON `trace/proposal.trace.json`，再调用 renderer 生成 `proposal.md`、Trace Appendix 和 manifest registry entry。

## Delivery Plane

- `Why` 说明 change 解决的 production capability、product gap、architecture gap、readiness gap 或 verification gap。
- `Change Plan Boundary` 必须说明当前 change 的 closed-loop outcome、in scope、out of scope 和 dependencies；这些内容必须来自 profile 允许的上游输入与 trace-backed boundary model。
- `What Changes` 只写 source/scope-backed product surfaces、routes、domain commands、APIs、database entities/migrations、worker jobs、events/SSE streams、storage/assets、auth/security rules、billing/entitlement rules、observability/ops surfaces、deployment constraints 和 verification surfaces 的行为边界。
- `What Changes` 可以由字符串或字符串数组承载；renderer 只按既有类型渲染，不得把字符串按长度或分号拆分。
- 当 source/scope 描述用户可见操作时，必须保留每个 operation verb 及其可观察结果：触发入口、作用对象、API/data mutation、成功后的页面或持久化变化，以及 disabled/failure/recovery 边界。
- `Capabilities` 必须匹配 profile-defined capability boundary。
- `Non-Goals` 必须表达当前 profile 允许的 registered source/scope boundary，例如 explicit non-goal、later-change、preserve、prototype-only、superseded 或其它明确边界。
- `Non-Goals` 不得为了补全边界而引入未登记的 future capability、UI、API、workflow、test/e2e 场景或其它 source/scope owner 的 non-goal；source-backed 但未注册到当前 proposal source/scope item 的内容仍属于 scope 外。
- `Impact` 必须只列当前 trace-backed model 触达的 app/package/API/database/runtime/security/ops/downstream 边界。
- `Rollout / Readiness` 必须只列当前 change 需要或保留的 migration ordering、config、compatibility、operations 和 archive readiness；不得写入 apply evidence、测试执行状态或未登记的未来运维计划。
- 主体不得包含 exhaustive source/scope coverage list、projection mix、register rows、coverage suffix 或 gate。

## Delivery Plane Projection Rules

- `delivery-plane.why`、`change-plan-boundary`、`what-changes`、`capabilities`、`non-goals`、`impact` 和 `rollout-readiness` 必须全部由同一个 trace-backed source/scope model 投影。
- Delivery Plane 不得直接从 template 注释、旧 proposal Markdown、上游 Markdown 宽泛摘要、当前实现、测试文件或 apply 结果推导新行为。
- 若 Delivery Plane 需要表达的行为、boundary、capability、impact 或 readiness 无法追溯到 proposal trace root register 或 boundary ref，writer 必须修订 trace 或报告 blocker，不得只在 Markdown prose 中补写。
- Delivery Plane 中可以使用人类可读总结，但总结不得改变 register 中 item 的 projection/handling、scope role、capability 或 downstream expectation。

## JSON Trace Plane

- 必须写入 profile-defined root register、boundary ref、Delivery Plane render payload 和最小 gate。
- 每个 material source/scope item 正好有一行 root register，不得使用 ranges。
- 每行必须记录 projection/handling、capability、source/scope fact、proposal 用途和 downstream expectation。
- Boundary ref 必须明确不传播身份，不得产生下游 coverage、projection、reconciliation 或 implementation obligation。
- artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 trace 不写入 Markdown。
- archived change 中旧 Markdown `Trace digest` 只能作为历史输出参考；新生成 proposal Markdown 的 Trace Appendix 继续遵守 renderer/contract 的短指针规则。

## Reviewer Focus

- change boundary 是否来自 profile 允许的权威输入。
- Delivery Plane 是否没有 coverage 泄漏。
- 每个 material source/scope item 是否有 projection/handling 和 downstream expectation。
- 是否存在 orphan source/scope item、range、scope 外行为、未登记 source/scope 外 non-goal，或应表达但漏失的 registered non-goal boundary。
