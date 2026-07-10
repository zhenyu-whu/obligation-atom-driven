# Specs Writer Contract

本文件只适用于 `specs-writer` 和 `specs-repair-writer`。Writer 的核心任务是把 proposal routed source/scope fact 转换为语义等价的 requirement/scenario delta；trace links 和 gate 是完成后的客观投影与自查结果，不是生成策略。

## 写入前

- 读取 `trace/proposal.trace.json`，使用 schema overlay 指定的 proposal register 作为唯一 scope-reading interface；不得从 `proposal.md` 推导 requirement、guard 或 no-delta completion。
- 按当前 schema 的 specs writer overlay 确定 spec-relevant item；base contract 不定义 source ID 前缀、proposal register 名称或 source eligibility 枚举。
- 若存在任一 spec-relevant item，只为对应 capability 创建正常 `specs/<capability>/spec.md`。
- 生成 normal delta 前必须读取 `openspec/specs/<capability>/spec.md`，并在 `existing-spec-state` 中记录 `absent`、`parsed` 或 `parse-blocked`。
- 若整个 change 没有任何 spec-relevant item，必须生成 `trace/specs/no-spec-delta/README.trace.json` no-delta trace，并由 renderer 生成 `specs/no-spec-delta/README.md` marker；不得生成任何 `specs/<capability>/spec.md`。
- 若 capability 没有 spec-relevant item，不创建该 capability 的 spec file；非 specs item 不得 fallback 派生成 requirement/guard。
- 正常 specs writer 只写 `trace/specs/<capability>.trace.json`；`specs/<capability>/spec.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。
- No-delta specs writer 只写 `trace/specs/no-spec-delta/README.trace.json`；`specs/no-spec-delta/README.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 使用 `--no-delta-specs` 从 trace 写入。

## Upstream Input Model

- Specs writer 必须按当前 schema 的 specs writer overlay 解析 proposal trace；`instructions.template` 只提供 JSON shape 和字段示例，不提供 source/scope 语义权威。
- 所有 `trace/specs/**.trace.json` sections 必须能回溯到 proposal trace register、focused existing spec read 或明确 blocker；不得从 template 注释、proposal Markdown、旧 specs Markdown、当前实现、测试文件、apply result、evidence 或 reviewer 过程摘要发明 requirement/guard。
- Common contract 只定义通用生成顺序和 Delivery Plane / JSON Trace Plane 边界；具体 source ID 体系、proposal register 字段、spec-relevant predicate 和 schema-specific 禁止项由 schema-specific specs writer overlay 约束。
- 如果 requirement/scenario 需要 proposal trace 无法到达的 source/scope detail，writer 必须报告 blocker 或修订上游 proposal trace；不得扩大读取范围后直接写入 specs trace。
- Writer 必须把 proposal trace 中的原始 source/scope fact、对应 specs route 的 use、proposal use 和 downstream expectation 作为转换依据；不得只依据 source id、projection 名称、主题标题或 capability 汇总来生成 requirement/scenario。
- Specs writer 的核心职责是把 routed source/scope fact 转换为语义等价的 requirement/scenario 模型；`source-ids[]` coverage 只是数学闭合证据，不是语义等价证据。
- 语义等价要求保留 source/scope fact 中 production-meaningful 的 material semantic units，包括用户可观察对象、操作、条件、状态变化、API/data 后果、失败/禁用/恢复边界、guard 和 downstream 必须保持的约束。Writer 可以合并表达多个 source items，但合并后的 requirement/scenario 必须仍让 reviewer 能判断这些 material units 没有丢失、变弱或被替换成泛化摘要。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 specs trace：

1. 读取 schema-specific specs writer overlay 允许的 proposal trace register，并建立 spec-relevant item set；每个 item 必须使用 overlay 指定的 exact source id，不得使用 ranges、汇总行或主题计数替代。
2. 按 capability 分组 spec-relevant item；每个有 item 的 capability 正好生成一个 normal delta specs trace。
3. 读取 `openspec/specs/<capability>/spec.md` 并生成 `existing-spec-state`。
4. 构造 `spec-delta-register[]`；该 register 是 specs 的 canonical semantic model。
5. 对每个 routed spec-relevant item 做语义等价自查：从 source/scope fact 中识别必须保留的 material semantic units，并确认这些 units 已被 requirement body、scenario when/then/body 或 guard handling 表达；该自查结论不得写入 Delivery Plane，也不得退化成 coverage 表。
6. 每个 spec-relevant source id 必须进入至少一个 `spec-delta-register[].source-ids[]` 或 scenario `source-ids[]`，否则进入 `spec-gate.orphan-source-ids`。该 source-id 闭合是必要条件，但不能替代上一步的语义等价自查。
7. 如果 source id 已闭合但 material semantic units 在 requirement/scenario 中丢失、变弱、被泛化摘要替代，或 writer 无法判断是否等价，必须写入 `spec-gate.blockers`，不得用空 gate 声称 specs 完成。
8. 每个 guard item 必须保持 `must-not`、`preserve-boundary` 或 `non-goal` 语义，不得膨胀成新的正向行为。
9. 从 `spec-delta-register[]` 投影 `delivery-plane`；Delivery Plane 不得包含 source/scope coverage、alignment gate、projection mix 或 trace rows。
10. 生成 `spec-gate`；gate 必须从 spec-relevant item set、语义等价自查、`existing-spec-state`、`spec-delta-register[]` 和 `delivery-plane` 派生。
11. 在调用 renderer 前做 set-diff 自查：proposal spec-relevant item set、delta register source ids、delivery requirement/scenario anchors、material semantic units 和 spec gate 不得缺失、重复、跨 capability 漂移、语义压缩或出现 orphan。
12. 写入严格 JSON，再调用 renderer 生成 Markdown、Trace Appendix 和 manifest registry entry。

## Requirement / Scenario 生成规则

- 若 requirement 包含多个用户可见操作或多个 material semantic units，scenario 必须逐项枚举、拆分或以可审查的结构合并表达。
- 每个 material unit 要定义触发、作用对象、预期 UI/API/data 后果、持久化或 reload 后结果，以及 disabled/failure/recovery 行为中 source-backed 的部分。
- 不得用“支持全部”“覆盖所有”“固定集合”“完整配置”等泛化短语替代 source/scope fact 中已经给出的 material semantic units。
- 如果为可读性进行合并，合并文本仍必须保留足够细节，使 design writer 不需要回读 proposal 才能知道每个 material unit 的规范行为。
- Guard 必须保持 MUST NOT、preserve、non-goal 或负向边界语义，不得写成 source/scope 外的正向能力。
- 不得创建只包含 projection notes、只写“无”或没有 requirement 的空 spec；zero-delta completion 的 canonical source 只能使用 `trace/specs/no-spec-delta/README.trace.json`，Markdown marker 只由 renderer 投影生成。

## Writer 提交前结构检查

调用 renderer 前，writer 只做结构一致性检查：

- `trace/specs/**.trace.json` 是严格 JSON，且包含 `artifacts/specs/trace-schema.md` 与 schema-specific overlay 允许的字段。
- Proposal spec-relevant item set、`spec-delta-register[]`、Delivery Plane 和 gate 引用同一 source/scope item set，且没有 orphan、重复 ID、range、跨 capability 漂移或 scope 外行为。
- Requirement/scenario 保留 routed source/scope fact 的 material semantic units，没有语义压缩、弱化或泛化摘要替代。
- Delivery Plane 只保存 renderer payload，不泄漏 coverage、gate、register rows、projection mix、source ids 或 trace rows。
- Gate 是当前 trace-backed model 的最小闭合结果；writer 不得为了清空 gate 创建虚假 requirement、未登记 guard、空 spec 或下游 coverage。

## Repair Writer

Repair-writer 必须重新读取最新 proposal trace、focused existing spec、当前 specs trace、contract bundle、validator hard error 和 reviewer blocker。修复时应重建受影响的 spec-relevant item set、semantic delta、Delivery Plane 和 gate，而不是局部补字段来关闭 validator 或 reviewer finding。
