# Regression Reconciliation Gate 运行约束

本文档定义 `openspec-apply-change` 中独立的回归调和阶段。该阶段在 `change-stabilizer` 完成后、`final-reviewer` 启动前运行，由独立 `regression-reconciler` subagent 执行。它不是 `change-stabilizer` 的子步骤，也不得由 `change-stabilizer` 或 `final-reviewer` 替代。

## 目标与边界

1. `Regression Reconciliation Gate` 的目标是对全仓历史回归测试结果做调和，确认当前 change 完成后，历史测试仍与当前 OpenSpec 真相一致，或已经被明确分类、修复、更新、删除、记录为 blocker。
2. 本 gate 不生成当前 change 的 Proof Slice，不替代 `test-worker`、`test-proof-reviewer`、`fix-worker` 或 `change-stabilizer` 对当前 change evidence 的职责。
3. 本 gate 可以处理当前 change 外的历史测试假设过期问题，但只能依据当前 OpenSpec artifacts、已归档主规格、baseline evidence 和实际测试失败事实做判断；不得把“测试过期”作为无依据跳过失败的理由。
4. `proof-test-map.json` 只能作为 evidence / context，用于识别当前 change Proof Slice evidence、当前 change 新增或确认的测试、测试文件和命令边界；它不是 oracle 来源。行为 oracle 仍来自当前 change artifacts、已归档主规格和当前生产 runtime contract。
5. 本 gate 不得修改 proposal、实际 delta specs 或 `specs/no-spec-delta/README.md` marker、design、`runtime-acceptance.md`、`verification.md` 或 `tasks.md` 来适配回归失败。若发现 artifact 或 oracle 冲突，必须返回 `artifact-consistency-blocker`。

## 启动条件

1. 所有 implementation-worker、test-worker、test-proof-reviewer、fix-worker 已自然返回，且没有 unresolved Proof Slice、未解决 `Authoring Blocker`、`Execution Failure`、`Proof Sufficiency Blocker` 或流程级 blocker。
2. `change-stabilizer` 已自然返回完成，没有流程级 blocker，并已完成 checkpoint commit 处理。
3. `openspec-results/<change-slug>/apply-result.md` 和 `openspec-results/<change-slug>/proof-test-map.json` 已存在；`proof-test-map.json` 已通过 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"`。
4. 若上述输入缺失，主 agent 不得启动 `regression-reconciler`，必须报告流程级 blocker 或回到对应前序阶段修复。

## Agent 权限与输入

1. `regression-reconciler` 是 read/write apply-stage agent，必须遵守 `openspec/agent-runtime/openspec-apply-change.md` 的 subagent 串行、模型、checkpoint 和不覆盖他人改动约束。
2. `regression-reconciler` 可以读取完整 `contextFiles`、artifact pointer、proposal、实际 delta specs 或 `specs/no-spec-delta/README.md` marker、design、`runtime-acceptance.md`、`verification.md`、`tasks.md`、`trace/manifest.json`、必要 JSON trace 摘录、worker/reviewer/stabilizer 报告、checkpoint 摘要、`apply-result.md`、`proof-test-map.json`、全量回归命令输出、失败测试文件、相关生产代码和可用 baseline 记录。
3. `regression-reconciler` 默认运行本仓库全量回归命令：`pnpm test`。如果该命令不可用、环境不可用或依赖外部状态失败，必须记录 `flaky-or-environmental` 或流程级环境 blocker；不得在未运行且无 blocker 的情况下通过本 gate。
4. `regression-reconciler` 可以修改：
   - 被当前回归调和判定为 stale 的历史测试或 test fixture。
   - 当前 change scope 内必要的生产代码修复。
   - `openspec-results/<change-slug>/apply-result.md` 的 `Regression Reconciliation` section。
   - 当当前 Proof Slice evidence 受到影响时，必要更新 `openspec-results/<change-slug>/proof-test-map.json` 并重跑 mapping audit。
5. `regression-reconciler` 不得修改当前 change artifacts、已归档 specs、schema/runtime 文档、AGENTS.md、validator 脚本或 source-of-truth 文档，除非用户另行明确要求并启动对应变更流程。

## 分类规则

每个全量回归失败必须归入且只能归入以下分类之一，并写明判定依据：

| 分类 | 判定 | 必需处理 |
| --- | --- | --- |
| `current-change-regression` | 当前 change 破坏仍有效的 specs、runtime row、Proof Slice oracle 或已归档主规格行为。 | 修生产代码或返回流程级 blocker；不得通过删除/弱化测试处理。 |
| `current-proof-instability` | 失败落在当前 change 的 Proof Slice evidence、`proof-test-map.json` 映射测试或当前 change 新增/修改测试中，且 oracle 仍有效但证据不可复现。 | 修测试/evidence 或生产行为，重跑相关测试和 proof mapping audit。 |
| `historical-test-superseded` | 历史测试断言的旧假设已被当前 change 的合法 specs/runtime contract 明确取代。 | 更新或删除旧测试；在 `apply-result.md` 记录 superseded-by artifact/runtime row/spec basis。 |
| `historical-test-fixture-stale` | 历史测试 oracle 仍有效，但 fixture、手写 snapshot、allowlist 或 harness 未同步当前协议/readback 形态。 | 更新 fixture/harness，不改变 oracle；记录当前协议依据。 |
| `artifact-consistency-blocker` | 当前 artifacts、已归档主规格或 runtime oracle 之间存在无法自主判定的冲突。 | 停止 apply，报告 blocker；不得通过代码或测试绕过。 |
| `pre-existing-failure` | 有可靠 baseline 证明该失败在当前 change 前已存在，且当前 change 未扩大或掩盖该失败。 | 记录 baseline 命令、时间、输出或引用；无 baseline 不得使用该分类。 |
| `flaky-or-environmental` | 失败由非确定性、测试隔离、runner、依赖服务、权限、网络或外部环境导致。 | 稳定化并重跑，或记录明确环境 blocker；不得静默归档。 |

默认规则：

1. 无法证明是 `historical-test-superseded`、`historical-test-fixture-stale`、`pre-existing-failure` 或 `flaky-or-environmental` 的失败，默认视为 `current-change-regression`。
2. 若失败断言与当前 artifacts 冲突，但无法判断是 artifacts 错还是测试错，必须使用 `artifact-consistency-blocker`。
3. 若失败属于当前 Proof Slice primary test，优先视为 `current-proof-instability` 或 `current-change-regression`，不得直接归为历史测试过期。
4. 删除测试只允许用于 `historical-test-superseded`，且必须说明被哪个当前 contract 替代；fixture 更新优先用于 `historical-test-fixture-stale`。

## 输出要求

`regression-reconciler` 必须在 `openspec-results/<change-slug>/apply-result.md` 写入或更新 `## Regression Reconciliation` section，至少包含：

- 全量回归命令、退出状态、运行时间或环境 blocker。
- `proof-test-map.json` 路径和本 gate 对它的使用方式。
- 每个失败测试文件、测试标题、失败摘要和分类。
- 每个分类的 decision basis：相关 spec、runtime row、Proof Slice、已归档主规格、baseline 或环境事实。
- action taken：生产修复、测试更新、fixture 更新、删除测试、重跑命令、proof map 更新、blocker。
- 最终状态：`resolved`、`documented-pre-existing`、`environment-blocked` 或 `blocked`。

如果更新了 `proof-test-map.json`，必须重跑：

```bash
node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"
```

如果修改了测试或生产代码，必须重跑受影响测试；若修改影响当前 change Proof Slice evidence，还必须重跑相关 proof command。

## 通过条件

只有同时满足以下条件，`Regression Reconciliation Gate` 才能返回 pass：

1. 全量回归命令已运行，或存在明确、已记录的环境 blocker。
2. 所有全量回归失败都已分类。
3. `current-change-regression`、`current-proof-instability` 和 `artifact-consistency-blocker` 均无 unresolved 项。
4. `historical-test-superseded` 已完成测试更新或删除，并记录 current contract basis。
5. `historical-test-fixture-stale` 已完成 fixture/harness 更新，并保留原 oracle。
6. `pre-existing-failure` 均有 baseline 证据。
7. `flaky-or-environmental` 已稳定化并通过，或作为明确环境 blocker 阻止 ready-to-archive。
8. `apply-result.md` 的 `Regression Reconciliation` section 完整，必要时 `proof-test-map.json` 已更新并通过 audit。

任一条件不满足时，不得启动 final-reviewer，不得声称 ready to archive。
