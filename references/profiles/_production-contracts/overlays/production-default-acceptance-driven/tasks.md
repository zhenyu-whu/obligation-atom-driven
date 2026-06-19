# Default Tasks Overlay

- `trace/tasks.trace.json` 的 `acceptance-driven-coverage` 必须包含 `scope-item-coverage`、`requirement-scenario-coverage`、`design-decision-coverage`。
- `scope-item-coverage` 每行只能包含一个 exact `SI-###`，不得使用 ranges、aggregate rows 或多 ID 单元格。
- `Artifact Handling` 必须与 proposal `change-scope-coverage` 一致，或有明确 handoff reason。
- `Artifact Handling: proof` rows 应映射到底层 production task，不得为了 coverage 创建 proof-only task。
