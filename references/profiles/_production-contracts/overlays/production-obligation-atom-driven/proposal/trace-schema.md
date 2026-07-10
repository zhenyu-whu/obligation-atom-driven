# Obligation Proposal Trace Schema Overlay

本文件定义 `production-obligation-atom-driven` 的 proposal trace schema 差异。它适用于 writer、repair-writer、reviewer、renderer 和 validator，但不定义 writer 的生成策略，也不替代 reviewer 的语义审查规则。

## Required Sections

`trace/proposal.trace.json` 必须包含：

- `source-interface`
- `change-ga-register`
- `non-direct-boundary-ref`
- `delivery-plane`
- `proposal-gate`

## Source Interface

- `source-interface` 只记录上游权威输入路径和 `input-mode`；字段值必须是字符串路径，不得写成 object，不得内联 `{ "path": "...", "sha256": "...", "trace-schema": "..." }` 或其它上游 metadata。
- `source-interface.input-mode` 必须为 `final-change-packet`。
- `source-interface` 至少包含 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json` 和 `final-packet-index-json`；这些字段对应 JSON 缺失必须 blocker。
- `source-interface` 可记录 `canonical-change-packet` 和 `capability-view-*`；这些字段出现时，对应文件缺失必须 blocker，不得静默回退到 Markdown。
- Proposal trace 只保存 handoff path；schema、status、digest 一致性由 validator 通过这些路径读取上游 JSON 后校验。

## change-ga-register

- `change-ga-register` 必须等于当前 final packet direct atom set；每行只能包含一个 exact direct `GA-####`。
- `change-ga-register[]` 的每个 direct row 必须包含：`ga-id`、`source-document`、`lines`、`source-fact`、`normativity`、`atom-type`、`capability`、`projection`、`routing-disposition`、`artifact-routes[]`、`routing-rationale`、`routing-no-scope-expansion`、`proposal-use`、`downstream-expectation`。
- `ga-id`、`source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 必须从 `obligation-atom-index.json` 派生。
- `capability` 和 `projection` 必须从 `atom-plan-mapping.json` 的 final owner capability 与 final artifact projection 派生。
- `change-ga-register[].projection` 不得为 `contextual-only`；非 direct context/boundary row 才可使用 contextual handling。
- Proposal trace 必须对当前 packet direct atoms 做字段级镜像；不得用 source-window 聚合行、主题 summary、atom count、projection mix 或 capability 汇总替代逐 GA rows。
- `source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 是唯一原始 source truth；`artifact-routes[].use` 只能说明某 artifact 消费该 GA 的哪一面，不得新增、改写或替代 `source-fact`。

## Artifact Routes

- `routing-disposition` 只允许 `projected`、`reference-only`、`deferred`、`out-of-scope`、`not-projected`。`projected` 必须有至少一个 `artifact-routes[]`；其它 disposition 必须使用空 `artifact-routes: []`。
- `artifact-routes[].artifact` 只允许 `specs` 或 `design`；不得路由到 `runtime-acceptance`、`verification` 或 `tasks`。
- `artifact-routes[].role` 按 artifact 受限：`specs` 只允许 `spec-requirement` 或 `spec-guard`；`design` 只允许 `design-input`。

## non-direct-boundary-ref

- `non-direct-boundary-ref` 只登记 reference-only boundary rows。没有允许的 non-direct boundary 时必须写空数组。
- `non-direct-boundary-ref[]` 只能来自 final packet 明确允许的 owner-scoped non-direct rows、out-of-scope summary 或 dependency/boundary row。
- `non-direct-boundary-ref[]` 的每行必须包含：`ga-id`、`source-document`、`lines`、`source-fact`、`boundary-role`、`propagate`、`proposal-use`。
- `non-direct-boundary-ref[].propagate` 必须为 `false`。
- `non-direct-boundary-ref[].ga-id` 不得出现在 `change-ga-register[].ga-id`。
- `non-direct-boundary-ref` 不得包含 `projection`、`artifact-projection`、`downstream-expectation`、`coverage-status`、`owner-capability` 或任何会让下游把它当作 direct coverage 的字段。
- 下游 artifacts 只能消费 `non-direct-boundary-ref` 的 boundary label、summary 或 no-scope 语义，不得传播其中的 `GA-####`。

## proposal-gate

- `proposal-gate` 只记录最小闭合结果，不得复制完整 direct atom set、coverage、projection、source 或 capability 分组。
- `proposal-gate.blockers`、`proposal-gate.orphan-ga`、`proposal-gate.source-set-mismatch`、`proposal-gate.non-direct-propagation-violations`、`proposal-gate.routing-missing`、`proposal-gate.routing-invalid`、`proposal-gate.routing-route-violations` 和 `proposal-gate.routing-source-conflicts` 必须存在且为空；非空表示 proposal trace 未闭合，必须 blocker。

## Delivery Plane Restrictions

- `delivery-plane.non-goals` 只能来自当前 final packet 的 direct rows、`non-direct-boundary-ref` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`change-ga-register`、`non-direct-boundary-ref`、`proposal-gate`、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
