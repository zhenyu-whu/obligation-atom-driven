# openspec-apply-change 运行约束

当执行或触发 `openspec-apply-change` 技能实施某个 OpenSpec change 时，必须遵守以下约束。

本文档是两个 production schema 的 apply 编排来源：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。schema 的 `apply.instruction` 只解释 schema-local artifact 语义；本文档负责执行顺序、subagent 编排、测试反馈闭环、evidence 输出和 ready-for-archive 判定。两个 production schema 的新格式必须同时具备 `runtime-acceptance.md`、`verification.md` 和 `tasks.md`；不实现旧 `tasks.md` 内置测试矩阵模式的兼容分支。

两个 production schema 的 apply 读取模型：

- artifact 主体是 Delivery Plane，承载 worker/tester 直接消费的交付契约。
- 外置 JSON Trace Plane 是审计平面，承载 coverage、source/scope trace、runtime projection、reconciliation 和 alignment gate；artifact 末尾 `## Trace Appendix` 只是 pointer block。
- 主 agent、change-stabilizer 和 final-reviewer 必须读取 artifact pointer、`trace/manifest.json` 和对应 JSON trace 做 preflight/archive/复核审计。
- implementation-worker 默认只消费当前 AC Delivery Plane section（尤其是 `Resolved Runtime Contract`）、必要 proposal/spec/design delivery 摘要和明确传入的约束摘录；`runtime-acceptance.md` canonical rows 主要用于 preflight、冲突排查和主 agent 摘录校验，不得把 JSON trace row 当作额外 executable work。

## 执行入口

1. 严格先执行 `openspec-apply-change` 技能原有流程：选择 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions apply --change "<name>" --json`，并取得 `schemaName`、`contextFiles`、进度、任务列表和动态 schema apply instruction。
2. 对两个 production schema，apply requirements 必须包含 `runtime-acceptance`、`verification` 和 `tasks`。若动态 instruction 只包含旧的 `tasks` / `verification`，主 agent 仍必须从同一 change 目录读取 `runtime-acceptance.md` 和 `verification.md`；缺失即 blocker。
3. 主 agent 必须读取 proposal、delta specs、design、runtime-acceptance、verification、tasks 的 Delivery Plane、短 `## Trace Appendix` pointer、`trace/manifest.json` 和对应 JSON trace，以及动态 schema apply instruction。不得读取或要求 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。
4. 动态 schema apply instruction 只作为 schema-local adapter 使用：解释 GA/SI 术语、artifact 字段、禁止旧矩阵字段和状态写入边界。若它与本文档的执行编排、subagent 模型、质量门禁或停止条件冲突，以本文档为准。
5. 如果 `tasks.md` 仍包含 `Test Evidence Matrix`、`Regression Test Deposit`、`Test Layer Plan`、`Fixed Command`、`Test File / Name`、`Evidence Directory`、`Evidence Status`、`Deposit Status` 或 `Test IDs` 字段，停止 apply，要求重新生成 artifacts。
6. 如果 `verification.md` 包含具体测试路径、固定测试命令、runner selector、evidence directory 或 deposit status，停止 apply，要求修订 artifact。
7. Phase 0 preflight 必须先运行全量静态 artifact validator：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>" --complete`。validator hard error 是实现前 `Artifact Consistency Blocker`，必须在启动任何 implementation-worker 前停止；validator warning 必须纳入 Phase 0 人工/agent preflight 判断，不得静默忽略。

## Phase 0 / Preflight

Phase 0 是实现前 artifact-only 硬门禁。任何不依赖当前实现代码、测试文件或 apply evidence 就能判定的 artifact 问题，都必须在启动 implementation-worker 前阻断；不得把明显的 runtime row 引用错误、Proof Slice 非原子、owner/layer/primitive 非法、fake covered reconciliation 或 tasks projection 错误推迟到 Phase 2 test-worker 才首次发现。

`production-obligation-atom-driven` 必须索引：

- `trace/proposal.trace.json` 的 `change-atom-coverage-register` rows、direct atoms、guard/boundary atoms、artifact projection 和 registered source line ranges。
- spec Delivery Plane requirements/scenarios 及对应 `trace/specs/*.trace.json` / `requirement-source-trace` exact `GA-####` 引用。
- design Delivery Plane obligations 及 `trace/design.trace.json` 中的 exact `GA-####` 引用。
- `runtime-acceptance.md` 中 canonical RS-/OP-/ST-/CH- rows、source basis、runtime obligation、observable fact、default path policy、external boundary、scope role 和 no-scope-expansion check。
- `trace/tasks.trace.json` / `acceptance-driven-coverage` 中 `obligation-atom-coverage`、`requirement-scenario-coverage`、`design-obligation-coverage` rows，且每行只能有一个 exact `GA-####`。
- `verification.md` Delivery Plane 中 `Proof Slice Matrix` 的 Slice ID、Runtime Row IDs、Primary Runtime Row ID、Primitive Type、Branch / Variant、Observable Surface、Oracle Fragment、Failure Signal、Primary Layer、Production Owner、Primary Assertion Shape、Fixture / Mock Boundary、Regression Intent 和 Manual / Environment Gate；并索引 `trace/verification.trace.json` / `runtime-coverage-reconciliation` 的 expected/missing slice closure。

`production-default-acceptance-driven` 必须索引：

- `trace/proposal.trace.json` 的 `change-scope-coverage` rows、change-local `SI-###` scope items、guard/context rows、artifact handling 和 baseline/input references。
- spec Delivery Plane requirements/scenarios 及对应 `trace/specs/*.trace.json` / `requirement-source-trace` exact `SI-###` 引用。
- design Delivery Plane decisions 及 `trace/design.trace.json` 中的 exact `SI-###` 引用。
- `runtime-acceptance.md` 中 canonical RS-/OP-/ST-/CH- rows、scope basis、runtime obligation、observable fact、default path policy、external boundary、scope role 和 no-scope-expansion check。
- `trace/tasks.trace.json` / `acceptance-driven-coverage` 中 `scope-item-coverage`、`requirement-scenario-coverage`、`design-decision-coverage` rows，且每行只能有一个 exact `SI-###`。
- `verification.md` Delivery Plane 中 `Proof Slice Matrix` 的 Slice ID、Runtime Row IDs、Primary Runtime Row ID、Primitive Type、Branch / Variant、Observable Surface、Oracle Fragment、Failure Signal、Primary Layer、Production Owner、Primary Assertion Shape、Fixture / Mock Boundary、Regression Intent 和 Manual / Environment Gate；并索引 `trace/verification.trace.json` / `runtime-coverage-reconciliation` 的 expected/missing slice closure。

两个 schema 的 common preflight 必须索引：

- AC Delivery Plane sections、AC-local fields（`Outcome`、`Start Gate`、`Runtime Rows`、`Resolved Runtime Contract`、`Implementation Scope`、`Preserve`、`Proof Contract`）、checkbox task IDs 和 task-level proof requirements。
- 每个 AC 的 `Resolved Runtime Contract` row IDs 必须与该 AC `Runtime Rows` 列表一致，且全部存在于 `runtime-acceptance.md`；resolved 摘录不得与 canonical row 的 runtime obligation、observable fact、default path policy 或 no-scope boundary 冲突。
- `trace/tasks.trace.json` / `runtime-acceptance-index` 中引用的 runtime surface rows、operation rows、state/branch rows、async/realtime rows、provides/consumes rows、depends-on AC、prerequisite runtime facts、scope role、no-scope-expansion check 和 detail matrix row references，且所有 row 必须存在于 `runtime-acceptance.md` Delivery Plane。
- `trace/tasks.trace.json` / `runtime-acceptance-projection` 中的 `Runtime Row Ownership Projection` 和 `Provider / Consumer Projection`。
- runtime provision graph：baseline-provided、provided-by-current-ac、consumed-by-current-ac、future-change-only、explicit negative boundary 的 provider/consumer 关系。
- `verification.md` Delivery Plane 的 `Verification Intent`、`Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`，新格式 `trace/verification.proof-slices.json` 的 canonical `proof-slices`，以及 `trace/verification.trace.json` 的 `runtime-coverage-reconciliation` 和 `slice-consistency-checklist`。

若 validator 或 preflight 发现 coverage orphan、GA/SI range、implementation task ID 无法解析、runtime row 无 owner、AC 顺序违反 provider/consumer graph、`runtime-acceptance.md` row 缺少 source/scope basis 或 default path/no-scope boundary、tasks/verification 引用未定义 runtime row、AC `Resolved Runtime Contract` 缺失/row ID 不一致/与 canonical row 冲突、required/preserve/proof-only runtime row 缺少 tasks projection 或 verification projection、proof-only row 被投影到 proof-only AC/checkbox、同一 row 在 runtime-acceptance/tasks/verification 中 source/scope/default path/no-scope 冲突、Proof Slice `Production Owner` 是复合 owner / owner list、Proof Slice 合并多个独立可失败分支、runtime row 标记 covered 但 missing slice 非空、runtime row 标记 covered 但 expected slice 不存在或非原子、slice 引用不存在的 runtime row、oracle 与 proposal/spec/design/runtime-acceptance 冲突、或 tasks/verification 使用了被禁止的旧测试矩阵字段，必须先修订 artifacts，不得让 worker 直接用代码绕过。

## Subagent 分派硬约束

1. 用户明确要求执行或继续执行 `openspec-apply-change` 技能时，该请求即代表用户授权并要求按本节使用 apply-stage subagent / delegation，除非用户在同一请求中明确禁止 subagent。
2. 创建或启动任何 apply-stage `implementation-worker`、`test-worker`、`fix-worker`、`change-stabilizer` 或 `final-reviewer` subagent 时，必须显式指定 `model=GPT-5.5` 且 `reasoningEffort=xhigh`。这是硬性运行约束，不得因速度、成本、默认设置、模型偏好、任务规模或可用性降级。若当前运行环境无法创建 `GPT-5.5` / `xhigh` apply-stage subagent，必须暂停 apply 并向用户报告 blocker。
3. 所有 worker 必须串行执行。任一时刻最多只能有一个 apply-stage worker 处于运行中；implementation、test、fix、stabilizer、reviewer 不得并行。
4. 启动任何 worker 时默认不要 fork 完整对话历史；使用显式任务包传递必要上下文。只有当该 worker 必须依赖当前对话中尚未写入文件的决策时，才允许 fork。
5. 每个 worker 任务包必须包含：change 名称、schema 名称、完整动态 schema apply instruction 原文、contextFiles、本文档路径、`openspec/agent-runtime/test-quality-strength.md` 路径、相关 proposal/spec/design/verification Delivery Plane 摘要、当前 AC Delivery Plane section（含 `Resolved Runtime Contract`）或 Runtime Row/Proof Slice 范围、preflight 需要的相关 runtime-acceptance canonical row 摘录、允许修改范围、状态写入边界、blocker 分类和最终报告格式。只有 preflight blocker 排查或主 agent 明确摘录时，才把相关 JSON trace 片段传给 implementation-worker。
6. 必须明确告知所有 worker：它不是唯一开发者，不得回滚或覆盖其他 agent / 用户改动；遇到重叠文件或冲突风险必须适配现有改动并在最终报告说明。

## Phase 1 / Production Implementation

1. implementation-worker 的分派单位是包含未完成 checkbox 的 `AC-###` 一级 section；按 runtime provision graph 拓扑顺序逐个 AC 串行启动。
2. 每个 implementation-worker 只负责自己 AC Delivery Plane section 内的 `Outcome`、`Resolved Runtime Contract`、`Implementation Scope`、`Preserve`、`Proof Contract` 和 checkbox tasks。
3. implementation-worker 只能使用 proposal、specs、design、runtime-acceptance 的 canonical row 摘录和 tasks Delivery Plane 作为实现需求来源。JSON trace 只作为主 agent 传入的审计摘录或 blocker 排查依据，不得用来制造额外实现任务；`verification.md` 只可用于理解后续测试 oracle，不得用来制造实现需求或扩大 source/scope。
4. 当前 AC 的 `Start Gate` 或 `trace/tasks.trace.json` provider/consumer graph 未满足时，不得用 mock、fixture、假持久化或越界实现绕过；必须先处理前置 AC 或修订 artifacts。
5. 任务 checkbox 只能由负责该 AC 的 implementation-worker 勾选；必须满足 AC Delivery Plane、`Preserve`、`Proof Contract`、task `Proof`、task `Mock / Default Path Policy`、linked spec/design delivery contract、default runtime path，以及 `trace/tasks.trace.json` 中对应 task projection 的审计约束。
6. 主 agent 在 implementation-worker 运行期间只能做编排等待和状态记录；不得审查未完成 diff、运行验证命令、修改代码、修改 artifacts、勾选任务或接手实现。

## Phase 2 / Test Agent Oracle Precheck

1. 所有 implementation-worker 自然返回完成且没有明确流程级 blocker 后，按 `trace/verification.proof-slices.json` 的 canonical `proof-slices` 和 `trace/verification.trace.json` / `runtime-coverage-reconciliation` 中 required / preserve / proof-only runtime row 的 expected Proof Slice 启动 test-worker；test-worker 写任何测试前必须检查 `verification.md` 的 `Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`、`trace/verification.proof-slices.json` 和 `trace/verification.trace.json` / `runtime-coverage-reconciliation`。Phase 2 Oracle Precheck 是 Phase 0 之后的残余防线；它必须继续阻断 artifact/oracle 问题，但不应成为明显 artifact-only 问题的首次发现位置。
2. 以下情况输出 `Artifact Consistency Blocker` 并停止 apply：
   - `verification.md` 仍包含旧的 Behavior Oracle 分组、旧分组 ID、分组 ID 列或分组 ID 汇总要求。
   - oracle 与 proposal/specs/design 冲突。
   - oracle 与 runtime-acceptance.md canonical runtime row 冲突。
   - oracle 引入 source/scope 外行为。
   - oracle 要求测试 artifact/process，而非产品/runtime 行为。
   - oracle 依赖 implementation detail。
   - oracle 只是检查 evidence、deposit、tasks 矩阵或 OpenSpec artifact 文本结构。
   - required / preserve / proof-only runtime row 未列出 expected Proof Slice，且没有 source/scope-backed manual/not-applicable reason。
   - runtime row 标记 `covered` 但 `Missing Proof Slice IDs` 非 `None`。
   - Proof Slice 引用 runtime-acceptance.md 中不存在的 Runtime Row ID。
   - Proof Slice Matrix 缺少 `Slice ID`、`Runtime Row IDs`、`Primary Runtime Row ID`、`Primitive Type`、`Branch / Variant`、`Observable Surface`、`Oracle Fragment`、`Failure Signal`、`Primary Layer`、`Production Owner`、`Primary Assertion Shape`、`Fixture / Mock Boundary`、`Regression Intent` 或 `Manual / Environment Gate` 列。
   - Proof Slice 的 Primary Runtime Row ID 不在该 slice 的 Runtime Row IDs 中，或该 row 未在 runtime-acceptance.md 中定义。
   - Proof Slice 的 Primitive Type 不在 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization` 中。
   - Proof Slice 的 Branch / Variant、Oracle Fragment 或 Primary Assertion Shape 聚合多个独立可失败分支，例如 edit/delete/add、replay/mismatch、success/failure、retryable/non_retryable/empty_result、多个 viewport condition、多个日志类别、多个 redaction 类别或多个 security branches。
   - Proof Slice 有多个 primary layer，或 primary layer 不在 `unit`、`component`、`route/API`、`DB/integration`、`contract`、`worker/job`、`realtime/SSE`、`browser/e2e`、`visual/responsive`、`security/negative` 中。
   - Proof Slice 缺少 production owner，或 production owner 是测试目录、evidence 目录、runner 入口而不是 production owner 边界。
   - Proof Slice 的 production owner 包含多个 production owner boundary，例如逗号分隔、多个反引号 owner、`+`、`/` owner list、`and`、`和`、`与` 连接的复合 owner。
   - Proof Slice 写入具体测试文件、固定命令、runner selector、evidence path、deposit status 或执行状态。
   - Proof Slice 把 repo-wide env/ops/workspace/forbidden-drift 作为默认新测试义务，且无 proposal/spec/design 明确 source/scope basis。
   - `verification.md` 新增或重复 source/scope basis，并以此重新解释 runtime-acceptance.md canonical row 之外的 source/scope。
3. 当前实现不支持 oracle、当前实现难测、当前测试会失败，都不是 Artifact Consistency Blocker。
4. 只要 oracle 能从 runtime-acceptance canonical rows 及 proposal/specs/design 一致性核对中合理推出，就必须进入测试生成；不得修改 `verification.md` 来适配当前实现。

## Phase 3 / Test Authoring + Execution

1. test-worker 写测试前必须读取并遵守 `openspec/agent-runtime/test-quality-strength.md`。
2. test-worker 基于 proposal、specs、design、runtime-acceptance、verification Delivery Plane 和已实现代码生成并运行测试；`tasks.md` 只能作为 runtime acceptance context，不得作为测试 oracle 来源。
3. test-worker 必须按 `trace/verification.proof-slices.json` 的 required Proof Slice 和 `test-quality-strength.md` 的测试质量强度选择最小充分测试层、placement、harness、mock/fixture 边界和实际运行命令，并在结果中记录 Runtime Row -> Proof Slice -> test result 覆盖关系。
4. test-worker 必须按 atomic Proof Slice 逐条生成或确认测试；每个 required Proof Slice 默认必须对应一个以 exact `PS-###` 开头的 primary test title。不得把多个独立可失败分支串成一个混合 browser/API/DB/provider/security 断言的大而全测试。发现非原子 Proof Slice 时必须输出 `Artifact Consistency Blocker`，不得自行拆开并继续。
5. 新增或修改的测试必须按 `openspec/agent-runtime/test-quality-strength.md` 的 placement policy 放在外置 `tests/**` 长期 test/spec 文件中；`Production Owner` 只用于 proof trace，不直接推导物理测试路径。协作依赖只影响 harness/mock/default-path 说明，不扩大 owner。`tests/runtime/**` 不再作为新业务测试目标，只保留历史测试或 source/scope-backed 手动迁移对象；不得放在 forbidden placement、`openspec-results/**`、`test-results/**`、`openspec/changes/**` 或一次性脚本中。
6. 同一 production owner、同一 primary layer 的多个 Proof Slice 可以共享同一测试文件、fixture/helper 或参数化结构；默认不得共享同一个 primary `it` / `test`。不同独立 branch 或不同 primary layer 不得合并成一个 primary proof。多个 Proof Slice 可以共享相同 `Primary Runtime Row ID`，但每个 required PS 必须保持独立 test title 和 runner filter。
7. 如果 test-worker 认为 slice 的 layer 或 owner 与代码 reality 不合理，不得静默修改 `verification.md`。只有在 oracle 不变且 source/scope-compatible 时，才可在 apply result 记录 layer/owner 调整理由；否则输出 blocker。
8. 测试断言必须来自 proposal/specs/design/runtime-acceptance/verification 的外部行为契约。不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 presence-only、静态 markup、源文件文本扫描或 artifact/config/text scan 作为 required behavior primary proof。
9. browser E2E 必须使用真实 browser/context/page 和 user-equivalent actions/readback；component 必须使用交互式 component harness；route/API、DB/integration、contract、worker/job、realtime/SSE、visual/responsive、security/negative 必须证明各自 production-compatible boundary。
10. test-worker 对每个 required Proof Slice 只能输出：`Passed`、`Authoring Blocker`、`Execution Failure`、`Artifact Consistency Blocker`。
11. `Passed` 表示标准测试已生成或确认存在，测试表达的 slice oracle 与 `verification.md` 一致，满足 `test-quality-strength.md`，实际测试路径符合 placement policy，实际命令通过，runner/entry 能真实触达 placement-policy compliant tests，且未新增 forbidden placement、错误 runner include 或 test-only production route。
12. `Authoring Blocker` 表示无法按标准测试写法覆盖 slice，原因是生产代码缺少合适 public/runtime boundary、稳定 observable surface、可控 dependency boundary、错误信号，或只能通过 implementation-detail/static/artifact proof 覆盖。
13. `Execution Failure` 表示测试已经能按标准写法生成，测试表达的 oracle 与 `verification.md` 一致，但执行失败、runner/entry 未触达、环境隔离失败或生产行为不满足 oracle。
14. test-worker 不得弱化 oracle、改成实现细节测试、跳过失败 slice、硬编码 change slug/AC ID/evidence path，或用 broad smoke 替代可低层稳定断言。

## Phase 4 / Production Fix Loop

1. `Authoring Blocker` 和 `Execution Failure` 都必须进入 fix-worker；不得由 test-worker 通过削弱 oracle、跳过 Proof Slice 或改成 implementation-detail test 消化。
2. fix-worker 默认修改生产代码。对 `Authoring Blocker`，应改善 public/runtime boundary、稳定可观察行为、隐式全局状态、过度耦合、production-compatible dependency boundary 或错误信号。对 `Execution Failure`，应修正状态流、错误分支、API/data contract、权限、异步链路、持久化或 UI readback 偏差，使生产行为满足 verification oracle。
3. fix-worker 不得要求 test-worker 削弱测试，不得修改 `verification.md` 来适配当前实现。只有 oracle 与 proposal/specs/design 确实冲突时，才返回 `Artifact Consistency Blocker`。
4. fix-worker 完成后必须回到 Phase 2/3，由 test-worker 重新执行 Oracle Precheck、Test Authoring 和 Execution。
5. 循环直到所有 required Proof Slice 都是 `Passed`、source/scope-backed `Manual / Environment Gate` 或 source/scope-backed `Not Applicable`，且 required / preserve / proof-only runtime row reconciliation 闭合，或出现真正的流程级 blocker。

## Worker Blocker 语义

1. `Authoring Blocker` 和 `Execution Failure` 是 fix loop 输入，不自动等同于 apply 流程级 blocker。
2. worker 在 current-change scope 内拥有 repair authority。只要修复仍在当前 change scope 内，worker 可以修改实现、测试、必要的 tasks checkbox 和 apply evidence result，并重跑相关命令。
3. 流程级 blocker 仅限：source / proposal / spec / design / verification 存在无法自主判定的冲突；必需工具、权限、凭证或外部状态不可用；用户或其他 agent 的改动冲突无法安全适配；必要修复会超出当前 change scope；当前环境无法满足 apply-stage subagent 模型/推理配置。
4. worker 返回 blocker 时，主 agent 只判断报告是否命中流程级 blocker 分类。若未命中，要求同一 worker 继续；主 agent 不接手实现、不更新 checkbox、不替 worker 补 proof。

## Phase 5 / Evidence Result

1. evidence 由 apply runtime、runner、CI、worker 或 auditor 收集；不写回 `tasks.md` 或 `verification.md`，也不进入产品测试代码。
2. apply evidence result 必须写入或更新 `openspec-results/<change-slug>/apply-result.md`。该文件是 archive 阶段读取 Proof Slice 结果、实际测试文件、实际命令、运行结果、manual/not-applicable 理由、blocker 处理和 subagent 报告摘要的事实来源。
3. apply result 至少记录：change 名称、schema 名称、每个 AC 的完成状态、每个 required / preserve / proof-only runtime row 的 tasks/verification 覆盖状态、每个 required Proof Slice 的最终状态、`openspec-results/<change-slug>/proof-test-map.json` 路径、实际命令、退出状态或 CI result、manual/environment/not-applicable source/scope-backed reason、source/scope-compatible layer/owner 调整理由、未解决 blocker、implementation/test/fix worker 报告摘要。
4. 详细 `Runtime Row -> Proof Slice -> test result` 机器映射必须写入 `openspec-results/<change-slug>/proof-test-map.json`，schema 固定为 `openspec-proof-test-map-v1`。每个 required PS 必须有一条 `proof-test-results[]`，包含 `slice-id`、`status`、`runner`、`file`、`test-title`、`filter`、`command`。
5. 测试代码不得硬编码 `openspec-results/**`、change slug、AC ID 或 evidence path。runner artifact 可通过测试框架 output directory、attachment/report 或 apply 执行方复制保存。
6. 任一 required Proof Slice 仍是 unresolved `Authoring Blocker`、`Execution Failure` 或 `Artifact Consistency Blocker`，或 required / preserve / proof-only runtime row reconciliation 未闭合，或 `proof-test-map.json` 无法通过 audit 时，不得声称 apply 完成或 ready to archive。

## Change Stabilizer 全局收敛

1. 所有 implementation/test/fix worker 自然返回完成且没有明确流程级 blocker 后，必须启动一个独立 `change-stabilizer` subagent 执行一次全 change 复核、修复和 apply-result 收敛。这是 final-reviewer 之前的固定环节，不得按任务规模、风险级别、速度、成本或主观判断跳过。
2. `change-stabilizer` 必须在所有 worker 结束后启动，且不得与 worker 或 final-reviewer 并行运行；若任一 worker 返回流程级 blocker 或仍有未完成实现/测试/fix 工作，不得启动 change-stabilizer。
3. `change-stabilizer` 是 read/write 的 current-change-scoped repair agent。它可以检查代码 diff、artifacts、tasks checkbox、runtime-acceptance model、verification oracle、test-quality-strength 门禁、实际测试、命令结果、apply-result 和跨 AC 集成冲突；只要修复仍在当前 change scope 内，它可以修改实现、测试、必要的 tasks checkbox、apply-result，并重跑受影响命令。
4. `change-stabilizer` 不得扩大当前 change scope，不得削弱 proposal/spec/design/verification oracle，不得把无法证明的 Proof Slice 改写为 `Passed`。如果必要修复超出当前 change scope、工具/权限/凭证不可用、artifact 存在无法自主判定的冲突，或用户/其他 agent 改动冲突无法安全适配，必须返回流程级 blocker。
5. 每个 apply completion cycle 最多自动运行一轮 `change-stabilizer`。如果 change-stabilizer 返回流程级 blocker，主 agent 只汇报 blocker 并停止，不得启动 final-reviewer。change-stabilizer 完成后若后续 final-reviewer 仍返回 blocker，主 agent 必须停止 apply 流程并交人工查验；不得自动启动第二轮 change-stabilizer，除非用户在 blocker 汇报后显式要求继续处理。
6. `change-stabilizer` 不得声明 ready to archive。只有后续只读 final-reviewer 返回 pass，才可声称复核通过或 ready to archive。

## Final Reviewer Subagent 复核

1. `change-stabilizer` 自然返回完成且没有明确流程级 blocker 后，必须启动一个独立只读 `final-reviewer` subagent 执行最终复核检验。这是所有自动实现和全局收敛后的固定环节，不得按任务规模、风险级别、速度、成本或主观判断跳过。
2. `final-reviewer` 必须在 change-stabilizer 结束后启动，且不得与 worker 或 change-stabilizer 并行运行；若 change-stabilizer 返回流程级 blocker 或仍有未完成修复/证据收敛工作，不得启动 final-reviewer。
3. 主 agent 启动 final-reviewer 时必须传入：change 名称、schema 名称、contextFiles、proposal/specs/design/runtime-acceptance/verification/tasks 路径、所有 worker 最终报告、worker 改动范围、change-stabilizer 最终报告、stabilizer 改动范围、实际测试文件、实际命令、apply-result 路径、runtime acceptance model 和 verification oracle 路径。主 agent 不得为了准备 final-reviewer 输入而自行审查 diff、打开 evidence、重跑验证命令或预先判断 worker/stabilizer 结果是否可信。
4. final-reviewer 负责独立只读复核：检查代码 diff、artifacts Delivery Plane、JSON trace coverage、tasks checkbox、runtime-acceptance model、verification Proof Slice/oracle、测试质量、实际测试文件、实际命令结果、apply-result、`proof-test-map.json`、跨 AC 集成冲突、默认路径/no-mock 约束；必要时可重跑命令。
5. final-reviewer 只输出复核报告和 pass/blocker 结论，不得直接修改代码、artifacts、checkbox、apply-result 或测试文件。
6. 若 final-reviewer 在 change-stabilizer 完成后仍发现 blocker，主 agent 必须汇报 final-reviewer blocker 并停止 apply 流程，状态为 blocked for human review；不得自行接手修复、替 stabilizer 补 proof、替 final-reviewer 复验或自动启动第二轮 stabilizer，除非用户在 blocker 汇报后明确要求继续处理。
7. 只有 final-reviewer 返回 pass，才可在最终汇报中声称复核通过或 ready to archive。final-reviewer 未运行、运行失败、无法满足模型/推理配置、或返回 blocker 时，不得声称 ready to archive。

## 主 Agent 职责

1. 主 agent 负责 orchestration：选择 change、读取 status / instructions、解析 context、执行 preflight、按 AC 串行分派 implementation-worker、按 Runtime Row/Proof Slice test feedback 串行分派 test-worker 和 fix-worker，在所有 worker 完成后启动一次 change-stabilizer，在 change-stabilizer 完成后启动 final-reviewer，并汇总各 subagent 返回的完成状态、证据路径、命令结果和流程级 blocker。
2. 主 agent 必须等待所有已分派 worker 自然返回最终完成或明确 blocker；若全部 worker 完成且无 blocker，必须等待 change-stabilizer 自然返回完成或 blocker；若 change-stabilizer 完成且无 blocker，必须等待 final-reviewer 自然返回 pass 或 blocker 后，才能做最终汇总。
3. 任一 worker、change-stabilizer 或 final-reviewer 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手修复/复核。
4. 主 agent 不得打断、停止、关闭或要求正在运行的 subagent 提前回报。除非用户明确要求终止当前 apply 流程，否则必须等待 subagent 自然返回最终完成或明确 blocker。
5. subagent 返回完成但摘要缺少路径、命令结果或 blocker 状态等汇总必需信息时，主 agent 可以要求同一个 subagent 补充说明；这不构成主 agent 复核，主 agent 不得自行打开文件或运行命令来补齐。

## 状态更新

1. `tasks.md` 只更新 implementation checkbox；不得写入测试计划、测试编号、执行证据或沉淀状态。
2. `runtime-acceptance.md` 和 `verification.md` 是 propose 阶段 artifacts；apply 不得为了适配当前实现静默修改 runtime rows 或 oracle。
3. 如果 test-worker/fix-worker/stabilizer/final-reviewer 发现 oracle 与 proposal/specs/design/runtime-acceptance 冲突，必须停止并报告 artifact consistency blocker，由人工或新的 artifact 修订流程处理。
4. 不需要更新独立 acceptance status；AC 的通过状态由负责该 section 的 worker 完成声明、checkbox 更新、runtime proof 摘要、apply-result、change-stabilizer 收敛结果和 final-reviewer pass 共同表示。

## 最终汇报

最终汇报必须包含：

- 已完成 AC sections 和任务。
- 生产代码改动范围。
- `runtime-acceptance.md` 每个 required / preserve / proof-only runtime row 的 tasks/verification 覆盖状态。
- `verification.md` 每个 required Proof Slice 的最终状态，以及 required / preserve / proof-only runtime row reconciliation 状态。
- test-worker 输出的 Passed / Authoring Blocker / Execution Failure / Artifact Consistency Blocker 处理结果。
- fix-worker 对生产代码的修复范围。
- 实际测试文件、实际命令和运行结果。
- `openspec-results/<change-slug>/apply-result.md` 路径。
- change-stabilizer 的全局收敛报告、修复范围、重跑命令和 blocker 状态。
- final-reviewer 的只读复核结论、复核命令及 pass/blocker 报告。
- 未完成、被阻塞、未验证或需要用户决策的事项。

不得在 tasks checkbox 全部完成、required Proof Slice 全部通过或有 source/scope-backed manual/not-applicable 结论、runtime row reconciliation 闭合、apply-result 已写入、change-stabilizer 完成、final-reviewer 返回 pass 前声称 ready to archive。
