<!--
本文件主体是 Delivery Plane：implementation worker 默认从 AC sections 的 Resolved Runtime Contract 和 checkbox tasks 执行。
外置 JSON trace 是审计平面，只供主 agent、archive、stabilizer 和 final reviewer 做 coverage / projection 检查；trace row 不是额外 executable work。
每个 checkbox task block（checkbox + Runtime Rows/Acceptance/Preserve/Proof/Mock / Default Path Policy）与下一个 checkbox task block 之间必须保留一个空行。
-->

## AC-001 <!-- 中文验收切片名称 -->

Outcome:

- <!-- 用户/系统可观察的验收结果。必须能从 proposal/spec/design/runtime-acceptance 推导，不从实现计划反推，不列 GA coverage。 -->

Start Gate:

- <!-- 本 AC 启动前必须完成的 AC IDs、baseline/runtime facts 或 None。provider/consumer graph 只写入 JSON trace。 -->

Runtime Rows:

- <!-- RS-001, OP-001, ST-001, CH-001；只列 runtime-acceptance.md 主体中已定义的 row IDs。 -->

Resolved Runtime Contract:

| Row             | Worker-facing obligation                                  | Observable proof                                          | Default / no-scope boundary                               |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| <!-- RS-001 --> | <!-- 摘录 runtime-acceptance.md 中该 row 对 worker 的语义义务。 --> | <!-- 摘录该 row 的可观察 proof 类别。 --> | <!-- 摘录 default path 与 no-scope boundary。 --> |

Implementation Scope:

- <!-- worker 可执行的 production change 范围；不要放 provider/consumer graph、GA coverage 或测试计划。 -->

Preserve:

- <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints，以及明确 no-scope boundary。 -->

Proof Contract:

- <!-- 本 AC 完成后应具备的可观察 proof 类别。用户可见操作必须覆盖 interaction、API/data effect 和 reload/readback。 -->

- [ ] AC-001.1 <!-- 用中文描述此 acceptance slice 下的具体实现或验收 proof 任务。 -->
      Runtime Rows: <!-- 本 task 负责或最终 proof 覆盖的 RS-/OP-/ST-/CH- row IDs；必须已在 runtime-acceptance.md 主体中定义；无 runtime 行为时写 Not applicable 并给出 source-backed 理由。 -->
      Acceptance: <!-- 此任务贡献证明的具体可验收行为，而不是 file-edit summary。 -->
      Preserve: <!-- 必须保留的 module/data/API/auth/worker/UI/responsive/privacy/ops constraints。 -->
      Proof: <!-- 说明可观察 proof。用户可见操作必须证明 runtime interaction、API/data effect 和 reload/readback；static markup / data-testid / screenshot 只能补充。 -->
      Mock / Default Path Policy: <!-- 说明 mock/sandbox/default path 规则；不得用 mock 替代 required runtime boundary。 -->

## Trace Appendix

Trace file: `trace/tasks.trace.json`
Trace schema: `openspec-trace-v1`
Trace digest: `<sha256-to-be-filled-after-trace-json-is-written>`
