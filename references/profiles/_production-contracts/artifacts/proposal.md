# Proposal Artifact Contract

## 目的

`proposal.md` 定义 change 的 WHY、WHAT、capability boundary、non-goal、影响面和 readiness。Delivery Plane 只写 reviewer 能直接判断的产品/技术边界；source/scope coverage 和 projection 只写入 `trace/proposal.trace.json`。

## 写入前

- 读取当前 schema profile contract，确定本 change 使用 `GA-####` 还是 `SI-###` 作为 source/scope item。
- 读取 schema instruction 指定的最小权威输入；不得读取 profile 禁止的 source。
- 建立 material source/scope item 列表，并给每个 item 分配 artifact projection/handling 和 downstream coverage expectation。
- 对需要精确行为、边界、failure path、verification expectation 的 source/scope item，按 profile contract 做 focused source/baseline read。
- 基于 source/scope item 建立 trace-backed register model、capability boundary model、focused read set、projection/handling、downstream coverage expectation、non-goal/boundary inventory 和 `delivery-plane` render payload。
- writer 只写 `trace/proposal.trace.json`；`proposal.md`、Trace Appendix 和 manifest digest 必须由 renderer 从 trace 写入。

## Delivery Plane

- `Why` 说明 change 解决的 production capability、product gap、architecture gap、readiness gap 或 verification gap。
- `What Changes` 只写 source/scope-backed product surfaces、routes、domain commands、APIs、database entities/migrations、worker jobs、events/SSE streams、storage/assets、auth/security rules、billing/entitlement rules、observability/ops surfaces、deployment constraints 和 verification surfaces 的行为边界。
- `What Changes` 可以由字符串或字符串数组承载；renderer 只按既有类型渲染，不得把字符串按长度或分号拆分。
- 当 source/scope 描述用户可见操作时，必须保留每个 operation verb 及其可观察结果：触发入口、作用对象、API/data mutation、成功后的页面或持久化变化，以及 disabled/failure/recovery 边界。
- `Capabilities` 必须匹配 profile-defined capability boundary。
- `Non-Goals` 必须表达 explicit non-goal、later-change、preserve、prototype-only、superseded 或其它明确边界。
- 主体不得包含 exhaustive source/scope coverage list、projection mix、register rows、coverage suffix 或 alignment gate。

## JSON Trace Plane

- 必须写入 source/scope coverage register、production source/baseline coverage、focused read set 和 proposal alignment gate。
- 每个 material source/scope item 正好有一行 register，不得使用 ranges。
- 每行必须记录 artifact projection/handling、projection source、capability、source/scope fact、propose use 和 downstream coverage expectation。
- Focused read set 必须列出读取目的和 interpretation result。
- artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 trace 不写入 Markdown。

## Reviewer Focus

- change boundary 是否来自 profile 允许的权威输入。
- Delivery Plane 是否没有 coverage 泄漏。
- 每个 material source/scope item 是否有 projection/handling 和 downstream expectation。
- 是否存在 orphan source/scope item、range、scope 外行为或 source/scope 外 non-goal 漏失。
