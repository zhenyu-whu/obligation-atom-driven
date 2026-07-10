# Design Writer Contract

本文件只适用于 `design-writer` 和 `design-repair-writer`。Writer 的核心任务是把 specs scenarios 与 proposal routed-to-design inputs 综合为可实施的设计语义模型；trace links 和 gate 是完成后的客观投影与自查结果，不是生成策略。

## 写入前

- 读取 `trace/proposal.trace.json` 和所有实际生成的 `trace/specs/*.trace.json`；若 specs artifact 是 no-delta marker，则只读取 `trace/specs/no-spec-delta/README.trace.json` 判定 specs completion，不从中派生 spec scenario。
- 不得从 `proposal.md`、`specs/**/*.md`、旧 `design.md` 或旧 `trace/design.trace.json` 推导 design 语义。
- Obligation schema 使用 proposal `change-ga-register[]` 中的 `GA-####`、`artifact-routes[]` 和 `capability`；default schema 使用 proposal `change-scope-coverage[]` 中的 `SI-###`、`artifact-handling` 和 `capability`。
- Specs scenario 是 design decision 的主要锚点；spec source basis 只能从 specs trace 反查，不得在 design trace 中用通用 `source-item-ids` 重复维护。
- Proposal 中 routed-to-design（obligation schema：`artifact-routes[].artifact == "design"` 且 `role == "design-input"`）或 `design`（default schema）类型的 direct source/scope item 是 design 输入。
- Obligation schema 中，原始 `source-fact` 是唯一 source truth；design route 的 `use` 只解释 design 应消费该 GA 的哪一面，不得新增、改写或替代 source fact。
- 如果 design input 实际要求新增用户行为、API 行为或规范约束，而 proposal/specs trace 未表达该行为，writer 必须报告 blocker 或修订上游 artifact，不得只在 design prose 中补写。
- Writer 只写 `trace/design.trace.json`；`design.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。

## Trace 生成顺序

Writer 必须按以下顺序生成 design trace：

1. 读取 proposal trace，建立当前 schema 的 direct source/scope item set。
2. 读取实际 specs trace：
   - delta specs：读取所有 `trace/specs/*.trace.json`。
   - no-delta specs：只读取 `trace/specs/no-spec-delta/README.trace.json`，并确认不派生 scenario。
3. 从 specs trace 建立 scenario anchor index。Anchor 必须使用 `trace/specs/<capability>.trace.json#/spec-delta-register/<delta-index>/scenarios/<scenario-index>` 字符串，不得从 Markdown scenario 反推。
4. 建立 design input set：
   - obligation schema：proposal direct row 中存在 `artifact-routes[]` row 满足 `artifact == "design"` 且 `role == "design-input"`。
   - default schema：proposal direct row 中 `artifact-handling == "design"`。
5. 从 specs scenarios 提取 implementation needs，包括用户/API surface、状态、数据、持久化、鉴权/安全、边界、失败分支、兼容、集成、运维和 rollout 等 production-meaningful implementation needs。No-delta specs 时，不派生 scenario needs，只从 routed-to-design inputs 提取实现约束。
6. 综合 implementation needs 和 design inputs，生成 `implementation-design-register[]`。每行必须是一个内聚实现决策主题，代表一组 requirement/scenario 或 design input 的实现方案；不得代表 source coverage row、单个 scenario row、单个 atom row、单个页面碎片、单个接口碎片或 layer coverage row。
7. 对每个决策主题，先写清 `decision`、`implementation-boundary`、`implementation-contract`、`guard-failure-handling`、`verification-handoff` 和 `no-scope-expansion`，使其即使暂不看 trace links 也能指导实现。
8. 按该决策主题实际需要的生产对象展开适用的 `implementation-details[]`。只生成存在真实设计对象的 detail type；不得为了 render order、layer coverage、gate closure 或模板完整性生成空洞、占位或不适用的 detail。
9. 决策主题和 details 完成后，再客观填写 `spec-anchors[]`、`design-inputs[]` 和 detail `basis`，表达它们真实吸收了哪些 specs scenarios 和 design inputs。
10. 从同一 register model 投影 `delivery-plane`。Delivery Plane 只承载 renderer payload，不得包含 exhaustive source/scope map、alignment gate、coverage matrix、register rows、detail basis、source gap 或 GA/SI ID。
11. 最后生成 `design-gate`。Gate 是 validator/reviewer 反查 scenario coverage、design input coverage、detail completeness、layer coverage 和 projection mismatch 的闭合结果；它不是 writer 倒推 IDR 或 detail 的 authoring checklist。
12. 写入严格 JSON `trace/design.trace.json`，再调用 renderer 生成 `design.md`、Trace Appendix 和 manifest registry entry。

## IDR 生成规则

- 每个 IDR 必须代表一个内聚实现决策主题，主轴是满足 specs implementation needs 和 routed design inputs 的实现方案。
- 多个 specs scenarios 可以共同锚定同一个 IDR；同一个 data model、API family、DTO family、frontend state model、validation/error family、migration subject 或 integration boundary 应优先归入同一个 IDR。
- 如果一个候选主题没有任何真实 `implementation-details[]` 可写，说明它不是实现决策，应合并、删除或报告 blocker；不得创建 `non-applicable` 或占位 detail 来满足结构。
- 不得把 IDR 当作 source atom coverage、scenario coverage、page fragment、route fragment、field fragment、error-code fragment 或测试断言碎片。
- 如果 source/spec 定义行为但未定义 exact implementation shape，writer 应选择最小 production-compatible shape，并把拒绝的 scope-expanding alternative 写入 IDR 或 detail 的 `no-scope-expansion`。

## Implementation Details 生成规则

- Detail 只能为当前 IDR 中真实存在的生产对象、边界、契约、状态、迁移、集成、运维或 rollout 设计而创建。
- Detail `content` 是 `design.md` 中 implementation detail 的唯一正文来源，必须足以指导实现；不得退化成一行摘要，不得包含 trace pointer、GA/SI ID、coverage 解释或 reviewer-only 说明。
- `non-applicable` 只用于某个 IDR 的 layer 本身被上游输入要求审视、但确认当前 change 没有该类实现设计对象时；不得为了让 section 看起来完整而创建。
- `data-model` 只适用于当前 change 创建或修改应用拥有的持久化模型、表、枚举、索引、查询模型或业务数据结构。
- 若当前 change 不创建应用拥有的数据模型，必须省略 `data-model` detail；不得用 Prisma datasource/generator、generated client、migration engine metadata、framework-owned internal table 或 `_prisma_migrations` 字段填充 data model。
- 当只需要表达数据库连接、migration metadata readback、client generation 或 schema 迁移兼容时，使用 `migration-compatibility`、`integration-boundary` 或 `module-boundary`，不要伪造 `data-model`。

## Writer 提交前结构检查

调用 renderer 前，writer 只做结构一致性检查：

- `trace/design.trace.json` 是严格 JSON，且只包含 `artifacts/design/trace-schema.md` 允许的顶层字段。
- 每个 IDR ID、detail ID 和 delivery-plane decision ID 都能在同一 trace 中解析，且无重复。
- 每个 detail 的 `basis` 只引用父 IDR 已覆盖的 specs anchors 和 design inputs。
- `delivery-plane` 只保存 render order，不泄漏 coverage、gate、trace pointer 或 source/scope matrix。
- `content` 不包含 trace metadata、GA/SI ID、placeholder 或 reviewer-only 说明。
- 若结构检查或生成后的 gate 出现缺口，writer 必须返回 blocker 或修订上游/语义模型；不得为了清空 gate 创建 coverage-only IDR、phantom detail 或不真实 contribution。

## Repair Writer

Repair-writer 必须重新读取最新上游 trace JSON、当前 design trace、contract bundle、validator hard error 和 reviewer blocker。修复时应重建设计语义模型中受影响的 IDR/detail，而不是局部补字段来关闭 validator 或 reviewer finding。
