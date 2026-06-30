# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取当前 planned change 的 final packet Markdown mirror 与必要 capability view；不得执行上游 source-aligned 技能脚本。Foundation change 也必须来自 `final-packet-index.json` 中的 `change-kind: foundation` packet。
- `trace/proposal.trace.json` 必须包含 `obligation-atom-preconditions`、`change-atom-coverage-register`、`production-source-coverage`、`source-window-read-set` 和 `proposal-alignment-gate`；当 final packet 含 owner-scoped non-direct rows 时，还必须包含 `owner-scoped-non-direct-boundary-register`。
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

- `change-atom-coverage-register` 每行只能包含一个 exact direct `GA-####`；它是下游 artifacts 唯一可传播的 trace-backed GA coverage source。
- `change-atom-coverage-register[]` 的每个 direct row 必须包含：`global-atom-id`、`source-document`、`lines`、`atom-type`、`source-fact`、`normativity`、`coverage-status`、`artifact-projection`、`projection-source`、`owner-capability`、`atom-relation`、`propose-use`、`evidence-need`、`downstream-coverage-expectation`。`owner-capability` 是 canonical 字段；`capability` 只能作为非权威辅助字段，不能替代 `owner-capability`。
- `source-window-read-set[]` 必须按 direct `GA-####` 拆成逐 atom row，不得用 `atom-ids[]`、source window 汇总行或 range 表达多个 GA。每行必须包含：`global-atom-id`、`source-document`、`line-range`、`source-fact`、`read-purpose`；`interpretation-result` 可选，用于中文解释定点重读结论，但不得与 `source-fact` 矛盾。
- `production-source-coverage[]` 必须是数组；每行包含：`source-document`、`global-atom-ids[]`、`line-ranges[]`、`atom-count`、`artifact-projections[]`、`owner-capabilities[]`、`proposal-use`。`atom-count` 必须等于该行 `global-atom-ids[]` 的数量。
- `proposal-alignment-gate.direct-atoms` 必须是对象，形状为 `{ "count": <number>, "ids": ["GA-####"], "id-list-source": "final-packet-index" | "final-change-packet-order" | "<等价来源说明>" }`；不得写成裸数组。
- `proposal-alignment-gate.change-kind` 必须为 `foundation` 或 `business`，且必须与 `final-packet-index.json` 中当前 packet 的 `change-kind` 一致。
- Foundation change 不得另建只读 reference、额外 read-set 或第三套 schema；它与 business change 一样通过当前 final packet direct atoms 进入 proposal register。
- `owner-scoped-non-direct-boundary-register` 只登记 reference-only boundary rows。每行必须继承上游 `final-relation` 或 final packet context type，并通过 `boundary-role`、`reference-only: true`、`downstream-trace-policy: "do-not-propagate-ga"`、`boundary-handling` 或等价字段明确表达边界分类、参考用途和不得传播 GA 身份。
- `owner-scoped-non-direct-boundary-register` 若保留上游 projection，只能写为 `original-artifact-projection` 或 source metadata；不得写成 downstream `artifact-projection`，不得产生下游 coverage、projection、reconciliation 或 implementation obligation。
- obligation profile 的 `delivery-plane.non-goals` 只能来自当前 final packet 的 direct register rows、`owner-scoped-non-direct-boundary-register` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
