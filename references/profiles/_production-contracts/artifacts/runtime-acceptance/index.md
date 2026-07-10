# Runtime Acceptance Artifact Contract

## 目的

`runtime-acceptance.md` 把 specs/design traces 综合成一组独立可验证的运行态事实，服务实现阶段避免遗漏典型 Web 项目的 surface、operation、state/branch、async/chain。

`runtime-fact-register[]` 是唯一 canonical semantic register。每条 fact 同时也是下游可引用的 typed runtime row，ID 直接使用 `RS-/OP-/ST-/CH-###`，字段名统一为 `runtime-fact-id`。不存在独立 `RF-###`、`runtime-row-id`、`canonical-row-index` 或 `delivery-plane.canonical-rows[]`。

Runtime acceptance 不是逐 proposal item 的 coverage matrix，也不是测试计划。proposal 中未进入 specs/design 的 item 在 runtime 阶段视为不存在；coverage gate 只反查 specs scenario 和 runtime-affecting design decision 是否被 runtime facts 覆盖。

## 角色化 Contract 文件

- `artifacts/runtime-acceptance/trace-schema.md`：共享 trace/schema 结构权威，定义 `trace/runtime-acceptance.trace.json` 字段、legacy 字段禁止、source-interface、runtime-fact-register、runtime-gate、delivery-plane 和 renderer/validator 不变量。
- `artifacts/runtime-acceptance/writer.md`：writer / repair-writer 的生成规则，说明如何从 specs scenarios 和 design decisions 综合 runtime facts，执行 split/merge，并生成 gate 与 delivery projection。
- `artifacts/runtime-acceptance/reviewer.md`：artifact reviewer / integration reviewer 的审查规则，说明如何审查 runtime fact 独立可验证性、source-basis 真实性、coverage closure、proof/test/evidence 泄漏和 scope expansion。

## 角色隔离

- Writer 和 repair-writer 不得把 reviewer contract、validator gate 或 coverage closure 当作 authoring checklist；writer 的主目标是生成正确的 runtime fact semantic model。
- Reviewer 不得修改 artifact，也不得把 validator pass、空 gate、trace link closure 或 rendered Markdown 当作语义通过证明；reviewer 的主目标是判断 runtime facts 是否真实达成 specs/design 输入的可观察运行语义。
- `artifacts/runtime-acceptance/trace-schema.md` 是双方共享的结构约束；它不替代 writer 的语义综合规则，也不替代 reviewer 的语义审查规则。

## 兼容入口

旧版流程若只按 `artifacts/<artifact-id>.md` 查找 runtime-acceptance contract，必须改为读取 `artifacts/runtime-acceptance/index.md`，并把本文件视为索引，不得据此直接生成完整 runtime acceptance trace。完整 runtime-acceptance contract bundle 必须按 `openspec/agent-runtime/openspec-propose-artifacts.md` 的 Contract Bundle Resolution 读取角色化文件。

旧的 `artifacts/runtime-acceptance.md` 不再是有效 runtime-acceptance contract 入口。

## Required Sections

Renderer 生成的 `runtime-acceptance.md` 仍必须包含：

- Runtime Acceptance Intent
- Runtime Surface Facts
- Runtime Operation Facts
- Runtime State / Branch Facts
- Async / Realtime Chain Facts
- JSON Trace Plane pointer
