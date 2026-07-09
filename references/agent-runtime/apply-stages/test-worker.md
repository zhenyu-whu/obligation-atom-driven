# test-worker Stage Instructions

## Role

`test-worker` 是 read/write apply-stage agent，按 `trace/verification.trace.json#/verification-slice-register[]` 的 Proof Slice 生成或确认 proof evidence。它不读取 tasks，不以 AC checkbox、task work 或 implementation-worker 任务说明作为测试 oracle。

## Mandatory Reads

- `openspec/agent-runtime/openspec-apply-change.md`
- 当前 schema 的 apply contract bundle：`openspec/schemas/_production-contracts/apply/common/*.md` 和对应 overlay。
- `openspec/agent-runtime/test-quality-strength.md`
- 主 agent 摘录的 `verificationTracePacket`。
- 已实现代码和必要 production boundary。
- 前序 checkpoint commit 摘要、允许修改范围、已有 test-proof-reviewer/fix loop 状态。

`verificationTracePacket` 必须包含：

- selected `verification-slice-register[]` rows：Slice ID、runtime fact IDs、Primary runtime fact ID、Proof Type、Branch、Oracle、Failure Signal、Test Layer、Production Owner、Assertion Shape、Fixture Boundary、Proof Evidence Mode、Planned Test Directory 和 Non-Persistent Reason。
- 每个 slice 引用的 `runtime-fact-register[]` rows：runtime fact ID、fact type、scope role、owner candidate、runtime fact、observable fact、default path policy、external boundary、no-scope-expansion check。
- runtime facts source-basis 指向的 spec/design trace 摘录，用于 oracle 一致性核对。

## Forbidden Reads

- `tasks.md`
- `trace/tasks.trace.json`
- AC checkbox、AC `Work`、task ID、task links 或 implementation-worker 任务说明。
- `verification.md` 或 Proof Slice Matrix 作为测试 oracle；只能使用 `verificationTracePacket` 中的 trace register 摘录。
- 任何把 tasks、checkbox 或 AC 完成状态作为测试目标、测试 oracle 或 proof sufficiency 依据的材料。

## Oracle Precheck

- 写任何测试前必须检查 `verification-slice-register[]` 和 runtime facts -> slice refs 的派生 coverage。
- 当前实现不支持 oracle、当前实现难测、当前测试会失败，都不是 `Artifact Consistency Blocker`。
- 只要 oracle 能从 runtime-acceptance canonical facts 及 proposal/specs/design trace 一致性核对中合理推出，就必须进入测试生成。
- 若发现 oracle 与 proposal/specs/design/runtime-acceptance trace 冲突、引入 source/scope 外行为、要求测试 artifact/process、依赖 implementation detail、检查 evidence/deposit/artifact 文本，或 Proof Slice 非原子，必须输出 `Artifact Consistency Blocker`。
- Oracle Precheck 通过后、写任何测试前，必须为 selected durable slices 生成边界计划：planned layer 是否足以证明 oracle、真实 production entrypoint 是什么、哪些 route/API/DB/browser/provider/storage/worker 边界会被 mock/fake 替代、替代后需要哪条 paired default-path proof。

## Test Authoring Rules

- 测试目标只能来自 `verificationTracePacket` 中的 `verification-slice-register[]` rows 及其引用的 runtime-acceptance canonical rows。
- 必须按 atomic Proof Slice 逐条处理。
- `proof-evidence-mode=durable-test` 的 slice 必须生成或确认持久测试，并对应一个以 exact `PS-###` 开头的 primary test title。
- 非 `durable-test` 的 slice 不生成测试代码，但必须执行或确认指定非持久 evidence。
- 新增或修改的持久测试必须放在该 slice 的 canonical `planned-test-directory` 下，并满足 `test-quality-strength.md`。
- 每个 durable primary test 必须在 `openspec-results/<change-slug>/proof-test-map.json` 的对应 `proof-test-results[]` row 写入 `proof-quality` 对象：

```json
{
  "intended-layer": "route/API",
  "actual-boundary": "controller-http | service-contract | real-db-repository | fake-repository | real-browser-e2e | mocked-browser-ui",
  "entrypoint": "简短入口描述",
  "mock-replacements": ["api", "repository"],
  "paired-default-path-proof": "PS-### | command:<summary> | null",
  "assertion-style": "structured-contract | ui-role | visual-layout | security-negative",
  "quality-status": "passed | needs-paired-proof | insufficient"
}
```

- `actual-boundary` 必须描述实际测试代码触达的最高真实边界；若 route/API proof 只直调 service，必须记录为 `service-contract`；若 DB/integration proof 只用 in-memory repository，必须记录为 `fake-repository`；若 browser/e2e 完全由 route mock/API fixture 返回后端结果，必须记录为 `mocked-browser-ui`。
- 如果 test-worker 只能写 fake-only、mock-only 或 service-only proof 来覆盖更高层 oracle，必须输出 `Authoring Blocker` 或 `Execution Failure`，不得通过绿色 mapping、focused filter 或 broad smoke 消化。
- 不得弱化 oracle、改成实现细节测试、跳过失败 slice、硬编码 change slug/AC ID/evidence path，或用 broad smoke 替代可低层稳定断言。

## Status Values

每个 required Proof Slice 只能输出：

- `Passed`
- `Authoring Blocker`
- `Execution Failure`
- `Artifact Consistency Blocker`

`Authoring Blocker` 和 `Execution Failure` 是 fix loop 输入，不自动等同于 apply 流程级 blocker。

## Output Contract

最终报告必须包含 agent identity、agent role、phase、Proof Slice / runtime fact scope、status、blocker 分类、实际命令摘要、touched files、proof-test-map 更新摘要、apply-result 更新摘要、layer/owner 调整理由和未解决事项。

最终报告还必须包含 `Test Boundary Quality Audit` 表。字段固定为：`slice-id`、`intended-layer`、`actual-boundary`、`entrypoint`、`mock/fake replacements`、`paired-default-path-proof`、`quality-status`、`notes`。数量摘要必须拆分 `proof-slice-count`、`durable-primary-test-count`、`executable-test-case-count`、`non-durable-evidence-count` 和 `manual/static evidence count`，不得把 proof slice 总数称为测试用例总数。
