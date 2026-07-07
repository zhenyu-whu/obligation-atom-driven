# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取当前 planned change 的 final packet Markdown mirror 与必要 capability view；不得执行上游 source-aligned 技能脚本。Foundation change 也必须来自 `final-packet-index.json` 中的 `change-kind: foundation` packet。
- `trace/proposal.trace.json` 必须包含 `source-interface`、`change-ga-register`、`non-direct-boundary-ref`、`delivery-plane` 和 `proposal-gate`。

## 上游输入权威

- `final-packet-index.json` 是当前 planned change 是否存在、`change-kind`、direct atom set、packet order 和 dependency/boundary 的机器权威。`change-ga-register[].ga-id` 必须等于当前 packet direct atom set。
- `atom-plan-mapping.json` 是 direct atom final owner capability、final relation 和 final artifact projection 的机器权威。`change-ga-register[].capability` 和 `change-ga-register[].projection` 必须由它派生；该 `projection` 是上游原始/建议分类，不再是 specs/design 的直接消费权威。
- `obligation-atom-index.json` 是 `GA-####` lookup、source document、line range、source fact、normativity 和 atom type 的机器权威。`change-ga-register[]` 和 `non-direct-boundary-ref[]` 的 source fields 必须由它派生。
- canonical final packet Markdown mirror 只作为 proposal-facing 人审镜像，用于 closed-loop outcome、in scope、out of scope、dependencies、non-direct boundary summary 和 blocker prose；它不得覆盖 JSON sidecar 的 direct atom set、projection、capability 或 `change-kind`。
- capability view Markdown 只辅助 capability boundary 文案和 owner-scoped boundary 理解；不得新增 direct `GA-####` coverage、artifact projection、runtime obligation 或 task/proof obligation。
- `change-plan.md`、Phase 4 source window 文案、review/report 产物和 archived proposal Markdown 不属于本 proposal 内容权威；需要依赖顺序时只可按 runtime overlay 限定用途读取。

## Trace 生成规则

- `source-interface` 只记录上游权威输入路径和 `input-mode`；字段值必须是字符串路径，不得写成 object，不得内联 `{ "path": "...", "sha256": "...", "trace-schema": "..." }` 或其它上游 metadata。
- `source-interface.input-mode` 必须为 `final-change-packet`。
- `source-interface` 至少包含 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json` 和 `final-packet-index-json`；这些字段对应 JSON 缺失必须 blocker。
- `change-ga-register` 必须等于当前 final packet direct atom set；每行只能包含一个 exact direct `GA-####`。
- `change-ga-register[]` 的每个 direct row 必须包含：`ga-id`、`source-document`、`lines`、`source-fact`、`normativity`、`atom-type`、`capability`、`projection`、`routing-disposition`、`artifact-routes[]`、`routing-rationale`、`routing-no-scope-expansion`、`proposal-use`、`downstream-expectation`。
- `change-ga-register[].projection` 不得为 `contextual-only`。
- `source-document`、`lines`、`source-fact`、`normativity` 和 `atom-type` 是唯一原始 source truth；`artifact-routes[].use` 只能说明某 artifact 消费该 GA 的哪一面，不得新增、改写或替代 `source-fact`。
- `routing-disposition` 只允许 `projected`、`reference-only`、`deferred`、`out-of-scope`、`not-projected`。`projected` 必须有至少一个 `artifact-routes[]`；其它 disposition 必须使用空 `artifact-routes: []`。
- `artifact-routes[].artifact` 只允许 `specs` 或 `design`；不得路由到 `runtime-acceptance`、`verification` 或 `tasks`。
- `artifact-routes[].role` 按 artifact 受限：`specs` 只允许 `spec-requirement` 或 `spec-guard`；`design` 只允许 `design-input`。
- `verification-obligation` 默认应为 `reference-only` 或 `not-projected`；只有 source fact 中确有生产行为或实现约束时，才可把对应语义路由到 specs/design，且 `routing-rationale` 必须说明没有传播纯验证义务。
- `non-direct-boundary-ref` 只登记 reference-only boundary rows。没有允许的 non-direct boundary 时必须写空数组。
- `non-direct-boundary-ref[]` 的每行必须包含：`ga-id`、`source-document`、`lines`、`source-fact`、`boundary-role`、`propagate`、`proposal-use`。
- `non-direct-boundary-ref[].propagate` 必须为 `false`。
- `non-direct-boundary-ref[].ga-id` 不得出现在 `change-ga-register[].ga-id`。
- `non-direct-boundary-ref` 不得包含 `projection`、`artifact-projection`、`downstream-expectation`、`coverage-status`、`owner-capability` 或任何会让下游把它当作 direct coverage 的字段。
- `proposal-gate` 只记录最小闭合结果，不得复制完整 coverage、projection、source 或 capability 分组。
- `proposal-gate.blockers`、`proposal-gate.orphan-ga`、`proposal-gate.source-set-mismatch`、`proposal-gate.non-direct-propagation-violations`、`proposal-gate.routing-missing`、`proposal-gate.routing-invalid`、`proposal-gate.routing-route-violations` 和 `proposal-gate.routing-source-conflicts` 必须存在且为空；非空表示 proposal 未闭合，必须 blocker。
- Foundation change 不得另建只读 reference、额外 read-set 或第三套 schema；它与 business change 一样通过当前 final packet direct atoms 进入 `change-ga-register`。
- obligation profile 的 `delivery-plane.non-goals` 只能来自当前 final packet 的 direct rows、`non-direct-boundary-ref` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`change-ga-register`、`non-direct-boundary-ref`、`proposal-gate`、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
