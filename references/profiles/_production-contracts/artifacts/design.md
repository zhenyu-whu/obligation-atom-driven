# Design Artifact Contract

## 目的

`design.md` 定义 HOW to implement the production change。Design 阶段的核心职责是：理解 proposal 的背景和边界，针对 specs 中已经形成的 requirement/scenario 做实现设计，并吸收 proposal 中明确标记为 design 输入的 source/scope item 作为设计约束。

Design trace 只维护一个顶层语义权威：`implementation-design-register[]`。其它内容只能是输入指针、renderer payload 或最小闭合 gate。每个 design register row 必须代表一个内聚实现决策主题，并在 `implementation-details[]` 中展开强类型实现细则。

## 写入前

- 读取 `trace/proposal.trace.json` 和所有实际生成的 `trace/specs/*.trace.json`；若 specs artifact 是 no-delta marker，则只读取 `trace/specs/no-spec-delta/README.trace.json` 判定 specs completion，不从中派生 spec scenario。
- 不得从 `proposal.md`、`specs/**/*.md`、旧 `design.md` 或旧 `trace/design.trace.json` 推导 design 语义。
- Obligation schema 使用 proposal `change-ga-register[]` 中的 `GA-####`、`projection`、`artifact-routes[]` 和 `capability`；default schema 使用 proposal `change-scope-coverage[]` 中的 `SI-###`、`artifact-handling` 和 `capability`。
- Specs scenario 是 design decision 的主要锚点；spec source basis 只能从 specs trace 反查，不得在 design trace 中用通用 `source-item-ids` 重复维护。
- Proposal 中 routed-to-design（obligation schema：`artifact-routes[].artifact == "design"` 且 `role == "design-input"`）或 `design`（default schema）类型的 direct source/scope item 是 design 输入，必须通过 `implementation-design-register[].design-inputs[]` 被至少一个设计决策吸收。
- Obligation schema 中，原始 `source-fact` 是唯一 source truth；design route 的 `use` 只解释 design 应消费该 GA 的哪一面，不得新增、改写或替代 source fact。
- 如果 design input 实际要求新增用户行为、API 行为或规范约束，而 proposal/specs trace 未表达该行为，writer 必须报告 blocker 或修订上游 artifact，不得只在 design prose 中补写。
- Writer 只写 `trace/design.trace.json`；`design.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从 trace 写入。

## Trace Generation Algorithm

Writer 必须按以下顺序生成 design trace：

1. 读取 proposal trace，建立当前 schema 的 direct source/scope item set。
2. 读取实际 specs trace：
   - delta specs：读取所有 `trace/specs/*.trace.json`。
   - no-delta specs：只读取 `trace/specs/no-spec-delta/README.trace.json`，并确认不派生 scenario。
3. 从 specs trace 建立 scenario anchor index。Anchor 必须使用 `trace/specs/<capability>.trace.json#/spec-delta-register/<delta-index>/scenarios/<scenario-index>` 字符串，不得从 Markdown scenario 反推。
4. 建立 design input set：
   - obligation schema：proposal direct row 中存在 `artifact-routes[]` row 满足 `artifact == "design"` 且 `role == "design-input"`。
   - default schema：proposal direct row 中 `artifact-handling == "design"`。
5. 生成 `implementation-design-register[]`。每行代表一个内聚实现决策主题，不代表 source coverage row、单个 scenario row、单个 atom row、单个页面碎片或单个接口碎片。
6. 每个 register row 必须至少包含一个 `spec-anchors[]` 或一个 `design-inputs[]`。
7. 每个 specs scenario anchor 必须至少被一个 register row 覆盖。
8. 每个 design input source/scope item 必须至少被一个 `design-inputs[].source-item-id` 引用。
9. 每个 register row 必须包含 `implementation-details[]`，用强类型 detail 承载 data model、JSON shape、API、DTO、frontend、validation、migration、ops 等具体设计细则。细则正文必须写入 `content` 长字符串，并以标准技术设计格式展开足以实施的细节；细则类别、归属、锚点和边界继续结构化保存在 trace 字段中。
10. 从同一 register model 投影 `delivery-plane`；Delivery Plane 不得包含 exhaustive source/scope map、alignment gate、coverage matrix、register rows、detail content、detail basis、decision summary、source gap、minimal shape、rejected expansion 或 GA/SI ID。
11. 生成 `design-gate`；gate 只记录 blocker、uncovered spec anchors、uncovered design inputs、invalid design inputs、implementation detail 闭合问题和 delivery projection mismatch。
12. 写入严格 JSON `trace/design.trace.json`，再调用 renderer 生成 `design.md`、Trace Appendix 和 manifest registry entry。

## JSON Trace Plane

`trace/design.trace.json` 顶层只允许 design 语义字段：

- `trace-schema`
- `artifact-id`
- `artifact-path`
- `change-name`
- `schema-name`
- `agent-role`
- `source-interface`
- `implementation-design-register`
- `design-gate`
- `delivery-plane`

旧字段必须视为 hard error，防止双语义源：

- `production-source-map`
- `spec-scenario-design-map`
- `design-decision-index`
- `design-obligation-matrix`
- `source-scope-map`
- `ui-control-contracts`
- `proof-expectation-handoff`
- `production-alignment-gate`

### source-interface

- `source-interface.proposal-trace` 必须为 `trace/proposal.trace.json`。
- `source-interface.specs-completion-mode` 必须匹配实际 specs trace completion mode：`delta` 或 `no-delta`。
- `source-interface.spec-traces[]` 必须等于实际 specs trace 路径集合。
- 字段值只允许字符串或字符串数组，不得内联 source metadata object。

### implementation-design-register

每行必须包含：

- `implementation-design-id`：`IDR-###`，全文件唯一。
- `layer`：只允许 `architecture-module-boundary`、`domain-data-migration`、`api-auth-security`、`async-realtime-ai-worker`、`frontend-ux`、`observability-ops-deployment`、`verification-rollout`。
- `title`
- `spec-anchors[]`
- `design-inputs[]`
- `decision`
- `implementation-boundary`
- `implementation-contract`
- `guard-failure-handling`
- `verification-handoff`
- `no-scope-expansion`
- `blocker`
- `implementation-details[]`

`spec-anchors[]` 只能引用实际 specs trace scenario anchor。No-delta specs 时必须为空。

`design-inputs[]` 每行必须包含：

- `source-item-id`
- `use`

`design-inputs[].source-item-id` 只能引用 proposal direct source/scope set 中 design 类型 item：

- obligation schema：存在 `artifact-routes[]` row 满足 `artifact == "design"` 且 `role == "design-input"`。
- default schema：`artifact-handling == "design"`。

非 routed-to-design item 不得出现在 `design-inputs[]`。Spec source basis 不得复制到 `design-inputs[]`。

`blocker` 必须为空、`无`、`None`、`N/A`、`none` 或 `n/a`；非空 blocker 不能进入 validator pass。

#### IDR 粒度规则

每个 IDR 必须代表一个内聚实现决策主题。多个 specs scenarios 可以共同锚定同一个 IDR；同一个 data model、API family、DTO family、frontend state model、validation/error family 或 migration subject 应优先归入同一个 IDR。

不得把 IDR 当作以下对象：

- 单个 specs scenario 的逐行设计解释。
- 单个 source atom / scope item 的 coverage row。
- 纯 layer coverage row。
- 页面、接口、字段、错误码或测试断言碎片。

如果同一 `detail-type + owner + subject` 被拆到多个 IDR，validator 必须视为 fragmented design subject blocker，要求合并为同一 IDR。

### implementation-details

每个 `implementation-design-register[]` row 必须包含非空 `implementation-details[]`。每个 detail 必须包含：

- `detail-id`：`IDR-###-D###`，全文件唯一，且 IDR 前缀必须匹配父 `implementation-design-id`。
- `detail-type`：只允许以下值：
  - `module-boundary`
  - `data-model`
  - `json-shape`
  - `api-contract`
  - `dto-contract`
  - `frontend-contract`
  - `validation-error-contract`
  - `state-lifecycle`
  - `integration-boundary`
  - `migration-compatibility`
  - `observability-ops`
  - `rollout-compatibility`
  - `non-applicable`
- `owner`：单一 production owner，不得写 owner list。
- `subject`：该细则约束的表、DTO、route、组件、状态、迁移、外部边界或其它生产对象。
- `basis`：该细则如何继承或细化父 IDR 输入。
- `content`：非空 Markdown 技术设计正文长字符串；这是 `design.md` 中 implementation detail 的唯一正文来源，必须足以指导实现，不得使用占位词，不得退化成一行长文本，不得使用字符串数组拆分正文。
- `no-scope-expansion`：该细则拒绝的 source/scope 外行为。

`basis` 必须包含：

- `inherits-parent-spec-anchors`：boolean。为 `true` 时该 detail 继承父 IDR 的全部 `spec-anchors[]`；为 `false` 时必须用 `spec-anchors[]` 列出父 IDR `spec-anchors[]` 的子集。
- `spec-anchors[]`：可为空；非空时只能引用父 IDR 已声明的 specs scenario anchor。
- `design-inputs[]`：可为空；非空时只能引用父 IDR 已声明的 `design-inputs[].source-item-id`。

Renderer 只按 `detail-type` 分组，并在每个分组下输出 `content` 字符串。Renderer 不得输出 `detail-id`、Parent IDR、`owner`、`subject`、`basis` 或 `no-scope-expansion` 等 trace 元信息。因此 `content` 不得把这些 trace 元信息、`GA-####`、`SI-###` 或 trace pointer 复制进 Markdown 正文。

`content` 和 `no-scope-expansion` 不得包含 `TBD`、`TODO`、`待定`、`后续完善`、`视情况`、`实现时决定` 等占位词。

#### Detail Content Format

`content` 必须按 detail type 写成可直接阅读的技术设计正文：

- `module-boundary` 必须明确模块/包/路由/组件边界、职责归属、允许的入站/出站依赖、持久化或 API ownership，以及边界失败/禁用行为。
- `data-model` 必须使用 Markdown 表格、SQL DDL 或 Prisma-like schema 等标准数据模型格式，明确字段/列名、类型、可空性、默认值、索引/唯一性和关键约束；不得只用 prose 罗列字段名。
- `json-shape` 必须包含 fenced `json` code block，展示稳定字段、嵌套结构、数组元素、枚举值和 nullable/optional 表达；不得只用自然语言描述 JSON。
- `api-contract` 必须明确 method、path、auth/tenant boundary、request body/query/path params、success response、error response/status 和幂等/并发语义；推荐使用 `http`、`openapi`、`yaml` 或 Markdown 表格呈现。
- `dto-contract` 必须包含 TypeScript interface/class、JSON schema 或字段表，明确字段名、类型、required/optional、nullable、枚举和版本兼容规则。
- `frontend-contract` 必须明确组件/route/state/event/data-fetching/error-display contract；涉及复杂 state 时用状态表或结构化 bullet 展开。
- `validation-error-contract` 必须明确 error code、field/path、severity/blocking、message key 和 UI 定位。
- `state-lifecycle` 必须明确 state 名称、进入条件、转移、持久化边界和失败/回滚行为。
- `integration-boundary` 必须明确内外部系统边界、调用方向、协议/队列/event/API surface、超时/重试/降级/失败处理和不得跨越的 dependency boundary。
- `migration-compatibility` 必须明确 schema/data/config 迁移或回填步骤、默认值/版本兼容策略、旧数据处理、安全回滚和 source/scope 外拒绝项。
- `observability-ops` 必须至少覆盖 metrics/logs/alerts/dashboard/runbook/tracing 中的两类，并明确生产 owner、触发条件和失败定位方式。
- `rollout-compatibility` 必须明确 rollout/feature flag/deployment gate、兼容窗口、回滚或禁用路径、监控门禁和客户端/服务端版本兼容。
- `non-applicable` 必须明确该 detail type 不适用的原因、已检查的边界，以及拒绝的 scope-expanding 行为；不得只写“无”。

#### Layer Detail Coverage

每个 IDR 的 `layer` 必须由对应 detail type 覆盖：

- `architecture-module-boundary`：至少一个 `module-boundary` 或 `integration-boundary`。
- `domain-data-migration`：至少一个 `data-model`、`json-shape`、`migration-compatibility`，或明确 `non-applicable`。
- `api-auth-security`：至少一个 `api-contract`、`dto-contract`、`validation-error-contract`，或明确 `non-applicable`。
- `async-realtime-ai-worker`：至少一个 `integration-boundary`、`state-lifecycle`，或明确 `non-applicable`。
- `frontend-ux`：至少一个 `frontend-contract`、`state-lifecycle`、`validation-error-contract`，或明确 `non-applicable`。
- `observability-ops-deployment`：至少一个 `observability-ops`、`rollout-compatibility`，或明确 `non-applicable`。
- `verification-rollout`：至少一个 `rollout-compatibility`、`observability-ops`，或明确 `non-applicable`。

### design-gate

`design-gate` 必须包含且只用于最小闭合结果：

- `blockers`
- `uncovered-spec-anchors`
- `uncovered-design-inputs`
- `invalid-design-inputs`
- `missing-implementation-details`
- `invalid-implementation-details`
- `detail-basis-violations`
- `layer-detail-coverage-gaps`
- `fragmented-design-subjects`
- `placeholder-detail-content`
- `delivery-projection-mismatch`

Validator pass 要求上述数组全部为空。

## Delivery Plane

- `delivery-plane.decisions[]` 只定义 Markdown 中 decision 的渲染顺序；每行只能包含 `decision-id`，且必须等于某个 `implementation-design-id`。Renderer 必须按该 ID 从 `implementation-design-register[]` 读取 `title` 和 `decision`。
- `delivery-plane.detail-render-order[]` 只定义 Markdown 中 implementation detail 的 `detail-type` 分组顺序，不承载语义。它只能包含允许的 detail type，不能重复，并必须覆盖当前 trace 中所有实际出现的 detail type；可以包含没有实际 detail 的 detail type，renderer 会跳过空 section。
- Delivery Plane 不得泄漏 `GA-####`、`SI-###`、trace pointer、coverage 表、register 表、matrix、gate、detail basis、source/scope closure 细节、source gap、minimal shape 或 rejected expansion。
- Design Markdown 不再渲染旧的 architecture/domain/API/frontend/ops/verification/rollout 模板段落；这些层面的实现细节必须归入对应 `implementation-details[].content`。
- 当 source/spec 定义行为但未定义 exact implementation shape 时，选择最小 production-compatible shape 并写入 `implementation-contract` 或对应 `implementation-details[].content`；拒绝的 scope-expanding alternative 必须写入 IDR 或 detail 的 `no-scope-expansion`。
- 不得把 production behavior 替换成 placeholder、diagnostic、mock-only、static-only、fixture-only、registry-only 或 sandbox-only 行为，除非 proposal 明确标记为 deferred、non-goal、context 或 verification/proof input。

## Required Sections

- Context
- Goals / Non-Goals
- Decisions
- Risks / Trade-offs
- Open Questions
- Implementation Details
- JSON Trace Plane pointer

## Reviewer Focus

- 每个 specs scenario 是否有实现设计。
- 每个 proposal design input 是否被设计决策吸收。
- `implementation-design-register[]` 是否是唯一 design 语义源，且没有旧字段残留。
- 设计是否新增 source/scope 外 behavior、provider、persistent concept 或 user workflow。
- 每个 register row 是否足以让 implementer 不需要从 design 外部猜测 implementation boundary、contract、guard/failure handling 和 verification handoff。
- 每个 IDR 是否按内聚实现主题组织，而不是按 scenario/source coverage 组织。
- 每个 IDR 的 implementation details 是否足以支撑实现 data model、API/DTO、frontend state、validation/error、migration/compatibility 或明确不适用。
- 是否存在同一 `detail-type + owner + subject` 被拆散到多个 IDR 的割裂设计。
