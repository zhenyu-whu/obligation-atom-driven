# Specs Artifact Contract

## 目的

`specs/**/*.md` 定义 production system 应该做什么。Specs 阶段是从 proposal spec-relevant source items 到 OpenSpec requirement/scenario delta 的语义转换层，不只是 coverage 审计层。

Specs trace 对齐 proposal/design 的 trace-first 模型：固定 `delivery-plane` 作为 renderer 输出 payload，一个 canonical `spec-delta-register[]` 承载语义，一个最小 `spec-gate` 承载闭合结果。

只为有 spec-relevant item 的 capability 创建 spec file；当整个 change 没有 spec-level delta 时，必须用 no-delta marker 显式完成 specs artifact。

## 角色化 Contract 文件

- `artifacts/specs/trace-schema.md`：共享 trace/schema 结构权威，定义 normal delta、no-delta marker、Delivery Plane、Trace Appendix 和 renderer/validator 不变量。
- `artifacts/specs/writer.md`：writer / repair-writer 的生成规则，说明如何从 proposal routed source/scope fact 和 focused existing spec read 转换为 requirement/scenario delta。
- `artifacts/specs/reviewer.md`：artifact reviewer / integration reviewer 的审查规则，说明如何审查 source-fact 到 spec-delta 的语义等价、必要 spec file、guard 保真和 Delivery Plane 投影。

## 角色隔离

- Writer 和 repair-writer 不得把 reviewer contract、validator gate 或 coverage closure 当作 authoring checklist；writer 的主目标是生成与 routed source/scope fact 语义等价的 specs model。
- Reviewer 不得修改 artifact，也不得把 validator pass、空 gate、source-id closure 或 rendered Markdown 当作语义通过证明；reviewer 的主目标是判断 specs trace 是否真实保留 production-meaningful material semantic units。
- `artifacts/specs/trace-schema.md` 是双方共享的结构约束；它不替代 writer 的语义转换规则，也不替代 reviewer 的语义审查规则。
- Schema overlay 若存在 specs 子目录，必须按当前 agent role 读取对应 overlay 文件；不得把 overlay reviewer-only 规则交给 writer 作为生成策略。

## 兼容入口

旧版流程若只按 `artifacts/<artifact-id>.md` 查找 specs contract，必须改为读取 `artifacts/specs/index.md`，并把本文件视为索引，不得据此直接生成完整 specs trace。完整 specs contract bundle 必须按 `openspec/agent-runtime/openspec-propose-artifacts.md` 的 Contract Bundle Resolution 读取角色化文件。

旧的 `artifacts/specs.md` 和 `overlays/<schema-name>/specs.md` 不再是有效 specs contract 入口。

## Required Sections

Renderer 生成的 normal `specs/<capability>/spec.md` 仍按 OpenSpec delta section 输出：

- `## ADDED Requirements`
- `## MODIFIED Requirements`
- `## REMOVED Requirements`
- `## RENAMED Requirements`
- JSON Trace Plane pointer

Renderer 生成的 `specs/no-spec-delta/README.md` marker 只能包含 no-delta summary、projection closure 和 JSON Trace Plane pointer，不得包含 requirement/scenario delta section。
