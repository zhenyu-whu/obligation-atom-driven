# openspec-propose artifact 运行约束

当执行或触发 `openspec-propose`、`openspec-new-change`、`openspec-continue-change`、`openspec-ff-change` 或任何会创建/继续生成 OpenSpec change artifacts 的技能时，必须遵守以下约束。

本文档覆盖两个生产 schema：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。历史 change 如果在 `.openspec.yaml` 中显式声明其他旧 schema，可继续按该 change 自身 schema instructions 读取旧 artifacts；使用这两个生产 schema 的新 change 不得创建或依赖 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact。

## Artifact 中文约束

1. 创建或修改 OpenSpec artifacts 时，必须面向中文 reviewer；适用范围包括 `openspec/changes/**`、`openspec/specs/**` 以及由 schema template 生成的 artifact 内容。
2. 固定模板结构可以保持英文或原文，不需要也不应该强行翻译。这包括 artifact instruction / template 要求的固定标题、表头、字段名、trace block 字段名、规范关键字、ID、路径、代码/API/DB/package 标识、命令、文件名、模块名、函数名、类型名、枚举值，以及需要精确引用的源文档原文术语。
3. 上一条只豁免“固定字段或标识本身”，不豁免 agent 填写的解释性内容。凡是 agent 自己写入的句子、短语说明、表格单元格说明、trace block 字段值、proof、preserve、risk、verification、acceptance、design rationale、task description、Requirement 正文、Scenario 的 WHEN/THEN 条件与结果正文，都必须使用简体中文。
4. 技术英文术语可以作为标识或名词短语保留，但承载语义的句子必须中文化。允许写 `fixture loader`、`GET /api/health`、`pnpm -w check` 这类标识；不允许写 `Runtime checks prove default wiring` 这类英文解释句，应改为“运行时检查证明默认 wiring 可用”。
5. 表格判定规则：表头可以按 template 保持英文；表格中由 agent 填写的每个说明类单元格都按正文处理，必须中文。只有单元格内容完全由 ID、路径、代码标识、任务编号、capability 名称或源文档精确术语组成时，才可以保持英文或原文。
6. `tasks.md` 的 AC-level 字段 `Source Atoms:`、`Scope Items:`、`Projection:`、`Artifact Handling:`、`Spec:`、`Design:`、`Acceptance:`、`No-Scope Boundary:`、`Primary Proof:`、`Mock Policy:` 以及 task-level 字段 `Trace:`、`Runtime Rows:`、`Test IDs:`、`Acceptance:`、`Proof:`、`Overrides:` 可以保持英文；字段值必须中文，除非字段值只是固定 trace marker（例如 `inherits AC-###`）、ID、路径、代码标识、命令、projection/handling enum 或精确 requirement/scenario 名称。checkbox 后的任务标题属于 task description，必须中文。
7. specs artifact 中 OpenSpec 固定关键词和 heading 可保持 template 要求；Requirement 正文、Scenario 的 WHEN/THEN 条件与结果说明必须中文。Requirement / Scenario 名称若由 agent 新拟定，优先中文；只有需要精确引用已有英文规范名或源文档原文术语时才保留英文。
8. proposal / design / tasks artifact 的固定章节标题可保持 template 形式；Why、What、Impact、Design decisions、Risks、Open Questions、Alignment Gate、AC 说明、Proof、Mock Policy 等解释性正文必须中文。
9. 语言自查最低标准：把反引号中的代码/路径/命令/ID 暂时忽略后，每个由 agent 填写的自然语言句子仍应主要是简体中文；若剩余内容是一句英文或英文主导的说明，即判定为不合格。
10. 每生成或修订一个 artifact 后，写入它的 agent 必须做语言自查。OpenSpec 结构校验或 schema validate 通过，不等同于语言门禁通过。
11. 若 artifact instruction 或 template 要求保留英文结构标题，不得为满足中文约束改写这些固定标题；正文用中文填充即可。

## Schema Selection Gate

创建新 change 或为尚未存在的 change 生成 artifacts 前，必须先判定 propose input mode，并据此显式选择 schema。不要只依赖 `openspec/config.yaml` 的默认 `schema:`。

1. 如果用户没有提供明确 change 名、也没有提供任何实质性 change 描述、功能请求、修复请求或修改范围，选择 `production-obligation-atom-driven`，并进入“无显式 Change 名时的自动推断”流程。
2. 如果用户提供了任意明确 change 名、需求描述、bug fix、feature、follow-up modification、验收口径、代码/规格调整意图或其他实质性输入，选择 `production-default-acceptance-driven`。该分支不得读取 `openspec/orchestrate`、final change packet、change plan、global atom index 或 capability anchor packet。
3. 如果用户明确要求继续一个已存在 active change，先读取 `openspec status --change "<name>" --json` 或该 change 的 `.openspec.yaml`，按已有 `schemaName` / schema 继续，不得因为本轮输入形态改写已存在 change 的 schema。
4. 新建 change 时必须使用显式 schema：
   - 无输入自动推断分支：`openspec new change "<change-slug>" --schema production-obligation-atom-driven`
   - 有输入 default-style 分支：`openspec new change "<derived-or-provided-slug>" --schema production-default-acceptance-driven`
5. 创建或继续 change 后必须运行 `openspec status --change "<name>" --json`，确认 `schemaName` 与选择结果或既有 change schema 一致；若不一致，先修正 schema/config/change metadata，不得继续生成 artifacts。
6. 两个生产 schema 的 `applyRequires` 都只应包含 `tasks`，artifact 顺序都是 `proposal.md`、`specs/**/*.md`、`design.md`、`tasks.md`。如果新 change 的 status 仍要求 `source-truth`、`acceptance`、旧版 source coverage、`change-source-map` 或任何 proposal 前置 source artifact，说明 schema 未切换成功，必须先修复。
7. `context` 与 `rules` 是 agent 必须遵守的约束，不得复制进 artifact 正文。

## 无显式 Change 名时的自动推断

仅当 Schema Selection Gate 选择 `production-obligation-atom-driven` 时适用本节。

当用户触发 artifact 生成但没有提供明确 change 名、也没有提供足够明确的 change 描述时，不得立即询问用户“要做什么 change”。必须先根据已完成/已存在 change 和 `openspec/orchestrate/change-capability-anchors/index.md` 自动推断下一个应处理的 final planned change。

自动推断的第一门禁是 active/archive 状态盘点。不得只看 final packet index 的第一行，也不得只依赖 `openspec list --json` 的 active 列表；必须同时检查 `openspec/changes/` 下的 active change 目录和 `openspec/changes/archive/` 下的归档目录后，才能决定下一个目标。

推断流程：

1. 读取 `openspec/orchestrate/change-capability-anchors/index.md`，按 final packet index 的表格顺序提取 final changes；如果 index 显式提供 `Order` 列，则按 `Order` 排序。推断出的 change 名必须使用 index 中的 exact slug，不得自行改名。
2. 在读取候选 packet 或执行 `openspec new change` 前，先建立完整状态盘点：
   - 运行 `openspec list --json`，记录 CLI 返回的 active changes。
   - 扫描 active change 目录：`find openspec/changes -mindepth 1 -maxdepth 1 -type d ! -name archive -print`。
   - 扫描 archive change 目录：`find openspec/changes/archive -mindepth 1 -maxdepth 2 -name .openspec.yaml -print`；不得使用会漏掉 `openspec/changes/archive/<archive-dir>/.openspec.yaml` 的过浅搜索。
   - 对每个 archive 目录，优先读取 `.openspec.yaml` 中的 change name；如果文件不含名称，则用目录名去除日期前缀 `YYYY-MM-DD-` 后匹配 final packet index 的 exact slug。历史归档目录可能带日期前缀，不能因此视为未完成。
   - 将 CLI active 列表、active 目录列表和 archive 目录列表合并成一份 per-slug inventory；如果三者不一致，必须以文件系统实际目录为准，并把不一致作为推断说明或 blocker。
3. 只对 final packet index 中存在的 planned changes 做分类，不得把 archive 或 active 中的非 planned change 自动加入本轮目标：
   - `completed`: 存在匹配 slug 的 archive 目录；该状态优先于“未在 active 列表中出现”。已归档 change 不得再次 propose。
   - `active-incomplete`: `openspec/changes/<change-slug>/` 存在，且 `openspec status --change "<change-slug>" --json` 显示 apply-ready artifacts 尚未完成，或 tasks/implementation 尚未完成。
   - `active-apply-ready`: `openspec/changes/<change-slug>/` 存在，且 apply-required artifacts 已完成，但该 change 尚未归档。
   - `not-started`: 没有匹配 archive 目录，也没有 active change 目录。
   - `state-conflict`: 同一个 planned change 同时存在匹配 archive 目录和 active 目录，或 CLI active 列表、active 目录、archive 目录给出相互矛盾的状态。
4. 如果任一 planned change 被分类为 `state-conflict`，不得继续创建或选择后续 change。必须报告冲突路径、推断出的 slug 和建议清理动作；只有用户明确要求清理或继续时，才处理该冲突。
5. 按 final packet index 顺序寻找最早的未完成 planned change：
   - 若最早未完成项是 `active-incomplete`，继续该 change 的 artifact 生成，不创建重复目录。
   - 若最早未完成项是 `active-apply-ready`，不得自动跳到后续 change；报告该 change 已 propose 完成，下一步应 apply 或 archive。只有用户明确要求并行规划后续 change 时，才允许继续推断下一个 `not-started` change。
   - 若最早未完成项是 `not-started`，自动选择它作为本次 propose 目标，并继续后续 packet/atom 校验；只有在校验通过后才执行 `openspec new change "<change-slug>"`。
6. 选定目标后，读取该 change 的 final packet：`openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md`，确认 packet 存在且没有 blocker。
7. 读取 `openspec/orchestrate/change-capability-anchors/obligation-atom-index.md`，确认目标 packet 中的 direct atoms 均能回链到全局 atom 注册表，并能取得或保守推断 artifact projection；最终 direct scope 和 artifact projection 以 final packet 为准。
8. 只有需要核对 dependencies 或 final packet index 信息不足时，才读取 `openspec/orchestrate/change-plan.md`；它不得覆盖 final packet。
9. 如果无法可靠判断 completed / active / archive 状态，或多个候选同等合理，才向用户提出一个简短澄清问题，并列出候选 change slug、active/archive 路径与阻塞原因。

推断门禁：

- 自动推断只能选择 final packet index 中已存在的 planned change。
- 自动推断必须先完成 active/archive inventory；未读取 archive 目录时，不得把 final packet index 中靠前的 change 判定为 `not-started`。
- 自动推断不得跳过尚未完成的 dependency。若候选 change 的 `Dependencies:` 指向的 planned change 未完成或未归档，必须选择依赖链上最早未完成的 change，或报告 blocker。
- 如果候选 change 缺少 `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md`，不得自动 propose，必须报告 final change packet 缺失。
- 如果候选 packet 中存在 direct atom 但 `obligation-atom-index.md` 查不到对应 `GA-####`，不得自动 propose，必须报告 atom index 与 change packet 不一致。
- 如果 archive 中已经存在目标 slug，绝不得再次运行 `openspec new change "<change-slug>"`；若 active 目录也存在同名 slug，先按 `state-conflict` 处理。

## Production Obligation Atom Driven 入口

仅当 Schema Selection Gate 选择 `production-obligation-atom-driven`，或既有 change 的 schemaName 为 `production-obligation-atom-driven` 时适用本节。

1. 严格执行 artifact 生成技能原有流程，但在创建 change 前必须先完成 change 目标解析：若用户未提供明确目标，按“无显式 Change 名时的自动推断”选择目标；若用户提供的目标不在 final packet index 中，按 Obligation Atom 输入契约报告目标超出当前 canonical change contract，而不是自行扩展 scope 或要求新的 proposal 前置 source artifact。
2. 创建或继续目标 change 后，运行 `openspec status --change "<name>" --json`、按 artifact dependency graph 读取依赖、对每个 ready artifact 运行 `openspec instructions <artifact-id> --change "<name>" --json`。
3. 当前分支 schema 必须为 `production-obligation-atom-driven`。该 schema 的 artifact 顺序为：
   - `proposal.md`
   - `specs/**/*.md`
   - `design.md`
   - `tasks.md`
4. `applyRequires` 只应包含 `tasks`。如果新 change 的 status 仍要求 `source-truth`、`acceptance`、旧版 source coverage、`change-source-map` 或任何 proposal 前置 source artifact，说明 schema 未切换成功，必须先修复 schema/config，而不是继续生成旧 artifacts。
5. `context` 与 `rules` 是 agent 必须遵守的约束，不得复制进 artifact 正文。

## Production Default Acceptance Driven 入口

仅当 Schema Selection Gate 选择 `production-default-acceptance-driven`，或既有 change 的 schemaName 为 `production-default-acceptance-driven` 时适用本节。

1. 严格执行 artifact 生成技能原有流程，但创建 change 前必须从用户输入派生或读取明确的 kebab-case change slug。若用户只给自然语言描述，按该描述派生 slug；若输入仍无法判断 change boundary，才提出一个简短澄清问题。
2. 新建 change 必须运行 `openspec new change "<name>" --schema production-default-acceptance-driven`。如果同名 active change 已存在，读取其 status 并继续；不得创建重复目录。
3. 创建或继续目标 change 后，运行 `openspec status --change "<name>" --json`、按 artifact dependency graph 读取依赖、对每个 ready artifact 运行 `openspec instructions <artifact-id> --change "<name>" --json`。
4. 当前分支 schema 必须为 `production-default-acceptance-driven`。该 schema 的 artifact 顺序为：
   - `proposal.md`
   - `specs/**/*.md`
   - `design.md`
   - `tasks.md`
5. 本分支不消费 `openspec/orchestrate`、`change-plan.md`、final change packet、`obligation-atom-index.md` 或 capability anchor packet；不得创建 `GA-####` register，也不得把 `SI-###` 当作全局 source ID。
6. proposal 的主要输入是用户请求、现有 `openspec/specs/`、现有代码、当前产品行为，以及用户显式提供的 issue、设计稿、外部文档或调研结论。不得要求 proposal 前置 artifact。
7. `applyRequires` 只应包含 `tasks`。如果 status 仍要求 `source-truth`、`acceptance`、旧版 source coverage、`change-source-map` 或任何 proposal 前置 source artifact，说明 schema 未切换成功，必须先修复 schema/config/change metadata。
8. `context` 与 `rules` 是 agent 必须遵守的约束，不得复制进 artifact 正文。

## Obligation Atom 输入契约

1. 不创建、不读取、不要求任何 proposal 前置 source artifact。`proposal.md` 是第一个标准 artifact，并且只能通过最小权威读集消费当前已存在的 canonical change packet 与 global atom index。
2. Canonical change contract：当前 Phase 4 final change packet `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md` 是 proposal 的唯一内容权威。它独占定义本 change 的 direct scope、capability 归属、artifact projection、contextual/preserve/non-goal guard、upstream realized baseline、downstream constraints、evidence burden 和 blockers。
3. Lookup table：`openspec/orchestrate/change-capability-anchors/obligation-atom-index.md` 只用于校验 `GA-####` 存在，并按 atom id 补齐 source trace 字段、artifact projection 和 focused source-window read 所需的 `Source Document` + `Lines`。它不得覆盖 final change packet 的 direct scope、artifact projection 或 capability 归属。
4. Discovery gates：
   - 读取 `openspec/orchestrate/change-capability-anchors/index.md`，确认目标 change 存在、packet path 存在。
   - 只有在用户未提供明确 change、需要按 roadmap 顺序自动推断、或需要核对 dependency 顺序时，才读取 `openspec/orchestrate/change-plan.md`。`change-plan.md` 不得覆盖 final change packet。
5. Optional grouping aids：只有当 final packet 或 schema 写作需要拆分 spec file 时，才读取当前 change 下的 `capability-anchors/<capability>.md`。这些 capability view 只能辅助 capability 分组，不得覆盖 final change packet。
6. Audit/debug evidence：除 canonical change packet、global atom index 和必要 capability views 外，其他 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。不得从这些文件新增、删除、移动、重判 direct atom，也不得用它们扩展 final packet 之外的 scope。
7. 若用户请求不是 final packet index 中的 change，必须报告目标超出当前 canonical change contract，而不是在 proposal 中扩展范围或要求新的 proposal 前置 source artifact。
8. proposal 必须为 final packet 中每个 `Direct Owning Atoms` 行建立 `Change Atom Coverage Register` 行，直接引用 exact `GA-####`，记录 `Artifact Projection` 和 `Projection Source`，不重新编号，不使用 ranges。
9. proposal 生成时必须对每个 direct atom 定点重读 `obligation-atom-index.md` 中记录的 `Source Document` + `Lines`。对 contextual、explicit-non-goal、contextual-preserve、prototype-only-not-production 等 non-direct atoms，只在需要保留精确边界、避免误扩 scope 或确认 proof 语义时定点重读。
10. proposal 必须记录 `Source Window Read Set`，列出被重读的 `GA-####`、source path、line range、重读目的和 interpretation result。
11. downstream artifacts 只能通过 proposal register 中的 exact `GA-####`、source document 和 line range 定点读取原始 docs。不得重新做全量 source extraction，不得从 source line range 直接发明新的 direct atom。

## Obligation Proposal 门禁

1. proposal 必须包含 `Change Atom Coverage Register`，且每个 direct atom 正好对应一个 `GA-####` register row。
2. proposal 必须保留 global atom / packet row 的 `Source Document`、`Lines`、`Atom Type`、`Source Fact`、`Normativity`、`Coverage Status`、`Artifact Projection`、final packet `Capability`、`Propose Use` 和 `Evidence Need`。
3. proposal 必须将 `direct`、`contextual`、`contextual-preserve`、`explicit-non-goal`、`prototype-only-not-production`、`non-production`、`blocked` 等 atom 状态分别处理，不能把上下文、排除项或 prototype-only atom 误转成实现 scope。
4. proposal 的 `Capabilities` 必须匹配 final change packet 中的 capability atom views；除非 packet 明确记录非阻塞 gap 或 blocker。
5. 每个 direct atom 必须有 downstream coverage expectation，并且必须匹配 artifact projection：`spec-requirement` 进入 requirement/scenario；`spec-guard` 进入 guard/gate/non-goal；`design-obligation` 必须进入 design artifact；`verification-obligation` 必须进入 tasks/proof；`contextual-only` 只允许作为非 direct context/guard。final packet 的 direct row 不得使用 `contextual-only`；若出现，必须改入 context/non-direct handling 或记录 blocker。不能留下 orphan direct atom。
6. proposal 不得因为 atom 是 direct 就自动要求 specs 生成 requirement/scenario。旧 packet 缺少 projection 时，必须按 schema 的 legacy inference 保守推断并记录 `Projection Source: inferred-from-legacy-packet`；无法推断则 blocker。
7. proposal alignment gate 必须声明 proposal input mode、change slug、global atom index、change packet、capability atom view files、direct atoms、artifact projection coverage、contextual/preserve/non-goal atoms、source windows re-read、orphan direct atoms、capability increment coverage 和 blockers。

## Obligation Specs / Design 门禁

1. specs 必须从 proposal register 和 per-change capability atom view file 生成；每个 requirement/scenario 必须列出 exact `GA-####` 和 concrete `Source Trace`。
2. specs 不得使用 `GA-0001-GA-0010`、`GA-0001..GA-0010`、`GA-0001 through GA-0010` 等范围。
3. specs 的 Requirement / Scenario 名称若非源文档固定术语，优先使用中文。
4. specs 生成前必须建立 capability-to-atom map 和 artifact-projection map。只有 `spec-requirement` direct atom 必须落到 requirement/scenario；`spec-guard` 作为 guard/gate/non-goal；`design-obligation` 和 `verification-obligation` 不得伪造成 scenario，也不得为了 handoff 单独创建空 spec。只有当同一 capability 已经因为 `spec-requirement` 或 `spec-guard` 生成有效 delta spec 时，才可在该 spec 的 `Artifact Projection Notes` 或 gate 中点名 handoff；纯 design/verification-only capability 的 closure 必须在 design/tasks coverage 中完成。
5. 每个 spec 的 Production Alignment Gate 必须列出 `Artifact Projection coverage` 和 `Orphan direct atoms: none`，或列出 blocker。
6. design 必须把 proposal/spec 中需要设计消费的 `GA-####` 落到可执行实现义务，包括 module、data/API、auth/security、worker/realtime、frontend/UX、ops/deployment 和 verification。
7. design 生成前必须建立 design atom matrix。每个 `design-obligation` direct `GA-####`、需要 design placement 的 `spec-requirement`、`spec-guard` 和每个 in-scope spec scenario 必须映射到至少一个 design obligation、guard handling 或 explicit blocker。
8. 如果 obligation atom 只定义行为、不定义实现形态，design 可以选择最小 source-compatible 技术形态，但必须标注为 source-backed implementation decision，记录 source gap、选择的最小技术形态、对应 `GA-####`、以及拒绝的 scope-expanding alternatives。

## Obligation Acceptance-Driven Tasks 门禁

1. 不生成独立 `acceptance.md`。`tasks.md` 是实现计划和验收合同。
2. tasks 必须按 `## AC-### <name>` 分组。每个 AC section 必须有 `Acceptance:`、`Source Atoms:`、`Projection:`、`Spec:`、`Design:`、`Runtime Rows Owned:`、`Test IDs:`、`No-Scope Boundary:`、`Primary Proof:`、`Required Evidence:`、`Mock / Fixture Boundary:`、`Mock Policy:`。
3. tasks 生成 AC 前必须建立 runtime provision graph，区分 baseline-provided、provided-by-current-ac、consumed-by-current-ac、future-change-only 和 forbidden-boundary；AC sections 必须按该 graph 拓扑排序生成。
4. 如果某个 AC 的 Primary Proof、Required Evidence 或 fixed command 需要 current-change 内尚未由 baseline 或 earlier AC 提供的 API、DB、repository、auth、route、worker、queue、provider、storage、config 或 runtime state，必须在生成阶段重排、合并 AC、把 provider work 内联到该 AC，或生成更早的 provider AC；不得把后置依赖留到 apply 阶段。
5. 每个 AC section 必须额外包含 `Prerequisites:`、`Provides:`、`Consumes:`、`Start Gate:`。`Prerequisites` 只能引用 baseline 或 earlier AC/Test IDs；`Provides` 说明本 AC 完成后提供给后续 AC 的 runtime rows/contracts/facts；`Consumes` 说明本 AC proof 消费的 baseline 或 earlier AC rows/contracts/facts；`Start Gate` 用中文写明进入该 AC 的执行门禁。
6. AC heading 的 `<name>` 和 checkbox task description 必须使用中文，除非它们完全是固定 ID、路径、命令或源文档精确术语。
7. 每个 checkbox task 必须只包含 `Trace:`、`Runtime Rows:`、`Test IDs:`、`Acceptance:`、`Proof:`、`Overrides:` trace 字段；默认通过 `Trace: inherits AC-###` 继承 owning AC 的 `Source Atoms:`、`Projection:`、`Spec:`、`Design:`、`No-Scope Boundary:` 和 `Mock Policy:`。只有 task 相对 owning AC 有更窄 scope 或例外时，才在 `Trace:` 或 `Overrides:` 中写明 exact override，不要机械重复 AC-level 字段。
8. `tasks.md` 必须包含 `## Acceptance-Driven Coverage`，并按顺序包含三张非 checkbox 表：
   - `### Obligation Atom Coverage`
   - `### Requirement / Scenario Coverage`
   - `### Design Obligation Coverage`
9. 每个 direct atom 必须按 artifact projection 有 implementation task、design handoff、guard handling 或 verification/acceptance proof，除非该 atom 在 proposal 中被 source-backed 改判为 blocker、deferred、non-goal 或 guard。
10. `Obligation Atom Coverage` 必须包含 `Artifact Projection` 列；`Requirement / Scenario Coverage` 和 `Design Obligation Coverage` 必须体现 projection handling，且不得为纯 `design-obligation` 或 `verification-obligation` atom 伪造 scenario。
11. `Obligation Atom Coverage` 每行只能包含一个 `GA-####`，不得使用 aggregate row、range 或多 ID 单元格。
12. 三张 coverage 表中的每个 `Implementation Task IDs` 和 `Verification Task IDs` 必须解析到实际 checkbox task ID。只引用 AC heading 不足以作为 executable proof；需要显式 final verification / acceptance checkbox。
13. 每个 AC section 必须至少有一个 final verification / acceptance checkbox，并在 `Primary Proof`、`Required Evidence` 和相关 coverage rows 中被引用。
14. 每个 Test ID 必须使用 exact `T-###`（三位数字，例如 `T-001`，可用 `T-000` 表示 repository/runtime support），在整个 change 内唯一且只归属一个 AC。禁止把 AC 编号、测试名称、slug、字母后缀或描述性文本写入 Test ID；语义应写入 `Test File / Name`、`Layer`、`Covers Rows`、`Evidence Produced` 或 ledger。
15. tasks 必须定义每个 AC 的 evidence ledger expectation，包括 commands、browser/rendered artifacts、API/DB/job/storage/log/audit facts、default-production-path proof。
16. Proof 必须达到验收强度：用户可见行为需要 browser/rendered evidence；后端/data/worker/storage/security 行为需要 API、DB、job、asset、log、audit 或 authorization facts；默认生产路径不能只用 mock 或 isolated unit test 证明。
17. Final task 自查必须确认 AC section 输出顺序满足 runtime provision graph：没有 consumer AC 依赖后置 provider AC，没有循环依赖，没有 future-change-only prerequisite，也没有只藏在 proof/fixed command 中的隐式 runtime dependency。

## Default Acceptance 输入契约与门禁

以下规则仅适用于 `production-default-acceptance-driven`。

1. proposal 必须包含 `Change Scope Coverage`，并为每个 material scope item 分配 change-local `SI-###`。`SI-###` 只在本 change 内有效，不得跨 change 复用，也不得当作 source document 的全局 ID。
2. `Change Scope Coverage` 的每个 material row 必须包含 `Artifact Handling`，允许值为 `spec`、`guard`、`design`、`proof`、`context`。每个非 context scope item 必须有 downstream coverage expectation。
3. proposal 必须记录 `Baseline / Input Read Set`，说明读取了哪些用户输入、existing specs、代码路径、测试、配置、路由/API 或外部输入；若没有外部来源，必须说明 scope 来自用户请求。
4. proposal 不得读取或依赖 `openspec/orchestrate`、final packet、global atom index、capability anchor packet；不得生成 `Change Atom Coverage Register` 或 `Source Window Read Set`。
5. specs 必须读取 proposal 的 `Change Scope Coverage`，并只为包含 `Artifact Handling: spec` 或 `Artifact Handling: guard` 的 capability 创建 delta spec。只有 `design`、`proof` 或 `context` scope item 时不得创建空 spec。
6. 每个 requirement 必须包含 `Scope Items:` bullets，列出 exact `SI-###` 和简短 scope 摘要；每个 requirement 必须包含 `Baseline Trace:` bullets，列出用户输入、existing spec、代码路径、路由/API、数据表、配置、测试或外部输入来源。
7. specs 不得使用 `SI-001-SI-010`、`SI-001..SI-010` 或类似 range；必须枚举 exact IDs。
8. design 必须使用 proposal 的 `Change Scope Coverage`、spec `Scope Items` 和 `Baseline Trace` 作为 scope-reading interface。每个 spec scenario、每个 `Artifact Handling: design` item、每个 guard item 以及每个需要 implementation placement 的 material scope item，都必须映射到 design decision、guard handling 或 explicit blocker。
9. tasks 必须按 `## AC-### <name>` 分组。每个 AC section 必须包含 `Acceptance:`、`Scope Items:`、`Artifact Handling:`、`Spec:`、`Design:`、`Runtime Rows Owned:`、`Test IDs:`、`Prerequisites:`、`Provides:`、`Consumes:`、`Start Gate:`、`No-Scope Boundary:`、`Primary Proof:`、`Required Evidence:`、`Mock / Fixture Boundary:`、`Mock Policy:`。
10. `tasks.md` 必须包含 `## Acceptance-Driven Coverage`，并按顺序包含三张非 checkbox 表：
   - `### Scope Item Coverage`
   - `### Requirement / Scenario Coverage`
   - `### Design Decision Coverage`
11. `Scope Item Coverage` 每行只能包含一个 exact `SI-###`，不得使用 aggregate row、range 或多 ID 单元格。每个 material scope item 必须按 artifact handling 映射到 AC section、implementation task、verification task、guard/design handoff 或 proof。
12. 三张 coverage 表中的每个 `Implementation Task IDs` 和 `Verification Task IDs` 必须解析到实际 checkbox task。只引用 AC heading 不足以作为 executable proof；需要显式 final verification / acceptance checkbox。
13. 每个 checkbox task 必须只包含 `Trace:`、`Runtime Rows:`、`Test IDs:`、`Acceptance:`、`Proof:`、`Overrides:` trace 字段。`Trace: inherits AC-###` 表示继承 owning AC 的 `Scope Items:`、`Artifact Handling:`、`Spec:`、`Design:`、`No-Scope Boundary:` 和 `Mock Policy:`。
14. 每个 Test ID 必须使用 exact `T-###`，在整个 change 内唯一且只归属一个 AC。禁止把 AC 编号、测试名称、slug、字母后缀或描述性文本写入 Test ID。
15. `tasks.md` 必须包含 `## Runtime Acceptance Index`、所有 `AC-###` sections、后置 `## Verification Appendix` 五张 runtime/test 矩阵，以及 `### Regression Test Deposit`。`Regression Test Deposit` 是永久回归测试文件、最小回归命令、behavior contract、assertion oracle、fixture boundary、CI tier、Not Testing 边界和 deposit status 的唯一事实来源。
16. 每个 required behavior Test ID 必须在 `Regression Test Deposit` 中有永久回归沉淀或 scope-backed `not-applicable` 理由。不得把私有 helper、mock 调用次数、非契约 DOM 层级、className、快照全文、`data-testid` 存在、按钮 enabled 或当前实现输出登记为 required behavior 的 primary proof 或永久回归 oracle。
17. Proof 必须达到验收强度：用户可见行为需要 user-equivalent interaction 与 browser/rendered evidence；API/data/worker/storage/security 行为需要对应 contract、DB/job/asset/log/audit 或 authorization facts；默认生产路径不能只用 mock 或 isolated unit test 证明。
18. Final task 自查必须确认 AC section 输出顺序满足 runtime provision graph：没有 consumer AC 依赖后置 provider AC，没有循环依赖，没有 future-change-only prerequisite，也没有只藏在 proof/fixed command 中的隐式 runtime dependency。

## Artifact 生成自查

每个 artifact 写入后，必须执行对应的结构自查，而不是只依赖 OpenSpec CLI 格式校验：

1. 全部 artifacts：按“Artifact 中文约束”做语言自查；忽略反引号中的标识后，不得存在英文主导的解释性句子；checkbox task description 必须中文。
2. `production-obligation-atom-driven` / `proposal.md`：packet direct atom 数量 = proposal register row 数量；每行有 `Artifact Projection` 和 `Projection Source`；direct atoms 均已出现在 `Source Window Read Set`；无 orphan direct `GA-####`；无 GA ranges。
3. `production-default-acceptance-driven` / `proposal.md`：`Change Scope Coverage` 覆盖每个 material scope item；每个非 context `SI-###` 有 `Artifact Handling` 和 downstream coverage expectation；`Baseline / Input Read Set` 已记录；无 `GA-####` register、无 orchestrate 依赖、无 SI ranges。
4. `production-obligation-atom-driven` / specs：只为有 OpenSpec delta 的 capability 生成 `specs/<capability>/spec.md`；每个生成的 spec file 必须至少包含一个 `### Requirement:`，且不得只包含 `Artifact Projection Notes` 或“无”。proposal direct `GA-####` 按 artifact projection 映射到 requirement/scenario、guard、已有 delta spec 的 `Artifact Projection Notes` 或 design/tasks coverage；handoff 不能替代后续 design/tasks 的实际消费；每个 scenario 有 exact `Source Atoms` 和 concrete `Source Trace`；无 spec-level orphan direct `GA-####`；无 GA ranges。
5. `production-default-acceptance-driven` / specs：只为有 `Artifact Handling: spec` 或 `guard` 的 capability 生成 delta spec；每个 generated spec 至少包含一个 `### Requirement:`；每个 requirement 有 exact `Scope Items:` 和 `Baseline Trace:`；无 spec-level orphan `SI-###`；无 SI ranges；不为 design/proof/context-only scope 创建空 spec。
6. `production-obligation-atom-driven` / `design.md`：每个 in-scope scenario、`design-obligation` atom 和需要 design placement 的 direct `GA-####` 有 design obligation 或 guard handling；source-backed implementation decisions 记录 source gap、最小技术形态和 rejected expansion；无需要 implementer 猜测的行为。
7. `production-default-acceptance-driven` / `design.md`：每个 in-scope scenario、`Artifact Handling: design` item、guard item 和需要 implementation placement 的 material `SI-###` 有 design decision、guard handling 或 explicit blocker；production-compatible implementation decisions 记录最小技术形态和避免 scope expansion 的理由；无需要 implementer 猜测的行为。
8. `production-obligation-atom-driven` / `tasks.md`：三张 coverage 表完整且 projection-aware；`Obligation Atom Coverage` 单行单 GA；所有 task ID 引用都能解析到 checkbox；每个 Test ID 都匹配 exact `T-[0-9]{3}` 且 canonical evidence directory 使用同名最后一级目录；每个 AC 有 final verification checkbox；每个 AC 有 evidence ledger expectation；每个 AC 有 Prerequisites/Provides/Consumes/Start Gate；AC section 顺序满足 runtime provision graph；无 GA ranges、无 aggregate row、无 orphan direct atom、无 projection mismatch、无后置 provider dependency。
9. `production-default-acceptance-driven` / `tasks.md`：三张 coverage 表完整且 handling-aware；`Scope Item Coverage` 单行单 `SI-###`；所有 task ID 引用都能解析到 checkbox；每个 Test ID 都匹配 exact `T-[0-9]{3}` 且 canonical evidence directory 使用同名最后一级目录；每个 AC 有 final verification checkbox；每个 AC 有 evidence ledger expectation；每个 required behavior Test ID 有 `Regression Test Deposit` 永久回归沉淀或 scope-backed 不适用理由；每个 AC 有 Prerequisites/Provides/Consumes/Start Gate；AC section 顺序满足 runtime provision graph；无 SI ranges、无 aggregate row、无 orphan scope item、无 handling mismatch、无后置 provider dependency、无 implementation-detail tests 作为 required behavior oracle。

## Legacy Schema 兼容

1. 如果打开的是历史 change，且 `openspec status --change "<name>" --json` 返回的 `schemaName` 不是 `production-obligation-atom-driven` 或 `production-default-acceptance-driven`，可继续按该 change 自身 schema 的 artifacts 和 instructions 处理。
2. 不得把 `source-truth.md`、独立 `acceptance.md`、旧版 source coverage artifact、`change-source-map.md` 或任何 proposal 前置 source artifact 要求带入两个生产 schema 的新 change。
