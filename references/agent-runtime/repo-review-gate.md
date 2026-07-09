# Repo Review Gate 运行约束

本文档定义 `openspec-apply-change` 后段的仓库级 review/fix loop。该 loop 在 implementation/test/proof/fix loop 闭合后、`final-reviewer` 启动前运行，由只读 `repo-reviewer` 和写入型 `repo-fix-worker` 串行循环执行。它取代旧的 `regression-reconciler` 主流程职责。

## 目标与边界

1. `Repo Review Gate` 的目标是确认当前 change 已经回归到本仓库工程上下文后仍可接受：默认全量回归入口可运行、历史测试与当前 OpenSpec 真相一致、当前 proof evidence 未被破坏、代码工程实践没有阻止交付的问题。
2. 本 gate 不生成当前 change 的 Proof Slice，不替代 `test-worker`、`test-proof-reviewer` 或 `fix-worker` 对当前 change evidence 的职责。
3. 本 gate 可以处理当前 change 外的历史测试假设过期、fixture stale、仓库测试入口缺失、测试环境不可用和工程实践问题，但必须依据当前 OpenSpec artifacts、已归档主规格、baseline evidence、实际测试失败事实和代码审查事实做判断。
4. `proof-test-map.json` 只能作为 evidence / context，用于识别当前 change Proof Slice evidence、当前 change 新增或确认的测试、测试文件和命令边界；它不是 oracle 来源。行为 oracle 仍来自当前 change artifacts、已归档主规格和当前生产 runtime contract。
5. 本 gate 不得修改 proposal、实际 delta specs 或 no-delta marker、design、runtime-acceptance trace、verification trace 或 tasks trace 来适配 review findings。若发现 artifact 或 oracle 冲突，必须返回 `artifact-consistency-blocker`。

## 启动条件

1. 所有必需的 implementation-worker、test-worker、test-proof-reviewer 以及已启动的 fix-worker 已自然返回，且没有 unresolved Proof Slice、未解决 `Authoring Blocker`、`Execution Failure`、`Proof Sufficiency Blocker` 或流程级 blocker。
2. `openspec-results/<change-slug>/apply-result.md` 和 `openspec-results/<change-slug>/proof-test-map.json` 已存在；`proof-test-map.json` 已通过 `node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"`。
3. 若上述输入缺失，主 agent 不得启动 `repo-reviewer`，必须报告流程级 blocker 或回到对应前序阶段修复。

## Repo Reviewer 权限与输入

1. `repo-reviewer` 是只读 apply-stage reviewer，必须遵守 `openspec/agent-runtime/openspec-apply-change.md`、本文档和 `openspec/agent-runtime/apply-stages/repo-reviewer.md`。
2. `repo-reviewer` 可以读取完整 `contextFiles`、`trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 no-delta marker trace、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/verification.trace.json`、`trace/tasks.trace.json`、`tasks.md` checkbox、worker/reviewer 报告、checkpoint 摘要、`apply-result.md`、`proof-test-map.json`、全量回归命令输出、失败测试文件、相关生产代码、测试代码和可用 baseline 记录。
3. `repo-reviewer` 必须运行或验证本仓库默认全量回归命令：`pnpm test`。如果该命令缺失、未实际执行测试、只运行当前 change focused tests、环境不可用或依赖外部状态失败，必须输出对应 finding；不得在默认入口未真实闭合时返回 `pass`。
4. `repo-reviewer` 只能将自身 `Repo Review Loop` / review round section 写入 `openspec-results/<change-slug>/apply-result.md`；不得修改代码、测试、artifacts、checkbox 或 `proof-test-map.json`；不得创建 checkpoint commit。

## Repo Fix Worker 权限

1. `repo-fix-worker` 是 read/write apply-stage worker，必须遵守 `openspec/agent-runtime/openspec-apply-change.md`、本文档和 `openspec/agent-runtime/apply-stages/repo-fix-worker.md`。
2. `repo-fix-worker` 可以修改：
   - 仓库测试入口、测试配置、CI/local parity 脚本和必要 harness。
   - 被 repo-reviewer 判定为 stale 的历史测试、fixture、snapshot、allowlist 或 harness。
   - 当前 change scope 内必要的生产代码修复。
   - `openspec-results/<change-slug>/apply-result.md` 的 repo fix round section。
   - 当当前 Proof Slice evidence 受到影响时，必要更新 `openspec-results/<change-slug>/proof-test-map.json` 并重跑 mapping audit。
3. `repo-fix-worker` 不得修改当前 change artifacts、已归档 specs、schema/runtime 文档、AGENTS.md、validator 脚本或 source-of-truth 文档，除非用户另行明确要求并启动对应变更流程。

## 必查项

`repo-reviewer` 每轮必须覆盖：

- 默认全量回归入口：`pnpm test` 是否存在、是否真实运行测试、是否包含当前 change proof 和必要历史回归。
- 全量回归结果：失败测试文件、测试标题、失败摘要、退出状态和环境事实。
- 当前 proof map 影响：当前 change proof tests / evidence 是否仍可被默认或明确入口发现；是否出现 current proof instability。
- 历史测试调和：历史测试是否被当前 specs/runtime contract 合法取代，或 fixture/harness 是否 stale。
- 代码工程实践：架构边界、权限/auth、错误处理、幂等、迁移、配置、观测、资源清理、并发/异步、用户/其他 agent 改动适配。
- 测试工程质量：测试隔离、mock/fake 边界、fixture 可维护性、浏览器/Docker/DB 依赖可重复性、focused-only 证据、CI/local parity。
- Repo hygiene：生成物残留、未跟踪测试产物、dirty workspace、`.only` / `.skip` / TODO/FIXME 风险、无意 metadata churn。

## Finding 分类

每个阻止 pass 的 finding 必须归入且只能归入以下分类之一，并写明判定依据：

| 分类 | 判定 | 必需处理 |
| --- | --- | --- |
| `current-change-regression` | 当前 change 破坏仍有效的 specs、runtime row、Proof Slice oracle 或已归档主规格行为。 | 修生产代码或返回流程级 blocker；不得通过删除/弱化测试处理。 |
| `current-proof-instability` | 失败落在当前 change Proof Slice evidence、`proof-test-map.json` 映射测试或当前 change 新增/修改测试中，且 oracle 仍有效但证据不可复现。 | 修测试/evidence 或生产行为，重跑相关测试和 proof mapping audit。 |
| `historical-test-superseded` | 历史测试断言的旧假设已被当前 change 的合法 specs/runtime contract 明确取代。 | 更新或删除旧测试；记录 superseded-by artifact/runtime row/spec basis。 |
| `historical-test-fixture-stale` | 历史测试 oracle 仍有效，但 fixture、snapshot、allowlist 或 harness 未同步当前协议/readback 形态。 | 更新 fixture/harness，不改变 oracle；记录当前协议依据。 |
| `repo-test-entrypoint-missing` | `pnpm test` 缺失、未实际执行测试、只运行 focused/current-change tests，或无法发现必要回归范围。 | 补齐默认测试入口或返回流程级 blocker；不得用空跑命令通过。 |
| `repo-test-environment-blocker` | Docker、网络、凭证、浏览器、数据库、权限或外部服务导致默认回归不可完成。 | 通过 harness、脚本、预检或文档化入口稳定化并重跑；无法稳定化时阻止 ready-to-archive。 |
| `engineering-practice-finding` | 代码审查或测试工程审查发现 P0/P1 工程质量问题。 | 修复 P0/P1；P2 advisory 可记录但不阻止 pass。 |
| `artifact-consistency-blocker` | 当前 artifacts、已归档主规格或 runtime oracle 之间存在无法自主判定的冲突。 | 停止 apply，报告 blocker；不得通过代码或测试绕过。 |
| `pre-existing-failure` | 有可靠 baseline 证明该失败在当前 change 前已存在，且当前 change 未扩大或掩盖该失败。 | 记录 baseline 命令、时间、输出或引用；无 baseline 不得使用该分类。 |

默认规则：

1. 无法证明是 `historical-test-superseded`、`historical-test-fixture-stale`、`pre-existing-failure` 或环境/入口问题的失败，默认视为 `current-change-regression`。
2. 若失败断言与当前 artifacts 冲突，但无法判断是 artifacts 错还是测试错，必须使用 `artifact-consistency-blocker`。
3. 若失败属于当前 Proof Slice primary test，优先视为 `current-proof-instability` 或 `current-change-regression`，不得直接归为历史测试过期。
4. 删除测试只允许用于 `historical-test-superseded`，且必须说明被哪个当前 contract 替代；fixture 更新优先用于 `historical-test-fixture-stale`。

## Severity

- `P0 blocker`: 直接破坏正确性、安全性、数据完整性、ready gate 或默认全量回归；必须修复或阻塞。
- `P1 must-fix`: 明确工程质量问题，会造成维护、可复现性、测试可信度或生产风险；必须修复或阻塞。
- `P2 advisory`: 可改进但不阻止 ready；必须记录，不得作为 pass blocker。

只有 P0/P1 finding 阻止 repo-reviewer 返回 `pass`。

## 输出要求

`repo-reviewer` 必须在 `openspec-results/<change-slug>/apply-result.md` 写入或更新 `## Repo Review Loop` section，至少包含：

- review round id、agent identity、phase、status：`pass`、`needs-fix` 或 `blocked`。
- 默认全量回归命令、退出状态、运行时间或环境 blocker。
- `proof-test-map.json` 路径和本 gate 对它的使用方式。
- 每个 finding 的文件/标题/摘要、分类、severity、decision basis 和 recommended action。
- code review、test engineering、repo hygiene 摘要。
- 若上一轮存在 repo-fix-worker，记录该 fix round 的 checkpoint SHA 和复验结论。
- 最终状态：`pass`、`needs-fix`、`environment-blocked` 或 `blocked`。

`repo-fix-worker` 必须在同一 section 写入 fix round 摘要，包含 finding ids、action taken、changed files、重跑命令、proof map 是否更新、blocker 状态。

如果更新了 `proof-test-map.json`，必须重跑：

```bash
node openspec/agent-runtime/scripts/audit-proof-test-mapping.mjs --change "<change-slug>"
```

如果修改了测试或生产代码，必须重跑受影响测试；若修改影响当前 change Proof Slice evidence，还必须重跑相关 proof command。若修改默认测试入口，必须重跑 `pnpm test`。

## 通过条件

只有同时满足以下条件，`repo-reviewer` 才能返回 `pass`：

1. `pnpm test` 存在、已运行、真实执行测试，并覆盖当前 change proof 和必要历史回归范围，或存在外部 CI 等价结果且已记录来源和范围。
2. 所有全量回归失败都已分类。
3. `current-change-regression`、`current-proof-instability`、`artifact-consistency-blocker`、`repo-test-entrypoint-missing` 和 P0/P1 `engineering-practice-finding` 均无 unresolved 项。
4. `historical-test-superseded` 已完成测试更新或删除，并记录 current contract basis。
5. `historical-test-fixture-stale` 已完成 fixture/harness 更新，并保留原 oracle。
6. `pre-existing-failure` 均有 baseline 证据。
7. `repo-test-environment-blocker` 均已稳定化并通过；无法稳定化的环境 blocker 必须返回 `blocked`，不得返回 `pass`。
8. `apply-result.md` 的 `Repo Review Loop` section 完整，必要时 `proof-test-map.json` 已更新并通过 audit。

任一条件不满足时，不得启动 final-reviewer，不得声称 ready to archive。
