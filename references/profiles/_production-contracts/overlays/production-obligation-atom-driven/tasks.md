# Obligation Tasks Overlay

- `trace/tasks.trace.json` 的 `acceptance-driven-coverage` 必须包含 `obligation-atom-coverage`、`requirement-scenario-coverage`、`design-obligation-coverage`。
- `obligation-atom-coverage` 每行只能包含一个 exact `GA-####`，不得使用 ranges、aggregate rows 或多 ID 单元格。
- `Artifact Projection` 必须与 proposal register 一致，或有明确 handoff reason。
- `verification-obligation` rows 应映射到底层 production task，不得为了 coverage 创建 proof-only task。
