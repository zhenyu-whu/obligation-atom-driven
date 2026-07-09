# openspec-apply-change 运行约束

当执行或触发 `openspec-apply-change` 技能实施某个 OpenSpec change 时，必须遵守本文档。

本文档是项目级 apply runtime overlay。官方 `openspec-apply-change` 技能仍负责通用入口：选择 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions apply --change "<name>" --json`，并取得 `schemaName`、`contextFiles`、进度、任务列表和动态 schema apply instruction。本文档覆盖 production schema 的执行顺序、subagent 编排、checkpoint、测试反馈闭环、仓库级 review/fix loop、evidence 输出和 ready-for-archive 判定。

本文档覆盖两个 production schema：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。

## Source of Truth

1. `AGENTS.md` 强制本 runtime overlay 优先生效；官方 `openspec-apply-change` 技能只提供通用执行骨架。
2. Apply 流程、subagent 模型、checkpoint policy、fix loop、repo review/fix loop、final closeout reviewer、最终汇报和 ready-to-archive 声明归本文档。
3. Apply-required artifacts、`tracks` 和动态 schema apply instruction 以 selected schema 的 `schema.yaml`、`openspec status --change "<name>" --json` 与 `openspec instructions apply --change "<name>" --json` 的实际返回为准。
4. Artifact apply 消费语义归 apply contract bundle：`openspec/schemas/_production-contracts/apply/common/*` 和 `openspec/schemas/_production-contracts/apply/overlays/<schema-name>.md`。
5. Apply-stage subagent 的 mandatory reads、forbidden reads、write scope、status values 和 output contract 归 `openspec/agent-runtime/apply-stages/*.md`。
6. 测试质量门禁归 `openspec/agent-runtime/test-quality-strength.md`；仓库级 review/fix loop 归 `openspec/agent-runtime/repo-review-gate.md`。
7. 如果发生冲突：流程/编排以本文档为准；schema-local apply 消费语义以 apply contract bundle 为准；stage 行为以对应 apply-stage 文档为准；测试质量以 `test-quality-strength.md` 为准；仓库级 review/fix loop 以 `repo-review-gate.md` 为准。

## 执行入口

1. 严格先执行官方 apply 入口：选择 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions apply --change "<name>" --json`，并取得 `schemaName`、`contextFiles`、进度、任务列表和动态 schema apply instruction。
2. 对两个 production schema，apply requirements 必须包含 `runtime-acceptance`、`verification` 和 `tasks`。缺少 `trace/runtime-acceptance.trace.json`、`trace/verification.trace.json` 或 `trace/tasks.trace.json` 是 blocker；`tasks.md` 仅要求存在可回写 checkbox 行。
3. 新 production schema 不兼容旧 trace 测试矩阵模式。旧 change 如需处理，必须单独制定迁移流程，不在本 apply runtime 中兼容。
4. 动态 schema apply instruction 只作为 schema-local adapter 使用；它不得覆盖本文档、apply contract bundle、stage docs、测试质量门禁或 repo review gate。
5. 主 agent 必须初始化或更新 `openspec-results/<change-slug>/apply-result.md`，记录 change 名称、schema 名称、入口命令、contract bundle 路径和流程状态。

## Apply Contract Bundle Resolution

启动 Phase 0 前，主 agent 必须解析并读取 selected schema 的 apply contract bundle：

1. `openspec/schemas/_production-contracts/apply/common/read-model.md`
2. `openspec/schemas/_production-contracts/apply/common/preflight.md`
3. `openspec/schemas/_production-contracts/apply/common/evidence-and-ready.md`
4. `openspec/schemas/_production-contracts/apply/overlays/<schema-name>.md`

如果任一 required contract 文件缺失，必须停止并报告 `Artifact Consistency Blocker`。不得降级为只读 schema instruction、旧内联规则或主 agent 记忆。

主 agent 必须按 contract bundle 读取 `trace/proposal.trace.json`、实际 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json` marker、`trace/design.trace.json`、`trace/runtime-acceptance.trace.json`、`trace/verification.trace.json` 和 `trace/tasks.trace.json`。`trace/manifest.json` 只作为可选 registry/version metadata；Markdown artifact 不作为 apply 语义输入。不得读取或要求 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。

## Phase 0 / Preflight

1. Phase 0 是实现前 trace-only 硬门禁。任何不依赖当前实现代码、测试文件或 apply evidence 就能判定的 trace/register 问题，都必须在启动 implementation-worker 前阻断。
2. Phase 0 必须先运行全量静态 artifact validator：

```bash
node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>" --complete
```

3. Validator hard error 是实现前 `Artifact Consistency Blocker`；validator warning 必须纳入人工/agent preflight 判断，不得静默忽略。
4. Complete validator 后，主 agent 必须按 `apply/common/preflight.md` 与 selected schema overlay 执行 schema-aware preflight。
5. Phase 0 主 agent 可以同时读取 tasks 与 verification 做 artifact consistency 检查。该权限不得传递给后续双盲隔离阶段：implementation-worker 禁止读取 verification / Proof Slice；test-worker 禁止读取 tasks / AC checkbox。
6. Phase 0 发现 artifact consistency blocker 时，必须停止 apply 并要求 artifact 修订；不得让 worker 直接用代码、测试或 evidence 绕过。

## Subagent 分派硬约束

1. 用户明确要求执行或继续执行 `openspec-apply-change` 技能时，该请求即代表用户授权并要求按本节使用 apply-stage subagent / delegation，除非用户在同一请求中明确禁止 subagent。
2. 创建或启动任何 apply-stage `implementation-worker`、`test-worker`、`test-proof-reviewer`、`fix-worker`、`repo-reviewer`、`repo-fix-worker` 或 `final-reviewer` subagent 时，必须显式指定 `model=GPT-5.5` 且 `reasoningEffort=xhigh`。若当前环境无法创建 `GPT-5.5` / `xhigh` apply-stage subagent，必须暂停 apply 并向用户报告 blocker。
3. 所有 apply-stage subagent 必须串行执行。任一时刻最多只能有一个 apply-stage subagent 处于运行中；implementation、test、test-proof-review、fix、repo-review、repo-fix、final-review 不得并行。
4. 启动任何 worker/reviewer 时默认不要 fork 完整对话历史；使用显式任务包传递必要上下文。只有当该 worker/reviewer 必须依赖当前对话中尚未写入文件的决策时，才允许 fork。
5. 每个 worker/reviewer 任务包必须包含：change 名称、schema 名称、完整动态 schema apply instruction 原文、contextFiles、本文档路径、apply contract bundle 路径、对应 apply-stage 文档路径、`openspec/agent-runtime/test-quality-strength.md` 路径、前序 checkpoint commit 摘要、允许修改范围、状态写入边界、blocker 分类和最终报告格式。
6. 每个 apply-stage subagent 必须先读取自己的 stage doc：
   - `openspec/agent-runtime/apply-stages/implementation-worker.md`
   - `openspec/agent-runtime/apply-stages/test-worker.md`
   - `openspec/agent-runtime/apply-stages/test-proof-reviewer.md`
   - `openspec/agent-runtime/apply-stages/fix-worker.md`
   - `openspec/agent-runtime/repo-review-gate.md`
   - `openspec/agent-runtime/apply-stages/repo-reviewer.md`
   - `openspec/agent-runtime/apply-stages/repo-fix-worker.md`
   - `openspec/agent-runtime/apply-stages/final-reviewer.md`
7. 必须明确告知所有 worker/reviewer：它不是唯一开发者，不得回滚或覆盖其他 agent / 用户改动；遇到重叠文件或冲突风险必须适配现有改动并在最终报告说明。

## Checkpoint Commit Policy

1. Checkpoint commit 是 apply runtime 的过程性审计轨迹，不代表实现正确、测试通过、Proof Slice evidence 充分、runtime fact covered、final review pass 或 ready to archive。
2. 写入型 apply-stage agent 包括 `implementation-worker`、`test-worker`、`fix-worker`、`repo-fix-worker`，以及未来明确声明为 read/write 的 apply-stage agent。
3. 只读 agent/reviewer/auditor 不得创建 checkpoint commit，包括 `test-proof-reviewer`、`repo-reviewer`、`final-reviewer` 和任何只读 reviewer。
4. 主 agent 启动每个写入型 agent 前，必须记录当前 `git status --porcelain` 的路径级基线。
5. 写入型 agent 最终报告必须列出 agent identity、agent role、phase、AC / PS / runtime fact scope、status、blocker 分类、实际命令摘要和 touched files。缺少这些信息时，主 agent 只能要求同一个 agent 补充，不得自行语义审查 diff 来补齐。
6. 每个写入型 agent 自然返回后、启动下一个 apply-stage agent 前，主 agent 必须执行 checkpoint commit 处理。只要该 agent 产生了允许修改范围内的文件变更，就默认创建 checkpoint commit；无 diff 时不 commit，但必须在 apply-result 记录 `skipped: no diff`。
7. Checkpoint staging 禁止使用 `git add -A`、`git add .` 或任何会隐式纳入未报告路径的命令。主 agent 只能 stage 该 agent 最终报告中的 touched files，且这些路径必须位于该 agent 允许修改范围内。
8. 若某 touched file 在 agent 启动前已有未提交改动，agent 必须说明如何适配现有改动；无法确认安全归属或存在重叠冲突时，必须停止为 `Checkpoint Commit Blocker`，不得启动下一个 apply-stage agent。
9. Checkpoint commit 必须使用 `git commit --no-verify`。Commit message 格式固定为 `openspec(<change-slug>): checkpoint <agent-role> <scope> [<status>]`。Commit body 必须记录 agent identity、phase、AC / PS / runtime fact scope、status、changed files、命令摘要和 blocker 摘要。
10. 如果 checkpoint commit 创建失败，必须输出 `Checkpoint Commit Blocker` 并停止 apply；除非用户明确允许跳过该 checkpoint，否则不得启动下一个 apply-stage agent。
11. 每个 checkpoint commit 的 SHA、message、agent role、scope、status、changed files 和 notes 必须写入 `openspec-results/<change-slug>/apply-result.md` 的 `Checkpoint Commits` 表。Checkpoint commit 不写入 `proof-test-map.json`，也不得作为测试 oracle、Proof Slice evidence 或 runtime fact covered 依据。

## Phase 1 / Production Implementation

1. 按 `trace/tasks.trace.json#/implementation-step-register[].depends-on-step-ids[]` 拓扑顺序，逐个 AC 串行启动 `implementation-worker`。
2. Implementation-worker 的分派单位是 `implementation-step-register[]` 中对应包含未完成 checkbox task 的 `AC-###` step。
3. 任务包必须包含主 agent 摘录的 `implementationTracePacket`，并遵守 `openspec/agent-runtime/apply-stages/implementation-worker.md` 的 Mandatory Reads 和 Forbidden Reads。
4. 主 agent 在 implementation-worker 运行期间只能做编排等待和状态记录；不得审查未完成 diff、运行验证命令、修改代码、修改 artifacts、勾选任务或接手实现。
5. 每个 implementation-worker 自然返回后必须完成 checkpoint commit 处理，再启动下一个 apply-stage agent。

## Phase 2 / Test Worker Cycle

1. 所有 implementation-worker 自然返回完成且没有明确流程级 blocker 后，按 `trace/verification.trace.json#/verification-slice-register[]` 串行启动 `test-worker`。
2. 任务包必须包含主 agent 摘录的 `verificationTracePacket`，并要求 test-worker 遵守 `openspec/agent-runtime/apply-stages/test-worker.md`、`openspec/agent-runtime/test-quality-strength.md` 和 evidence/ready contract。
3. Oracle Precheck 是 test-worker 写任何测试或 evidence 前的内部必做步骤；主 agent 不得代审 oracle、审查测试实现或用 tasks/checkbox 补充 test oracle。
4. Test-worker 自然返回后，必须完成 checkpoint commit 处理，再进入 Phase 3。
5. 若 test-worker 返回 `Artifact Consistency Blocker` 或流程级 blocker，主 agent 必须停止 apply；若最终报告缺少路由所需信息，只能要求同一 test-worker 补充说明。

## Phase 3 / Test Proof Sufficiency Review

1. 每次 test-worker 自然返回后，任何 `Passed` 结果被接受、进入 fix-worker 或进入完成判断前，必须启动一个独立只读 `test-proof-reviewer` subagent。
2. 任务包必须遵守 `openspec/agent-runtime/apply-stages/test-proof-reviewer.md`，并包含 test-worker 最终报告、实际测试或非持久 evidence、`proof-test-map.json` 和 `apply-result.md`。
3. 主 agent 不得自行复核 proof sufficiency、审查测试 diff、补写 proof map 或替 reviewer 下结论。
4. 若 test-proof-reviewer 返回 pass 且存在经复核的 `Authoring Blocker` 或 `Execution Failure`，进入 Phase 4。
5. 若 test-proof-reviewer 返回 `Proof Sufficiency Blocker`，必须回到 Phase 2 强化或重写测试和 proof map；若返回 `Artifact Consistency Blocker` 或流程级 blocker，必须停止 apply。
6. 若 test-proof-reviewer 返回 pass 且无 unresolved Proof Slice 或 runtime fact reconciliation 问题，进入 Phase 5。

## Phase 4 / Production Fix Loop

1. Test-worker 结果必须先经过 test-proof-reviewer 复核；复核通过后的 `Authoring Blocker` 和 `Execution Failure` 都必须进入 `fix-worker`。
2. 任务包必须遵守 `openspec/agent-runtime/apply-stages/fix-worker.md`。
3. Fix-worker 自然返回后必须完成 checkpoint commit 处理，再回到 Phase 2/3，由 test-worker 重新执行 Oracle Precheck、Test Authoring / Evidence Execution，并由 test-proof-reviewer 重新复核证明充分性。
4. 循环直到所有 required Proof Slice 都有经 test-proof-reviewer 复核通过的最终 proof result，且 required / preserve runtime fact reconciliation 闭合，或出现真正的流程级 blocker。

## Phase 5 / Repo Review Gate

1. 所有必需的 implementation-worker、test-worker、test-proof-reviewer 以及已启动的 fix-worker 自然返回完成，且无 unresolved Proof Slice、未解决 worker/reviewer blocker 或流程级 blocker 后，必须启动一个独立只读 `repo-reviewer` subagent。
2. Repo-reviewer 必须遵守 `openspec/agent-runtime/repo-review-gate.md` 和 `openspec/agent-runtime/apply-stages/repo-reviewer.md`。
3. 启动前 `openspec-results/<change-slug>/apply-result.md` 和 `openspec-results/<change-slug>/proof-test-map.json` 必须存在，且 `proof-test-map.json` 已通过 proof mapping audit；缺失时必须回到对应前序阶段或报告流程级 blocker。
4. Repo-reviewer 可以全量读取 artifacts、tasks、verification、apply-result、proof-test-map、worker/reviewer 报告、checkpoint 摘要、全仓回归命令输出、失败测试文件、相关生产代码和测试代码，因为它发生在 implementation/test 双盲隔离之后。
5. 若 repo-reviewer 返回 `pass`，进入 Phase 7 final closeout review。若返回 `needs-fix`，进入 Phase 6 repo fix loop。若返回 `blocked` 或流程级 blocker，主 agent 必须停止 apply，不得启动 final-reviewer。

## Phase 6 / Repo Fix Loop

1. Repo-reviewer 返回 `needs-fix` 后，必须启动一个独立 `repo-fix-worker` subagent。
2. Repo-fix-worker 必须遵守 `openspec/agent-runtime/repo-review-gate.md` 和 `openspec/agent-runtime/apply-stages/repo-fix-worker.md`。
3. Repo-fix-worker 可以修复 repo-reviewer findings，包括测试入口、测试配置、历史测试、fixture/harness、当前 change 范围内生产代码、`apply-result.md`，以及当前 Proof Slice evidence 受影响时的 `proof-test-map.json`。
4. Repo-fix-worker 不得修改 proposal、delta specs 或 no-delta marker、design、runtime-acceptance trace、verification trace、tasks trace 或 schema/runtime source-of-truth 文档来绕过 review。
5. Repo-fix-worker 自然返回后必须完成 checkpoint commit 处理，再回到 Phase 5 启动新的 repo-reviewer。该 loop 无固定次数上限，直到 repo-reviewer 返回 `pass`，或出现 artifact/user/environment blocker。

## Phase 7 / Final Closeout Review

1. 最新 repo-reviewer 返回 `pass`、若存在 repo-fix-worker 则该 pass 晚于最新 repo-fix-worker，且没有明确流程级 blocker 后，必须启动一个独立只读 `final-reviewer` subagent。
2. 任务包必须遵守 `openspec/agent-runtime/apply-stages/final-reviewer.md`。
3. Final-reviewer 只验证 ready gate、最新 repo-review pass、proof audit、默认全量回归、checkpoint 和 apply-result 完整性；不再承担主要发现和修复职责。
4. 若 final-reviewer 发现 blocker，必须返回 blocker 并停止 apply，状态为 blocked for human review。修复必须回到 Phase 5/6 repo review/fix loop，不得由 final-reviewer 或主 agent 接手。
5. 只有 final-reviewer 返回 pass，才可在最终汇报中声称复核通过或 ready to archive。

## Blocker Routing

1. 各 worker/reviewer 的 stage-local status、repair authority、write scope 和 output contract 以对应 apply-stage 文档为准。
2. `Authoring Blocker`、`Execution Failure` 和 `Proof Sufficiency Blocker` 是 test/fix/proof loop 输入，不自动等同于 apply 流程级 blocker。
3. 流程级 blocker 仅限：source / proposal / spec / design / verification 存在无法自主判定的冲突；必需工具、权限、凭证或外部状态不可用；用户或其他 agent 的改动冲突无法安全适配；必要修复会超出当前 change scope；当前环境无法满足 apply-stage subagent 模型/推理配置。
4. Worker/reviewer 返回 blocker 时，主 agent 只判断报告是否命中流程级 blocker 分类并执行路由；主 agent 不接手实现、不更新 checkbox、不替 worker 补 proof。

## Evidence / Ready Contract

1. Evidence/ready 不是独立 Phase；它是 test-worker、test-proof-reviewer、repo-reviewer、repo-fix-worker、final-reviewer 和 archive 阶段共同遵守的结果契约。
2. Apply evidence result、`proof-test-map.json`、runtime fact reconciliation 和 ready-to-archive 判定必须遵守 `openspec/schemas/_production-contracts/apply/common/evidence-and-ready.md`。
3. Evidence 由 apply runtime、runner、CI、worker 或 auditor 收集；不写回 `tasks.md` 或 `verification.md`，也不进入产品测试代码。
4. 主 agent 不得在 evidence/ready contract、repo review gate 和 final closeout review 全部闭合前声称 apply 完成、复核通过或 ready to archive。

## 主 Agent 职责

1. 主 agent 负责 orchestration：选择 change、读取 status / instructions、解析 context、解析 apply contract bundle、执行 Phase 0 preflight、按 AC 串行分派 implementation-worker、按 Proof Slice feedback 串行分派 test-worker、test-proof-reviewer 和 fix-worker，在每个写入型 agent 自然返回后执行 checkpoint commit 处理，在 test/fix/proof loop 闭合后启动 repo-reviewer / repo-fix-worker loop 和 final-reviewer，并汇总状态、证据路径、命令结果、checkpoint commit 和流程级 blocker。
2. 主 agent 必须等待所有已分派 worker/reviewer/repo-reviewer/repo-fix-worker/final-reviewer 自然返回最终完成或明确 blocker，并完成对应 checkpoint commit 处理后，才能做下一阶段分派或最终汇总。
3. 任一 worker/reviewer/repo-reviewer/repo-fix-worker/final-reviewer 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手修复/复核。
4. 主 agent 不得打断、停止、关闭或要求正在运行的 subagent 提前回报。除非用户明确要求终止当前 apply 流程，否则必须等待 subagent 自然返回最终完成或明确 blocker。
5. Subagent 返回完成但摘要缺少路径、命令结果或 blocker 状态等汇总必需信息时，主 agent 可以要求同一个 subagent 补充说明；这不构成主 agent 复核，主 agent 不得自行打开文件或运行命令来补齐。
6. Checkpoint commit 处理是主 agent 唯一允许的 post-worker git 写入动作；该动作只能按 `Checkpoint Commit Policy` 做路径级 status/staging/commit 和 apply-result 记录，不得演变为语义 diff review、代码修复、测试复跑或 artifact 修订。

## 状态更新

1. `tasks.md` 只更新 implementation checkbox；不得写入测试计划、测试编号、执行证据或沉淀状态。
2. runtime-acceptance 和 verification trace 是 propose 阶段 artifact trace；apply 不得为了适配当前实现静默修改 runtime facts 或 oracle。
3. 如果 test-worker/test-proof-reviewer/fix-worker/repo-reviewer/repo-fix-worker/final-reviewer 发现 oracle 与 proposal/specs/design/runtime-acceptance 冲突，必须停止并报告 artifact consistency blocker，由人工或新的 artifact 修订流程处理。
4. 不需要更新独立 acceptance status；AC 的通过状态由负责该 section 的 worker 完成声明、checkbox 更新、runtime proof 摘要、apply-result、repo-reviewer pass 和 final-reviewer pass 共同表示。

## 最终汇报

最终汇报必须包含：

- 已完成 AC sections 和任务。
- 生产代码改动范围。
- `trace/runtime-acceptance.trace.json` 每个 required / preserve runtime fact 的 tasks/verification 覆盖状态。
- `trace/verification.trace.json` 每个 required Proof Slice 的最终 proof result，包括持久测试 mapping 或非持久 evidence result，以及 required / preserve runtime fact reconciliation 状态。
- test-worker 输出的 Passed / Authoring Blocker / Execution Failure / Artifact Consistency Blocker 处理结果。
- test-proof-reviewer 的 proof sufficiency 结论及 Proof Sufficiency Blocker 处理结果。
- fix-worker 对生产代码的修复范围。
- 实际测试文件或非持久 evidence、实际命令和运行结果。
- `openspec-results/<change-slug>/apply-result.md` 路径。
- checkpoint commit 摘要，包括写入型 agent 的 commit SHA、scope、status 和 skipped / blocker reason。
- repo-reviewer / repo-fix-worker loop 的仓库级 review findings、分类、severity、fix action、checkpoint、重跑命令和最终 pass/blocker 状态。
- final-reviewer 的最终 closeout 复核结论、复核命令及 pass/blocker 报告。
- 未完成、被阻塞、未验证或需要用户决策的事项。

不得在 tasks checkbox 全部完成、required Proof Slice 全部有持久测试 mapping / 非持久 evidence result / source/scope-backed manual/not-applicable 结论且通过 test-proof-reviewer 复核、runtime fact reconciliation 闭合、apply-result 已写入、最新 repo-reviewer 返回 pass、若存在 repo-fix-worker 则该 pass 晚于最新 repo-fix-worker、final-reviewer 返回 pass 前声称 ready to archive。
