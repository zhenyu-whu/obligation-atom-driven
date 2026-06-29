# openspec-propose artifact 运行约束

当执行或触发 `openspec-propose`、`openspec-new-change`、`openspec-continue-change`、`openspec-ff-change` 或任何会创建/继续生成 OpenSpec change artifacts 的技能时，必须遵守以下约束。

本文档覆盖两个生产 schema：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。使用这两个生产 schema 的新 change 必须生成 `verification.md`。

## Artifact 中文约束

1. 创建或修改 OpenSpec artifacts 时，必须面向中文 reviewer；适用范围包括 `openspec/changes/**`、`openspec/specs/**` 以及由 schema template 生成的 artifact 内容。
2. 固定模板结构可以保持英文或原文，不需要也不应该强行翻译。这包括 artifact instruction / template 要求的固定标题、表头、字段名、trace block 字段名、规范关键字、ID、路径、代码/API/DB/package 标识、命令、文件名、模块名、函数名、类型名、枚举值，以及需要精确引用的源文档原文术语。
3. 上一条只豁免“固定字段或标识本身”，不豁免 agent 填写的解释性内容。凡是 agent 自己写入的句子、短语说明、表格单元格说明、trace block 字段值、proof、preserve、risk、verification、acceptance、design rationale、task description、Requirement 正文、Scenario 的 WHEN/THEN 条件与结果正文，都必须使用简体中文。
4. 技术英文术语可以作为标识或名词短语保留，但承载语义的句子必须中文化。允许写 `fixture loader`、`GET /api/health`、`pnpm -w check` 这类标识；不允许写 `Runtime checks prove default wiring` 这类英文解释句，应改为“运行时检查证明默认 wiring 可用”。
5. 表格判定规则：表头可以按 template 保持英文；表格中由 agent 填写的每个说明类单元格都按正文处理，必须中文。只有单元格内容完全由 ID、路径、代码标识、任务编号、capability 名称或源文档精确术语组成时，才可以保持英文或原文。
6. `tasks.md` 的 AC-level 字段 `Outcome:`、`Start Gate:`、`Runtime Rows:`、`Resolved Runtime Contract:`、`Implementation Scope:`、`Preserve:`、`Proof Contract:` 以及 task-level 字段 `Runtime Rows:`、`Acceptance:`、`Preserve:`、`Proof:`、`Mock / Default Path Policy:` 可以保持英文；字段值必须中文，除非字段值只是 ID、路径、代码标识、projection/handling enum 或精确 requirement/scenario 名称。checkbox 后的任务标题属于 task description，必须中文。
7. specs artifact 中 OpenSpec 固定关键词和 heading 可保持 template 要求；Requirement 正文、Scenario 的 WHEN/THEN 条件与结果说明必须中文。Requirement / Scenario 名称若由 agent 新拟定，优先中文；只有需要精确引用已有英文规范名或源文档原文术语时才保留英文。
8. proposal / design / tasks artifact 的固定章节标题可保持 template 形式；Why、What、Impact、Design decisions、Risks、Open Questions、Alignment Gate、AC 说明、Proof Contract、Mock / Default Path Policy 等解释性正文必须中文。
9. 内部语言检查最低标准：把反引号中的代码/路径/命令/ID 暂时忽略后，每个由 agent 填写的自然语言句子仍应主要是简体中文；若剩余内容是一句英文或英文主导的说明，即判定为不合格。
10. 语言检查是写入前的内部门禁，不是 artifact 内容。不得在任何 artifact 中生成独立的语言检查、自检 section 或 checklist。
11. 若 artifact instruction 或 template 要求保留英文结构标题，不得为满足中文约束改写这些固定标题；正文用中文填充即可。

## Trace-First Delivery Plane / JSON Trace Plane

1. 两个 production schema 的所有 artifact 都必须采用 Delivery Plane + JSON Trace Plane 布局。
2. writer 写 artifact 前必须先建立或更新当前 artifact 的 canonical JSON trace sections。writer/repair-writer 不得直接写 Markdown Delivery Plane；必须先写入 trace/proof-slices sidecar，再调用 `node openspec/agent-runtime/scripts/render-production-artifacts.mjs --change "<change-slug>" --artifact "<artifact-id>" [--capability "<capability>"] --write` 从 trace deterministic 渲染 Markdown、Trace Appendix 和 manifest digest。
3. writer/repair-writer 在渲染前必须基于 JSON trace 做 set-diff 自查：source/scope item、spec scenario、design obligation、runtime row、Proof Slice、AC 和 task projection 不得缺失、重复、跨类型引用或出现 orphan；自查结论不得写入 artifact 正文。
4. artifact 主体是 Delivery Plane，只承载 reviewer、implementer 或 tester 直接消费的交付契约。
5. JSON trace 是唯一 canonical trace；完整 coverage、source/scope trace、runtime projection、reconciliation、alignment gate 和 archive/preflight 审计信息必须写入 `trace/*.trace.json`，不得双写为 Markdown trace 表格。
6. 每个 artifact 末尾必须保留短 `## Trace Appendix` pointer block，且它只能包含 `Trace file`、`Trace schema`、`Trace digest`。不得在 pointer 后追加任何其它 artifact section。
7. `trace/manifest.json` 必须从 proposal 阶段起登记当前阶段已生成的 trace 文件、artifact path、trace schema 和 digest，并写入 `trace-contract-version: "proof-slices-v1"` 与 `render-contract-version: "trace-render-v1"`。所有 JSON object key 必须使用 kebab-case；ID、enum、路径、heading 名称保持原有 exact value。
8. 下游 artifact 可以读取上游 JSON trace 建立 coverage；不得把 JSON trace row 当作新增需求、测试计划、执行状态、evidence path、deposit status 或 worker executable work。
9. `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始；`acceptance-driven-coverage`、`runtime-acceptance-index` 和 `runtime-acceptance-projection` 必须存在于 `trace/tasks.trace.json`。
10. proposal 和 design 的 Delivery Plane 主体不得出现 exhaustive `GA-####` / `SI-###` coverage list、`Direct atoms`、`Projection mix`、`Global Atoms:`、`Scope Items:`、`Satisfies` coverage column、source/scope coverage suffix 或 alignment gate；这些内容只允许出现在 JSON trace。
11. 每个 `tasks.md` AC section 必须包含 `Resolved Runtime Contract` 表，并在主体直接展开 runtime row 的 worker-facing 语义。该表只摘录 runtime-acceptance.md canonical rows，不拥有 canonical row 定义。
12. `runtime-acceptance.md` 主体只定义 canonical RS-/OP-/ST-/CH- rows；`canonical-row-index`、`runtime-upstream-coverage-map`、`runtime-coverage-source-map` 和 `coverage-closure-checklist` 必须在 `trace/runtime-acceptance.trace.json`。
13. `verification.md` 主体必须包含 `Verification Intent`、`Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`；canonical Proof Slice 模型必须写入 `trace/verification.proof-slices.json` 并在 manifest 登记 digest，`runtime-coverage-reconciliation` 和 `slice-consistency-checklist` 必须在 `trace/verification.trace.json`。
14. 新 active production changes 必须按 Delivery Plane + JSON Trace Plane 生成。历史 archive old-layout changes 保持只读；若未来重新打开，必须按 JSON trace 契约手工迁移。

## Schema Selection Gate

创建新 change 或为尚未存在的 change 生成 artifacts 前，必须先判定 propose input mode，并据此显式选择 schema。不要只依赖 `openspec/config.yaml` 的默认 `schema:`。

1. 如果用户没有提供明确 change 名、也没有提供任何实质性 change 描述、功能请求、修复请求或修改范围，选择 `production-obligation-atom-driven`，并进入“无显式 Change 名时的自动推断”流程。
2. 如果用户提供了任意明确 change 名、需求描述、bug fix、feature、follow-up modification、验收口径、代码/规格调整意图或其他实质性输入，选择 `production-default-acceptance-driven`。该分支不得读取 `openspec/orchestrate`、final change packet、change plan、global atom index 或 capability anchor packet。
3. 如果用户明确要求继续一个已存在 active change，先读取 `openspec status --change "<name>" --json` 或该 change 的 `.openspec.yaml`，按已有 `schemaName` / schema 继续，不得因为本轮输入形态改写已存在 change 的 schema。
4. 新建 change 时必须使用显式 schema：
   - 无输入自动推断分支：`openspec new change "<change-slug>" --schema production-obligation-atom-driven`
   - 有输入 default-style 分支：`openspec new change "<derived-or-provided-slug>" --schema production-default-acceptance-driven`
5. 创建或继续 change 后必须运行 `openspec status --change "<name>" --json`，确认 `schemaName` 与选择结果或既有 change schema 一致；若不一致，先修正 schema/config/change metadata，不得继续生成 artifacts。
6. 两个生产 schema 的 `applyRequires` 都必须包含 `runtime-acceptance`、`verification` 和 `tasks`，artifact 顺序都是 `proposal.md`、`specs/**/*.md`、`design.md`、`runtime-acceptance.md`、`verification.md`、`tasks.md`。
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
6. 选定目标后，优先读取 `openspec/orchestrate/phase-works/phase-5/final-packet-index.json`，确认目标 change 存在、packet path 存在、direct atom IDs 可解析；如该 JSON sidecar 不存在且 proposal preconditions 未显式指向 JSON handoff，才允许回退读取 `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md`。
7. 优先读取 `openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json` 与 `openspec/orchestrate/change-capability-anchors/obligation-atom-index.json`，确认目标 direct atoms 均能回链到全局 atom 注册表，并能取得 final owner、final relation、source fields 与 final artifact projection；如 JSON sidecar 不存在且 proposal preconditions 未显式指向 JSON handoff，才允许回退读取 `obligation-atom-index.md`。
8. 只有需要核对 dependencies 或 final packet index 信息不足时，才读取 `openspec/orchestrate/change-plan.md`；它不得覆盖 final packet。
9. 如果无法可靠判断 completed / active / archive 状态，或多个候选同等合理，才向用户提出一个简短澄清问题，并列出候选 change slug、active/archive 路径与阻塞原因。

推断门禁：

- 自动推断只能选择 final packet index 中已存在的 planned change。
- 自动推断必须先完成 active/archive inventory；未读取 archive 目录时，不得把 final packet index 中靠前的 change 判定为 `not-started`。
- 自动推断不得跳过尚未完成的 dependency。若候选 change 的 `Dependencies:` 指向的 planned change 未完成或未归档，必须选择依赖链上最早未完成的 change，或报告 blocker。
- 如果候选 change 缺少 `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md`，不得自动 propose，必须报告 final change packet 缺失。
- 如果候选 JSON handoff 或 legacy packet 中存在 direct atom 但 `obligation-atom-index.json` / legacy `obligation-atom-index.md` 查不到对应 `GA-####`，不得自动 propose，必须报告 atom index 与 change packet 不一致。
- 如果 archive 中已经存在目标 slug，绝不得再次运行 `openspec new change "<change-slug>"`；若 active 目录也存在同名 slug，先按 `state-conflict` 处理。

## Production Obligation Atom Driven 入口

仅当 Schema Selection Gate 选择 `production-obligation-atom-driven`，或既有 change 的 schemaName 为 `production-obligation-atom-driven` 时适用本节。

1. 严格执行 artifact 生成技能原有流程，但在创建 change 前必须先完成 change 目标解析：若用户未提供明确目标，按“无显式 Change 名时的自动推断”选择目标；若用户提供的目标不在 final packet index 中，按 Obligation Atom 输入契约报告目标超出当前 canonical change contract，而不是自行扩展 scope 或要求新的 proposal 前置 source artifact。
2. 创建或继续目标 change 后，运行 `openspec status --change "<name>" --json`、按 artifact dependency graph 读取依赖、对每个 ready artifact 运行 `openspec instructions <artifact-id> --change "<name>" --json`。
3. 当前分支 schema 必须为 `production-obligation-atom-driven`。该 schema 的 artifact 顺序为：
   - `proposal.md`
   - `specs/**/*.md`
   - `design.md`
   - `runtime-acceptance.md`
   - `verification.md`
   - `tasks.md`
4. `applyRequires` 必须包含 `runtime-acceptance`、`verification` 和 `tasks`。
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
   - `runtime-acceptance.md`
   - `verification.md`
   - `tasks.md`
5. 本分支不消费 `openspec/orchestrate`、`change-plan.md`、final change packet、`obligation-atom-index.md` 或 capability anchor packet；不得创建 `GA-####` register，也不得把 `SI-###` 当作全局 source ID。
6. proposal 的主要输入是用户请求、现有 `openspec/specs/`、现有代码、当前产品行为，以及用户显式提供的 issue、设计稿、外部文档或调研结论。不得要求 proposal 前置 artifact。
7. `applyRequires` 必须包含 `runtime-acceptance`、`verification` 和 `tasks`。
8. `context` 与 `rules` 是 agent 必须遵守的约束，不得复制进 artifact 正文。

## Obligation Atom 输入契约

1. 不创建、不读取、不要求任何 proposal 前置 source artifact。`proposal.md` 是第一个标准 artifact，并且只能通过最小权威读集消费当前已存在的 source-aligned JSON handoff、canonical change packet 与 global atom index。
2. 不得执行、复制或依赖 `source-aligned-change-plan-coverage` 的 Python validator 或其它上游技能脚本。下游只按稳定数据契约读取 `openspec/orchestrate/**` 中自己消费的 JSON sidecar 与 Markdown mirror。
3. Machine handoff：若存在 `openspec/orchestrate/trace/manifest.json`、`phase-works/phase-5/final-packet-index.json`、`phase-works/phase-5/atom-plan-mapping.json`、`change-capability-anchors/obligation-atom-index.json`，proposal 入口必须优先读取这些 JSON。所有 planned changes（包括 `change-kind: foundation`）都来自 `final-packet-index.json` 和对应 final packet；不得读取或生成额外的 foundation 只读 handoff。`trace-contract-version` 必须为 `source-aligned-trace-v1`；`trace/manifest.json` 的 `phase-statuses.phase-5` 和 `trace/phase-5.trace.json.status` 必须一致，且当 Phase 5 status 字段存在时必须为 `accepted` 或 `adjusted`。该 status 是 source-aligned Phase 5 最终 handoff 决策，不得写入 validator/reviewer/repair 流程态。
4. Canonical change contract：当前 final change packet `openspec/orchestrate/change-capability-anchors/<change-slug>/<change-slug>.md` 仍是 proposal-facing 内容权威和人审镜像。它独占表达本 change 的 direct scope、capability 归属、artifact projection、contextual/preserve/non-goal guard、upstream realized baseline、downstream constraints、evidence burden 和 blockers；JSON sidecar 是机器 handoff 数据源。
5. Lookup table：`obligation-atom-index.json` 优先用于校验 `GA-####` 存在，并按 atom id 补齐 source trace 字段、source fact、normativity、focused source-window read 所需的 `Source Document` + `Lines`；`atom-plan-mapping.json` 优先提供 final owner change/capability、final relation 和 final artifact projection。legacy `obligation-atom-index.md` 只在 JSON sidecar 缺失且 proposal preconditions 未显式指向 JSON handoff 时作为兼容 fallback。
6. Discovery gates：
   - 读取 `openspec/orchestrate/change-capability-anchors/index.md`，确认目标 change 存在、packet path 存在。
   - 只有在用户未提供明确 change、需要按 roadmap 顺序自动推断、或需要核对 dependency 顺序时，才读取 `openspec/orchestrate/change-plan.md`。`change-plan.md` 不得覆盖 final change packet。
7. Optional grouping aids：只有当 final packet 或 schema 写作需要拆分 spec file 时，才读取当前 change 下的 `capability-anchors/<capability>.md`。这些 capability view 只能辅助 capability 分组，不得覆盖 final change packet。
8. Audit/debug evidence：除 canonical change packet、global atom index 和必要 capability views 外，其他 orchestrate/review/report 产物都不是 proposal 内容权威或门禁。不得从这些文件新增、删除、移动、重判 direct atom，也不得用它们扩展 final packet 之外的 scope。
9. 若用户请求不是 final packet index 中的 change，必须报告目标超出当前 canonical change contract，而不是在 proposal 中扩展范围或要求新的 proposal 前置 source artifact。
10. proposal 的 `trace/proposal.trace.json` / `obligation-atom-preconditions` 可记录 `orchestrate-manifest`、`global-atom-index-json`、`atom-plan-mapping-json`、`final-packet-index-json`。这些字段出现时，对应 JSON 缺失必须视为 blocker，不得静默回退到 Markdown。上述 handoff 字段值必须是字符串路径，不得是 object，不得内联 `{ "path": "...", "sha256": "...", "trace-schema": "..." }` 或其它上游 metadata。合法形状示例：

```json
"obligation-atom-preconditions": {
  "orchestrate-manifest": "openspec/orchestrate/trace/manifest.json",
  "global-atom-index-json": "openspec/orchestrate/change-capability-anchors/obligation-atom-index.json",
  "atom-plan-mapping-json": "openspec/orchestrate/phase-works/phase-5/atom-plan-mapping.json",
  "final-packet-index-json": "openspec/orchestrate/phase-works/phase-5/final-packet-index.json"
}
```

Foundation change 使用统一 production schema，并通过 `proposal-alignment-gate.change-kind: "foundation"` 进入后续 specs/design/runtime/verification/tasks。不得为 foundation 另建只读 reference、额外 read-set 或第三套 schema。
11. proposal 的 `trace/proposal.trace.json` / `change-atom-coverage-register` 必须为 JSON handoff 或 legacy final packet 中每个 direct atom 建立 register row，直接引用 exact `GA-####`，记录 `Artifact Projection` 和 `Projection Source`，不重新编号，不使用 ranges。
12. proposal 生成时必须对每个 direct atom 定点重读 JSON handoff / legacy atom index 中记录的 `Source Document` + `Lines`。对 contextual、explicit-non-goal、contextual-preserve、prototype-only-not-production 等 non-direct atoms，只在需要保留精确边界、避免误扩 scope 或确认 proof 语义时定点重读。
13. `trace/proposal.trace.json` 必须记录 `source-window-read-set`，列出被重读的 `GA-####`、source path、line range、重读目的和 interpretation result。
14. downstream artifacts 只能通过 proposal `trace/proposal.trace.json` register 中的 exact `GA-####`、source document 和 line range 定点读取原始 docs。不得重新做全量 source extraction，不得从 source line range 直接发明新的 direct atom。

## Obligation Proposal 门禁

1. proposal 的 `trace/proposal.trace.json` 必须包含 `change-atom-coverage-register`，且每个 direct atom 正好对应一个 `GA-####` register row。
2. `trace/proposal.trace.json` / `change-atom-coverage-register` 必须保留 global atom / packet row 的 `Source Document`、`Lines`、`Atom Type`、`Source Fact`、`Normativity`、`Coverage Status`、`Artifact Projection`、final packet `Capability`、`Propose Use` 和 `Evidence Need`。
3. proposal 必须将 `direct`、`contextual`、`contextual-preserve`、`explicit-non-goal`、`prototype-only-not-production`、`non-production`、`blocked` 等 atom 状态分别处理，不能把上下文、排除项或 prototype-only atom 误转成实现 scope。
4. proposal 的 `Capabilities` 必须匹配 final change packet 中的 capability atom views；除非 packet 明确记录非阻塞 gap 或 blocker。
5. 每个 direct atom 必须有 downstream coverage expectation，并且必须匹配 artifact projection：`spec-requirement` 进入 requirement/scenario；`spec-guard` 进入 guard/gate/non-goal；`design-obligation` 必须进入 design artifact；`verification-obligation` 必须进入 `verification.md` 的 oracle/proof intent；所有需要生产实现、preserve boundary 或 runtime proof 的 rows 必须进入 `runtime-acceptance.md` canonical row，并由 `tasks.md` 和 `verification.md` 投影覆盖；`contextual-only` 只允许作为非 direct context/guard。final packet 的 direct row 不得使用 `contextual-only`；若出现，必须改入 context/non-direct handling 或记录 blocker。不能留下 orphan direct atom。
6. proposal 不得因为 atom 是 direct 就自动要求 specs 生成 requirement/scenario。旧 packet 缺少 projection 时，必须按 schema 的 legacy inference 保守推断并记录 `Projection Source: inferred-from-legacy-packet`；无法推断则 blocker。
7. proposal Delivery Plane 主体只写业务边界、行为承诺、影响面和 readiness；不得在 `## Trace Appendix` 前生成 exhaustive `GA-####` coverage list、`Direct atoms`、`Projection mix`、`Global Atoms:` 或“覆盖 GA...”类 suffix。
8. `trace/proposal.trace.json` 的 `proposal-alignment-gate` 必须声明 proposal input mode、change slug、`change-kind`（`foundation` 或 `business`，来自 `final-packet-index.json`）、global atom index、change packet、capability atom view files、direct atoms、artifact projection coverage、contextual/preserve/non-goal atoms、source windows re-read、orphan direct atoms、capability increment coverage 和 blockers。

## Obligation Specs / Design 门禁

1. specs 必须从 proposal `trace/proposal.trace.json` register 和 per-change capability atom view file 生成；每个 requirement/scenario 的 exact `GA-####` 和 concrete source trace 必须列在对应 `trace/specs/<capability>.trace.json` / `requirement-source-trace`。
2. specs 不得使用 `GA-0001-GA-0010`、`GA-0001..GA-0010`、`GA-0001 through GA-0010` 等范围。
3. specs 的 Requirement / Scenario 名称若非源文档固定术语，优先使用中文。
4. specs 生成前必须建立 capability-to-atom map 和 artifact-projection map。`spec-requirement` direct atom 必须落到 requirement/scenario；`spec-guard` 作为 guard/gate/non-goal；`design-obligation` 必须进入 design，`verification-obligation` 必须进入 verification/runtime proof。只有包含 direct `spec-requirement` 或 `spec-guard` atom 的 capability 才创建 `specs/<capability>/spec.md`。不得从 `design-obligation` / `verification-obligation` 做 capability-level fallback，不得使用 `derived-capability-contract-requirement` 或 `derived-capability-contract-guard`。若 capability 没有 spec-level direct atom，不创建 spec，不得创建空 spec。
5. 每个 spec 的 `trace/specs/<capability>.trace.json` / `production-alignment-gate` 必须列出 `Artifact Projection coverage` 和 `Orphan direct atoms: none`，或列出 blocker。
6. design 必须把 proposal/spec 中需要设计消费的 source-backed obligations 落到可执行实现义务，包括 module、data/API、auth/security、worker/realtime、frontend/UX、ops/deployment 和 verification；exact `GA-####` 映射只写入 `trace/design.trace.json`。
7. design 生成前必须建立 design atom matrix。每个 `design-obligation` direct `GA-####`、需要 design placement 的 `spec-requirement`、`spec-guard` 和每个 in-scope spec scenario 必须映射到至少一个 design obligation、guard handling 或 explicit blocker，但 matrix 只进入 `trace/design.trace.json`。
8. 如果 obligation atom 只定义行为、不定义实现形态，design 可以选择最小 source-compatible 技术形态；Delivery Plane decision 只记录 `Decision`、`Source Gap`、`Minimal Shape`、`Rejected Expansion`，不得加入 `Satisfies`、GA list 或 source coverage 列。

## Obligation Runtime Acceptance / Tasks / Verification 门禁

1. `runtime-acceptance.md` 是 canonical runtime coverage registry；`tasks.md` 主体是 production implementation Delivery Plane，`trace/tasks.trace.json` 是 runtime acceptance projection；`verification.md` 是 independent test intent and oracle artifact。
2. `runtime-acceptance.md` 必须在 `verification.md` 和 `tasks.md` 之前生成，依赖 proposal/specs/design；`verification.md` 和 `tasks.md` 都依赖 `runtime-acceptance.md`，但二者不得互相作为新增需求来源。
3. `runtime-acceptance.md` 主体必须包含 `Runtime Acceptance Intent`、`Runtime Surface Inventory`、`Operation Coverage Matrix`、`State / Branch Coverage Matrix`、`Async / Realtime Chain Matrix`；`trace/runtime-acceptance.trace.json` 必须包含 `canonical-row-index`、`runtime-upstream-coverage-map`、`runtime-coverage-source-map` 和 `coverage-closure-checklist`。
4. `runtime-acceptance.md` 只定义 canonical RS-/OP-/ST-/CH- rows，不得包含 AC checkbox、implementation task IDs、Proof Slice、测试文件、固定命令、runner selector、evidence path、执行状态或 deposit status。
5. `runtime-upstream-coverage-map` 是当前 change 可观察运行行为的审计表：只覆盖当前 change 中会产生或约束可观察运行行为的 proposal direct `GA-####`、in-scope spec scenario 和 design decision/guard。Business mode 覆盖业务运行行为；foundation mode 只覆盖当前 foundation change 可观察工程运行事实。Foundation mode 允许的 observable kind 包括 `workspace-script`、`app-skeleton-startup`、`health-readiness`、`config-env`、`prisma-migration-readback`、`openapi-proto-generation`、`package-boundary`、`compose-local-smoke`、`ci-conformance`。纯架构原则、未来部署预留、云中立性、非目标、长期 preserve guard 不得生成 runtime rows，只能写 source-backed not-applicable reason。不得只用 `Direct atom closure`、主题 source map 行或 checklist 证明覆盖；每个 covered item 的 row IDs 必须解析到主体 canonical rows。
6. `verification.md` 主体必须包含 `Verification Intent`、`Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`；canonical Proof Slice 模型必须写入 `trace/verification.proof-slices.json`，`trace/verification.trace.json` 必须包含 `runtime-coverage-reconciliation` 和 `slice-consistency-checklist`。
7. `trace/verification.proof-slices.json` 是唯一测试义务模型；`Proof Slice Matrix` 必须是该 JSON 的完整镜像。每个 required / preserve / proof-only runtime row 必须拆出所有独立可失败分支并生成 expected Proof Slice，或有 source/scope-backed manual/not-applicable reason。每个 slice 必须有 Runtime Row IDs、Primary Runtime Row ID、Primitive Type、Branch / Variant、Observable Surface、Oracle Fragment、Failure Signal、Primary Layer、Production Owner、Primary Assertion Shape、Fixture / Mock Boundary、Regression Intent、Manual / Environment Gate 和 `test-contract`。Propose 阶段只校验 `Production Owner` 是单一 planned production boundary token、`Primary Layer` 是合法枚举；不得要求 owner/layer 映射到 `tests/**` 目录。真实测试文件落点必须在 apply 阶段通过 `proof-test-map.json` 和 placement audit 校验。`test-contract` 默认要求 `primary-test-cardinality: "exactly-one"`、`test-title-prefix` 等于 slice id、`allow-shared-setup: true`、`allow-multi-slice-primary-test: false`、`waiver-required-for-multi-slice: true`。oracle 不能来自当前实现细节、`tasks.md`、测试文件结构或 evidence/deposit 结构。
   - Foundation mode 下，Proof Slice 只能从有效 foundation runtime rows 派生；不得为 not-applicable、pure design/reference/guard/future rows 生成 required Proof Slice。
8. `verification.md` 不得包含具体测试文件、固定测试命令、runner selector、evidence directory 或 deposit status。
9. `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始，并以 `## Trace Appendix` 结束；`trace/tasks.trace.json` 保留 `acceptance-driven-coverage`、`runtime-acceptance-index` 和 `runtime-acceptance-projection`。
10. 每个 AC section 必须按顺序包含 `Outcome:`、`Start Gate:`、`Runtime Rows:`、`Resolved Runtime Contract:`、`Implementation Scope:`、`Preserve:`、`Proof Contract:`，随后是 checkbox tasks。
11. `Resolved Runtime Contract` 表头固定为 `Row`、`Worker-facing obligation`、`Observable proof`、`Default / no-scope boundary`；row IDs 必须与该 AC 的 `Runtime Rows:` 列表一致，且全部存在于 runtime-acceptance.md canonical rows。
12. `Resolved Runtime Contract` 只能摘录 canonical row 的 worker-facing 语义，不得包含 `GA-####`、source trace、projection、Proof Slice、测试路径、固定命令或 evidence path，不得新增 canonical runtime row。
13. obligation profile 的每个 checkbox task 必须包含 `Runtime Rows:`、`Acceptance:`、`Preserve:`、`Proof:`、`Mock / Default Path Policy:` 字段。
    - checkbox task 必须代表 production implementation work：代码、schema、migration、API、domain behavior、UI behavior、auth/security guard、config、provider contract、observability、deployment 或 runtime boundary preservation。
    - Foundation mode 的 AC 和 checkbox task 必须代表生产工程底座实现工作，例如 workspace、app skeleton、scripts、config、migration、health、生成链路、package boundary 或 CI/local smoke。
    - checkbox task 不得只为了 proof、verification、test、fixture replay、截图、evidence、coverage closure、acceptance closure 或 artifact closure 而存在。
    - task-level `Runtime Rows:` 只能列该 task 实现、实质修改或保留的 rows；仅由 proof/readback 观察的 supporting rows 不得列入该 task 的 `Runtime Rows:`。
    - `Proof:` 是生产任务完成标准，不是独立 executable work。
14. `trace/tasks.trace.json` / `acceptance-driven-coverage` 必须包含 `obligation-atom-coverage`、`requirement-scenario-coverage`、`design-obligation-coverage`；`obligation-atom-coverage` 每行只能包含一个 exact `GA-####`。
15. coverage 表只保留 implementation task 引用和 runtime proof 摘要；proof 摘要是说明字段，不是独立 checkbox task 或测试编号。`Implementation Task IDs` 必须引用交付或实质保留 source behavior 的生产任务；`verification-obligation` rows 应映射到被证明的底层生产 task，不得为了 coverage 创建 proof-only task。
16. `trace/tasks.trace.json` 的 `runtime-acceptance-index` 必须建立 runtime provision graph，区分 baseline、current-change AC、future change 和 explicit negative boundary；AC sections 必须按拓扑顺序生成。`Provides / Consumes / Depends On / Prerequisite Runtime Facts / Detail Matrix Rows` 只保留在该 JSON trace graph/index，不作为 AC 主体必填字段。
17. `trace/tasks.trace.json` 的 `runtime-acceptance-projection` 只保留 runtime-acceptance.md 到 AC/implementation checkbox 的 projection rows，不得重新定义 canonical runtime row 详情。required / preserve rows 必须有 production task projection；proof-only rows 必须分类为 `production-work-required` 或 `proof-projection-only`。`production-work-required` 需要生产 UI/config/log/security/runtime changes，必须有 owner AC 和 implementation task projection；`proof-projection-only` 只声明对既有生产行为的 proof expectation，不得创建新 AC 或 checkbox，只能映射到已有 AC/task IDs 和 runtime proof summary。
18. `tasks.md` 不得包含 `Test Evidence Matrix`、`Regression Test Deposit`、`Test Layer Plan`、`Fixed Command`、`Test File / Name`、`Evidence Directory`、`Evidence Status`、`Deposit Status` 或 `Test IDs` 字段。
19. Proof 必须达到生产验收强度：用户可见行为需要 rendered/readback fact；后端/data/worker/storage/security 行为需要 API、DB、job、asset、log、audit 或 authorization facts；这些是 runtime proof category，不是测试执行记录。
20. artifact 生成后自查必须确认没有 orphan direct atom、GA range、后置 provider dependency、source 外行为、runtime row orphan、未定义 row 引用；`runtime-upstream-coverage-map` 没有仅由 closure 聚合兜底的上游项；每个 required/preserve runtime row 都有 tasks projection 和 verification projection；每个 proof-only runtime row 都已分类并按 `production-work-required` 或 `proof-projection-only` 正确投影；不存在 proof-only AC/checkbox 或 task-level supporting row 误列。

## Default Acceptance 输入契约与门禁

以下规则仅适用于 `production-default-acceptance-driven`。

1. proposal 的 `trace/proposal.trace.json` 必须包含 `change-scope-coverage`，并为每个 material scope item 分配 change-local `SI-###`。`SI-###` 只在本 change 内有效。
2. `Artifact Handling` 允许值为 `spec`、`guard`、`design`、`proof`、`context`。`proof` 表示进入 `verification.md` 的测试意图或 runtime proof，不表示写入 `tasks.md` 的测试矩阵。
3. `trace/proposal.trace.json` 必须记录 `baseline-input-read-set`，不得读取或依赖 `openspec/orchestrate`、final packet、global atom index 或 capability anchor packet。
4. specs 只为包含 `Artifact Handling: spec` 或 `guard` 的 capability 创建 delta spec；不得为 design/proof/context-only scope 创建空 spec。
5. design 必须使用 proposal `trace/proposal.trace.json` 的 `change-scope-coverage` 和 spec JSON trace 的 `requirement-source-trace` 作为 scope-reading interface。
6. `runtime-acceptance.md` 必须在 `verification.md` 和 `tasks.md` 之前生成，依赖 proposal/specs/design，并定义 canonical RS-/OP-/ST-/CH- runtime rows。`trace/runtime-acceptance.trace.json` 必须包含 `canonical-row-index` 和 `runtime-upstream-coverage-map`，逐项把每个非 context material `SI-###`、in-scope spec scenario、material design decision、guard 和 proof handling item 映射到具体 runtime row，或写 scope-backed not-applicable reason；不得只用 `Scope closure`、主题 source map 行或 checklist 证明覆盖。
7. `trace/verification.proof-slices.json` 是唯一测试义务模型；`verification.md` 主体必须包含 `Proof Slice Matrix`，并作为该 JSON 的人类可读镜像。在每个 slice 中定义 Runtime Row IDs、Primary Runtime Row ID、Primitive Type、Branch / Variant、public/runtime observable surface、Oracle Fragment、Failure Signal、Primary Layer、Production Owner、Primary Assertion Shape、Fixture / Mock Boundary、Regression Intent、Manual / Environment Gate 和 `test-contract`；propose 阶段不校验 `Production Owner + Primary Layer` 的 `tests/**` 目录落点，目录 placement 由 apply 阶段 `proof-test-map.json` audit 负责；runtime coverage reconciliation 必须位于 `trace/verification.trace.json` / `runtime-coverage-reconciliation`。
8. `verification.md` 不得包含具体测试文件、固定测试命令、runner selector、evidence directory 或 deposit status。
9. `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始，并以 `## Trace Appendix` 结束；`trace/tasks.trace.json` 保留 `acceptance-driven-coverage`、`runtime-acceptance-index` 和 `runtime-acceptance-projection`。
10. 每个 AC section 必须按顺序包含 `Outcome:`、`Start Gate:`、`Runtime Rows:`、`Resolved Runtime Contract:`、`Implementation Scope:`、`Preserve:`、`Proof Contract:`，随后是 checkbox tasks。
11. `Resolved Runtime Contract` 表头固定为 `Row`、`Worker-facing obligation`、`Observable proof`、`Default / no-scope boundary`；row IDs 必须与该 AC 的 `Runtime Rows:` 列表一致，且全部存在于 runtime-acceptance.md canonical rows。
12. `Resolved Runtime Contract` 只能摘录 canonical row 的 worker-facing 语义，不得包含 `SI-###`、source/scope trace、projection、Proof Slice、测试路径、固定命令或 evidence path，不得新增 canonical runtime row。
13. `trace/tasks.trace.json` / `acceptance-driven-coverage` 必须包含 `scope-item-coverage`、`requirement-scenario-coverage`、`design-decision-coverage`；`scope-item-coverage` 每行只能包含一个 exact `SI-###`。
14. coverage 表只保留 implementation task 引用和 runtime proof 摘要；proof 摘要是说明字段，不是独立 checkbox task 或测试编号。`Implementation Task IDs` 必须引用交付或实质保留 source/scope behavior 的生产任务；`Artifact Handling: proof` rows 应映射到被证明的底层生产 task，不得为了 coverage 创建 proof-only task。
15. default profile 的每个 checkbox task 必须包含 `Runtime Rows:`、`Acceptance:`、`Preserve:`、`Proof:`、`Mock / Default Path Policy:` 字段。
    - checkbox task 必须代表 production implementation work：代码、schema、migration、API、domain behavior、UI behavior、auth/security guard、config、provider contract、observability、deployment 或 runtime boundary preservation。
    - checkbox task 不得只为了 proof、verification、test、fixture replay、截图、evidence、coverage closure、acceptance closure 或 artifact closure 而存在。
    - task-level `Runtime Rows:` 只能列该 task 实现、实质修改或保留的 rows；仅由 proof/readback 观察的 supporting rows 不得列入该 task 的 `Runtime Rows:`。
    - `Proof:` 是生产任务完成标准，不是独立 executable work。
16. `trace/tasks.trace.json` 的 `runtime-acceptance-index` / `runtime-acceptance-projection` 只保留 runtime-acceptance.md 到 AC/implementation checkbox 的 graph/projection rows，不得重新定义 canonical runtime row 详情。`Provides / Consumes / Depends On / Prerequisite Runtime Facts / Detail Matrix Rows` 只保留在 JSON trace graph/index，不作为 AC 主体必填字段。required / preserve rows 必须有 production task projection；proof-only rows 必须分类为 `production-work-required` 或 `proof-projection-only`。`production-work-required` 需要生产 UI/config/log/security/runtime changes，必须有 owner AC 和 implementation task projection；`proof-projection-only` 只声明对既有生产行为的 proof expectation，不得创建新 AC 或 checkbox，只能映射到已有 AC/task IDs 和 runtime proof summary。
17. `tasks.md` 不得包含 `Test Evidence Matrix`、`Regression Test Deposit`、`Test Layer Plan`、`Fixed Command`、`Test File / Name`、`Evidence Directory`、`Evidence Status`、`Deposit Status` 或 `Test IDs` 字段。
18. artifact 生成后自查必须确认没有 orphan scope item、SI range、后置 provider dependency、scope 外行为、runtime row orphan、未定义 row 引用；`runtime-upstream-coverage-map` 没有仅由 closure 聚合兜底的上游项；每个 required/preserve runtime row 都有 tasks projection 和 verification projection；每个 proof-only runtime row 都已分类并按 `production-work-required` 或 `proof-projection-only` 正确投影；不存在 proof-only AC/checkbox 或 task-level supporting row 误列。

## 统一静态校验与分阶段 Writer/Reviewer

本节适用于 `openspec-propose`、`openspec-ff-change`、`openspec-continue-change` 和任何会创建或继续生成 production schema artifacts 的流程；三者使用同一门禁逻辑，不得因为入口不同而跳过。

### Contract Bundle Resolution

1. 生成或复核任一 artifact 前，主 Agent 必须解析并读取该 artifact 的 contract bundle。bundle 顺序固定为：
   - `openspec/schemas/_production-contracts/common/chinese.md`
   - `openspec/schemas/_production-contracts/common/delivery-plane-trace-appendix.md`
   - `openspec/schemas/_production-contracts/common/no-evidence-or-test-plan.md`
   - `openspec/schemas/_production-contracts/common/source-scope-boundary.md`
   - `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`
   - `openspec/schemas/_production-contracts/profiles/<schema-name>.md`
   - `openspec/schemas/_production-contracts/artifacts/<artifact-id>.md`
   - `openspec/schemas/_production-contracts/overlays/<schema-name>/<artifact-id>.md`，仅在文件存在时读取。
2. Artifact id 到 contract 文件名的映射固定为：`proposal -> proposal.md`、`specs -> specs.md`、`design -> design.md`、`runtime-acceptance -> runtime-acceptance.md`、`verification -> verification.md`、`tasks -> tasks.md`。
3. 如果任一 required contract 文件缺失，必须停止并报告 `Artifact Consistency Blocker`；不得降级为只读 schema instruction 或主 Agent 自检。
4. `schema.yaml` 仍是 OpenSpec 默认生成入口；contract bundle 是 writer/reviewer 的共同强制约束来源。不得把 contract 文本复制进 artifact 正文。

### Trace-First Writer Gate

1. Writer 和 repair-writer 写入任一 production artifact 前，必须先建立或更新当前 artifact 的 JSON trace sections。trace sections 至少表达本 artifact 的输入读集、上游 item inventory、输出 ID 集合、coverage/projection 映射、Delivery Plane render payload 和模型计数摘要；只有 trace-backed ID 集可用于渲染 Delivery Plane。
2. Writer 只能直接写当前 artifact 的 trace/proof-slices JSON；不得直接写或手工修改 Markdown artifact。写完 trace 后必须调用 `node openspec/agent-runtime/scripts/render-production-artifacts.mjs --change "<change-slug>" --artifact "<artifact-id>" [--capability "<capability>"] --write` 生成 Markdown Delivery Plane、Trace Appendix 和 manifest digest。
3. Writer 在调用 renderer 前必须基于 trace sections 做 set-diff 自查：上游 source/scope item、spec scenario、design obligation、runtime row、Proof Slice、AC 和 task projection 不得缺失、重复、跨类型引用或出现 orphan；自查结论不得写入 artifact 正文。
4. repair-writer 必须重新读取最新上游 artifact/trace、contract bundle 和 validator/reviewer blocker 后重建当前 trace-backed ID 集，并重新调用 renderer；不得以旧过程记录或手写 Markdown 替代 canonical artifact 或 JSON trace。
5. 主 Agent 在 writer/repair-writer 自然返回前不得读取中间落盘状态；返回后也不得把过程摘要当作 validator 或 reviewer 输入的 oracle。主 Agent 只可在 `propose-result.md` 中记录 artifact path、trace digest、renderer status、模型计数摘要和 writer 摘要。
6. Static validator、artifact reviewer、integration reviewer、apply、archive 只能从 renderer 生成的 artifact、JSON trace、manifest 和 proof-slices sidecar 推导 coverage、oracle、apply readiness 或 archive readiness。

### Partial / Complete Static Validation Semantics

1. Partial static validator 指不带 `--complete` 的命令：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>"`。它只验证当前 change 目录中已经存在的 artifacts 及其已声明 trace，不得要求尚未生成的下游 artifact、sidecar trace 或 apply-required artifact 提前存在。
2. 每次 artifact writer 或 repair-writer 自然返回后运行 partial validator。该次 partial validator 必须检查所有已存在 artifact 的 `## Trace Appendix` 指针、对应 trace 文件、manifest entry、trace digest、`render-contract-version`、renderer exact output、JSON key 格式、当前 artifact 必需 trace sections，以及已存在 artifacts 之间可解析的 source/scope、runtime、verification、tasks 引用。
3. Proposal 阶段 partial validator 必须校验 `proposal.md`、`trace/proposal.trace.json` 和 `trace/manifest.json` 的当前内容；不得要求 `specs/**/*.md`、`design.md`、`runtime-acceptance.md`、`verification.md`、`tasks.md` 或 `trace/verification.proof-slices.json` 已存在。
4. Specs 阶段 partial validator 必须在 proposal 基础上校验已生成 specs 及其 trace；不得要求尚未生成的 design、runtime-acceptance、verification、tasks artifacts。
5. Design 阶段 partial validator 必须在 proposal/specs 基础上校验 `design.md` 和 `trace/design.trace.json`；不得要求尚未生成的 runtime-acceptance、verification、tasks artifacts。
6. Runtime-acceptance 阶段 partial validator 必须校验 `runtime-acceptance.md`、`trace/runtime-acceptance.trace.json` 和已存在上游 trace 的 runtime projection；在 `verification.md` 尚未存在时，不得要求 `trace/verification.proof-slices.json` 或 verification reconciliation。
7. Verification 阶段 partial validator 必须校验 `verification.md`、`trace/verification.trace.json`、`trace/verification.proof-slices.json`、manifest 中 proof-slices entry/digest、Proof Slice Matrix 与 canonical JSON 的镜像一致性，以及 runtime coverage reconciliation。
8. Tasks 阶段 partial validator 必须校验 `tasks.md`、`trace/tasks.trace.json`、AC runtime ownership/projection、task ID 解析和已存在 runtime/verification 交叉引用。
9. `trace-contract-version: "proof-slices-v1"` 是 change-level trace contract 标识，可以从 proposal 阶段写入 manifest；它不表示 proposal/specs/design/runtime partial 阶段必须预先创建 verification sidecar trace。只有 `verification.md` 已存在或运行 complete validator 时，`trace/verification.proof-slices.json` 才成为必需文件。
10. Complete validator 指带 `--complete` 的命令：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>" --complete`。它必须要求 apply-required artifacts 全部存在，并校验完整 trace plane、verification proof-slices sidecar、runtime/verification/tasks reconciliation 和跨 artifact 闭环。

### Artifact Writer / Reviewer Loop

1. Artifact 必须按 schema dependency graph 顺序处理：`proposal`、`specs`、`design`、`runtime-acceptance`、`verification`、`tasks`。
2. 每个 artifact 必须使用一组独立 subagents：
   - `proposal-writer` 后接 `proposal-reviewer`
   - `specs-writer` 后接 `specs-reviewer`
   - `design-writer` 后接 `design-reviewer`
   - `runtime-acceptance-writer` 后接 `runtime-acceptance-reviewer`
   - `verification-writer` 后接聚焦 `verification-reviewer`
   - `tasks-writer` 后接 `tasks-reviewer`
3. 每个 artifact 的修复必须使用当前 artifact 的 `repair-writer`，例如 `proposal-repair-writer`、`specs-repair-writer`、`design-repair-writer`、`runtime-acceptance-repair-writer`、`verification-repair-writer` 或 `tasks-repair-writer`。
4. Writer、repair-writer 和 reviewer 都必须使用 `model=GPT-5.5` 且 `reasoningEffort=xhigh`；若当前环境无法创建对应 subagent，必须停止并报告 blocker，不得降级为主 Agent 自检或低配模型。
5. Writer 输入必须包含：change 名称、schema 名称、`openspec instructions <artifact-id> --change "<change-slug>" --json` 的完整输出、已完成 dependency artifact 路径和内容、contract bundle 路径和内容、必要 source/scope/baseline read set，以及 renderer CLI 命令。Writer 只能直接写当前 artifact 的 trace/proof-slices JSON，并必须通过 renderer 生成 Markdown artifact。
6. 任一 writer、repair-writer、reviewer 或 integration-reviewer 运行期间，主 Agent 只能执行必要的编排等待和状态记录；不得读取当前 artifact 的中间落盘状态、审查 partial trace、运行 validator、修改 artifacts、接手修复/复核，或向正在运行的 subagent 注入中途发现。
7. Writer 或 repair-writer 自然返回最终完成或明确 blocker 前，主 Agent 不得运行 partial static validator，不得启动 reviewer，也不得继续生成依赖该 artifact 的下游 artifact。
8. Writer 或 repair-writer 自然返回完成后，主 Agent 必须运行 partial static validator：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>"`。Hard error 必须由主 Agent 分派当前 artifact 的 `repair-writer` 修复；repair-writer 自然返回后重新运行 validator 到 hard pass。Warning 必须传给 artifact reviewer。
9. Partial validator hard pass 后，主 Agent 才能启动 artifact reviewer。Artifact reviewer 输入必须包含：change 名称、schema 名称、当前 artifact 路径和内容、必要 upstream dependency artifact、contract bundle 路径和内容、partial validator 报告。Reviewer 不得读取当前实现、测试文件、`openspec-results/**` 中的 apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle；不得因 propose 阶段 `Production Owner + Primary Layer` 无 `tests/**` 目录落点而提出 blocker，目录 placement 属于 apply proof mapping gate；只允许接收主 Agent 摘录的 propose-result 未关闭 blocker 摘要，并且不得把该摘要当作 coverage 或行为 oracle。
10. Reviewer 只读复核，不得直接修订 artifact。Reviewer 只能输出 `Pass` 或 `Blocker`。Blocker 必须包含 artifact path、artifact anchor、contract source path + section heading、问题描述和修复方向；`verification.md` blocker 还必须列出 runtime row、现有或缺失 Proof Slice、被合并或遗漏的分支。
11. 主 Agent 收到 reviewer blocker 后必须分派当前 artifact 的 `repair-writer` 修复，等待 repair-writer 自然返回，重新运行 partial validator，并重新启动同一 artifact reviewer。Reviewer pass 且 validator hard pass 前，不得继续生成依赖该 artifact 的下游 artifact。
12. Reviewer finding 不使用人为稳定编号；必须使用 artifact path、contract section、heading/table row、`GA-####`、`SI-###`、`RS-/OP-/ST-/CH-`、`PS-###`、`AC-###` 等自然锚点定位。

### Propose Result Record

1. Propose runtime 必须写入或更新 `openspec-results/<change-slug>/propose-result.md`。该文件是 propose 阶段过程审计记录，借鉴 apply 阶段 `apply-result.md` 的摘要模型，但不得替代 artifact、JSON trace、static validator、artifact reviewer、integration reviewer、apply evidence 或 archive proof。
2. 主 Agent 创建 change 后必须初始化 propose result，并至少记录 change 名称、schema 名称、创建日期、选择来源、active/archive 盘点摘要、source handoff / baseline 输入摘要、direct `GA-####` 或 change-local `SI-###` 集合、artifact dependency order 和结果文件路径。
3. 每次 writer、repair-writer、partial validator、artifact reviewer、full validator 和 integration reviewer 自然返回后，主 Agent 必须在 propose result 中追加或更新对应记录。记录不得在 subagent 运行中途读取当前 artifact 中间状态或提前审查；只能使用自然返回报告、validator 输出、reviewer 输出和最终落盘路径/digest。writer/repair-writer notes 可以记录 artifact path、trace digest 和模型计数摘要。
4. Propose result 至少包含 `Artifact Runs` 表，字段为 `sequence`、`artifact-id`、`agent-role`、`agent-id`、`status`、`validator`、`reviewer`、`trace-digest`、`notes`。同一 artifact 多轮 repair/review 必须保留多行或在 notes 中保留轮次，不得只留下最终 pass。
5. Propose result 必须包含 `Blocker / Repair Log` 表，记录所有 writer blocker、validator hard error、reviewer blocker、integration blocker、修复 agent、最小修复摘要、复跑 validator 结果和复审结论。无 blocker 时也必须显式写 `None`。
6. Propose result 必须包含 `Final Gates` 小节，记录 partial validators、full validator、artifact reviewer pass、integration reviewer pass、`openspec status --change "<change-slug>"` 摘要和是否 apply-ready。未满足所有门禁前，`apply-ready` 必须写为 `no` 并说明未满足项。
7. Propose result 只能记录过程摘要、命令结果、agent 返回摘要、artifact path、模型计数摘要和 trace digest；不得写入测试计划、实际测试命令、测试文件、evidence/deposit、Proof Slice 通过结果或任何 apply-stage evidence 结论。
8. 后续 artifact reviewer 和 integration reviewer 的输入应包含此前 propose result 摘要，用于确认是否存在未关闭 blocker；但 reviewer 不得把 propose result 当作 artifact oracle 或 coverage source。若 propose result 与 artifact / trace / validator 结论冲突，必须以 artifact / trace / validator 为准并报告 `Artifact Consistency Blocker`。

### Complete Validation / Integration Reviewer

1. 当 apply-required artifacts 全部完成并且每个 artifact reviewer pass 后，必须运行全量静态校验：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>" --complete`。
2. Full validator hard error 阻断 integration reviewer 和 apply-ready 声明；主 Agent 必须分派受影响 artifact 的 `repair-writer` 修复，按受影响 artifact 重新运行 partial validator 和相应 artifact reviewer，再重新运行 full validator 到 hard pass。Warning 必须进入 integration reviewer 输入。
3. Full validator hard pass 后，必须启动一次且仅一次 `artifact-integration-reviewer` subagent。
4. `artifact-integration-reviewer` 必须使用 `model=GPT-5.5` 且 `reasoningEffort=xhigh`；若当前环境无法创建该 reviewer，必须停止并报告 blocker，不得降级为主 Agent 自检。
5. Integration reviewer 输入必须包含：change 名称、schema 名称、完整 static validator 报告、所有 artifact reviewer 输出、proposal/specs/design/runtime-acceptance/verification/tasks 路径和内容、所有相关 contract bundle 路径。它不重新替代每个 artifact 的专项 reviewer。
6. Integration reviewer 只检查跨 artifact reconciliation：source/scope projection 是否漂移、runtime rows 是否同时被 `tasks.md` 和 `verification.md` 正确投影、未关闭 reviewer blocker 是否存在、validator warning 是否处理、proposal/spec/design/runtime/verification/tasks 是否存在互相发明新行为。
7. Integration reviewer 只读复核，不得直接修订 artifact。输出只能是 `Pass` 或 `Blocker`；Blocker 必须包含 artifact path、artifact anchor、contract source heading、问题和修复方向。主 Agent 收到 blocker 后必须分派受影响 artifact 的 `repair-writer` 修复，按受影响 artifact 重新运行 partial validator 和相应 artifact reviewer，再重新运行 full validator，并重新启动 integration reviewer。
8. 未满足所有 artifact reviewer pass、full validator hard pass 和 integration reviewer pass 前，不得声称 artifacts apply-ready，不得建议进入 apply，不得把 `Coverage Status = covered`、checklist 勾选或 validator PASS 当作最终质量证明。

### Validator / Reviewer 分工

- 静态 validator 负责机械门禁和启发式风险标记。
- Artifact reviewer 负责 artifact-local contract compliance。
- `verification-reviewer` 必须特别聚焦 Proof Slice 粒度、runtime row 分支枚举和 reconciliation 真实性。
- Integration reviewer 负责跨 artifact reconciliation。
- 三者都不得把 artifact/process、测试文件结构或 apply evidence 当作产品行为 oracle。

## Artifact 生成自查

每个 artifact 写入后必须按其 contract bundle 做结构自查，而不是只依赖 OpenSpec CLI 格式校验。

1. 全部 artifacts 必须执行 common contract 自查：中文约束、Delivery Plane / JSON Trace Plane、禁止测试执行/evidence 字段、source/scope boundary 和 reviewer 输出协议。
2. Profile-specific 自查必须来自 `openspec/schemas/_production-contracts/profiles/<schema-name>.md`：obligation schema 使用 final packet、global atom index 和 exact `GA-####`；default schema 使用用户输入、baseline/spec/code read set 和 change-local `SI-###`。
3. Artifact-specific 自查必须来自 `openspec/schemas/_production-contracts/artifacts/<artifact-id>.md` 和存在时的 overlay contract。
4. 自查结果不得写入 artifact 正文；若发现无法满足 contract，必须作为 writer blocker 或 reviewer blocker 处理。
5. Propose 完成后必须确认 `runtime-acceptance.md`、`tasks.md` 和 `verification.md` 都没有 source/scope 外新增行为，且 verification/tasks 没有互相作为新增需求来源。

## No Backward Compatibility

1. 两个 production schema 的新格式必须生成 `runtime-acceptance.md` 和 `verification.md`，且 `tasks.md` 不允许包含旧测试矩阵。
2. 新 schema 不实现旧 change 兼容逻辑；已有旧 change 不在本流程内自动迁移。
3. 如果需要处理旧 change，单独制定迁移流程：从旧 `tasks.md` 抽取 canonical runtime rows 到 `runtime-acceptance.md`，抽取测试意图到 `verification.md`，将 tasks projection 手工迁入 `trace/tasks.trace.json`，删除测试/evidence/deposit section。
