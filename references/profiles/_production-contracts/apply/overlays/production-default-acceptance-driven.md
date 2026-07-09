# Default Apply Overlay

## 适用范围

本文档是 `production-default-acceptance-driven` schema 的 apply-specific overlay。公共读取模型、preflight 和 evidence/ready gate 由 `openspec/schemas/_production-contracts/apply/common/*.md` 定义；本文档只定义 SI-specific artifact 索引和 schema-local 语义。

## Proposal / Specs / Design Index

- 索引 `trace/proposal.trace.json` 的 `change-scope-coverage` rows、change-local `SI-###` scope items、guard/context rows、artifact handling 和 baseline/input references。
- `SI-###` 只在当前 change 内有效，不是全局编号。
- 若存在正常 delta specs，索引 `trace/specs/*.trace.json#/spec-delta-register[]` 中 exact `SI-###` 引用及 requirement/scenario 字段。
- `trace/specs/**/*.trace.json` 中出现的所有 `SI-###` 都必须属于 proposal `change-scope-coverage` exact set。
- 若存在 no-delta marker，确认其 trace 为 `specs-completion-mode: "no-delta"`、`spec-delta-register: []` 且 `spec-gate` 闭合。
- 索引 `trace/design.trace.json#/implementation-design-register[]` 中 exact `SI-###` 引用及 implementation detail 字段。

## Runtime Acceptance Index

- Runtime acceptance 只能使用 specs scenario trace pointer 和 `IDR-###` design decision。
- `source-interface` 只能列实际 specs trace 或 no-delta marker trace、`trace/design.trace.json`；不得把 `trace/proposal.trace.json` 作为 runtime semantic input。
- `trace/runtime-acceptance.trace.json` 不得出现 `GA-####`、`global-atom-id`、`SI-###` source basis 或 proposal context。
- `runtime-fact-register[]` 是唯一 semantic register；每行 `runtime-fact-id` 必须使用 `RS-/OP-/ST-/CH-###`，且 `fact-type` 必须与 ID 前缀一致。
- `source-basis` 不得包含 `proposal-context[]`；不得从 `change-scope-coverage[]`、`openspec/orchestrate`、global atom index 或 capability anchor packet 派生 runtime facts。
- 普通 `SI-###` 和 `artifact-handling: "proof"` item 不要求逐项生成 runtime fact；只有已进入 specs/design 的生产语义才可进入 runtime。
- 每个 in-scope added/modified spec scenario 和 runtime-affecting `IDR-###` design row 必须至少被一条 runtime fact 覆盖。

## Tasks Index

- `trace/tasks.trace.json` 不得出现 `SI-###`、`scope-item-coverage`、`acceptance-driven-coverage`、`runtime-acceptance-index`、`runtime-acceptance-projection` 或 tasks 旧 `runtime-fact-ids[]`。
- Tasks 不重复 SI source coverage；spec 只能通过 `spec-scenario-links[].spec-scenario` scenario pointer 引用，design 只能通过 `design-detail-links[].design-detail-id` 引用，runtime 只能通过 `runtime-fact-links[].runtime-fact-id` 引用。
- `Artifact Handling: proof` rows 不得为了 coverage 创建 task；若其中含有生产实现工作，必须先在 specs/design 中表达，再由 tasks 通过 spec/design/runtime links 映射实现与验收贡献。

## Verification Index

- Verification 只能通过 Proof Slice -> runtime fact IDs -> runtime-acceptance row 反查 source/scope。
- `trace/verification.trace.json` 不重复 `scope basis`，不重新解释 source/scope。
- Proof Slice 的语义只能摘取或细分 runtime-acceptance canonical fact 的 runtime obligation、observable fact、failure/branch/default/no-scope 字段，不得新增 source/scope 外 behavior。
- 如果 `trace/verification.trace.json` 的 oracle 与 proposal/specs/design/runtime-acceptance trace 冲突、引入 scope 外行为、要求测试 artifact/process、重复 scope basis 或依赖 implementation detail，必须报告 `Artifact Consistency Blocker`。
