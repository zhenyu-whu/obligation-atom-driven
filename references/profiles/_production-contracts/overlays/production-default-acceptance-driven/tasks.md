# Default Tasks Overlay

- `trace/tasks.trace.json` 不再维护 `acceptance-driven-coverage`、`scope-item-coverage`、`requirement-scenario-coverage` 或 `design-decision-coverage`。
- `SI-###` scope item 覆盖不得在 tasks trace 中重复登记；tasks 只消费 runtime acceptance 中的 required / preserve runtime facts。
- `Artifact Handling: proof` rows 不得为了 coverage 创建 task；若其中含有生产实现工作，必须先在 specs/design 中表达并由 runtime acceptance 投影为 required / preserve runtime fact。
