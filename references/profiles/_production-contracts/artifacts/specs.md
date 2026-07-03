# Specs Artifact Contract

## 目的

`specs/**/*.md` 定义 production system 应该做什么。Delivery Plane 只写 OpenSpec delta requirement、scenario、guard、rename/remove 信息；source/scope coverage、capability 分组、guard handling、no-delta completion 和 alignment gate 只写入 `trace/specs/**.trace.json`。

只为有 spec-level direct item 的 capability 创建 spec file；当整个 change 没有 spec-level delta 时，必须用 no-delta marker 显式完成 specs artifact。

## 写入前

- 读取 `trace/proposal.trace.json`，使用其中 source/scope coverage register 作为唯一 proposal scope-reading interface；不得从 `proposal.md` 推导 requirement、guard 或 no-delta completion。
- 按当前 schema overlay 确定 spec-relevant item：obligation schema 使用 `spec-requirement` / `spec-guard` direct `GA-####`，default schema 使用 `spec` / `guard` `SI-###`。
- 若存在任一 spec-relevant item，只为对应 capability 创建正常 `specs/<capability>/spec.md`。
- 修改 existing capability 前，读取对应 `openspec/specs/<capability>/spec.md`，并在 trace 的 `existing-spec-read-set` 中记录读取结果或明确 blocker。
- 若整个 change 没有任何 spec-relevant item，必须生成 `trace/specs/no-spec-delta/README.trace.json` no-delta trace，并由 renderer 生成 `specs/no-spec-delta/README.md` marker；不得生成任何 `specs/<capability>/spec.md`。
- 若 capability 没有 spec-relevant item，不创建该 capability 的 spec file。`design-obligation` / `verification-obligation` / `design` / `proof` / `context` 不得 fallback 派生成 requirement/guard。
- 建立 trace-backed capability-to-source/scope map、requirement/scenario model、guard model、non-spec handoff notes、existing requirement read set、spec-handling、no-scope-expansion checks 和 `delivery-plane` render payload。
- 正常 specs writer 只写 `trace/specs/<capability>.trace.json`；`specs/<capability>/spec.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。
- no-delta specs writer 只写 `trace/specs/no-spec-delta/README.trace.json`；`specs/no-spec-delta/README.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 使用 `--no-delta-specs` 从 trace 写入。

## Upstream Input Model

- Specs writer 必须按当前 schema profile 与 overlay 解析 proposal trace；`instructions.template` 只提供 JSON shape 和字段示例，不提供 source/scope 语义权威。
- 所有 `trace/specs/**.trace.json` sections 必须能回溯到 proposal trace register、focused existing spec read 或明确 blocker；不得从 template 注释、proposal Markdown、旧 specs Markdown、当前实现、测试文件、apply result、evidence 或 reviewer 过程摘要发明 requirement/guard。
- Common contract 只定义通用生成顺序和 Delivery Plane / JSON Trace Plane 边界；具体 ID 体系、register 字段、spec-relevant predicate 和 gate 形状由 profile contract 与 schema overlay 约束。
- Downstream artifact writer/reviewer 只能把 specs trace 作为 specs 语义输入；`specs/**/*.md` 是 renderer 投影后的 Delivery Plane，不得反向作为 source/scope register、coverage oracle、runtime row 或 proof oracle。
- 如果 requirement/scenario 需要 proposal trace 无法到达的 source/scope detail，writer 必须报告 blocker 或修订上游 proposal trace；不得扩大读取范围后直接写入 specs trace。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 specs trace：

1. 读取 schema overlay 允许的 proposal trace register，并记录缺失、冲突或超出 scope 的 blocker。
2. 建立 spec-relevant item set；每个 item 必须有 exact `GA-####` 或 `SI-###`，不得使用 ranges、汇总行或主题计数替代。
3. 按 capability 分组 spec-relevant item；每个有 item 的 capability 正好生成一个 normal delta specs trace。
4. 对修改 existing capability 的分组读取 `openspec/specs/<capability>/spec.md`，记录 `existing-spec-read-set[]`；新增 capability 时记录无 existing spec。
5. 为每个 item 分配 `spec-handling`：正向 requirement 使用 `direct-spec-requirement`，guard 使用 `direct-spec-guard`。
6. 为每个 guard item 分配 `guard-handling`：只能是 `must-not`、`preserve-boundary` 或 `non-goal`；guard 不得膨胀成新的正向行为。
7. 构造 requirement/scenario model；每个 source-backed operation、edge case、failure state、data/API/auth/security rule 和 guard 必须落到至少一个 requirement/scenario，或进入 blocker。
8. 生成 `requirement-source-trace[]`；每行必须锚定一个 rendered requirement/scenario，并保留 proposal trace 中的 source/scope ID、capability、source fact、source path/range 和 projection/handling。
9. 生成 `capability-source-map[]`；该分组只能从 `requirement-source-trace[]` 汇总，不得新增语义。
10. 生成 `production-alignment-gate`；gate 必须从 spec-relevant item set、requirement-source-trace、capability-source-map、guard register 和 blocker set 机械派生。
11. 从同一 trace-backed model 投影 `delivery-plane` render payload；Delivery Plane 不得包含 exhaustive source/scope coverage、alignment gate、projection mix 或 trace rows。
12. 在调用 renderer 前做 set-diff 自查：proposal spec-relevant item set、capability-source-map、requirement-source-trace、guard handling、delivery requirement/scenario anchors 和 alignment gate 不得缺失、重复、跨 capability 漂移或出现 orphan。
13. 写入严格 JSON `trace/specs/<capability>.trace.json`，再调用 renderer 生成 `specs/<capability>/spec.md`、Trace Appendix 和 manifest registry entry。
14. no-delta 分支只生成 `trace/specs/no-spec-delta/README.trace.json`，其 `requirement-source-trace` 必须为空，`production-alignment-gate.blockers` 必须为空。

## Delivery Plane

- no-delta marker 不是 delta spec，不能包含 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`、`### Requirement` 或 `#### Scenario`。
- 新行为使用 `## ADDED Requirements`。
- 变化行为使用 `## MODIFIED Requirements`，修改前必须复制完整 existing requirement block。
- 删除行为只在有 Reason 和 Migration 时使用 `## REMOVED Requirements`。
- 重命名只在有 `FROM:` / `TO:` 时使用 `## RENAMED Requirements`。
- 每个 requirement 使用 `### Requirement: <name>`。
- Requirement 正文使用 SHALL / MUST / MUST NOT 表达规范行为。
- Requirement 正文和 freeform Scenario body 可以写字符串或字符串数组；renderer 必须保留数组换行，不得隐式逗号拼接，也不得猜测拆分字符串。
- 每个 added/modified requirement 至少有一个 `#### Scenario: <name>`。
- 若 requirement 包含多个用户可见操作，scenario 必须逐项枚举或拆分；每个操作要定义触发、预期 UI/API/data 后果、持久化或 reload 后结果，以及 disabled/failure/recovery 行为。
- Guard 必须保持 MUST NOT、preserve、non-goal 或负向边界语义，不得写成 source/scope 外的正向能力。
- 不得创建只包含 projection notes、只写“无”或没有 requirement 的空 spec；zero-delta completion 的 canonical source 只能使用 `trace/specs/no-spec-delta/README.trace.json`，Markdown marker 只由 renderer 投影生成。

## Delivery Plane Projection Rules

- `delivery-plane.added-requirements`、`modified-requirements`、`removed-requirements` 和 `renamed-requirements` 必须全部由同一个 trace-backed requirement/scenario/guard model 投影。
- Delivery Plane 不得直接从 template 注释、proposal Markdown、旧 specs Markdown、当前实现、测试文件或 apply 结果推导新行为。
- 若 Delivery Plane 需要表达的 requirement、scenario、guard、remove reason 或 rename target 无法追溯到 specs trace row、existing-spec-read-set 或 blocker，writer 必须修订 trace 或报告 blocker，不得只在 Markdown prose 中补写。
- Delivery Plane 中可以使用人类可读总结，但总结不得改变 trace 中 item 的 source projection、spec-handling、guard-handling、owner capability 或 downstream expectation。
- 每个 rendered added/modified scenario 必须至少有一条 `requirement-source-trace[]` row 反向锚定；每个 `requirement-source-trace[]` row 也必须能解析到 rendered requirement/scenario。

## JSON Trace Plane

- Normal delta spec 必须写入 `trace/specs/<capability>.trace.json`，包含 `trace-schema`、`artifact-id: "specs"`、`artifact-path: "specs/<capability>/spec.md"`、`change-name`、`schema-name`、`agent-role`、`source-proposal-trace-path`、`specs-completion-mode: "delta"`、`capability`、`existing-spec-read-set`、`capability-source-map`、`requirement-source-trace`、`production-alignment-gate` 和 `delivery-plane`。
- no-delta marker 必须写入 `trace/specs/no-spec-delta/README.trace.json`，包含 `artifact-id: "specs"`、`artifact-path: "specs/no-spec-delta/README.md"`、`specs-completion-mode: "no-delta"`、`requirement-source-trace: []`、空 `production-alignment-gate.blockers` 和 no-delta `delivery-plane`。
- `requirement-source-trace` 每行必须写 `spec-handling`。允许值仅为 `direct-spec-requirement`、`direct-spec-guard`。
- `source-projection` / `artifact-handling` 必须保持 proposal trace 中的 spec-relevant projection/handling；`design-obligation` / `verification-obligation` / `design` / `proof` / `context` 出现在 normal specs `requirement-source-trace` 中是 validator error。
- guard row 必须写 `guard-handling`，允许值仅为 `must-not`、`preserve-boundary`、`non-goal`。
- 如同一 capability 已有 delta spec 且存在 design/proof/context-only item，可在 JSON trace 中写 handoff notes；不得为了 notes 单独创建 spec file。
- no-delta marker 的 `requirement-source-trace` 必须为空；若 proposal register 中存在任一 spec-relevant item，no-delta marker 是 validator error。
- Gate 必须确认 spec-relevant items 没有 orphan、range、source/scope 外 scenario、missing guard、capability drift 或 delivery-only scenario。
- artifact 末尾只保留短 `## Trace Appendix` 指针块，完整 trace 不写入 Markdown。

## Reviewer Focus

- 是否只创建必要 spec file。
- Requirement/scenario 是否保留所有 source/scope-backed operation、edge case、failure state、data/API/auth/security rule 和 guard。
- Guard 是否被膨胀为正向行为。
- Design/proof/context-only item 是否没有伪造成 requirement/guard，并有明确下游 handoff。
- Delivery Plane 是否没有 coverage 泄漏，且每个 rendered scenario 都能回到 specs trace。
