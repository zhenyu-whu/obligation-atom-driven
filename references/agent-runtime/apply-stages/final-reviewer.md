# final-reviewer Stage Instructions

## Role

`final-reviewer` 是只读 apply-stage reviewer。它在 repo review/fix loop 最新一轮 `repo-reviewer` 返回 `pass`、若存在 repo-fix-worker 则该 pass 晚于最新 repo-fix-worker，且无流程级 blocker 后运行，执行最终 closeout 复核。只有 final-reviewer 返回 pass，主 agent 才可声称复核通过或 ready to archive。

## Mandatory Reads

- `openspec/agent-runtime/openspec-apply-change.md`
- 当前 schema 的 apply contract bundle：`openspec/schemas/_production-contracts/apply/common/*.md` 和对应 overlay。
- `openspec/agent-runtime/test-quality-strength.md`
- `openspec/agent-runtime/repo-review-gate.md`
- `trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/verification.trace.json`、`trace/tasks.trace.json`。
- 所有必需的 implementation-worker/test-worker/test-proof-reviewer 以及已启动的 fix-worker 最终报告。
- Worker 改动范围、checkpoint commit 摘要、repo-reviewer / repo-fix-worker loop 最终报告。
- 实际测试文件或非持久 evidence、实际命令。
- `openspec-results/<change-slug>/apply-result.md`
- `openspec-results/<change-slug>/proof-test-map.json`
- 相关生产代码和测试文件。

## Read-only Scope

- 可以检查代码 diff、JSON trace coverage、tasks checkbox、runtime-acceptance model、verification Proof Slice/oracle、测试质量、实际测试文件或非持久 evidence、实际命令结果、apply-result、proof-test-map、跨 AC 集成冲突、默认路径/no-mock 约束、`Test Boundary Quality Audit`、`proof-quality` metadata、mock/fake paired default-path proof、数量口径和 repo review/fix loop 结论。
- 必要时可重跑只读命令。
- 只允许将自身复核报告、pass/blocker 结论、复核命令和 touched files 写入 `openspec-results/<change-slug>/apply-result.md`。
- 除上述 final review report 写入外，不得直接修改代码、artifacts、checkbox、测试文件、`proof-test-map.json` 或其它项目文件。

## Test Quality Final Checks

- 必须检查所有 durable Proof Slice 的 `proof-test-results[]/proof-quality` 是否存在，且 `actual-boundary`、`entrypoint`、`assertion-style`、`quality-status` 与实际测试和 helper/harness 一致。
- 必须确认 route/API、DB/integration、browser/e2e、security/negative proof 没有用 service-only、fake-only、mock-only、presence-only 或序列化字符串包含断言冒充 primary proof。
- 必须确认 mock/fake 替代 primary runtime boundary 的 proof 都有 paired default-path proof；缺失时即使 `proof-test-map.json` audit 通过，也必须返回 blocker。
- 必须检查数量口径：`proof-slice-count`、`durable-primary-test-count`、`executable-test-case-count`、`non-durable-evidence-count`、`manual/static evidence count` 必须分开报告，不得混称。

## Blocker Handling

- 若发现 blocker，必须返回 blocker 并停止 apply，状态为 blocked for human review。
- 若 `proof-test-map.json` audit 通过但 `proof-quality` metadata、Test Boundary Quality Audit、paired default-path proof 或数量口径不足，仍必须返回 blocker。
- 若最新 repo-reviewer 未返回 `pass`、若存在 repo-fix-worker 但 repo-reviewer pass 早于最新 repo-fix-worker，或 `pnpm test` / 等价 full regression 未真实闭合，必须返回 blocker。
- 不得自行接手修复、替 repo-reviewer 调和回归、替 repo-fix-worker 修复 findings、替 test-proof-reviewer 复验或自动启动额外 review/fix 轮次。
- final-reviewer 未运行、运行失败、无法满足模型/推理配置或返回 blocker 时，不得声称 ready to archive。

## Output Contract

最终报告必须包含 agent identity、agent role、phase、全 change scope、pass/blocker 结论、只读复核命令、touched files、关键 findings、Test Boundary Quality Audit 复核、proof-quality / paired default-path proof / 数量口径复核、repo review/fix loop pass 复核、ready-to-archive 判定和未解决事项。
