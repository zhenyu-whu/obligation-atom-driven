# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取当前 planned change 的 final packet Markdown mirror 与必要 capability view；不得执行上游 source-aligned 技能脚本。Foundation change 也必须来自 `final-packet-index.json` 中的 `change-kind: foundation` packet。
- `trace/proposal.trace.json` 必须包含 `obligation-atom-preconditions`、`change-atom-coverage-register`、`production-source-coverage`、`source-window-read-set` 和 `proposal-alignment-gate`；当 final packet 含 owner-scoped non-direct rows 时，还必须包含 `owner-scoped-non-direct-boundary-register`。

## 上游输入权威

- `final-packet-index.json` 是当前 planned change 是否存在、`change-kind`、direct atom set、packet order 和 dependency/boundary 的机器权威。`proposal-alignment-gate.change-kind`、`direct-atoms.ids/count` 和 direct atom set-diff 必须由它派生。
- `atom-plan-mapping.json` 是 direct atom final owner capability、final relation 和 final artifact projection 的机器权威。`change-atom-coverage-register[].owner-capability`、`artifact-projection`、`atom-relation` 和 projection coverage 必须由它派生。
- `obligation-atom-index.json` 是 `GA-####` lookup、source document、line range、source fact、normativity 和 atom type 的机器权威。`change-atom-coverage-register[]` 与 `source-window-read-set[]` 的 source fields 必须由它派生并通过 focused source window read 确认。
- canonical final packet Markdown mirror 只作为 proposal-facing 人审镜像，用于 closed-loop outcome、in scope、out of scope、dependencies、owner-scoped non-direct boundary summary 和 blocker prose；它不得覆盖 JSON sidecar 的 direct atom set、projection、owner capability 或 `change-kind`。
- capability view Markdown 只辅助 capability boundary 文案和 owner-scoped boundary 理解；不得新增 direct `GA-####` coverage、artifact projection、runtime obligation 或 task/proof obligation。
- `change-plan.md`、Phase 4 source window 文案、review/report 产物和 archived proposal Markdown 不属于本 proposal 内容权威；需要依赖顺序时只可按 runtime overlay 限定用途读取。

## Trace 生成规则

- `obligation-atom-preconditions` 可记录 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json`、`final-packet-index-json`；这些字段出现时，对应 JSON 缺失必须 blocker。
- `obligation-atom-preconditions` 中上述 handoff 字段值必须是字符串路径，不得写成 object，不得内联 `{ "path": "...", "sha256": "...", "trace-schema": "..." }` 或其它上游 metadata。合法形状：

```json
"obligation-atom-preconditions": {
  "orchestrate-manifest": "openspec/orchestrate/trace/manifest.json",
  "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
  "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
  "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json"
}
```

- `change-atom-coverage-register` 必须等于当前 final packet direct atom set；每行只能包含一个 exact direct `GA-####`；它是下游 artifacts 唯一可传播的 trace-backed GA coverage source。
- `change-atom-coverage-register[]` 的每个 direct row 必须包含：`global-atom-id`、`source-document`、`lines`、`atom-type`、`source-fact`、`normativity`、`coverage-status`、`artifact-projection`、`projection-source`、`owner-capability`、`atom-relation`、`propose-use`、`evidence-need`、`downstream-coverage-expectation`。`owner-capability` 是 canonical 字段；`capability` 只能作为非权威辅助字段，不能替代 `owner-capability`。
- `source-window-read-set[]` 必须按 direct `GA-####` 拆成逐 atom row，不得用 `atom-ids[]`、source window 汇总行或 range 表达多个 GA。每行必须包含：`global-atom-id`、`source-document`、`line-range`、`source-fact`、`read-purpose`；`source-document`、`line-range` 和 `source-fact` 必须与 register/source handoff 一致；`interpretation-result` 可选，用于中文解释定点重读结论，但不得与 `source-fact` 矛盾。
- `production-source-coverage[]` 必须从 direct register 按 `source-document` 分组生成；它不是新语义来源。每行包含：`source-document`、`global-atom-ids[]`、`line-ranges[]`、`atom-count`、`artifact-projections[]`、`owner-capabilities[]`、`proposal-use`。`atom-count` 必须等于该行 `global-atom-ids[]` 的数量。
- `proposal-alignment-gate.direct-atoms` 必须是对象，形状为 `{ "count": <number>, "ids": ["GA-####"], "id-list-source": "final-packet-index" | "final-change-packet-order" | "<等价来源说明>" }`；不得写成裸数组。
- `proposal-alignment-gate.change-kind` 必须为 `foundation` 或 `business`，且必须与 `final-packet-index.json` 中当前 packet 的 `change-kind` 一致。
- `proposal-alignment-gate.artifact-projection-coverage[]` 必须从 `change-atom-coverage-register[]` 按 `artifact-projection` 分组生成；每行 `count` 必须等于 `ids.length`，且 `ids[]` 必须全部属于 direct register。
- `proposal-alignment-gate.owner-scoped-non-direct-atoms.ids[]` 只能来自 `owner-scoped-non-direct-boundary-register[]`；`count` 必须等于 `ids.length`。没有 owner-scoped non-direct rows 时必须使用 `count: 0` 和空数组。
- `proposal-alignment-gate.source-windows-re-read.ids[]` 必须等于 `source-window-read-set[].global-atom-id`，且 `count` 必须等于 `ids.length`。
- `proposal-alignment-gate.capability-increment-coverage[]` 必须从 direct register 按 `owner-capability` 分组生成；每行 `direct-atom-count` 必须等于该 capability 的 direct atom 数量。
- `proposal-alignment-gate.orphan-direct-atoms` 必须为空；非空表示 proposal register、read set 或 gate 未闭合，必须 blocker。
- Foundation change 不得另建只读 reference、额外 read-set 或第三套 schema；它与 business change 一样通过当前 final packet direct atoms 进入 proposal register。
- `owner-scoped-non-direct-boundary-register` 只登记 reference-only boundary rows。每行必须继承上游 `final-relation` 或 final packet context type，并通过 `boundary-role`、`reference-only: true`、`downstream-trace-policy: "do-not-propagate-ga"`、`boundary-handling` 或等价字段明确表达边界分类、参考用途和不得传播 GA 身份。
- `owner-scoped-non-direct-boundary-register` 若保留上游 projection，只能写为 `original-artifact-projection` 或 source metadata；不得写成 downstream `artifact-projection`，不得产生下游 coverage、projection、reconciliation 或 implementation obligation。
- obligation profile 的 `delivery-plane.non-goals` 只能来自当前 final packet 的 direct register rows、`owner-scoped-non-direct-boundary-register` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
