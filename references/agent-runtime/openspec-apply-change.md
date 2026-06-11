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
   - test layer code requirements：每个 Test ID 的 `Layer` 必须匹配实际测试 harness/runtime；目录、文件名、脚本名、截图存在或 agent 口述不能提升层级。`browser E2E` 必须有真实 browser/context/page 和 user-equivalent actions/readback；`component` 必须有交互式 component harness；route/API、DB/integration、worker/job、realtime/SSE、visual/responsive、security/negative、config/ops/check 必须证明各自 production-compatible boundary。
   - test evidence matrix：Test ID、owning AC ID、fixed command、test file/name、layer、covered row IDs、`Default Path Level`（旧表可兼容 `Default Path?`）、fixture boundary、Verification Expectation、Evidence Status、Requires Tests Passed、canonical evidence directory、evidence produced、CI runnable 标记；每个 Test ID 必须匹配 exact `T-[0-9]{3}`，不得带测试名称、AC 编号、slug 或字母后缀。tasks 生成阶段只定义计划契约，新增/变更 required behavior 默认应停留在 `planned`；apply 阶段负责执行同一个 Fixed Command，并更新 Evidence Status / Evidence Produced。
   - runtime provision graph：baseline-provided、provided-by-current-ac、consumed-by-current-ac、future-change-only、forbidden-boundary 的 row/provider/consumer 关系，以及 AC 拓扑顺序。
   - execution evidence targets：fixed commands、canonical `openspec-results/<change-slug>/<AC-ID>/<Test-ID>/` artifacts、browser/rendered artifacts、API/DB/job/storage/log/audit facts、runner/CI result/report 和 default-production-path proof。固定命令不得用 `pnpm test* -- ...` 透传 file/filter 作为 Test ID 级 selector；需要 selector 时使用 runner 直接命令、`pnpm exec vitest/playwright ...` 或专用 script。
9. 完成 change 选择、status / instructions 读取、context 解析、schema-specific preflight、common preflight、coverage gate 和进度展示后，才能分派 worker 或开始实现。
10. 在分派 worker 或开始实现前必须执行 Testing Quality Core plan audit：人工检查 `Test Layer Plan`、`Test Evidence Matrix`、`Regression Test Deposit`、默认路径、Test ID ownership、fixed command 和回归沉淀契约。plan audit 不要求 apply-owned execution evidence 已存在；若发现缺口，先修订 artifacts。

## Implementation + Acceptance Gates

1. **Gate 1 / Artifact 完整性**：`tasks.md` 必须包含 `## Acceptance-Driven Coverage`、三张 coverage 表、`## Runtime Acceptance Index`、所有 `AC-###` sections、后置 `## Verification Appendix` 六张 runtime/test 矩阵（包含 `Test Layer Plan` 和 `Test Evidence Matrix`），以及 `Regression Test Deposit`。两个生产 schema 的 Testing Quality Core（`Test Layer Plan`、verification evidence fields、`Test Evidence Matrix`、`Regression Test Deposit`）不可选。
2. **Gate 2 / AC-local contract 检查**：`production-obligation-atom-driven` 的每个 AC section 必须包含 `Source Atoms:`、`Projection:`、`Spec:`、`Design:`；`production-default-acceptance-driven` 的每个 AC section 必须包含 `Scope Items:`、`Artifact Handling:`、`Spec:`、`Design:`。两个 schema 的每个 AC 都必须包含 `Acceptance:`、`Runtime Rows Owned:`、`Test IDs:`、`Prerequisites:`、`Provides:`、`Consumes:`、`Start Gate:`、`No-Scope Boundary:`、`Primary Proof:`、`Required Evidence:`、`Mock / Fixture Boundary:`、`Mock Policy:`。
3. **Gate 3 / 覆盖检查**：GA schema 中每个 direct `GA-####` 必须在 `Obligation Atom Coverage` 中有一行，并带有与 proposal register 一致的 `Artifact Projection`。Default schema 中每个 material `SI-###` 必须在 `Scope Item Coverage` 中有一行，并带有与 proposal scope coverage 一致的 `Artifact Handling`。两个 schema 都禁止 ID ranges、aggregate rows、多 ID 单元格、orphan coverage 和 projection/handling mismatch。
4. **Gate 4 / Coverage task ID 解析检查**：三张 coverage 表中的每个 `Implementation Task IDs` 和 `Verification Task IDs` 必须解析到实际 checkbox task。每个 AC section 必须至少有一个 final verification / acceptance checkbox，并被 `Primary Proof`、`Required Evidence` 和相关 coverage rows 引用。
5. **Gate 5 / Runtime model 覆盖检查**：`Verification Appendix` 中每个 mandatory row 必须有 basis、scope role、provider/consumer ownership、AC ID、Test ID 和 no-scope-expansion check；每个 Test ID 必须绑定具体 covered row IDs，只能归属一个 exact `AC-###`，并且必须匹配 exact `T-[0-9]{3}`。fixed command、test file/name、evidence directory、execution artifacts、fixture boundary、Requires Tests Passed 和 CI runnable 状态只能在 `Test Evidence Matrix` 中定义。
6. **Gate 6 / AC dependency 拓扑检查**：每个 AC 的 `Consumes` 必须只能引用 baseline 或 earlier AC 在 `Provides` 中提供的 runtime rows / contracts / facts；`Depends On AC IDs` 必须排在当前 AC 之前；`Prerequisite Test IDs` / `Requires Tests Passed` 必须引用 earlier AC 的 Test IDs；不得存在循环依赖、future-change-only prerequisite、或只在 proof/fixed command 中隐式出现的 runtime dependency。
7. **Gate 7 / 永久回归与有意义测试检查**：两个生产 schema 的每个 required behavior Test ID 必须在 `Regression Test Deposit` 中有 `required` 或 `deposited` 行，除非写明 source/scope-backed `not-applicable` 理由。不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 enabled 或当前实现输出登记为 required behavior 的 primary proof 或永久回归 oracle。`Test Layer Plan` 中不得用 smoke/browser proof 替代可低层稳定断言的 unit/component/API/DB/security 等层级。
   - `unit` 只能证明纯规则/解析/映射/脱敏/状态机/adapter contract；状态机直调不是 component/browser。
   - `component` 必须 mount/render 到交互式 harness 并用用户事件证明组件状态；静态 markup、snapshot、reducer 或 state machine 直调不是 component primary proof。
   - `browser E2E` 必须使用真实 browser/context/page、navigation、用户动作和 rendered/readback assertion；没有 Playwright/WebDriver/Cypress 等 runtime marker 的 `tests/e2e/**` 文件不得算 browser E2E，直接 import route/repository/state machine 只能登记为对应低层或 supplemental proof。
   - route/API、DB/integration、worker/job、realtime/SSE、visual/responsive、security/negative、config/ops/check 必须分别证明实际 contract/DB/processor/event/render/security/config boundary；只证明 mock、fixture、私有 helper、静态文件存在或 broad command 通过是 blocker。
8. **Gate 8 / 任务级验证与 proof 检查**：worker 应优先按当前 AC-local `Test IDs`、任务 `Test IDs`、`Proof:`、test layer code requirements 和 regression deposit（若适用）建立或补齐对应验证。完成实现与验证后必须运行同一 Test ID 的唯一 `Fixed Command`，在 canonical evidence directory 产出 `command.log` 或 runner/CI result/report，并把 `Evidence Status`、`Evidence Produced` 和 deposit 状态更新回 `tasks.md`。当前 AC final verification / acceptance checkbox 勾选前必须执行 AC evidence audit：对照当前 AC 的 Test Evidence rows、Regression Test Deposit、canonical evidence directory 和 fixed command 结果，修复本 AC 所有 execution evidence / deposit 缺口。用户可见操作必须执行当前 schema 中定义的 runtime interaction / operation matrix proof；presence-only、static-only、API-only、implementation-detail 或 broad command proof 不得单独支撑勾选。
9. **Gate 9 / 默认路径与 no-mock 检查**：凡 task 涉及 Route Handler、auth、session、DB、AI/provider、storage、queue、SSE、worker、external service adapter、env/config 或 deployment wiring，proof 必须覆盖真实导出、default dependency 或 default config。mock、stub、dependency injection、Playwright route intercept、fixture-only、手工注入 EventSource、直接 DB seed 或 isolated unit test 只能作为补充，除非 runtime matrix 明确说明该 row 是 source-compatible deterministic path 且另有测试覆盖被替换的 production boundary。
10. **Gate 10 / 完成判定**：只有当 `tasks.md` 全部 checkbox 完成、三张 coverage 表、`Runtime Acceptance Index`、每个 AC-local contract、`Verification Appendix` 六张 runtime/test 矩阵、required evidence、canonical evidence directories、verification evidence、execution evidence、每个已完成 AC 的 AC evidence audit、`Regression Test Deposit`、全量 Testing Quality Core final audit、以及独立 `reviewer` subagent 复核结论都能回链到已完成任务和 proof，且 reviewer 返回 pass，才可称为 ready for archive。final audit 下不得存在 `planned`、缺失 execution evidence 或未闭合 deposit 的 required behavior。

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
   - 与该 AC 相关的 execution evidence targets、`Test Evidence Matrix` 定义的唯一 `Fixed Command`、canonical `openspec-results/<change-slug>/<AC-ID>/<Test-ID>/` evidence storage contract，以及 final verification / acceptance checkbox ID。
   - 允许修改的代码范围或模块边界。
   - 任务状态更新要求：worker 完成并验证自己 AC section 内任务后，必须把对应 checkbox 从 `- [ ]` 更新为 `- [x]`；未完成、未验证、proof 不足、default path 未证明或存在 blocker 的任务不得勾选。
8. 必须明确告知 worker：实现前按 schema 分支读取必要原始依据。GA schema 通过 linked `GA-####` 定点读取 registered source docs；default schema 通过 `SI-###` 对应的 proposal/spec/design baseline/input/code/spec trace 定点读取。若发现 context 冲突、任务边界不清、trace 缺失、proof 不可执行、task 弱于 proposal/spec/design/source 或 baseline，必须停止猜测并标明 blocker。
9. 必须明确告知 worker：它不是唯一开发者，不得回滚或覆盖其他 agent / 用户的改动；遇到重叠文件或冲突风险必须适配现有改动并在最终回复中说明。
10. 必须明确告知 worker：完成任务时要执行 AC-owned Test IDs 在 `Test Evidence Matrix` 中定义的唯一 fixed command。将该命令的 stdout/stderr 保存为 `openspec-results/<change-slug>/<AC-ID>/<Test-ID>/command.log`，或保存等价 runner/CI result/report，且 `<Test-ID>` 必须匹配 `T-[0-9]{3}`。`Evidence Status` 必须使用 `planned`、`passed`、`not-applicable`、`blocked` 等 schema 枚举；当前 AC final verification / acceptance checkbox 勾选前，worker 必须执行 AC evidence audit 并修复本 AC 所有 execution evidence / deposit 缺口。AC-005/final proof 只能消费已经通过各自 AC evidence gate 的前置 evidence，不得把 final gate 作为前置 AC 执行证据的首次 canonicalization 检查。`/tmp`、未复制的 runner 默认输出、agent 当场手工截图或口述路径不得作为最终 evidence。两个生产 schema worker 都必须按 `Test Layer Plan`、test layer code requirements、verification evidence fields 和 `Regression Test Deposit` 落实分层测试与永久回归测试；若 deposit 标记 `not-applicable` 或 `blocked`，必须给出 source/scope-backed 理由。

## Reviewer Subagent 复核

1. 所有 implementation `worker` subagent 自然返回完成且没有明确 blocker 后，必须启动一个独立 `reviewer` subagent 执行最终复核检验。这是所有任务实现后的固定环节，不得按任务规模、风险级别、速度、成本或主观判断跳过。
2. `reviewer` subagent 必须在所有 worker 结束后启动，且不得与 implementation worker 并行运行；若任一 worker 返回 blocker 或仍有未完成实现任务，先汇报 blocker，不得启动 reviewer。
3. 创建或启动 apply-stage `reviewer` subagent 时，必须显式指定 `model=GPT-5.5` 且 `reasoningEffort=xhigh`，并且不得降级。若当前运行环境无法创建 `GPT-5.5` / `xhigh` reviewer，必须暂停 apply 并向用户报告 blocker，不得由主 agent 替代复核。
4. 主 agent 启动 reviewer 时必须传入：change 名称、schema 名称、`contextFiles`、proposal/specs/design/tasks 路径、所有 worker 最终报告、worker 报告的改动范围、所有 AC/Test ID/execution evidence 路径、fixed commands、Regression Test Deposit 状态，以及 reviewer 需要复核的 coverage/runtime/test 矩阵路径。主 agent 不得为了准备 reviewer 输入而自行审查 diff、打开 evidence、重跑验证命令或预先判断 worker 结果是否可信。
5. reviewer 负责独立复核：检查代码 diff、artifacts、tasks checkbox、coverage/runtime/test 矩阵、execution evidence、Regression Test Deposit、固定验证命令结果、跨 AC 集成冲突、默认路径/no-mock 约束、verification evidence，并执行必要复核，包括每个已完成 AC 的 AC evidence audit 和全量 Testing Quality Core final audit；必要时可重跑 fixed commands。
6. reviewer 只输出复核报告和 pass/blocker 结论，不得直接修改代码、artifacts、checkbox、execution evidence 或测试文件。若发现 blocker，主 agent 只汇报 reviewer blocker；不得自行接手修复、替 worker 补 proof、替 reviewer 复验，除非用户在 blocker 汇报后明确要求继续处理。
7. 只有 reviewer 返回 pass，才可在最终汇报中声称复核通过或 ready to archive。reviewer 未运行、运行失败、无法满足模型/推理配置、或返回 blocker 时，不得声称 ready to archive。

## 主 Agent 职责

1. 主 agent 负责 orchestration：选择 change、读取 status / instructions、解析 context、按 AC section 串行分派 worker、逐个等待 worker 自然返回结果，在所有 worker 完成后启动 reviewer，并汇总 worker 与 reviewer 返回的完成状态、证据路径、验证命令结果和 blocker。
2. 主 agent 必须等待所有已分派 worker 的任务全部完成或明确 blocker；若全部 worker 完成且无 blocker，必须等待 reviewer 自然返回 pass 或 blocker 后，才能做最终汇总。worker 已声明完成的 AC section、checkbox、proof、evidence 和 fixed command 结果视为 worker 输出，reviewer 的 pass/blocker 视为最终复核输出；主 agent 不得再次复核、重测、审查 diff、重新跑验证命令、重新检查 execution evidence、重新执行 coverage/proof audit，或以主 agent 判断覆盖 worker/reviewer 的结论。
3. 任一 worker 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查未完成 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手实现。
4. 任一 reviewer 运行期间，主 agent 只能执行必要的编排等待和状态记录；不得读取新的实现上下文、审查 diff、运行新的验证命令、修改代码、修改 artifacts、勾选任务或接手复核。
5. 主 agent 不得打断、停止、关闭或要求正在运行的 worker/reviewer 提前回报。除非用户明确要求终止当前 apply 流程，否则必须等待 worker 自然返回最终完成或明确 blocker，并等待 reviewer 自然返回 pass 或明确 blocker。
6. worker 或 reviewer 返回明确 blocker 时，主 agent 只记录 blocker 并向用户汇报；不得自行接手修复、替 worker 补 proof、替 worker 勾选或取消 checkbox、替 reviewer 复验，除非用户在 blocker 汇报后明确要求主 agent 继续处理。
7. worker 或 reviewer 返回完成但摘要缺少路径、命令结果或 blocker 状态等汇总必需信息时，主 agent 可以要求同一个 subagent 补充说明；这不构成主 agent 复核，主 agent 不得自行打开文件或运行命令来补齐。

## 状态更新

1. task checkbox 由负责对应 AC section 的 worker 执行。
2. worker 只能勾选自己 section 内已经完成且满足 AC-level source/scope、projection/handling、No-Scope Boundary、Mock Policy、task `Proof`、linked spec scenario、linked design obligation/decision、default runtime path verification 和 AC/task override 约束的任务。
3. 主 agent 不核对 worker 已勾选任务是否可信，不复验 proof 是否充分，也不纠偏 worker 的勾选结果；worker 的 checkbox 更新和完成声明是该 AC section 的状态来源。
4. 不需要更新独立 acceptance status；AC 的通过状态由负责该 section 的 worker 完成声明、checkbox 更新、required evidence 产出和 worker 报告的 coverage 状态共同表示。

## 最终汇报

最终汇报必须包含：

- 已完成 AC sections 和任务。
- 每个 worker 的关键改动范围。
- worker 报告的 schema-aware `Acceptance-Driven Coverage` 状态。
- worker 报告的每个 AC 的 primary proof、required evidence、canonical evidence directories、execution evidence、截图/DOM/API/DB/job/log/audit 等证据。
- worker 执行的验证命令及结果。
- reviewer 的复核结论、复核命令及 pass/blocker 报告。
- 两个生产 schema 的永久回归测试沉淀：新增或更新的 test/spec 文件、最小回归命令、CI tier，以及明确不测试的实现细节边界。
- 未完成、被阻塞、未验证或需要用户决策的事项。

不得在所有 AC section proof 均由对应 worker 报告完成且 reviewer 返回 pass 前声称 ready to archive。
