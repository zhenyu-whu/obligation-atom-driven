# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取 final packet Markdown mirror 与必要 capability view；不得执行上游 source-aligned 技能脚本。
- `trace/proposal.trace.json` 必须包含 `obligation-atom-preconditions`、`change-atom-coverage-register`、`production-source-coverage`、`source-window-read-set` 和 `proposal-alignment-gate`；当 final packet 含 owner-scoped non-direct rows 时，还必须包含 `owner-scoped-non-direct-boundary-register`。
- `obligation-atom-preconditions` 可记录 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json`、`final-packet-index-json`；这些字段出现时，对应 JSON 缺失必须 blocker。
- `change-atom-coverage-register` 每行只能包含一个 exact direct `GA-####`；它是下游 artifacts 唯一可传播的 trace-backed GA coverage source。
- `owner-scoped-non-direct-boundary-register` 只登记 reference-only boundary rows。每行必须继承上游 `final-relation` 或 final packet context type，并通过 `boundary-role`、`reference-only: true`、`downstream-trace-policy: "do-not-propagate-ga"`、`boundary-handling` 或等价字段明确表达边界分类、参考用途和不得传播 GA 身份。
- `owner-scoped-non-direct-boundary-register` 若保留上游 projection，只能写为 `original-artifact-projection` 或 source metadata；不得写成 downstream `artifact-projection`，不得产生下游 coverage、projection、reconciliation 或 implementation obligation。
- obligation profile 的 `delivery-plane.non-goals` 只能来自当前 final packet 的 direct register rows、`owner-scoped-non-direct-boundary-register` rows，或 final packet 明确写出的 out-of-scope summary；“source-backed”不是充分条件，候选边界必须同时属于当前 packet allowlist。
- 其它 change 拥有的 source-backed non-goal、later-change、verification obligation、Phase 4 source window 文案、`change-plan.md` 通用 non-goal 文案，均不得写入当前 proposal 的 `Non-Goals`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
