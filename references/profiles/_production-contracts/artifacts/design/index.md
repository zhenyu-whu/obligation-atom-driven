# Design Artifact Contract

## 目的

`design.md` 定义 HOW to implement the production change。Design 阶段的核心职责是：针对 specs 中已经形成的 requirement/scenario 做实现设计，并吸收 proposal 中明确标记为 design 输入的 source/scope item 作为设计约束。

Design trace 只维护一个顶层语义权威：`implementation-design-register[]`。每个 row 必须代表一个内聚实现决策主题，具体结构、writer 生成规则和 reviewer 审查规则分别由下列角色化 contract 约束。

## 角色化 Contract 文件

- `artifacts/design/trace-schema.md`：共享 trace/schema 结构权威，定义 `trace/design.trace.json` 字段、allowed detail types、delivery-plane、design-gate 和 renderer/validator 不变量。
- `artifacts/design/writer.md`：writer / repair-writer 的生成规则，说明如何从 specs scenarios 和 design inputs 综合 implementation needs，生成内聚 IDR，再展开真实适用的 implementation details。
- `artifacts/design/reviewer.md`：artifact reviewer / integration reviewer 的审查规则，说明如何审查语义覆盖、IDR 内聚性、detail 真实性、coverage closure、phantom detail 和 no-scope-expansion。

## 角色隔离

- Writer 和 repair-writer 不得把 reviewer contract、validator gate 或 coverage closure 当作 authoring checklist；writer 的主目标是生成正确的设计语义模型。
- Reviewer 不得修改 artifact，也不得把 validator pass、空 gate 或 trace link closure 当作语义通过证明；reviewer 的主目标是判断 writer 产物是否真实达成 specs/design-input 的实现语义。
- `artifacts/design/trace-schema.md` 是双方共享的结构约束；它不替代 writer 的语义综合规则，也不替代 reviewer 的语义审查规则。

## 兼容入口

旧版流程若只按 `artifacts/<artifact-id>.md` 查找 design contract，必须改为读取 `artifacts/design/index.md`，并把本文件视为索引，不得据此直接生成完整 design trace。完整 design contract bundle 必须按 `openspec/agent-runtime/openspec-propose-artifacts.md` 的 Contract Bundle Resolution 读取角色化文件。

## Required Sections

Renderer 生成的 `design.md` 仍必须包含：

- Context
- Goals / Non-Goals
- Decisions
- Risks / Trade-offs
- Open Questions
- Implementation Details
- JSON Trace Plane pointer
