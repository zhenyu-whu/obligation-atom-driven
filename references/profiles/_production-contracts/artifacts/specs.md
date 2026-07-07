# Specs Artifact Contract

## 目的

`specs/**/*.md` 定义 production system 应该做什么。Specs 阶段是从 proposal spec-relevant source items 到 OpenSpec requirement/scenario delta 的语义转换层，不只是 coverage 审计层。

Trace 必须对齐 proposal 模板风格：固定 `delivery-plane` 作为 renderer 输出 payload，一个 canonical register 承载语义，一个最小 gate 承载闭合结果。

只为有 spec-relevant item 的 capability 创建 spec file；当整个 change 没有 spec-level delta 时，必须用 no-delta marker 显式完成 specs artifact。

## 写入前

- 读取 `trace/proposal.trace.json`，使用 schema overlay 指定的 proposal register 作为唯一 scope-reading interface；不得从 `proposal.md` 推导 requirement、guard 或 no-delta completion。
- 按当前 schema overlay 确定 spec-relevant item；base contract 不定义 source ID 前缀、proposal register 名称或 source eligibility 枚举。
- 若存在任一 spec-relevant item，只为对应 capability 创建正常 `specs/<capability>/spec.md`。
- 生成 normal delta 前必须读取 `openspec/specs/<capability>/spec.md`，并在 `existing-spec-state` 中记录 `absent`、`parsed` 或 `parse-blocked`。
- 若整个 change 没有任何 spec-relevant item，必须生成 `trace/specs/no-spec-delta/README.trace.json` no-delta trace，并由 renderer 生成 `specs/no-spec-delta/README.md` marker；不得生成任何 `specs/<capability>/spec.md`。
- 若 capability 没有 spec-relevant item，不创建该 capability 的 spec file；非 specs item 不得 fallback 派生成 requirement/guard。
- 正常 specs writer 只写 `trace/specs/<capability>.trace.json`；`specs/<capability>/spec.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。
- no-delta specs writer 只写 `trace/specs/no-spec-delta/README.trace.json`；`specs/no-spec-delta/README.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 使用 `--no-delta-specs` 从 trace 写入。

## Upstream Input Model

- Specs writer 必须按当前 schema overlay 解析 proposal trace；`instructions.template` 只提供 JSON shape 和字段示例，不提供 source/scope 语义权威。
- 所有 `trace/specs/**.trace.json` sections 必须能回溯到 proposal trace register、focused existing spec read 或明确 blocker；不得从 template 注释、proposal Markdown、旧 specs Markdown、当前实现、测试文件、apply result、evidence 或 reviewer 过程摘要发明 requirement/guard。
- Common contract 只定义通用生成顺序和 Delivery Plane / JSON Trace Plane 边界；具体 source ID 体系、proposal register 字段、spec-relevant predicate 和 schema-specific 禁止项由 schema overlay 约束。
- Downstream artifact writer/reviewer 只能把 specs trace 作为 specs 语义输入；`specs/**/*.md` 是 renderer 投影后的 Delivery Plane，不得反向作为 source/scope register、coverage oracle、runtime row 或 proof oracle。
- 如果 requirement/scenario 需要 proposal trace 无法到达的 source/scope detail，writer 必须报告 blocker 或修订上游 proposal trace；不得扩大读取范围后直接写入 specs trace。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 specs trace：

1. 读取 schema overlay 允许的 proposal trace register，并建立 spec-relevant item set；每个 item 必须使用 overlay 指定的 exact source id，不得使用 ranges、汇总行或主题计数替代。
2. 按 capability 分组 spec-relevant item；每个有 item 的 capability 正好生成一个 normal delta specs trace。
3. 读取 `openspec/specs/<capability>/spec.md` 并生成 `existing-spec-state`：
   - `absent`：base spec 不存在，只允许生成 `added` delta。
   - `parsed`：base spec 可解析，允许按语义差异生成 `added`、`modified`、`removed` 或 `renamed`。
   - `parse-blocked`：base spec 存在但无法可靠解析；若需要非 `added` delta，必须写入 `spec-gate.blockers`。
4. 构造 `spec-delta-register[]`；该 register 是 specs 的 canonical semantic model。
5. 每个 spec-relevant source id 必须进入至少一个 `spec-delta-register[].source-ids[]` 或 scenario `source-ids[]`，否则进入 `spec-gate.orphan-source-ids`。
6. 每个 guard item 必须保持 `must-not`、`preserve-boundary` 或 `non-goal` 语义，不得膨胀成新的正向行为。
7. 从 `spec-delta-register[]` 投影 `delivery-plane`；Delivery Plane 不得包含 source/scope coverage、alignment gate、projection mix 或 trace rows。
8. 生成 `spec-gate`；gate 必须从 spec-relevant item set、`existing-spec-state`、`spec-delta-register[]` 和 `delivery-plane` 机械派生。
9. 在调用 renderer 前做 set-diff 自查：proposal spec-relevant item set、delta register source ids、delivery requirement/scenario anchors 和 spec gate 不得缺失、重复、跨 capability 漂移或出现 orphan。
10. 写入严格 JSON，再调用 renderer 生成 Markdown、Trace Appendix 和 manifest registry entry。

## Delivery Plane

- no-delta marker 不是 delta spec，不能包含 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`、`### Requirement` 或 `#### Scenario`。
- 新行为使用 `## ADDED Requirements`。
- 变化行为使用 `## MODIFIED Requirements`，修改前必须读取 existing spec 并确认 semantic delta。
- 删除行为只在有 source-backed Reason 和 Migration 时使用 `## REMOVED Requirements`。
- 重命名只在语义不变且有 `FROM:` / `TO:` 时使用 `## RENAMED Requirements`；行为变化必须使用 `modified`。
- 每个 requirement 使用 `### Requirement: <name>`。
- Requirement 正文使用 SHALL / MUST / MUST NOT 表达规范行为。
- Requirement 正文和 freeform Scenario body 可以写字符串或字符串数组；renderer 必须保留数组换行，不得隐式逗号拼接，也不得猜测拆分字符串。
- 每个 added/modified requirement 至少有一个 `#### Scenario: <name>`。
- 若 requirement 包含多个用户可见操作，scenario 必须逐项枚举或拆分；每个操作要定义触发、预期 UI/API/data 后果、持久化或 reload 后结果，以及 disabled/failure/recovery 行为。
- Guard 必须保持 MUST NOT、preserve、non-goal 或负向边界语义，不得写成 source/scope 外的正向能力。
- 不得创建只包含 projection notes、只写“无”或没有 requirement 的空 spec；zero-delta completion 的 canonical source 只能使用 `trace/specs/no-spec-delta/README.trace.json`，Markdown marker 只由 renderer 投影生成。

## Delivery Plane Projection Rules

- `delivery-plane.added-requirements`、`modified-requirements`、`removed-requirements` 和 `renamed-requirements` 必须全部由同一个 `spec-delta-register[]` 投影。
- Delivery Plane 不得直接从 template 注释、proposal Markdown、旧 specs Markdown、当前实现、测试文件或 apply 结果推导新行为。
- 若 Delivery Plane 需要表达的 requirement、scenario、guard、remove reason 或 rename target 无法追溯到 `spec-delta-register[]`、`existing-spec-state` 或 blocker，writer 必须修订 trace 或报告 blocker，不得只在 Markdown prose 中补写。
- Delivery Plane 中可以使用人类可读总结，但总结不得改变 trace 中 item 的 source projection、guard handling、owner capability 或 downstream expectation。
- 每个 rendered added/modified scenario 必须能解析到 `spec-delta-register[]` 中的 requirement/scenario；每个 register row 也必须能投影到 Delivery Plane。

## JSON Trace Plane

- Normal delta spec 必须写入 `trace/specs/<capability>.trace.json`，包含 `trace-schema`、`artifact-id: "specs"`、`artifact-path: "specs/<capability>/spec.md"`、`change-name`、`schema-name`、`agent-role`、`source-proposal-trace-path`、`specs-completion-mode: "delta"`、`capability`、`delivery-plane`、`source-interface`、`existing-spec-state`、`spec-delta-register` 和 `spec-gate`。
- `source-interface` 只记录语义输入路径和模式，字段值保持字符串或字符串数组，不得内联 source metadata object。
- `existing-spec-state.status` 只能是 `absent`、`parsed` 或 `parse-blocked`。
- `spec-delta-register[]` 每行必须包含 `delta-id`、`delta-op`、`requirement` 和 `source-ids[]`。`delta-id` 使用 `SD-###`。
- `delta-op` 允许值仅为 `added`、`modified`、`removed`、`renamed`。
- `added` / `modified` row 必须包含 `body` 和至少一个 `scenarios[]` row；scenario row 必须包含 `name`，并包含 `body` 或 `given` / `when` / `then`。
- `removed` row 必须包含 `existing-anchor`、`reason` 和 `migration`，不得包含 `scenarios[]`。
- `renamed` row 必须包含 `existing-anchor`、`from` 和 `to`，不得包含行为变化字段。
- guard row 必须写 `guard-handling`，允许值仅为 `must-not`、`preserve-boundary`、`non-goal`。
- `spec-gate` 必须包含 `blockers`、`orphan-source-ids`、`source-set-mismatch`、`existing-spec-state-violations` 和 `delivery-projection-mismatch`；validator pass 要求这些数组为空。
- no-delta marker 必须写入 `trace/specs/no-spec-delta/README.trace.json`，包含 `artifact-id: "specs"`、`artifact-path: "specs/no-spec-delta/README.md"`、`specs-completion-mode: "no-delta"`、`spec-delta-register: []`、空 `spec-gate` 和 no-delta `delivery-plane`。
- artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 trace 不写入 Markdown。

## Reviewer Focus

- 是否只创建必要 spec file。
- Requirement/scenario 是否保留所有 source/scope-backed operation、edge case、failure state、data/API/auth/security rule 和 guard。
- Existing spec state 是否足以支持 `added` / `modified` / `removed` / `renamed` 判定。
- Guard 是否被膨胀为正向行为。
- Design/proof/context-only item 是否没有伪造成 requirement/guard。
- Delivery Plane 是否没有 coverage 泄漏，且每个 rendered scenario 都能回到 `spec-delta-register[]`。
