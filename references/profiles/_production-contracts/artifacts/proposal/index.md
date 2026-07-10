# Proposal Artifact Contract

## 目的

`proposal.md` 定义 change 的 WHY、WHAT、capability boundary、non-goal、影响面和 readiness。Proposal 阶段的核心职责是建立当前 change 的 source/scope 根集合，并从同一个 trace-backed model 投影 reviewer-facing Delivery Plane。

Proposal trace 的具体 root register、boundary ref 和 gate shape 由当前 schema overlay 决定；共享结构、writer 生成规则和 reviewer 审查规则分别由下列角色化 contract 约束。

## 角色化 Contract 文件

- `artifacts/proposal/trace-schema.md`：共享 trace/schema 结构权威，定义 `trace/proposal.trace.json` 的通用字段、Delivery Plane render payload、Trace Appendix 和 renderer/validator 不变量。
- `artifacts/proposal/writer.md`：writer / repair-writer 的生成规则，说明如何从 schema overlay 允许的输入建立 source/scope model，生成 schema-specific root register、boundary ref、Delivery Plane 和 gate。
- `artifacts/proposal/reviewer.md`：artifact reviewer / integration reviewer 的审查规则，说明如何审查 source/scope 权威、Delivery Plane 投影、scope boundary、orphan/range 和 reviewer pass 条件。

## 角色隔离

- Writer 和 repair-writer 不得把 reviewer contract、validator gate 或 coverage closure 当作 authoring checklist；writer 的主目标是生成正确的 proposal source/scope 语义模型。
- Reviewer 不得修改 artifact，也不得把 validator pass、空 gate 或 trace link closure 当作语义通过证明；reviewer 的主目标是判断 writer 产物是否真实表达当前 change boundary。
- `artifacts/proposal/trace-schema.md` 是双方共享的结构约束；它不替代 writer 的语义生成规则，也不替代 reviewer 的语义审查规则。
- Schema overlay 若存在 proposal 子目录，必须按当前 agent role 读取对应 overlay 文件；不得把 overlay reviewer-only 规则交给 writer 作为生成策略。

## 兼容入口

旧版流程若只按 `artifacts/<artifact-id>.md` 查找 proposal contract，必须改为读取 `artifacts/proposal/index.md`，并把本文件视为索引，不得据此直接生成完整 proposal trace。完整 proposal contract bundle 必须按 `openspec/agent-runtime/openspec-propose-artifacts.md` 的 Contract Bundle Resolution 读取角色化文件。

## Required Sections

Renderer 生成的 `proposal.md` 仍必须包含：

- Why
- Change Plan Boundary
- What Changes
- Capabilities
- Non-Goals
- Impact
- Rollout / Readiness
- JSON Trace Plane pointer
