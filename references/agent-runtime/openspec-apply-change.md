# openspec-apply-change 运行约束

当执行或触发 `openspec-apply-change` 技能实施某个 OpenSpec change 时，必须遵守以下约束。

本文档是两个 production schema 的 apply 编排来源：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。schema 的 `apply.instruction` 只解释 schema-local artifact 语义；本文档负责执行顺序、subagent 编排、测试反馈闭环、evidence 输出和 ready-for-archive 判定。两个 production schema 的新格式必须同时具备 `tasks.md` 和 `verification.md`；不实现旧 `tasks.md` 内置测试矩阵模式的兼容分支。

## 执行入口

1. 严格先执行 `openspec-apply-change` 技能原有流程：选择 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions apply --change "<name>" --json`，并取得 `schemaName`、`contextFiles`、进度、任务列表和动态 schema apply instruction。
2. 对两个 production schema，apply requirements 必须包含 `tasks` 和 `verification`。若动态 instruction 只包含 `tasks`，主 agent 仍必须从同一 change 目录读取 `verification.md`；缺失即 blocker。
3. 主 agent 必须读取 proposal、delta specs、design、tasks、verification，以及动态 schema apply instruction。不得读取或要求 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。
4. 动态 schema apply instruction 只作为 schema-local adapter 使用：解释 GA/SI 术语、artifact 字段、禁止旧矩阵字段和状态写入边界。若它与本文档的执行编排、subagent 模型、质量门禁或停止条件冲突，以本文档为准。
5. 如果 `tasks.md` 仍包含 `Test Evidence Matrix`、`Regression Test Deposit`、`Test Layer Plan`、`Fixed Command`、`Test File / Name`、`Evidence Directory`、`Evidence Status`、`Deposit Status` 或 `Test IDs` 字段，停止 apply，要求重新生成 artifacts。
6. 如果 `verification.md` 包含具体测试路径、固定测试命令、runner selector、evidence directory 或 deposit status，停止 apply，要求修订 artifact。

## Phase 0 / Preflight

`production-obligation-atom-driven` 必须索引：

- proposal `Change Atom Coverage Register` rows、direct atoms、guard/boundary atoms、artifact projection 和 registered source line ranges。
- spec requirements/scenarios 及其 exact `GA-####` 引用。
- design obligations 及其 exact `GA-####` 引用。
- `tasks.md` 中 `Obligation Atom Coverage`、`Requirement / Scenario Coverage`、`Design Obligation Coverage` rows，且每行只能有一个 exact `GA-####`。
- `verification.md` 中每个 VID 的 source basis、runtime behavior、observable surface、oracle、failure signal 和 priority。

`production-default-acceptance-driven` 必须索引：

- proposal `Change Scope Coverage` rows、change-local `SI-###` scope items、guard/context rows、artifact handling 和 baseline/input references。
- spec requirements/scenarios 及其 exact `SI-###` 引用。
- design decisions 及其 exact `SI-###` 引用。
- `tasks.md` 中 `Scope Item Coverage`、`Requirement / Scenario Coverage`、`Design Decision Coverage` rows，且每行只能有一个 exact `SI-###`。
- `verification.md` 中每个 VID 的 source basis、runtime behavior、observable surface、oracle、failure signal 和 priority。

两个 schema 的 common preflight 必须索引：

- AC sections、AC-local execution contract fields、checkbox task IDs、source/scope trace fields、coverage table rows、Prerequisites/Provides/Consumes/Start Gate 和 proof requirements。
- `Runtime Acceptance Index` 中的 runtime surface rows、operation rows、state/branch rows、async/realtime rows、provides/consumes rows、depends-on AC、prerequisite runtime facts、scope role、no-scope-expansion check 和 detail matrix row references。
- `Verification Appendix` 中的 `Runtime Surface Inventory`、`Operation Coverage Matrix`、`State / Branch Coverage Matrix`、`Async / Realtime Chain Matrix`。
- runtime provision graph：baseline-provided、provided-by-current-ac、consumed-by-current-ac、future-change-only、explicit negative boundary 的 provider/consumer 关系。
- `verification.md` 的 `Behavior Oracle Matrix`、`Suggested Layer Matrix`、`Harness Rationale`、`Mock And Fixture Boundary`、`Failure And Negative Coverage`、`Regression Intent`、`Do Not Test` 和 `Oracle Consistency Checklist`。

若 preflight 发现 coverage orphan、GA/SI range、coverage task ID 无法解析、AC 缺少 final acceptance/proof checkbox、runtime row 无 owner、AC 顺序违反 provider/consumer graph、`verification.md` VID 无 source basis、oracle 与 proposal/spec/design 冲突、或 tasks/verification 使用了被禁止的旧测试矩阵字段，必须先修订 artifacts，不得让 worker 直接用代码绕过。

## Subagent 分派硬约束

1. 用户明确要求执行或继续执行 `openspec-apply-change` 技能时，该请求即代表用户授权并要求按本节使用 apply-stage subagent / delegation，除非用户在同一请求中明确禁止 subagent。
2. 创建或启动任何 apply-stage `implementation-worker`、`test-worker`、`fix-worker`、`change-stabilizer` 或 `final-reviewer` subagent 时，必须显式指定 `model=GPT-5.5` 且 `reasoningEffort=xhigh`。这是硬性运行约束，不得因速度、成本、默认设置、模型偏好、任务规模或可用性降级。若当前运行环境无法创建 `GPT-5.5` / `xhigh` apply-stage subagent，必须暂停 apply 并向用户报告 blocker。
3. 所有 worker 必须串行执行。任一时刻最多只能有一个 apply-stage worker 处于运行中；implementation、test、fix、stabilizer、reviewer 不得并行。
4. 启动任何 worker 时默认不要 fork 完整对话历史；使用显式任务包传递必要上下文。只有当该 worker 必须依赖当前对话中尚未写入文件的决策时，才允许 fork。
5. 每个 worker 任务包必须包含：change 名称、schema 名称、完整动态 schema apply instruction 原文、contextFiles、本文档路径、`openspec/agent-runtime/test-quality-strength.md` 路径、相关 proposal/spec/design/tasks/verification 片段、当前 AC 或 VID 范围、允许修改范围、状态写入边界、blocker 分类和最终报告格式。
6. 必须明确告知所有 worker：它不是唯一开发者，不得回滚或覆盖其他 agent / 用户改动；遇到重叠文件或冲突风险必须适配现有改动并在最终报告说明。

## Phase 1 / Production Implementation

1. implementation-worker 的分派单位是包含未完成 checkbox 的 `AC-###` 一级 section；按 runtime provision graph 拓扑顺序逐个 AC 串行启动。
2. 每个 implementation-worker 只负责自己 AC section 内的 production implementation、runtime rows、provider/consumer graph、no-scope boundary 和 AC-local proof 摘要。
3. implementation-worker 只能使用 proposal、specs、design 和 tasks 作为实现需求来源。`verification.md` 只可用于理解后续测试 oracle，不得用来制造实现需求或扩大 source/scope。
4. 当前 AC 的 `Prerequisites`、`Provides`、`Consumes`、`Start Gate` 未满足时，不得用 mock、fixture、假持久化或越界实现绕过；必须先处理前置 AC 或修订 artifacts。
5. 任务 checkbox 只能由负责该 AC 的 implementation-worker 勾选；必须满足 AC-level source/scope、projection/handling、No-Scope Boundary、Mock Policy、task `Proof`、linked spec/design、default runtime path 和 task override 约束。
6. 主 agent 在 implementation-worker 运行期间只能做编排等待和状态记录；不得审查未完成 diff、运行验证命令、修改代码、修改 artifacts、勾选任务或接手实现。

## Phase 2 / Test Agent Oracle Precheck

1. 所有 implementation-worker 自然返回完成且没有明确流程级 blocker 后，按 required VID 启动 test-worker；test-worker 写任何测试前必须检查 `verification.md`。
2. 以下情况输出 `Artifact Consistency Blocker` 并停止 apply：
   - VID 无 source basis。
   - oracle 与 proposal/specs/design 冲突。
   - oracle 引入 source/scope 外行为。
   - oracle 要求测试 artifact/process，而非产品/runtime 行为。
   - oracle 依赖 implementation detail。
   - oracle 只是检查 evidence、deposit、tasks 矩阵或 OpenSpec artifact 文本结构。
3. 当前实现不支持 oracle、当前实现难测、当前测试会失败，都不是 Artifact Consistency Blocker。
4. 只要 oracle 能从 proposal/specs/design 合理推出，就必须进入测试生成；不得修改 `verification.md` 来适配当前实现。

## Phase 3 / Test Authoring + Execution

1. test-worker 写测试前必须读取并遵守 `openspec/agent-runtime/test-quality-strength.md`。
2. test-worker 基于 proposal、specs、design、verification 和已实现代码生成并运行测试；`tasks.md` 只能作为 runtime acceptance context，不得作为测试 oracle 来源。
3. test-worker 必须按 `verification.md` 的 required VID 和 `test-quality-strength.md` 的测试质量强度选择最小充分测试层、harness、mock/fixture 边界和实际运行命令。
4. 新增或修改的测试必须放在 production owner 附近的长期 test/spec 文件或稳定 e2e/ops 入口中；不得只放在 `openspec-results/**`、`test-results/**`、`openspec/changes/**` 或一次性脚本中。
5. 测试断言必须来自 proposal/specs/design/verification 的外部行为契约。不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 presence-only、静态 markup、源文件文本扫描或 artifact/config/text scan 作为 required behavior primary proof。
6. browser E2E 必须使用真实 browser/context/page 和 user-equivalent actions/readback；component 必须使用交互式 component harness；route/API、DB/integration、worker/job、realtime/SSE、visual/responsive、security/negative、config/ops/check 必须证明各自 production-compatible boundary。
7. test-worker 对每个 required VID 只能输出：`Passed`、`Authoring Blocker`、`Execution Failure`、`Artifact Consistency Blocker`。
8. `Passed` 表示标准测试已生成或确认存在，测试表达的 oracle 与 `verification.md` 一致，满足 `test-quality-strength.md`，且实际命令通过。
9. `Authoring Blocker` 表示无法按标准测试写法覆盖 VID，原因是生产代码缺少合适 public/runtime boundary、稳定 observable surface、可控 dependency boundary、错误信号，或只能通过 implementation-detail/static/artifact proof 覆盖。
10. `Execution Failure` 表示测试已经能按标准写法生成，测试表达的 oracle 与 `verification.md` 一致，但执行失败、runner/entry 未触达、环境隔离失败或生产行为不满足 oracle。
11. test-worker 不得弱化 oracle、改成实现细节测试、跳过失败 VID、硬编码 change slug/AC ID/VID/evidence path，或用 broad smoke 替代可低层稳定断言。

## Phase 4 / Production Fix Loop

1. `Authoring Blocker` 和 `Execution Failure` 都必须进入 fix-worker；不得由 test-worker 通过削弱 oracle、跳过 VID 或改成 implementation-detail test 消化。
2. fix-worker 默认修改生产代码。对 `Authoring Blocker`，应改善 public/runtime boundary、稳定可观察行为、隐式全局状态、过度耦合、production-compatible dependency boundary 或错误信号。对 `Execution Failure`，应修正状态流、错误分支、API/data contract、权限、异步链路、持久化或 UI readback 偏差，使生产行为满足 verification oracle。
3. fix-worker 不得要求 test-worker 削弱测试，不得修改 `verification.md` 来适配当前实现。只有 oracle 与 proposal/specs/design 确实冲突时，才返回 `Artifact Consistency Blocker`。
4. fix-worker 完成后必须回到 Phase 2/3，由 test-worker 重新执行 Oracle Precheck、Test Authoring 和 Execution。
5. 循环直到所有 required VID 都是 `Passed`、source-backed `Manual / Environment Gate` 或 source-backed `Not Applicable`，或出现真正的流程级 blocker。

## Worker Blocker 语义

1. `Authoring Blocker` 和 `Execution Failure` 是 fix loop 输入，不自动等同于 apply 流程级 blocker。
2. worker 在 current-change scope 内拥有 repair authority。只要修复仍在当前 change scope 内，worker 可以修改实现、测试、必要的 tasks checkbox 和 apply evidence result，并重跑相关命令。
3. 流程级 blocker 仅限：source / proposal / spec / design / verification 存在无法自主判定的冲突；必需工具、权限、凭证或外部状态不可用；用户或其他 agent 的改动冲突无法安全适配；必要修复会超出当前 change scope；当前环境无法满足 apply-stage subagent 模型/推理配置。
4. worker 返回 blocker 时，主 agent 只判断报告是否命中流程级 blocker 分类。若未命中，要求同一 worker 继续；主 agent 不接手实现、不更新 checkbox、不替 worker 补 proof。

## Phase 5 / Evidence Result

1. evidence 由 apply runtime、runner、CI、worker 或 auditor 收集；不写回 `tasks.md` 或 `verification.md`，也不进入产品测试代码。
2. apply evidence result 必须写入或更新 `openspec-results/<change-slug>/apply-result.md`。该文件是 archive 阶段读取 VID 结果、实际测试文件、实际命令、运行结果、manual/not-applicable 理由、blocker 处理和 subagent 报告摘要的事实来源。
3. apply result 至少记录：change 名称、schema 名称、每个 AC 的完成状态、每个 required VID 的最终状态、实际测试文件或稳定入口、实际命令、退出状态或 CI result、manual/environment/not-applicable source-backed reason、未解决 blocker、implementation/test/fix worker 报告摘要。
4. 测试代码不得硬编码 `openspec-results/**`、change slug、AC ID、VID 或 evidence path。runner artifact 可通过测试框架 output directory、attachment/report 或 apply 执行方复制保存。
5. 任一 required VID 仍是 unresolved `Authoring Blocker`、`Execution Failure` 或 `Artifact Consistency Blocker` 时，不得声称 apply 完成或 ready to archive。

## Change Stabilizer 全局收敛

1. 所有 implementation/test/fix worker 自然返回完成且没有明确流程级 blocker 后，必须启动一个独立 `change-stabilizer` subagent 执行一次全 change 复核、修复和 apply-result 收敛。这是 final-reviewer 之前的固定环节，不得按任务规模、风险级别、速度、成本或主观判断跳过。
2. `change-stabilizer` 必须在所有 worker 结束后启动，且不得与 worker 或 final-reviewer 并行运行；若任一 worker 返回流程级 blocker 或仍有未完成实现/测试/fix 工作，不得启动 change-stabilizer。
3. `change-stabilizer` 是 read/write 的 current-change-scoped repair agent。它可以检查代码 diff、artifacts、tasks checkbox、runtime acceptance model、verification oracle、test-quality-strength 门禁、实际测试、命令结果、apply-result 和跨 AC 集成冲突；只要修复仍在当前 change scope 内，它可以修改实现、测试、必要的 tasks checkbox、apply-result，并重跑受影响命令。
4. `change-stabilizer` 不得扩大当前 change scope，不得削弱 proposal/spec/design/verification oracle，不得把无法证明的 VID 改写为 `Passed`。如果必要修复超出当前 change scope、工具/权限/凭证不可用、artifact 存在无法自主判定的冲突，或用户/其他 agent 改动冲突无法安全适配，必须返回流程级 blocker。
5. 每个 apply completion cycle 最多自动运行一轮 `change-stabilizer`。如果 change-stabilizer 返回流程级 blocker，主 agent 只汇报 blocker 并停止，不得启动 final-reviewer。change-stabilizer 完成后若后续 final-reviewer 仍返回 blocker，主 agent 必须停止 apply 流程并交人工查验；不得自动启动第二轮 change-stabilizer，除非用户在 blocker 汇报后显式要求继续处理。
6. `change-stabilizer` 不得声明 ready to archive。只有后续只读 final-reviewer 返回 pass，才可声称复核通过或 ready to archive。

## Final Reviewer Subagent 复核

1. `change-stabilizer` 自然返回完成且没有明确流程级 blocker 后，必须启动一个独立只读 `final-reviewer` subagent 执行最终复核检验。这是所有自动实现和全局收敛后的固定环节，不得按任务规模、风险级别、速度、成本或主观判断跳过。
2. `final-reviewer` 必须在 change-stabilizer 结束后启动，且不得与 worker 或 change-stabilizer 并行运行；若 change-stabilizer 返回流程级 blocker 或仍有未完成修复/证据收敛工作，不得启动 final-reviewer。
3. 主 agent 启动 final-reviewer 时必须传入：change 名称、schema 名称、contextFiles、proposal/specs/design/tasks/verification 路径、所有 worker 最终报告、worker 改动范围、change-stabilizer 最终报告、stabilizer 改动范围、实际测试文件、实际命令、apply-result 路径、runtime acceptance model 和 verification oracle 路径。主 agent 不得为了准备 final-reviewer 输入而自行审查 diff、打开 evidence、重跑验证命令或预先判断 worker/stabilizer 结果是否可信。
4. final-reviewer 负责独立只读复核：检查代码 diff、artifacts、tasks checkbox、runtime acceptance model、verification VID/oracle、测试质量、实际测试文件、实际命令结果、apply-result、跨 AC 集成冲突、默认路径/no-mock 约束；必要时可重跑命令。
5. final-reviewer 只输出复核报告和 pass/blocker 结论，不得直接修改代码、artifacts、checkbox、apply-result 或测试文件。
6. 若 final-reviewer 在 change-stabilizer 完成后仍发现 blocker，主 agent 必须汇报 final-reviewer blocker 并停止 apply 流程，状态为 blocked for human review；不得自行接手修复、替 stabilizer 补 proof、替 final-reviewer 复验或自动启动第二轮 stabilizer，除非用户在 blocker 汇报后明确要求继续处理。
7. 只有 final-reviewer 返回 pass，才可在最终汇报中声称复核通过或 ready to archive。final-reviewer 未运行、运行失败、无法满足模型/推理配置、或返回 blocker 时，不得声称 ready to archive。

## 主 Agent 职责

1. 主 agent 负责 orchestration：选择 change、读取 status / instructions、解析 context、执行 preflight、按 AC 串行分派 implementation-worker、按 VID/test feedback 串行分派 test-worker 和 fix-worker，在所有 worker 完成后启动一次 change-stabilizer，在 change-stabilizer 完成后启动 final-reviewer，并汇总各 subagent 返回的完成状态、证据路径、命令结果和流程级 blocker。
2. 主 agent 必须等待所有已分派 worker 自然返回最终完成或明确 blocker；若全部 worker 完成且无 blocker，必须等待 change-stabilizer 自然返回完成或 blocker；若 change-stabilizer 完成且无 blocker，必须等待 final-reviewer 自然返回 pass 或 blocker 后，才能做最终汇总。
3. 任一 worker、change-stabilizer 或 final-reviewer 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手修复/复核。
4. 主 agent 不得打断、停止、关闭或要求正在运行的 subagent 提前回报。除非用户明确要求终止当前 apply 流程，否则必须等待 subagent 自然返回最终完成或明确 blocker。
5. subagent 返回完成但摘要缺少路径、命令结果或 blocker 状态等汇总必需信息时，主 agent 可以要求同一个 subagent 补充说明；这不构成主 agent 复核，主 agent 不得自行打开文件或运行命令来补齐。

## 状态更新

1. `tasks.md` 只更新 implementation checkbox；不得写入测试计划、测试编号、执行证据或沉淀状态。
2. `verification.md` 是 propose 阶段 artifact；apply 不得为了适配当前实现静默修改 oracle。
3. 如果 test-worker/fix-worker/stabilizer/final-reviewer 发现 oracle 与 proposal/specs/design 冲突，必须停止并报告 artifact consistency blocker，由人工或新的 artifact 修订流程处理。
4. 不需要更新独立 acceptance status；AC 的通过状态由负责该 section 的 worker 完成声明、checkbox 更新、runtime proof 摘要、apply-result、change-stabilizer 收敛结果和 final-reviewer pass 共同表示。

## 最终汇报

最终汇报必须包含：

- 已完成 AC sections 和任务。
- 生产代码改动范围。
- `verification.md` 每个 required VID 的最终状态。
- test-worker 输出的 Passed / Authoring Blocker / Execution Failure / Artifact Consistency Blocker 处理结果。
- fix-worker 对生产代码的修复范围。
- 实际测试文件、实际命令和运行结果。
- `openspec-results/<change-slug>/apply-result.md` 路径。
- change-stabilizer 的全局收敛报告、修复范围、重跑命令和 blocker 状态。
- final-reviewer 的只读复核结论、复核命令及 pass/blocker 报告。
- 未完成、被阻塞、未验证或需要用户决策的事项。

不得在 tasks checkbox 全部完成、required VID 全部通过或有 source-backed manual/not-applicable 结论、apply-result 已写入、change-stabilizer 完成、final-reviewer 返回 pass 前声称 ready to archive。
