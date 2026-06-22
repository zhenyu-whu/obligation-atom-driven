# Obligation Proposal Overlay

- Proposal 必须优先读取 source-aligned JSON handoff（`final-packet-index.json`、`atom-plan-mapping.json`、`obligation-atom-index.json`），并读取 final packet Markdown mirror 与必要 capability view；不得执行上游 source-aligned 技能脚本。
- `trace/proposal.trace.json` 必须包含 `obligation-atom-preconditions`、`change-atom-coverage-register`、`production-source-coverage`、`source-window-read-set` 和 `proposal-alignment-gate`。
- `obligation-atom-preconditions` 可记录 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json`、`final-packet-index-json`；这些字段出现时，对应 JSON 缺失必须 blocker。
- `change-atom-coverage-register` 每行只能包含一个 exact `GA-####`。
- Delivery Plane 不得出现 exhaustive `GA-####` coverage、`Direct atoms`、`Projection mix` 或 `Global Atoms:`。
- 如果用户请求扩展到 planned change boundary 之外，必须报告超出 canonical change contract，不得在 proposal 中扩 scope。
