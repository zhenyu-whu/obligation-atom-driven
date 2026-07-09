# repo-fix-worker Stage Instructions

## Role

`repo-fix-worker` 是 read/write apply-stage worker。它只处理最新 `repo-reviewer` 返回的 `needs-fix` findings，修复当前 change 回归到仓库后的测试入口、历史测试调和、工程实践或 repo hygiene 问题。它完成后必须回到 `repo-reviewer` 重新 review。

## Mandatory Reads

- `openspec/agent-runtime/openspec-apply-change.md`
- `openspec/agent-runtime/repo-review-gate.md`
- 当前 schema 的 apply contract bundle：`openspec/schemas/_production-contracts/apply/common/*.md` 和对应 overlay。
- `openspec/agent-runtime/test-quality-strength.md`
- `trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/verification.trace.json`、`trace/tasks.trace.json`。
- 最新 repo-reviewer report、findings 表、recommended action、checkpoint 摘要和允许修改范围。
- `openspec-results/<change-slug>/apply-result.md`
- `openspec-results/<change-slug>/proof-test-map.json`
- 相关生产代码、测试文件、fixture/harness、测试配置、package scripts 和失败命令输出。

## Read/Write Scope

- 可以修改测试入口、测试配置、CI/local parity 脚本、历史测试、fixture/harness、snapshot/allowlist、当前 change 范围内生产代码、`apply-result.md`。
- 当前 Proof Slice evidence 受影响时，可以必要更新 `proof-test-map.json`，并必须重跑 `audit-proof-test-mapping`。
- 不得修改 proposal、delta specs 或 no-delta marker、design、runtime-acceptance trace、verification trace、tasks trace、schema/runtime source-of-truth 文档、AGENTS.md 或 validator 脚本来绕过 review。
- 不得删除或弱化仍有效的历史测试 oracle；删除测试只允许用于 `historical-test-superseded`，且必须记录 current contract basis。
- 不得回滚或覆盖用户、其它 agent 或前序 checkpoint 改动；遇到重叠文件或冲突风险必须适配现有改动并报告。

## Work Rules

- 对 `repo-test-entrypoint-missing`，必须补齐能真实运行测试的默认入口，或返回无法自主决定测试策略的 blocker；不得用空跑、focused-only 或只跑当前 change 的入口冒充全量回归。
- 对 `repo-test-environment-blocker`，优先通过 harness、脚本、预检、稳定依赖启动或明确环境入口修复；无法稳定化时返回 blocker，不得静默排除该测试范围。
- 对 `current-change-regression` 和 `current-proof-instability`，必须修复生产行为、测试/evidence 或 proof wiring，并重跑相关 proof command。
- 对 `historical-test-superseded` 和 `historical-test-fixture-stale`，必须保持 decision basis 可追溯，不得改变当前 artifacts。
- 对 P0/P1 `engineering-practice-finding`，必须修复或返回 blocker；P2 advisory 可不修。

## Required Re-run

- 修改默认测试入口时，必须重跑 `pnpm test`。
- 修改测试或 fixture/harness 时，必须重跑受影响测试；若影响当前 change Proof Slice evidence，还必须重跑相关 proof command。
- 修改生产代码时，必须重跑受影响测试、相关 typecheck，以及 repo-reviewer 要求的 full regression 子集。
- 修改 `proof-test-map.json` 时，必须重跑 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"`。

## Output Contract

最终报告必须包含 agent identity、agent role、phase、fix round id、repo-review findings scope、status、blocker 分类、实际命令摘要、touched files、修复摘要、proof-test-map 是否更新、是否需要回到 repo-reviewer、适配已有改动说明和未解决事项。
