# Delivery Plane / JSON Trace Plane Contract

本文件定义两个 production schema 的共同 artifact 布局。

## 总体布局

- 每个 artifact 生成时必须先建立或更新当前 artifact 的 canonical JSON trace sections，再由 `render-production-artifacts.mjs` 从同一 trace-backed ID 集渲染 Delivery Plane 和 JSON Trace Plane。
- writer/repair-writer 只能直接写 trace/proof-slices JSON；不得直接写或手工修改 Markdown artifact。Markdown artifact、Trace Appendix 和 manifest digest 必须由 renderer 写入。
- 每个 artifact trace 必须包含 renderer 所需的 `delivery-plane` payload；缺失 payload 是 `VAL-RENDER-002` hard error。
- writer/repair-writer 必须基于 JSON trace 做 set-diff 自查：source/scope item、spec scenario、design obligation、runtime row、Proof Slice、AC 和 task projection 不得缺失、重复、跨类型引用或出现 orphan；自查结论不得写入 artifact 正文。
- 每个 artifact 主体是 Delivery Plane，只承载 reviewer、implementer 或 tester 直接消费的交付契约。
- JSON Trace Plane 是唯一 canonical trace，承载 coverage、source/scope trace、runtime projection、reconciliation、alignment gate 和 archive/preflight 审计。
- 每个 artifact 末尾必须保留短 `## Trace Appendix` 指针块，只包含 `Trace file`、`Trace schema` 和 `Trace digest` 三个字段。
- `Trace schema` 必须是 `openspec-trace-v1`；`Trace digest` 必须是 trace JSON 文件内容的 `sha256-<hex>`。
- trace JSON 必须位于 `openspec/changes/<change>/trace/**`，所有 JSON key 必须使用 kebab-case。
- artifact 末尾 `## Trace Appendix` 不得包含 Markdown coverage 表格、alignment checklist、runtime graph 或其它完整 trace 内容。
- 下游 artifacts 必须通过 JSON trace resolver 读取上游 trace 建立 coverage；不得把 trace rows 当作新增需求、测试计划、执行状态、evidence path、deposit status 或 worker executable work。
- `trace/manifest.json` 必须列出当前阶段已生成 artifact 的 artifact path、trace path 和 trace digest。新生成 production change 必须写入 `trace-contract-version: "proof-slices-v1"` 和 `render-contract-version: "trace-render-v1"`。
- static validator 必须复用 renderer pure function 做 exact output comparison；Markdown artifact 与 renderer 输出不一致是 `VAL-RENDER-001` warning，供 apply/propose/reviewer 判断是否需要重新渲染，但不作为 hard error 阻断。
- 当 `trace-contract-version` 为 `proof-slices-v1` 时，`trace/verification.proof-slices.json` 是 verification 阶段和 complete validation 的必需 sidecar trace，其 `trace-schema` 为 `openspec-proof-slices-v1`，并且必须在生成时登记到 manifest。proposal、specs、design 和 runtime-acceptance partial validation 阶段不得要求或伪造尚未生成的 verification sidecar trace。

## trace-render-v1 payload 形状

- proposal trace 的 `delivery-plane` 必须包含 `why`、`change-plan-boundary`、`what-changes`、`capabilities.new-capabilities`、`capabilities.modified-capabilities`、`non-goals`、`impact`、`rollout-readiness`。
- specs trace 的 `delivery-plane` 必须包含 `added-requirements`，并可包含 `modified-requirements`、`removed-requirements`、`renamed-requirements`；每个 requirement 必须包含 `name`、`body` 和至少一个 scenario。
- design trace 的 `delivery-plane` 必须包含固定 design sections 和 `decisions[]`；每个 decision 必须包含 `decision-id`、`title`、`decision`、`source-gap`、`minimal-shape`、`rejected-expansion`。
- runtime-acceptance trace 的 `delivery-plane` 必须包含 `runtime-acceptance-intent` 和 `canonical-rows[]`；`canonical-rows` 必须是数组，不能用 `RS-001` / `OP-001` 作为 JSON object key。renderer 按 trace `canonical-row-index.surface-rows`、`operation-rows`、`state-rows`、`chain-rows` 的顺序读取对应 row fields 渲染四张表。
- verification trace 的 `delivery-plane` 只包含 `verification-intent`、`layer-harness-fixture-notes[]`、`do-not-test[]`；Proof Slice canonical rows 必须来自 `trace/verification.proof-slices.json`，不得复制回 `verification.trace.json`。
- tasks trace 的 `delivery-plane` 必须包含 `acceptance-slices[]`；每个 slice 必须包含 AC heading payload、`runtime-rows`、`resolved-runtime-contract[]` 和 checkbox `tasks[]` payload。
- renderer 必须忠实渲染 delivery-plane 既有类型：字符串原样输出，字符串数组逐行输出；不得根据长度、分号或其它标点猜测拆分字符串。
- renderer 不接受整段 artifact Markdown payload；writer 不得通过把完整 Markdown body 塞入 JSON 来绕过结构化渲染。

## Artifact-specific 布局

- proposal 和 design 的 Delivery Plane 主体不得出现 exhaustive `GA-####` / `SI-###` coverage list、projection mix、coverage column、source/scope coverage suffix 或 alignment gate；这些内容只能写入对应 JSON trace。
- specs 只为真实 OpenSpec delta 创建文件；每个 generated spec 至少包含一个 `### Requirement:`，且必须以短 `## Trace Appendix` 指针块结束。
- `runtime-acceptance.md` 主体只定义 canonical `RS-/OP-/ST-/CH-` rows；`canonical-row-index`、source/scope map、coverage closure 和 upstream reconciliation 必须写入 `trace/runtime-acceptance.trace.json`。
- `verification.md` 主体必须包含 `Verification Intent`、`Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`；canonical Proof Slice 模型必须写入 `trace/verification.proof-slices.json`，`runtime-coverage-reconciliation` 和 `slice-consistency-checklist` 必须写入 `trace/verification.trace.json`。
- `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始，并以短 `## Trace Appendix` 指针块结束；AC 主体必须包含 `Resolved Runtime Contract`，coverage、runtime index 和 projection 必须写入 `trace/tasks.trace.json`。

## 禁止模式

- 不得用 checklist、coverage closure、主题汇总行或“全部覆盖”类陈述替代逐项 JSON trace 覆盖。
- 不得用 artifact 自身勾选、`coverage-status = covered` 或空 `missing-proof-slice-ids` 作为 reviewer 语义通过证明。
- 不得在 Delivery Plane 混入只服务审计的 exhaustive source/scope coverage。
- 不得在 trace JSON 中使用 camelCase、snake_case 或带空格的 key。
