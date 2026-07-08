# Default Tasks Overlay

- `trace/tasks.trace.json` 不再维护 `acceptance-driven-coverage`、`scope-item-coverage`、`requirement-scenario-coverage` 或 `design-decision-coverage`。
- `SI-###` scope item 覆盖不得在 tasks trace 中重复登记；tasks 必须直接引用 specs scenario pointers、design detail IDs 和 runtime fact contribution links。
- `Artifact Handling: proof` rows 不得为了 coverage 创建 task；若其中含有生产实现工作，必须先在 specs/design 中表达，再由 tasks 通过 spec/design/runtime links 映射实现与验收贡献。
