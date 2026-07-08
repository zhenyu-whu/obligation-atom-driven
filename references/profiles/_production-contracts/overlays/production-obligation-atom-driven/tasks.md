# Obligation Tasks Overlay

- `trace/tasks.trace.json` 不再维护 `acceptance-driven-coverage`、`obligation-atom-coverage`、`requirement-scenario-coverage` 或 `design-obligation-coverage`。
- `GA-####` source/scope 覆盖不得在 tasks trace 中重复登记；tasks 必须直接引用 specs scenario pointers、design detail IDs 和 runtime fact contribution links。
- Obligation schema 下不得按 `GA-####`、source atom、runtime fact 或 closure row 逐项生成 AC；AC / checkbox 必须先按生产工程阶段和依赖顺序说明如何实现，再客观写入 specs/design/runtime links。
- `verification-obligation` rows 不得为了 coverage 创建 task；若其中含有生产实现工作，必须先在 specs/design 中表达，再由 tasks 通过 spec/design/runtime links 映射实现与验收贡献。
- Foundation mode 下，AC 和 checkbox task 必须是生产工程底座实现工作，例如 workspace、app skeleton、scripts、config、migration、health/readiness、生成链路、package boundary、Compose/local smoke 或 CI conformance。
- Foundation mode 的 atom closure 不是 AC 拆分主轴；只能在真实底座实现草案完成后作为 links / closure invariant 检查。
- Foundation mode 不得创建 proof、coverage-only 或 artifact-closure task；not-applicable foundation atoms 不生成 AC 或 checkbox。
