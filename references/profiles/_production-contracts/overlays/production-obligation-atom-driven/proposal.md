# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取当前 planned change 的 final packet Markdown mirror 与必要 capability view；不得执行、复制或依赖 `source-aligned-change-plan-coverage` 的 Python validator 或其它上游技能脚本。
- Foundation change 也必须来自 `final-packet-index.json` 中的 `change-kind: foundation` packet；不得另建只读 reference、额外 read-set 或第三套 schema。
- `trace/proposal.trace.json` 必须包含 `source-interface`、`change-ga-register`、`non-direct-boundary-ref`、`delivery-plane` 和 `proposal-gate`。

## 上游输入权威

- 若存在 source-aligned JSON sidecar，proposal 入口必须优先读取 `openspec/orchestrate/trace/manifest.json`、`openspec/orchestrate/phase-works/phase-5/final-packet-index.json`、`openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 和 `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json`。
- 所有 planned changes 都来自 `final-packet-index.json` 和对应 final packet；`change-kind` 必须为 `foundation` 或 `business`。
- `trace-contract-version` 必须为 `source-aligned-trace-v1`；`trace/manifest.json` 的 `phase-statuses.phase-5` 和 `trace/phase-5.trace.json.status` 必须一致，且当 Phase 5 status 字段存在时必须为 `accepted` 或 `adjusted`。该 status 是 Phase 5 最终 handoff 决策，不是 validator/reviewer/repair 流程态。
- `final-packet-index.json` 是当前 planned change 是否存在、`change-kind`、direct atom set、packet order 和 dependency/boundary 的机器权威。`change-ga-register[].ga-id` 必须等于当前 packet direct atom set。
- `atom-plan-mapping.json` 是 direct atom final owner capability、final relation 和 final artifact projection 的机器权威。`change-ga-register[].capability` 和 `change-ga-register[].projection` 必须由它派生；该 `projection` 是上游原始/建议分类，不再是 specs/design 的直接消费权威。
- `obligation-atom-index.json` 是 `GA-####` lookup、source document、line range、source fact、normativity 和 atom type 的机器权威。`change-ga-register[]` 和 `non-direct-boundary-ref[]` 的 source fields 必须由它派生。
- canonical final packet Markdown mirror 只作为 proposal-facing 人审镜像，用于 closed-loop outcome、in scope、out of scope、dependencies、non-direct boundary summary 和 blocker prose；它不得覆盖 JSON sidecar 的 direct atom set、projection、capability 或 `change-kind`。
- capability view Markdown 只辅助 capability boundary 文案和 owner-scoped boundary 理解；不得新增 direct `GA-####` coverage、artifact projection、runtime obligation 或 task/proof obligation。
- legacy `obligation-atom-index.md` 只在 JSON sidecar 缺失且 `source-interface` 未显式指向 JSON handoff 时作为兼容 fallback；它不得覆盖 final packet 的 direct scope、artifact projection 或 capability 归属。
- `openspec/orchestrate/change-capability-anchors/index.md` 只用于 packet discovery。
- `openspec/orchestrate/change-plan.md` 只在自动推断 change slug 或核对 roadmap/dependency 顺序时读取，不得覆盖 final packet。
- 除 canonical change packet、global atom index 和必要 capability views 外，其它 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。

## Source Interface

- `source-interface` 只记录上游权威输入路径和 `input-mode`；字段值必须是字符串路径，不得写成 object，不得内联 `{ "path": "...", "sha256": "...", "trace-schema": "..." }` 或其它上游 metadata。
- `source-interface.input-mode` 必须为 `final-change-packet`。
- `source-interface` 至少包含 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json` 和 `final-packet-index-json`；这些字段对应 JSON 缺失必须 blocker。
- `source-interface` 可记录 `canonical-change-packet` 和 `capability-view-*`；这些字段出现时，对应文件缺失必须 blocker，不得静默回退到 Markdown。
- proposal trace 只保存 handoff path；schema、status、digest 一致性由 validator 通过这些路径读取上游 JSON 后校验。

## Trace 生成规则

- `change-ga-register` 必须等于当前 final packet direct atom set；每行只能包含一个 exact direct `GA-####`。
- `change-ga-register[]` 的每个 direct row 必须包含：`ga-id`、`source-document`、`lines`、`source-fact`、`normativity`、`atom-type`、`capability`、`projection`、`routing-disposition`、`artifact-routes[]`、`routing-rationale`、`routing-no-scope-expansion`、`proposal-use`、`downstream-expectation`。
- `ga-id`、`source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 必须从 `obligation-atom-index.json` 派生。
- `capability` 和 `projection` 必须从 `atom-plan-mapping.json` 的 final owner capability 与 final artifact projection 派生。
- `change-ga-register[].projection` 不得为 `contextual-only`；非 direct context/boundary row 才可使用 contextual handling。
- Proposal trace 必须对当前 packet direct atoms 做字段级镜像；不得用 source-window 聚合行、主题 summary、atom count、projection mix 或 capability 汇总替代逐 GA rows。
- `source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 是唯一原始 source truth；`artifact-routes[].use` 只能说明某 artifact 消费该 GA 的哪一面，不得新增、改写或替代 `source-fact`。
- Proposal writer 必须把 `projection` 当作上游建议分类逐 GA 复核，不得按 `spec-requirement -> specs`、`spec-guard -> specs`、`design-obligation -> design`、`verification-obligation -> verification/proof` 做机械映射。
- route 审定必须以 `source-fact` 的语义为准：用户可观察能力边界、产品编辑语义、API/data/auth/security contract 或拒绝未知值的能力边界进入 specs；implementation shape、JSON/schema/model/provider/runtime/deployment/UI control/validation branching 进入 design；同一 fact 同时具备两面时使用 specs + design 双归属。
- `routing-rationale` 必须引用本 GA 的具体 source-fact 语义；不得写“按 final projection 进入 …”或等价模板句。若 writer 无法判断 route，应写入 `proposal-gate.routing-invalid` 并阻断，而不是退回 projection 映射。
- `routing-disposition` 只允许 `projected`、`reference-only`、`deferred`、`out-of-scope`、`not-projected`。`projected` 必须有至少一个 `artifact-routes[]`；其它 disposition 必须使用空 `artifact-routes: []`。
- `artifact-routes[].artifact` 只允许 `specs` 或 `design`；不得路由到 `runtime-acceptance`、`verification` 或 `tasks`。
- `artifact-routes[].role` 按 artifact 受限：`specs` 只允许 `spec-requirement` 或 `spec-guard`；`design` 只允许 `design-input`。
- `verification-obligation` 默认应为 `reference-only` 或 `not-projected`；只有 source fact 中确有生产行为或实现约束时，才可把对应语义路由到 specs/design，且 `routing-rationale` 必须说明没有传播纯验证义务。
- `non-direct-boundary-ref` 只登记 reference-only boundary rows。没有允许的 non-direct boundary 时必须写空数组。
- `non-direct-boundary-ref[]` 只能来自 final packet 明确允许的 owner-scoped non-direct rows、out-of-scope summary 或 dependency/boundary row。
- `non-direct-boundary-ref[]` 的每行必须包含：`ga-id`、`source-document`、`lines`、`source-fact`、`boundary-role`、`propagate`、`proposal-use`。
- `non-direct-boundary-ref[].propagate` 必须为 `false`。
- `non-direct-boundary-ref[].ga-id` 不得出现在 `change-ga-register[].ga-id`。
- `non-direct-boundary-ref` 不得包含 `projection`、`artifact-projection`、`downstream-expectation`、`coverage-status`、`owner-capability` 或任何会让下游把它当作 direct coverage 的字段。
- 下游 artifacts 只能消费 `non-direct-boundary-ref` 的 boundary label、summary 或 no-scope 语义，不得传播其中的 `GA-####`。
- `proposal-gate` 只记录最小闭合结果，不得复制完整 direct atom set、coverage、projection、source 或 capability 分组。
- `proposal-gate.blockers`、`proposal-gate.orphan-ga`、`proposal-gate.source-set-mismatch`、`proposal-gate.non-direct-propagation-violations`、`proposal-gate.routing-missing`、`proposal-gate.routing-invalid`、`proposal-gate.routing-route-violations` 和 `proposal-gate.routing-source-conflicts` 必须存在且为空；非空表示 proposal trace 未闭合，必须 blocker。
- `delivery-plane.non-goals` 只能来自当前 final packet 的 direct rows、`non-direct-boundary-ref` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`change-ga-register`、`non-direct-boundary-ref`、`proposal-gate`、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。

## Reviewer Focus

- change 是否存在于 final packet index。
- packet direct atoms 是否全部在 `change-ga-register` 中出现。
- direct `GA-####` 是否都有 source fact、capability、projection、审定后的 routing 字段和 downstream expectation。
- `artifact-routes[]` 是否基于 `source-fact` 审定，而不是机械照抄 `projection`；若所有 route 都是一对一 projection 映射，且 rationale 使用通用模板或引用 final projection，必须输出 blocker。
- 双语义 source fact 是否正确双归属；纯 verification/proof source fact 是否没有进入 production specs/design。
- `non-direct-boundary-ref` 是否只表达边界引用，且没有传播 non-direct GA。
- 是否从非权威 orchestrate/review/report 产物扩展 scope。
