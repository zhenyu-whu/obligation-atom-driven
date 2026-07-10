# Apply Read Model Contract

## 目的

本文档定义两个 production schema 在 apply 阶段共同使用的 trace-first 读取模型。`openspec/agent-runtime/openspec-apply-change.md` 负责流程编排；本文档负责说明 apply runtime 如何消费 proposal、specs、design、runtime-acceptance、verification 和 tasks 的 JSON trace/register。

## Trace Plane / Markdown Boundary

- JSON Trace Plane 是 apply 阶段唯一机器语义输入，承载 source/scope trace、runtime fact register、tasks links、Proof Slice register、gate 和 reconciliation 输入。
- Markdown artifact 是 renderer 生成的人读产物，不作为 apply 语义输入、oracle 输入、coverage 输入、runtime fact 来源或 worker 任务来源。
- `trace/manifest.json` 只作为可选 registry/version metadata；不得通过 manifest 摘要、artifact path 或 `render-contract-version` 建立 apply 语义或 hard gate。
- renderer exact output drift 不属于 apply blocker。Static validator 不再比较 Markdown 与 renderer 输出。
- `tasks.md` 的唯一 apply 用途是兼容 OpenSpec apply 默认 checkbox tracking/writeback；apply 只检查 task ID 对应 checkbox 行可回写，不从 `tasks.md` 读取 work、links、oracle、runtime fact 或 proof。

## Required Apply Inputs

- 两个 production schema 的 apply-required 机器输入是 `trace/runtime-acceptance.trace.json`、`trace/verification.trace.json` 和 `trace/tasks.trace.json`。
- Apply 必须读取 `trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json` marker、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/verification.trace.json` 和 `trace/tasks.trace.json`。
- `tasks.md` 必须存在并包含 `trace/tasks.trace.json#/implementation-step-register[].tasks[].task-id` 对应的可回写 checkbox 行。
- 若存在 no-delta marker，确认其 trace 为 `specs-completion-mode: "no-delta"`、`spec-delta-register: []` 且 `spec-gate` 闭合；implementation/test oracle 不得从 specs 派生，只能继续使用 proposal/design/runtime-acceptance/verification/tasks trace 的可观察契约。
- 不得读取或要求 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。

## Runtime Acceptance Consumption

- Apply 从 `trace/runtime-acceptance.trace.json#/runtime-fact-register` 读取 RS-/OP-/ST-/CH- runtime facts、source/scope basis、runtime obligation、observable fact、owner candidate、default path policy、external boundary、scope role 和 no-scope-expansion check。
- `trace/tasks.trace.json` 和 `trace/verification.trace.json` 只能引用 runtime-acceptance 已定义的 runtime facts，不得各自发明新的 canonical runtime fact。
- Runtime facts 主要用于 preflight、worker 任务包摘录、oracle 一致性核对、proof coverage 和 final review；不得把 JSON trace row 当成额外 executable work。

## Tasks Consumption

- Apply 从 `trace/tasks.trace.json#/implementation-step-register[]` 读取 step IDs、titles、`work-stage`、`depends-on-step-ids[]`、checkbox task IDs/titles/work、step/task `spec-scenario-links[]`、`design-detail-links[]` 和 `runtime-fact-links[]`。
- `delivery-plane.step-sections[]` 只提供 renderer payload，不参与 apply 语义闭合、worker 分派顺序或 dependency 判断；dependency graph 只能来自 `implementation-step-register[].depends-on-step-ids[]`。
- Implementation-worker 输入必须由主 agent 摘录为 `implementationTracePacket`，只包含当前 step register row 和 linked upstream trace row 的关键字段。
- `tasks.md` 只允许 apply 阶段更新 implementation checkbox；不得写入测试计划、测试编号、evidence path、执行状态或 deposit 状态。若 tasks 文本中出现具体测试文件或测试 runner 命令，必须在 preflight/reviewer 中确认它不是 proof/test/evidence-only task。

## Verification Consumption

- Apply 从 `trace/verification.trace.json#/verification-slice-register[]` 读取 canonical Proof Slice rows；`verification.md` / Proof Slice Matrix 不作为测试 oracle 或 proof sufficiency 输入。
- Test-worker 输入必须由主 agent 摘录为 `verificationTracePacket`，包含目标 slice rows、其引用的 runtime fact rows，以及这些 runtime facts source-basis 指向的 spec/design trace 摘录。
- Proof Slice coverage 由 runtime facts 与 slice runtime fact refs 派生，不读取独立 reconciliation 表。
- Verification 不重复 source/scope basis；source/scope 审计必须通过 Proof Slice -> runtime fact IDs -> runtime-acceptance row 反查。

## Trace Packet Fields

- `implementationTracePacket` 必须包含当前 step 的 `step-id`、`title`、`work-stage`、`depends-on-step-ids`、`tasks[].task-id/title/work-stage/work`、三类 link arrays，以及 linked spec/design/runtime trace 摘录。
- Linked spec 摘录字段：pointer、`delta-id`、`delta-op`、`requirement`、`body`、scenario 的 `name`、`when`、`then`。
- Linked design 摘录字段：`implementation-design-id`、`title`、`layer`、detail 的 `detail-id`、`detail-type`、`owner`、`subject`、`content`、`no-scope-expansion`。
- Linked runtime 摘录字段：`runtime-fact-id`、`fact-type`、`scope-role`、`owner-candidate`、`runtime-fact`、`observable-fact`、`default-path-policy`、`external-boundary`、`no-scope-expansion-check`。
- `verificationTracePacket` 必须包含 selected `verification-slice-register[]` rows、linked runtime fact rows，以及 linked runtime facts source-basis 指向的 spec/design trace 摘录。

## Legacy Format Boundary

以下内容在新 production schema apply 中均为 invalid legacy trace signal，发现即作为 `Artifact Consistency Blocker` 或要求重新生成 artifacts：

- `trace/tasks.trace.json` 包含旧 AC-local proof/preserve 字段、`runtime-fact-ids[]`、`Resolved Runtime Contract`、`Acceptance`、`Proof`、`Mock / Default Path Policy`、coverage table、schema source coverage 身份、runtime index、runtime projection 或 evidence/apply path。
- `trace/verification.trace.json` 包含具体测试路径、固定测试命令、runner selector、evidence directory、deposit status、执行状态、旧 Behavior Oracle 分组、旧分组 ID、分组 ID 列或分组 ID 汇总要求。
- Markdown 中的旧测试矩阵文本不作为 apply 语义来源；只有当对应旧字段进入 trace JSON 时才构成 artifact consistency blocker。
