# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取 final packet Markdown mirror、必要 capability view，以及存在时的 `foundation-reference/foundation-runtime-substrate.md` / `.trace.json`；不得执行上游 source-aligned 技能脚本。
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
- `foundation-reference-read-set` 必须是数组；每行只能记录 `reference-path`、`trace-path`、`digest` 和 `read-purpose`。合法形状：

```json
"foundation-reference-read-set": [
  {
    "reference-path": "openspec/orchestrate/foundation-reference/foundation-runtime-substrate.md",
    "trace-path": "openspec/orchestrate/foundation-reference/foundation-runtime-substrate.trace.json",
    "digest": "sha256-...",
    "read-purpose": "只作为设计约束读取，不传播 foundation GA。"
  }
]
```

- `foundation-reference-read-set` 不得记录 `atom-ids`、`global-atom-ids`、`consumed`、`materialized`、`deferred`、`not-applicable` 或 foundation atom 消费明细；不得原样复制 foundation trace 的 `artifact-digest` / `atom-ids[]` 到 proposal trace，不得传播 foundation `GA-####` 到 specs/runtime/proof/tasks coverage。
- `owner-scoped-non-direct-boundary-register` 只登记 reference-only boundary rows。每行必须继承上游 `final-relation` 或 final packet context type，并通过 `boundary-role`、`reference-only: true`、`downstream-trace-policy: "do-not-propagate-ga"`、`boundary-handling` 或等价字段明确表达边界分类、参考用途和不得传播 GA 身份。
- `owner-scoped-non-direct-boundary-register` 若保留上游 projection，只能写为 `original-artifact-projection` 或 source metadata；不得写成 downstream `artifact-projection`，不得产生下游 coverage、projection、reconciliation 或 implementation obligation。
- obligation profile 的 `delivery-plane.non-goals` 只能来自当前 final packet 的 direct register rows、`owner-scoped-non-direct-boundary-register` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
