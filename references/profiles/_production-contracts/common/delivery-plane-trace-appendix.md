# Delivery Plane / JSON Trace Plane Contract

本文件定义两个 production schema 的共同 artifact 布局。

## 总体布局

- 每个 artifact 生成时必须先建立或更新当前 artifact 的 canonical JSON trace sections，再由 `render-production-artifacts.mjs` 从同一 trace-backed ID 集渲染 Markdown Delivery Plane。
- writer/repair-writer 只能直接写 trace JSON；不得直接写或手工修改 Markdown artifact。Markdown artifact、Trace Appendix 和 manifest registry entry 必须由 renderer 写入。新格式不得创建 verification sidecar。
- 每个 artifact trace 必须包含 renderer 所需的 `delivery-plane` payload；缺失 payload 是 `VAL-RENDER-002` hard error。
- writer/repair-writer 必须基于 JSON trace 做 set-diff 自查：source/scope item、spec scenario、design obligation、runtime fact、Proof Slice、AC 和 task projection 不得缺失、重复、跨类型引用或出现 orphan；自查结论不得写入 artifact 正文。
- 每个 artifact 主体是 Markdown Delivery Plane，只承载 renderer 从 trace 投影出来的人类可读交付契约。
- JSON Trace Plane 是唯一 canonical trace，承载 coverage、source/scope trace、runtime projection、reconciliation、alignment gate 和 archive/preflight 审计。
- 下游 artifact writer、repair-writer、artifact reviewer 和 integration reviewer 的上游语义输入只允许使用 dependency trace JSON。不得从上游 Markdown Delivery Plane 推导 scope、coverage、runtime fact、Proof Slice、AC 或 oracle。
- 每个 artifact 末尾必须保留短 `## Trace Appendix` 指针块，只包含 `Trace file` 和 `Trace schema` 两个字段。
- `Trace schema` 必须是 `openspec-trace-v1`。
- trace JSON 必须位于 `openspec/changes/<change>/trace/**`，所有 JSON key 必须使用 kebab-case。
- artifact 末尾 `## Trace Appendix` 不得包含 Markdown coverage 表格、alignment checklist、runtime graph 或其它完整 trace 内容。
- 下游 artifacts 必须通过 JSON trace resolver 读取上游 trace 建立 coverage；不得把 trace rows 当作新增需求、测试计划、执行状态、evidence path、deposit status 或 worker executable work。
- `trace/manifest.json` 如保留，只是非权威 registry/version metadata，可列出当前阶段已生成 artifact 的 artifact path、trace path 和 trace schema。下游不得通过 manifest registry metadata 解析上游语义。新生成 production change 必须写入 `trace-contract-version: "verification-slice-register-v2"` 和 `render-contract-version: "trace-render-v1"`。
- static validator 必须复用 renderer pure function 做 exact output comparison；Markdown artifact 与 renderer 输出不一致是 `VAL-RENDER-001` warning，供 apply/propose/reviewer 判断是否需要重新渲染，但不作为 hard error 阻断。
- 当 `trace-contract-version` 为 `verification-slice-register-v2` 时，`trace/verification.trace.json#/verification-slice-register` 是 verification 阶段和 complete validation 的必需 Proof Slice register。新格式不得生成或登记 `trace/verification.proof-slices.json`。
- `verification-slice-register[]` 的每个 canonical row 必须包含 `proof-evidence-mode` 和 `planned-test-directory`。`proof-evidence-mode: "durable-test"` 表示必须生成或确认持久测试；其它 mode 表示非持久 proof，且 `planned-test-directory` 必须为 `N/A`。propose 阶段只允许写目录级 planned test directory glob，不允许写具体测试文件、固定命令、runner selector 或 evidence path。

## trace-render-v1 payload 形状

- proposal trace 的 `delivery-plane` 必须包含 `why`、`change-plan-boundary`、`what-changes`、`capabilities.new-capabilities`、`capabilities.modified-capabilities`、`non-goals`、`impact`、`rollout-readiness`。
- normal delta specs trace 的 `delivery-plane` 必须在 `added-requirements`、`modified-requirements`、`removed-requirements`、`renamed-requirements` 中至少包含一个非空 section；added/modified requirement 必须包含 `name`、`body` 和至少一个 scenario，removed requirement 必须包含 `name`、`reason`、`migration`，renamed requirement 必须包含 `from`、`to`。no-delta specs trace 的 `delivery-plane` 必须包含 `completion-mode: "no-delta"`、`summary` 和 `projection-closure`。Specs 的 canonical semantic model 是 `spec-delta-register[]`，`delivery-plane` 必须由该 register 投影。
- design trace 的 `delivery-plane` 必须包含固定 design sections 和 `decisions[]`；每个 decision 只能包含 `decision-id`，作为 `implementation-design-register[]` 的 Markdown 渲染顺序。Renderer 必须按该 ID 从 `implementation-design-register[]` 读取 `title` 和 `decision`。
- runtime-acceptance trace 的 `delivery-plane` 必须包含 `runtime-acceptance-intent` 和 `fact-sections`；`fact-sections.surface-facts`、`operation-facts`、`state-facts`、`chain-facts` 只保存 `runtime-fact-id` 顺序。renderer 按这些 ID 从 `runtime-fact-register[]` 投影四张表，Delivery Plane 不得重复定义事实字段。
- verification trace 的 `delivery-plane` 只包含 `verification-intent`；Proof Slice canonical rows 必须来自 `trace/verification.trace.json#/verification-slice-register`，不得复制到 `delivery-plane`。
- tasks trace 的 canonical semantic model 是 `implementation-step-register[]`；`delivery-plane` 只包含 `step-sections[]` step ID 顺序，renderer 按该顺序从 register 渲染 AC sections 和 checkbox tasks。
- renderer 必须忠实渲染 delivery-plane 既有类型：字符串原样输出，字符串数组逐行输出；不得根据长度、分号或其它标点猜测拆分字符串。
- renderer 不接受整段 artifact Markdown payload；writer 不得通过把完整 Markdown body 塞入 JSON 来绕过结构化渲染。

## Artifact-specific 布局

- proposal 和 design 的 Delivery Plane 主体不得出现 exhaustive `GA-####` / `SI-###` coverage list、projection mix、coverage column、source/scope coverage suffix 或 alignment gate；这些内容只能写入对应 JSON trace。
- specs 只为真实 OpenSpec delta 创建文件；每个 generated spec 至少包含一个 `### Requirement:`，且必须以短 `## Trace Appendix` 指针块结束。
- `runtime-acceptance.md` 主体只渲染 canonical `RS-/OP-/ST-/CH-` runtime facts；事实细化必须写入 `trace/runtime-acceptance.trace.json#/runtime-fact-register`，闭合问题必须写入 `runtime-gate`，不得再生成 source/scope map、coverage closure、`canonical-row-index`、`canonical-rows[]` 或 upstream reconciliation 旧字段。
- `verification.md` 主体必须包含 `Verification Intent` 和 `Proof Slice Matrix`；canonical Proof Slice register 和目录级 placement 规划必须写入 `trace/verification.trace.json#/verification-slice-register`，coverage 由 validator 从 runtime facts 和 slice refs 派生。
- `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始，并以短 `## Trace Appendix` 指针块结束；AC 主体只渲染 `Work Stage`、非空 `Depends On` 和 checkbox tasks，checkbox 只渲染 `Work Stage` 与 `Work`。Spec/design/runtime contribution links 只保留在 `trace/tasks.trace.json`。

## 禁止模式

- 不得用 checklist、coverage closure、主题汇总行或“全部覆盖”类陈述替代逐项 JSON trace 覆盖。
- 不得用 artifact 自身勾选、`coverage-status = covered` 或空 `missing-proof-slice-ids` 作为 reviewer 语义通过证明。
- 不得在 Delivery Plane 混入只服务审计的 exhaustive source/scope coverage。
- 不得在 trace JSON 中使用 camelCase、snake_case 或带空格的 key。
