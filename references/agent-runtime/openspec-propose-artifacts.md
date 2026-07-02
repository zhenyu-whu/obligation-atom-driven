# openspec-propose artifact 运行约束

当执行或触发 `openspec-propose`、`openspec-new-change`、`openspec-continue-change`、`openspec-ff-change` 或任何会创建/继续生成 OpenSpec change artifacts 的技能时，必须先遵守本文档。

本文档是项目级 runtime overlay。官方 OpenSpec artifact 技能仍负责通用入口：创建或继续 change、读取 `openspec status --change "<name>" --json`、读取 `openspec instructions <artifact-id> --change "<name>" --json`，并按 schema dependency graph 推进 artifacts。本文档覆盖官方技能的默认写入方式、schema 选择、目标解析、writer/reviewer/validator 编排和 apply-ready 门禁。

本文档覆盖两个 production schema：`production-obligation-atom-driven` 和 `production-default-acceptance-driven`。

## Source of Truth

1. `AGENTS.md` 强制本 runtime overlay 优先生效；官方 `openspec-propose` / `openspec-ff-change` / `openspec-continue-change` 技能只提供通用执行骨架。
2. schema 选择、无输入目标推断、subagent 编排、partial/full validator、artifact reviewer、integration reviewer、propose-result 和 apply-ready 声明归本文档。
3. artifact dependency graph、artifact id、template、output path、`requires` 和 `apply.requires` 归选定 schema 的 `schema.yaml`，并以 `openspec status --change "<name>" --json` 与 `openspec instructions ... --json` 的实际返回为准。
4. Artifact 内容语义归 contract bundle：`openspec/schemas/_production-contracts/common/*`、`profiles/<schema-name>.md`、`artifacts/<artifact-id>.md` 和存在时的 `overlays/<schema-name>/<artifact-id>.md`。
5. JSON Trace Plane 是下游 artifact 的唯一机器语义输入；writer、repair-writer、artifact reviewer 和 integration reviewer 不得从上游 Markdown Delivery Plane 推导 scope、coverage、runtime row、Proof Slice、AC 或 oracle。
6. Markdown Delivery Plane 和短 `## Trace Appendix` 归 `render-production-artifacts.mjs`；writer/repair-writer 不得手写 Markdown artifact。`trace/manifest.json` 如存在，只作为非权威 trace registry/version metadata；不得通过 manifest 中的任何摘要字段建立下游语义。
7. 机械结构校验归 `validate-production-artifacts.mjs`；validator hard error 必须修复，warning 必须进入 reviewer 判断。
8. 如果发生冲突：流程/编排问题以本文档为准；dependency graph 和 apply-required 集合以 schema/status 为准；artifact 内容合同以 contract bundle 为准；renderer 输出一致性以 renderer 和 validator 为准。

## Schema Selection Gate

创建新 change 或为尚未存在的 change 生成 artifacts 前，必须先根据用户输入选择 schema。不得只依赖 `openspec/config.yaml` 的默认 `schema:`。

1. 如果用户没有提供明确 change 名，也没有提供实质性 change 描述、功能请求、修复请求或修改范围，选择 `production-obligation-atom-driven`，并进入“无显式 Change 名时的自动推断”。
2. 如果用户提供了任意明确 change 名、需求描述、bug fix、feature、follow-up modification、验收口径、代码/规格调整意图或其它实质性输入，选择 `production-default-acceptance-driven`。
3. 如果用户明确要求继续既有 active change，先读取 `openspec status --change "<name>" --json` 或该 change 的 `.openspec.yaml`，按既有 `schemaName` / schema 继续；不得因为本轮输入形态改写既有 schema。
4. 新建 change 必须使用显式 schema：
   - 无输入自动推断：`openspec new change "<change-slug>" --schema production-obligation-atom-driven`
   - 有输入 default-style：`openspec new change "<derived-or-provided-slug>" --schema production-default-acceptance-driven`
5. 创建或继续 change 后必须运行 `openspec status --change "<name>" --json`，确认 `schemaName` 与选择结果或既有 change schema 一致；不一致时先修正 metadata/config，不得继续生成 artifacts。
6. `context` 与 `rules` 是 agent 约束，不得复制进 artifact 正文。

## 无显式 Change 名时的自动推断

仅当 Schema Selection Gate 选择 `production-obligation-atom-driven` 时适用本节。

当用户触发 artifact 生成但没有提供明确 change 名、也没有提供足够明确的 change 描述时，不得立即询问用户“要做什么 change”。必须先根据已完成/已存在 change 和 `openspec/orchestrate/change-capability-anchors/index.md` 自动推断下一个应处理的 final planned change。

自动推断第一门禁是 active/archive 状态盘点。不得只看 final packet index 的第一行，也不得只依赖 `openspec list --json` 的 active 列表；必须同时检查 `openspec/changes/` 下 active change 目录和 `openspec/changes/archive/` 下归档目录。

推断流程：

1. 读取 `openspec/orchestrate/change-capability-anchors/index.md`，按 final packet index 表格顺序提取 final changes；如果 index 显式提供 `Order` 列，则按 `Order` 排序。推断出的 change 名必须使用 index 中的 exact slug，不得自行改名。
2. 在读取候选 packet 或执行 `openspec new change` 前，先建立完整状态盘点：
   - 运行 `openspec list --json`，记录 CLI 返回的 active changes。
   - 扫描 active change 目录：`find openspec/changes -mindepth 1 -maxdepth 1 -type d ! -name archive -print`。
   - 扫描 archive change 目录：`find openspec/changes/archive -mindepth 1 -maxdepth 2 -name .openspec.yaml -print`；不得使用会漏掉 `openspec/changes/archive/<archive-dir>/.openspec.yaml` 的过浅搜索。
   - 对每个 archive 目录，优先读取 `.openspec.yaml` 中的 change name；如果文件不含名称，则用目录名去除日期前缀 `YYYY-MM-DD-` 后匹配 final packet index 的 exact slug。
   - 将 CLI active 列表、active 目录列表和 archive 目录列表合并成 per-slug inventory；如果三者不一致，必须以文件系统实际目录为准，并把不一致作为推断说明或 blocker。
3. 只对 final packet index 中存在的 planned changes 做分类，不得把 archive 或 active 中的非 planned change 自动加入本轮目标：
   - `completed`: 存在匹配 slug 的 archive 目录；已归档 change 不得再次 propose。
   - `active-incomplete`: `openspec/changes/<change-slug>/` 存在，且 apply-ready artifacts 尚未完成，或 tasks/implementation 尚未完成。
   - `active-apply-ready`: active change 存在，apply-required artifacts 已完成，但尚未归档。
   - `not-started`: 没有匹配 archive 目录，也没有 active change 目录。
   - `state-conflict`: 同一个 planned change 同时存在 archive 和 active 目录，或 CLI/filesystem 状态矛盾。
4. 如果任一 planned change 被分类为 `state-conflict`，不得继续创建或选择后续 change。必须报告冲突路径、推断出的 slug 和建议清理动作；只有用户明确要求清理或继续时，才处理该冲突。
5. 按 final packet index 顺序寻找最早的未完成 planned change：
   - `active-incomplete`: 继续该 change 的 artifact 生成，不创建重复目录。
   - `active-apply-ready`: 不得自动跳到后续 change；报告该 change 已 propose 完成，下一步应 apply 或 archive。只有用户明确要求并行规划后续 change 时，才允许继续推断下一个 `not-started` change。
   - `not-started`: 自动选择它作为本次 propose 目标，并继续 packet/atom 校验；只有校验通过后才执行 `openspec new change "<change-slug>"`。
6. 选定目标后，按 `production-obligation-atom-driven` profile contract 读取 source-aligned JSON handoff、final packet 和 global atom index。若 proposal preconditions 显式指向 JSON handoff，对应 JSON 缺失必须 blocker，不得静默回退到 Markdown。
7. 只有需要核对 dependencies 或 final packet index 信息不足时，才读取 `openspec/orchestrate/change-plan.md`；它不得覆盖 final packet。
8. 如果无法可靠判断 completed / active / archive 状态，或多个候选同等合理，才向用户提出一个简短澄清问题，并列出候选 change slug、active/archive 路径与阻塞原因。

推断门禁：

- 自动推断只能选择 final packet index 中已存在的 planned change。
- 自动推断必须先完成 active/archive inventory；未读取 archive 目录时，不得把 final packet index 中靠前的 change 判定为 `not-started`。
- 自动推断不得跳过尚未完成的 dependency。若候选 change 的 `Dependencies:` 指向的 planned change 未完成或未归档，必须选择依赖链上最早未完成的 change，或报告 blocker。
- 如果候选 change 缺少 final change packet，不得自动 propose，必须报告 final change packet 缺失。
- 如果候选 JSON handoff 或 legacy packet 中存在 direct atom 但 global atom index 查不到对应 `GA-####`，不得自动 propose，必须报告 atom index 与 change packet 不一致。
- 如果 archive 中已经存在目标 slug，绝不得再次运行 `openspec new change "<change-slug>"`；若 active 目录也存在同名 slug，先按 `state-conflict` 处理。

## Production Schema Entrypoints

1. `production-obligation-atom-driven` 只适用于无实质输入自动推断，或既有 change 的 `schemaName` 已是该 schema。若用户提供的目标不在 final packet index 中，报告目标超出 canonical change contract；不得自行扩展 scope。
2. `production-default-acceptance-driven` 适用于明确 change 名、需求、修复或后续修改。若用户只给自然语言描述，按该描述派生 kebab-case slug；仍无法判断 change boundary 时才提出简短澄清问题。
3. 创建或继续目标 change 后，主 Agent 必须运行 `openspec status --change "<name>" --json`，按 status 中的 ready artifacts 和 dependency graph 推进。不得在本文档中固定 artifact 处理次序；不得跳过 schema graph 中的 dependency。
4. 对每个 ready artifact，必须运行 `openspec instructions <artifact-id> --change "<name>" --json`，并把完整 instructions JSON 作为 writer 输入的一部分。
5. 对 proposal artifact，instructions JSON 中的 `template` 是 `trace/proposal.trace.json` 的 JSONC authoring guide，不是 `outputPath` / `proposal.md` 的 Markdown 模板；writer 必须输出严格 JSON trace，再由 renderer 生成 Markdown。
6. 每个 artifact 的内容读写边界由 selected schema instruction 和 contract bundle 共同约束；本文档不复制 artifact 内容契约。

## Contract Bundle Resolution

生成、修复或复核任一 production artifact 前，主 Agent 必须解析并读取该 artifact 的 contract bundle。

1. Bundle 顺序固定为：
   - `openspec/schemas/_production-contracts/common/chinese.md`
   - `openspec/schemas/_production-contracts/common/delivery-plane-trace-appendix.md`
   - `openspec/schemas/_production-contracts/common/no-evidence-or-test-plan.md`
   - `openspec/schemas/_production-contracts/common/source-scope-boundary.md`
   - `openspec/schemas/_production-contracts/common/reviewer-output-protocol.md`
   - `openspec/schemas/_production-contracts/profiles/<schema-name>.md`
   - `openspec/schemas/_production-contracts/artifacts/<artifact-id>.md`
   - `openspec/schemas/_production-contracts/overlays/<schema-name>/<artifact-id>.md`，仅在文件存在时读取。
2. Artifact-specific contract 文件名按 `<artifact-id>.md` 解析；当前 production artifact ids 均使用同名 contract basename。
3. 如果任一 required contract 文件缺失，必须停止并报告 `Artifact Consistency Blocker`；不得降级为只读 schema instruction 或主 Agent 自检。
4. Contract bundle 是 writer/reviewer 的共同 artifact 内容权威；不得把 contract 文本复制进 artifact 正文。

## Trace-First Writer Gate

1. Writer 和 repair-writer 写入任一 production artifact 前，必须先建立或更新当前 artifact 的 JSON trace sections。verification 还必须按 contract 写 `trace/verification.proof-slices.json`。
2. Writer/repair-writer 只能直接写当前 artifact 的 trace/proof-slices JSON，不得直接写或手工修改 Markdown artifact。
3. Proposal writer 使用 schema `template` 时，必须把 JSONC authoring guide 中的注释、占位符和示例值替换为严格 JSON；`trace/proposal.trace.json` 不得包含 JSONC 注释、占位符、trailing comma 或 Markdown section body。
4. 写完 trace 后必须调用 renderer：`node openspec/agent-runtime/scripts/render-production-artifacts.mjs --change "<change-slug>" --artifact "<artifact-id>" [--capability "<capability>" | --no-delta-specs] --write`。
5. Writer 在调用 renderer 前必须基于 trace 做 set-diff 自查；自查结论不得写入 artifact 正文。
6. repair-writer 必须重新读取最新上游 trace/sidecar JSON、contract bundle 和 validator/reviewer blocker 后重建当前 trace-backed ID 集，并重新调用 renderer。
7. 主 Agent 在 writer/repair-writer 自然返回前不得读取当前 artifact 中间落盘状态；返回后也不得把过程摘要当作 validator 或 reviewer 的 oracle。

## Partial / Complete Static Validation

1. Partial static validator 指不带 `--complete` 的命令：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>"`。它只验证当前 change 目录中已经存在的 artifacts 及其已声明 trace，不得要求尚未生成的下游 artifact、sidecar trace 或 apply-required artifact 提前存在。
2. 每次 writer 或 repair-writer 自然返回后，主 Agent 必须运行 partial validator。
3. Partial validator 必须检查已存在 artifact 的 `## Trace Appendix` 指针、trace 文件、manifest registry entry、`render-contract-version`、renderer exact output、JSON key 格式、当前 artifact 必需 trace sections，以及已存在 traces 之间可解析的交叉引用；不得要求或校验 production artifact 内容摘要。
4. `trace-contract-version: "proof-slices-v1"` 可从 proposal 阶段写入 manifest；它不表示 proposal/specs/design/runtime partial 阶段必须预先创建 verification sidecar trace。只有 `verification.md` 已存在或运行 complete validator 时，`trace/verification.proof-slices.json` 才是必需文件。
5. Complete validator 指带 `--complete` 的命令：`node openspec/agent-runtime/scripts/validate-production-artifacts.mjs --change "<change-slug>" --complete`。它必须要求 selected schema 的 apply-required artifacts 全部存在，并校验完整 trace plane、verification proof-slices sidecar、runtime/verification/tasks reconciliation 和跨 artifact 闭环。

## Artifact Writer / Reviewer Loop

1. Artifact 必须按 `openspec status --change "<name>" --json` 返回的 schema dependency graph 处理；不得按本文档中的示例、记忆或固定顺序处理。
2. 每个 artifact 必须使用对应 writer 和 reviewer subagent。默认命名为 `<artifact-id>-writer`、`<artifact-id>-reviewer` 和 `<artifact-id>-repair-writer`；`verification` reviewer 必须聚焦 Proof Slice 粒度、runtime row 分支枚举和 reconciliation 真实性。
3. Writer、repair-writer、reviewer 和 integration reviewer 都必须使用 `model=GPT-5.5` 且 `reasoningEffort=xhigh`；若当前环境无法创建对应 subagent，必须停止并报告 blocker，不得降级为主 Agent 自检或低配模型。
4. Writer 输入必须包含：change 名称、schema 名称、完整 `openspec instructions ... --json` 输出、已完成 dependency trace/sidecar JSON 路径和内容、contract bundle 路径和内容、必要 source/scope/baseline read set、renderer CLI 命令和本文档路径。
5. 任一 writer、repair-writer、reviewer 或 integration reviewer 运行期间，主 Agent 只能执行必要的编排等待和状态记录；不得读取当前 artifact 中间状态、运行 validator、接手修复/复核，或向正在运行的 subagent 注入中途发现。
6. Writer 或 repair-writer 自然返回最终完成或明确 blocker 前，主 Agent 不得运行 partial validator、启动 reviewer 或继续生成依赖该 artifact 的下游 artifact。
7. Writer 或 repair-writer 完成后，partial validator hard error 必须由当前 artifact 的 repair-writer 修复；warning 必须传给 artifact reviewer。
8. Partial validator hard pass 后，主 Agent 才能启动 artifact reviewer。Reviewer 输入必须包含当前 artifact trace/sidecar JSON、必要 upstream dependency trace/sidecar JSON、contract bundle、partial validator 报告和 propose result 未关闭 blocker 摘要；不得把当前或上游 Markdown artifact 作为 reviewer 语义输入。
9. Reviewer 不得读取当前实现、测试文件、Markdown Delivery Plane、`openspec-results/**` apply evidence、`apply-result.md`、`proof-test-map.json`、evidence 或 apply 阶段产物来推导 oracle。Reviewer 只能输出 `Pass` 或 `Blocker`；Blocker 必须包含 artifact path、trace anchor、contract source path + section heading、问题描述和修复方向。
10. 主 Agent 收到 reviewer blocker 后必须分派当前 artifact 的 repair-writer，等待其自然返回，重新运行 partial validator，并重新启动同一 artifact reviewer。Reviewer pass 且 validator hard pass 前，不得继续下游 artifact。
11. Reviewer finding 不使用人为稳定编号；必须使用 artifact path、trace section/row、contract section、`GA-####`、`SI-###`、`RS-/OP-/ST-/CH-`、`PS-###`、`AC-###` 等自然锚点定位。

## Propose Result Record

1. Propose runtime 必须写入或更新 `openspec-results/<change-slug>/propose-result.md`。该文件是过程审计记录，不得替代 artifact、JSON trace、validator、reviewer、apply evidence 或 archive proof。
2. 主 Agent 创建 change 后必须初始化 propose result，并至少记录 change 名称、schema 名称、创建日期、选择来源、active/archive 盘点摘要、source handoff / baseline 输入摘要、source/scope ID 集合、schema dependency graph 摘要和结果文件路径。
3. 每次 writer、repair-writer、partial validator、artifact reviewer、full validator 和 integration reviewer 自然返回后，主 Agent 必须在 propose result 中追加或更新记录。记录只能使用自然返回报告、validator 输出、reviewer 输出、最终落盘 trace 路径和 renderer 状态。
4. Propose result 至少包含 `Artifact Runs` 表，字段为 `sequence`、`artifact-id`、`agent-role`、`agent-id`、`status`、`validator`、`reviewer`、`trace-paths`、`notes`。同一 artifact 多轮 repair/review 必须保留轮次。
5. Propose result 必须包含 `Blocker / Repair Log` 表，记录所有 writer blocker、validator hard error、reviewer blocker、integration blocker、修复 agent、最小修复摘要、复跑 validator 结果和复审结论。无 blocker 时也必须显式写 `None`。
6. Propose result 必须包含 `Final Gates` 小节，记录 partial validators、full validator、artifact reviewer pass、integration reviewer pass、`openspec status --change "<change-slug>"` 摘要和是否 apply-ready。未满足所有门禁前，`apply-ready` 必须写为 `no` 并说明未满足项。
7. Propose result 不得写入测试计划、实际测试命令、测试文件、evidence/deposit、Proof Slice 通过结果或任何 apply-stage evidence 结论。
8. 若 propose result 与 artifact / trace / validator 结论冲突，必须以 artifact / trace / validator 为准并报告 `Artifact Consistency Blocker`。

## Complete Validation / Integration Reviewer

1. 当 selected schema 的 apply-required artifacts 全部完成，并且每个已生成 artifact reviewer pass 后，必须运行 complete validator。
2. Full validator hard error 阻断 integration reviewer 和 apply-ready 声明；主 Agent 必须分派受影响 artifact 的 repair-writer 修复，再按受影响 artifact 重新运行 partial validator 和 artifact reviewer。
3. Full validator hard pass 后，必须启动一次且仅一次 `artifact-integration-reviewer`。
4. Integration reviewer 输入必须包含：change 名称、schema 名称、完整 static validator 报告、所有 artifact reviewer 输出、已生成 artifact trace/sidecar JSON 路径和内容、相关 contract bundle 路径，以及 propose result 未关闭 blocker 摘要；不得把 Markdown artifact 作为 integration reviewer 语义输入。
5. Integration reviewer 只检查跨 trace reconciliation：source/scope projection 是否漂移、runtime rows 是否同时被 tasks 和 verification 正确投影、未关闭 blocker 是否存在、validator warning 是否处理、traces 是否互相发明新行为。
6. Integration reviewer 只读复核，不得直接修订 artifact。输出只能是 `Pass` 或 `Blocker`；Blocker 必须包含 artifact path、trace anchor、contract source heading、问题和修复方向。
7. 主 Agent 收到 integration blocker 后必须分派受影响 artifact 的 repair-writer，按受影响 artifact 重新运行 partial validator 和 artifact reviewer，再重新运行 full validator，并重新启动 integration reviewer。
8. 未满足 artifact reviewer pass、full validator hard pass 和 integration reviewer pass 前，不得声称 artifacts apply-ready，不得建议进入 apply，不得把 validator PASS 当作最终质量证明。

## Artifact 自查与旧格式边界

1. 每个 artifact 写入后必须按 contract bundle 做结构自查，而不是只依赖 OpenSpec CLI 格式校验。自查结果不得写入 artifact 正文；无法满足 contract 时必须作为 writer blocker 或 reviewer blocker 处理。
2. Propose 完成后必须确认 runtime/tasks/verification 没有 source/scope 外新增行为，且 verification/tasks 没有互相作为新增需求来源。
3. 两个 production schema 的新格式必须生成 runtime acceptance、verification 和 tasks apply-required artifacts，且 tasks 不允许包含旧测试矩阵。
4. 新 schema 不实现旧 change 兼容逻辑；已有旧 change 不在本流程内自动迁移。需要处理旧 change 时，必须单独制定迁移流程。
