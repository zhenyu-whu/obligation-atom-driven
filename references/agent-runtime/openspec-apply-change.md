# openspec-apply-change 运行约束

当执行或触发 `openspec-apply-change` 技能实施某个 OpenSpec change 时，必须遵守以下约束。

本文档覆盖两个生产 schema：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。历史 change 如果在 `.openspec.yaml` 中显式声明其他旧 schema，可按其 schema instructions 兼容处理；两个生产 schema 的新 change 不得创建或依赖 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。

## 执行入口

1. 严格先执行 `openspec-apply-change` 技能原有流程：选择 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions apply --change "<name>" --json`，并从 apply instructions 中获取 `schemaName`、`contextFiles`、进度、任务列表和动态指令。
2. 根据 `schemaName` 分支处理：
   - `production-obligation-atom-driven`：使用 Global Atom / `GA-####` 覆盖模型。
   - `production-default-acceptance-driven`：使用 change-local Scope Item / `SI-###` 覆盖模型。
   - 其他 schema：按该 change 自身 schema instructions 兼容处理，不套用本文件的 GA/SI 生产门禁。
3. 对两个生产 schema，apply instructions 必须只要求 `tasks` 作为 apply requirement，并且 context files 应包含 `proposal.md`、delta specs、`design.md`、`tasks.md`。若 apply instructions 仍要求 `source-truth`、`acceptance`、旧版 source coverage、`change-source-map` 或任何 proposal 前置 source artifact，必须暂停并修正 schema/config/artifacts。
4. 主 agent 先读取 `tasks.md`，解析 `Acceptance-Driven Coverage`、`Runtime Acceptance Index`、所有 `AC-###` section、`Verification Appendix`、`Test Layer Plan`、`Test Evidence Matrix`、`Regression Test Deposit`、每个 AC 的 `Prerequisites` / `Provides` / `Consumes` / `Start Gate`，以及每个未完成 checkbox 的 `Trace` / `Runtime Rows` / `Test IDs` / `Acceptance` / `Proof` / `Overrides` trace 字段。
5. 主 agent 同时读取 proposal、相关 specs 和 design。不得批量展开原始 source docs；只有任务 trace、coverage gate、冲突协调或 proof 失败定位需要时，才按 schema 分支做定点读取。
6. `production-obligation-atom-driven` preflight 必须索引：
   - proposal `Change Atom Coverage Register` rows、direct atoms、guard/boundary atoms、artifact projection 和 registered source line ranges。
   - spec requirements/scenarios 及其 exact `GA-####` 引用。
   - design obligations 及其 exact `GA-####` 引用。
   - `Obligation Atom Coverage`、`Requirement / Scenario Coverage`、`Design Obligation Coverage` rows，且每行只能有一个 exact `GA-####`。
7. `production-default-acceptance-driven` preflight 必须索引：
   - proposal `Change Scope Coverage` rows、change-local `SI-###` scope items、guard/context rows、artifact handling 和 baseline/input references。
   - spec requirements/scenarios 及其 exact `SI-###` 引用。
   - design decisions 及其 exact `SI-###` 引用。
   - `Scope Item Coverage`、`Requirement / Scenario Coverage`、`Design Decision Coverage` rows，且每行只能有一个 exact `SI-###`。
   - `Regression Test Deposit`：每个 AC/Test ID 的永久测试文件、最小回归命令、behavior contract、assertion oracle、fixture boundary、CI tier、Not Testing 边界和 deposit status。
8. 两个生产 schema 的 common preflight 必须索引：
   - AC sections、AC-local execution contract fields、checkbox task IDs、trace inheritance / overrides、coverage table rows、AC-owned Test IDs、Prerequisites/Provides/Consumes/Start Gate 和 proof/evidence requirements。
   - `Runtime Acceptance Index`：每个 AC 的 scope/source basis、runtime surface rows、operation rows、state/branch rows、async/realtime rows、Test IDs、Provides Rows、Consumes Rows、Depends On AC IDs、Prerequisite Test IDs、Start Gate、scope role、no-scope-expansion check 和 detail matrix row references。它只作为 routing index，不作为 row/test 详情来源。
   - `Verification Appendix`：`Runtime Surface Inventory`、`Operation Coverage Matrix`、`State / Branch Coverage Matrix`、`Async / Realtime Chain Matrix`、`Test Layer Plan`、`Test Evidence Matrix` 的 row IDs、basis、scope role、provider/consumer ownership、AC ID、Requires Tests Passed、Test IDs 和 no-scope-expansion checks。Appendix 是 runtime/test detail source of truth。
   - `Test Layer Plan`：每个 required behavior、preserve boundary 和 proof-only guard 的 required layers、Test IDs by layer、omitted layers / reason、primary proof layer 和 regression entry。Testing Quality Core 不可选；runtime detail matrices 只在确实无对应 runtime 行为时允许最小 `Not applicable` 行。
   - test evidence matrix：Test ID、owning AC ID、fixed command、test file/name、layer、covered row IDs、default path 标记、fixture boundary、must-fail-before-implementation、Red Command、Expected Red Failure、Observed Red Failure、Green Command、TDD Status、Requires Tests Passed、canonical evidence directory、ledger file、CI runnable 标记和 evidence produced；每个 Test ID 必须匹配 exact `T-[0-9]{3}`，不得带测试名称、AC 编号、slug 或字母后缀。
   - runtime provision graph：baseline-provided、provided-by-current-ac、consumed-by-current-ac、future-change-only、forbidden-boundary 的 row/provider/consumer 关系，以及 AC 拓扑顺序。
   - evidence ledger targets：fixed commands、canonical `test-results/<change-slug>/<AC-ID>/<Test-ID>/` artifacts、browser/rendered artifacts、API/DB/job/storage/log/audit facts、default-production-path proof。
9. 完成 change 选择、status / instructions 读取、context 解析、schema-specific preflight、common preflight、coverage gate 和进度展示后，才能分派 worker 或开始实现。
10. 如果仓库存在 `openspec/agent-runtime/scripts/validate_tasks_quality.py`，必须在分派 worker 或开始实现前运行 `python openspec/agent-runtime/scripts/validate_tasks_quality.py openspec/changes/<change-slug>/tasks.md`。若报告 error，先修订 artifacts；不得用实现绕过 Testing Quality Core 缺口。

## Implementation + Acceptance Gates

1. **Gate 1 / Artifact 完整性**：`tasks.md` 必须包含 `## Acceptance-Driven Coverage`、三张 coverage 表、`## Runtime Acceptance Index`、所有 `AC-###` sections、后置 `## Verification Appendix` 六张 runtime/test 矩阵（包含 `Test Layer Plan` 和 `Test Evidence Matrix`），以及 `Regression Test Deposit`。两个生产 schema 的 Testing Quality Core（`Test Layer Plan`、TDD red/green fields、`Test Evidence Matrix`、`Regression Test Deposit`）不可选。
2. **Gate 2 / AC-local contract 检查**：`production-obligation-atom-driven` 的每个 AC section 必须包含 `Source Atoms:`、`Projection:`、`Spec:`、`Design:`；`production-default-acceptance-driven` 的每个 AC section 必须包含 `Scope Items:`、`Artifact Handling:`、`Spec:`、`Design:`。两个 schema 的每个 AC 都必须包含 `Acceptance:`、`Runtime Rows Owned:`、`Test IDs:`、`Prerequisites:`、`Provides:`、`Consumes:`、`Start Gate:`、`No-Scope Boundary:`、`Primary Proof:`、`Required Evidence:`、`Mock / Fixture Boundary:`、`Mock Policy:`。
3. **Gate 3 / 覆盖检查**：GA schema 中每个 direct `GA-####` 必须在 `Obligation Atom Coverage` 中有一行，并带有与 proposal register 一致的 `Artifact Projection`。Default schema 中每个 material `SI-###` 必须在 `Scope Item Coverage` 中有一行，并带有与 proposal scope coverage 一致的 `Artifact Handling`。两个 schema 都禁止 ID ranges、aggregate rows、多 ID 单元格、orphan coverage 和 projection/handling mismatch。
4. **Gate 4 / Coverage task ID 解析检查**：三张 coverage 表中的每个 `Implementation Task IDs` 和 `Verification Task IDs` 必须解析到实际 checkbox task。每个 AC section 必须至少有一个 final verification / acceptance checkbox，并被 `Primary Proof`、`Required Evidence` 和相关 coverage rows 引用。
5. **Gate 5 / Runtime model 覆盖检查**：`Verification Appendix` 中每个 mandatory row 必须有 basis、scope role、provider/consumer ownership、AC ID、Test ID 和 no-scope-expansion check；每个 Test ID 必须绑定具体 covered row IDs，只能归属一个 exact `AC-###`，并且必须匹配 exact `T-[0-9]{3}`。fixed command、test file/name、evidence directory、ledger file、fixture boundary、Requires Tests Passed 和 CI runnable 状态只能在 `Test Evidence Matrix` 中定义。
6. **Gate 6 / AC dependency 拓扑检查**：每个 AC 的 `Consumes` 必须只能引用 baseline 或 earlier AC 在 `Provides` 中提供的 runtime rows / contracts / facts；`Depends On AC IDs` 必须排在当前 AC 之前；`Prerequisite Test IDs` / `Requires Tests Passed` 必须引用 earlier AC 的 Test IDs；不得存在循环依赖、future-change-only prerequisite、或只在 proof/fixed command 中隐式出现的 runtime dependency。
7. **Gate 7 / 永久回归与有意义测试检查**：两个生产 schema 的每个 required behavior Test ID 必须在 `Regression Test Deposit` 中有 `required` 或 `deposited` 行，除非写明 source/scope-backed `not-applicable` 理由。不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 enabled 或当前实现输出登记为 required behavior 的 primary proof 或永久回归 oracle。`Test Layer Plan` 中不得用 smoke/browser proof 替代可低层稳定断言的 unit/component/API/DB/security 等层级。
8. **Gate 8 / 任务级 TDD 与 proof 检查**：worker 应优先按当前 AC-local `Test IDs`、任务 `Test IDs`、`Proof:` 和 regression deposit（若适用）建立或补齐对应验证。实现完成前 proof 应能失败或暴露缺口；实现后必须通过 AC-owned Test ID 在 `Test Evidence Matrix` 中定义的 fixed command，并在 canonical evidence directory 产出 evidence。用户可见操作必须执行当前 schema 中定义的 runtime interaction / operation matrix proof；presence-only、static-only、API-only、implementation-detail 或 broad command proof 不得单独支撑勾选。
9. **Gate 9 / 默认路径与 no-mock 检查**：凡 task 涉及 Route Handler、auth、session、DB、AI/provider、storage、queue、SSE、worker、external service adapter、env/config 或 deployment wiring，proof 必须覆盖真实导出、default dependency 或 default config。mock、stub、dependency injection、Playwright route intercept、fixture-only、手工注入 EventSource、直接 DB seed 或 isolated unit test 只能作为补充，除非 runtime matrix 明确说明该 row 是 source-compatible deterministic path 且另有测试覆盖被替换的 production boundary。
10. **Gate 10 / 完成判定**：只有当 `tasks.md` 全部 checkbox 完成、三张 coverage 表、`Runtime Acceptance Index`、每个 AC-local contract、`Verification Appendix` 六张 runtime/test 矩阵、required evidence、canonical evidence directories、TDD red/green evidence、evidence ledger 和 `Regression Test Deposit` 都能回链到已完成任务和 proof，才可称为 ready for archive。

## 任务章节拆分

1. implementation worker 的分派单位是包含未完成 checkbox 的 `AC-###` 一级 section。
2. `Acceptance-Driven Coverage`、`Runtime Acceptance Index`、`Verification Appendix` 和 `Regression Test Deposit` 不属于开发任务章节；coverage tables 只负责 proposal/spec/design 覆盖，`Runtime Acceptance Index` 只负责路由，`Verification Appendix` 负责 runtime/test 明细，`Regression Test Deposit` 负责永久回归沉淀。
3. 不存在独立 Acceptance Phase。AC section 内的 final verification task 就是该 slice 的验收闭环。
4. 如果 preflight 发现某个 AC section 缺少 AC-local runtime ownership、final verification / acceptance checkbox，或 coverage/runtime/test 表只引用 AC heading 而没有具体 verification task ID，必须先修订 artifacts，不得让 worker 直接补代码绕过。
5. 如果 preflight 发现 AC section 顺序不满足 runtime provision graph，必须先修订 artifacts；不得让较早 AC 越界实现较晚 AC 的 provider work，也不得用假持久化、mock API 或 fixture-only proof 代替应由前置 AC 提供的真实 runtime surface。

## Subagent 分派

1. 用户明确要求执行或继续执行 `openspec-apply-change` 技能时，该请求即代表用户显式授权并要求按本节使用 `worker` subagent 和 delegation，除非用户在同一请求中明确禁止 subagent。
2. 创建或启动任何 apply-stage `worker` subagent 时，必须显式指定 `model=GPT-5.5` 且 `reasoningEffort=xhigh`。这是硬性运行约束，不得因速度、成本、默认设置、模型偏好、任务规模或可用性降级为其他模型或推理档位；若当前运行环境无法创建 `GPT-5.5` / `xhigh` worker，必须暂停 apply 并向用户报告 blocker，不得以降级 worker 继续。
3. `worker` subagent 必须串行执行。禁止一次性启动多个 worker；任一时刻最多只能有一个 worker 处于运行中。
4. 对每个包含未完成任务的 AC section，必须按顺序分别创建一个 `worker` subagent 进行开发，除非用户明确禁止 subagent 或运行环境不可用。前一个 worker 自然返回最终完成或明确 blocker 前，不得启动下一个 worker。
5. 每个 worker 只负责自己 AC section 内的任务和该 section 的验收 proof。
6. 启动 worker 时默认不要 fork 完整对话历史；使用显式任务包传递必要上下文。只有当该章节必须依赖当前对话中尚未写入文件的决策时，才允许 fork。
7. 启动 worker 时必须传入：
   - runtime 配置：`model=GPT-5.5`、`reasoningEffort=xhigh`、不得降级；若无法满足该配置，worker 不得启动。
   - change 名称和 schema 名称。
   - `contextFiles` 路径清单。
   - schema-specific coverage rows：GA schema 传当前 AC 相关 `GA-####` proposal register rows；default schema 传当前 AC 相关 `SI-###` scope coverage rows。
   - 对应 AC section 的完整 AC-local execution contract，包括 acceptance、source atoms 或 scope items、projection 或 artifact handling、runtime rows owned、Test IDs、Prerequisites、Provides、Consumes、Start Gate、no-scope boundary、required evidence、mock/fixture boundary、mock policy 和每个 task trace inheritance/overrides。
   - 相关 specs/design 片段路径。
   - 与该 AC 相关的 coverage 表行、runtime detail rows、test evidence rows 和 regression deposit rows（若适用）。只传当前 AC 拥有或引用的 rows；不要把完整全局矩阵作为 worker 的主要执行输入。
   - 该 AC 的 dependency gate：前置 AC IDs、前置 Test IDs、已经由 baseline 或 earlier AC 提供的 runtime rows / contracts / facts。
   - 与该 AC 相关的 evidence ledger targets、`Test Evidence Matrix` 定义的 canonical `test-results/<change-slug>/<AC-ID>/<Test-ID>/` evidence storage contract，以及 final verification / acceptance checkbox ID。
   - 允许修改的代码范围或模块边界。
   - 任务状态更新要求：worker 完成并验证自己 AC section 内任务后，必须把对应 checkbox 从 `- [ ]` 更新为 `- [x]`；未完成、未验证、proof 不足、default path 未证明或存在 blocker 的任务不得勾选。
8. 必须明确告知 worker：实现前按 schema 分支读取必要原始依据。GA schema 通过 linked `GA-####` 定点读取 registered source docs；default schema 通过 `SI-###` 对应的 proposal/spec/design baseline/input/code/spec trace 定点读取。若发现 context 冲突、任务边界不清、trace 缺失、proof 不可执行、task 弱于 proposal/spec/design/source 或 baseline，必须停止猜测并标明 blocker。
9. 必须明确告知 worker：它不是唯一开发者，不得回滚或覆盖其他 agent / 用户的改动；遇到重叠文件或冲突风险必须适配现有改动并在最终回复中说明。
10. 必须明确告知 worker：完成任务时要执行 AC-owned Test IDs 在 `Test Evidence Matrix` 中定义的 fixed command，并在 `test-results/<change-slug>/<AC-ID>/<Test-ID>/` 提供 evidence ledger 条目，且 `<Test-ID>` 必须匹配 `T-[0-9]{3}`。`/tmp`、未复制的 runner 默认输出、agent 当场手工截图或口述路径不得作为最终 evidence。两个生产 schema worker 都必须按 `Test Layer Plan`、TDD red/green fields 和 `Regression Test Deposit` 落实分层测试与永久回归测试；若 deposit 标记 `not-applicable` 或 `blocked`，必须给出 source/scope-backed 理由。

## 主 Agent 职责

1. 主 agent 负责 orchestration：选择 change、读取 status / instructions、解析 context、按 AC section 串行分派 worker、逐个等待 worker 自然返回结果、统一审查改动、执行最终 coverage/proof audit、汇总证据。
2. 主 agent 必须等待所有已分派 worker 的任务全部完成或明确 blocker 后，才能开始主 agent 自己的统一审查、集成修复、额外测试、proof audit、tasks checkbox 更新和最终汇总。
3. 任一 worker 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查未完成 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手实现。
4. 主 agent 不得打断、停止、关闭或要求正在运行的 worker 提前回报。除非用户明确要求终止当前 apply 流程，否则必须等待 worker 自然返回最终完成或明确 blocker。
5. 统一 audit 至少确认：
   - 相关代码改动符合 AC section、task trace inheritance/overrides、schema-specific coverage IDs、spec/design 和原始依据。
   - 每个已勾选 task 都有实现证据和 proof 证据。
   - 每个 AC section 的 primary proof 和 required evidence 已满足。
   - 三张 coverage 表的每一行都有已勾选任务、真实存在的 verification task ID、验证证据、projection/handling 处理和验收 proof。
   - `Runtime Acceptance Index` 每行都能解析到 owning AC、AC-local `Runtime Rows Owned`、checkbox `Runtime Rows`、Test IDs、Prerequisites/Provides/Consumes/Start Gate 和 `Verification Appendix` detail rows。
   - Runtime provision graph 无循环，所有 `Depends On AC IDs` 均排在 consumer AC 之前，所有 `Prerequisite Test IDs` / `Requires Tests Passed` 均引用 earlier AC 的 Test IDs，且没有 hidden future dependency。
   - `Verification Appendix` 六张 runtime/test 矩阵的每个 mandatory row 都有已勾选任务、真实存在且只归属一个 AC、并匹配 exact `T-[0-9]{3}` 的 Test ID、fixed command、验证证据、basis、provider/consumer ownership 和 no-scope-expansion check；无 runtime 行为的 detail matrix 只能保留 source/scope-backed `Not applicable` 最小行。
   - 两个生产 schema 的 `Test Layer Plan` 中每个 required behavior、preserve boundary 和 proof-only guard 都有 layer decision；省略适用层时理由不能只是“已有 smoke 覆盖”。
   - 两个生产 schema 的 `Regression Test Deposit` 中每个 required behavior Test ID 都有永久回归文件或稳定测试入口、最小回归命令、behavior contract、assertion oracle、fixture boundary、CI tier 和 `Not Testing` 边界；`not-applicable` 或 `blocked` 行有 source/scope-backed 理由。
   - 不存在违反当前 schema proof strength 的 presence-only、static-only、API-only、implementation-detail 或 broad-command 验收。
6. 若验收 proof 失败揭示 proposal/spec/design/tasks 与 schema-specific coverage basis 不一致，主 agent 必须暂停代码修复并提出 artifact 更新；不得用实现绕过 artifact mismatch。

## 状态更新

1. task checkbox 由负责对应 AC section 的 worker 执行。
2. worker 只能勾选自己 section 内已经完成且满足 AC-level source/scope、projection/handling、No-Scope Boundary、Mock Policy、task `Proof`、linked spec scenario、linked design obligation/decision、default runtime path verification 和 AC/task override 约束的任务。
3. 主 agent 在统一 audit 中核对 worker 已勾选任务是否可信；若发现误勾选、proof 不足或 coverage 行未覆盖，必须指出并纠偏。
4. 不需要更新独立 acceptance status；AC 的通过状态由该 section 下所有任务完成、required evidence 产出、coverage audit 通过共同表示。

## 最终汇报

最终汇报必须包含：

- 已完成 AC sections 和任务。
- 每个 worker 的关键改动范围。
- schema-aware `Acceptance-Driven Coverage` audit 结果。
- 每个 AC 的 primary proof、required evidence、canonical evidence directories、evidence ledger、截图/DOM/API/DB/job/log/audit 等证据。
- 执行的验证命令及结果。
- 两个生产 schema 的永久回归测试沉淀：新增或更新的 test/spec 文件、最小回归命令、CI tier，以及明确不测试的实现细节边界。
- 未完成、被阻塞、未验证或需要用户决策的事项。

不得在所有 AC section proof 未完成时声称 ready to archive。
