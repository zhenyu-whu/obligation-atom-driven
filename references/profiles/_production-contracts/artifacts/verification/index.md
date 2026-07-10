# Verification Artifact Contract

## 目的

`verification.md` 是 independent test intent and oracle artifact。它的唯一语义源是 `trace/verification.trace.json#/verification-slice-register`。每个 `verification-slice-register[]` row 是一个原子 Proof Slice，描述一个可验证 runtime 分支、oracle、证明层级和持久/非持久 proof 方式。

`runtime-acceptance` 是唯一 oracle 来源。Verification 不读取 proposal/specs/design 重新建立 source/scope mapping，也不得从这些上游 artifact 发明 runtime acceptance 之外的 oracle。`verification.md` 只是 renderer 从 register 投影的人类可读镜像，不定义测试执行计划、具体测试文件、固定命令、runner selector 或 evidence path。

## 角色化 Contract 文件

- `artifacts/verification/trace-schema.md`：共享 trace/schema 结构权威，定义 `trace/verification.trace.json` 字段、Proof Slice register、verification-gate、delivery-plane 和 renderer/validator 不变量。
- `artifacts/verification/writer.md`：writer / repair-writer 的生成规则，说明如何从 runtime facts 拆出 Proof Slice、选择 proof mode、规划目录级 test placement，并生成 gate 与 delivery projection。
- `artifacts/verification/reviewer.md`：artifact reviewer / integration reviewer 的审查规则，说明如何审查 Proof Slice 粒度、runtime oracle 真实性、proof mode、placement 和 no-scope-expansion。

## 角色隔离

- Writer 和 repair-writer 不得把 reviewer contract、validator gate 或 coverage closure 当作 authoring checklist；writer 的主目标是从 runtime facts 生成正确的 Proof Slice semantic model。
- Reviewer 不得修改 artifact，也不得把 validator pass、空 gate、trace link closure 或 rendered Markdown 当作语义通过证明；reviewer 的主目标是判断 Proof Slices 是否真实覆盖 runtime acceptance 的可验证分支。
- `artifacts/verification/trace-schema.md` 是双方共享的结构约束；它不替代 writer 的 Proof Slice 生成规则，也不替代 reviewer 的语义审查规则。

## 兼容入口

旧版流程若只按 `artifacts/<artifact-id>.md` 查找 verification contract，必须改为读取 `artifacts/verification/index.md`，并把本文件视为索引，不得据此直接生成完整 verification trace。完整 verification contract bundle 必须按 `openspec/agent-runtime/openspec-propose-artifacts.md` 的 Contract Bundle Resolution 读取角色化文件。

旧的 `artifacts/verification.md` 不再是有效 verification contract 入口。

## Required Sections

Renderer 生成的 `verification.md` 仍必须包含：

- Verification Intent
- Proof Slice Matrix
- JSON Trace Plane pointer
