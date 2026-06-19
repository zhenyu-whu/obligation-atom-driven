# Default Proposal Overlay

- `trace/proposal.trace.json` 必须包含 `baseline-input-read-set`、`change-scope-coverage` 和 `proposal-alignment-gate`。
- `change-scope-coverage` 每行只能包含一个 exact `SI-###`。
- `Artifact Handling` 必须使用 `spec`、`guard`、`design`、`proof`、`context`。
- Delivery Plane 不得出现 exhaustive `SI-###` coverage、`Scope Items:`、scope coverage suffix 或 alignment gate。
- 不得读取或依赖 `openspec/orchestrate`、final packet、global atom index 或 capability anchor packet。
