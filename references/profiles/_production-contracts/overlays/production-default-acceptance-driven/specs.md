# Default Specs Overlay

- Specs 必须使用 `trace/proposal.trace.json` 的 `change-scope-coverage` 作为 scope-reading interface。
- 只为 `Artifact Handling: spec` 或 `Artifact Handling: guard` 的 capability 创建 delta spec。
- `guard` scope item 必须落到 guard、MUST NOT、non-goal 或 Production Alignment Gate。
- `design`、`proof`、`context` item 不得伪造成 requirement。
- JSON trace 必须列 exact `SI-###` 和用户输入、existing spec、代码路径、路由/API、数据表、配置、测试或外部输入来源。
