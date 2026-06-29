# Obligation Tasks Overlay

- `trace/tasks.trace.json` 的 `acceptance-driven-coverage` 必须包含 `obligation-atom-coverage`、`requirement-scenario-coverage`、`design-obligation-coverage`。
- `obligation-atom-coverage` 每行只能包含一个 exact `GA-####`，不得使用 ranges、aggregate rows 或多 ID 单元格。
- `Artifact Projection` 必须与 proposal register 一致，或有明确 handoff reason。
- `verification-obligation` rows 应映射到底层 production task，不得为了 coverage 创建 proof-only task。
- Foundation mode 下，AC 和 checkbox task 必须是生产工程底座实现工作，例如 workspace、app skeleton、scripts、config、migration、health/readiness、生成链路、package boundary、Compose/local smoke 或 CI conformance。
- Foundation mode 不得创建 proof-only、coverage-only 或 artifact-closure task；not-applicable foundation atoms 不生成 AC 或 checkbox。
