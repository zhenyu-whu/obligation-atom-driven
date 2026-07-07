# Obligation Tasks Overlay

- `trace/tasks.trace.json` 不再维护 `acceptance-driven-coverage`、`obligation-atom-coverage`、`requirement-scenario-coverage` 或 `design-obligation-coverage`。
- `GA-####` source/scope 覆盖不得在 tasks trace 中重复登记；tasks 只消费 runtime acceptance 中的 required / preserve runtime facts。
- `verification-obligation` rows 不得为了 coverage 创建 task；若其中含有生产实现工作，必须先在 specs/design 中表达并由 runtime acceptance 投影为 required / preserve runtime fact。
- Foundation mode 下，AC 和 checkbox task 必须是生产工程底座实现工作，例如 workspace、app skeleton、scripts、config、migration、health/readiness、生成链路、package boundary、Compose/local smoke 或 CI conformance。
- Foundation mode 不得创建 proof、coverage-only 或 artifact-closure task；not-applicable foundation atoms 不生成 AC 或 checkbox。
