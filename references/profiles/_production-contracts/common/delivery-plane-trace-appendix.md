# Delivery Plane / JSON Trace Plane Contract

本文件定义两个 production schema 的共同 artifact 布局。

## 总体布局

- 每个 artifact 主体是 Delivery Plane，只承载 reviewer、implementer 或 tester 直接消费的交付契约。
- JSON Trace Plane 是唯一 canonical trace，承载 coverage、source/scope trace、runtime projection、reconciliation、alignment gate 和 archive/preflight 审计。
- 每个 artifact 末尾必须保留短 `## Trace Appendix` 指针块，只包含 `Trace file`、`Trace schema` 和 `Trace digest` 三个字段。
- `Trace schema` 必须是 `openspec-trace-v1`；`Trace digest` 必须是 trace JSON 文件内容的 `sha256-<hex>`。
- trace JSON 必须位于 `openspec/changes/<change>/trace/**`，所有 JSON key 必须使用 kebab-case。
- artifact 末尾 `## Trace Appendix` 不得包含 Markdown coverage 表格、alignment checklist、runtime graph 或其它完整 trace 内容。
- 下游 artifacts 必须通过 JSON trace resolver 读取上游 trace 建立 coverage；不得把 trace rows 当作新增需求、测试计划、执行状态、evidence path、deposit status 或 worker executable work。
- `trace/manifest.json` 必须列出当前阶段已生成 artifact 的 artifact path、trace path 和 trace digest。新生成 production change 必须写入 `trace-contract-version: "proof-slices-v1"`。
- 当 `trace-contract-version` 为 `proof-slices-v1` 时，`trace/verification.proof-slices.json` 是 verification 阶段和 complete validation 的必需 sidecar trace，其 `trace-schema` 为 `openspec-proof-slices-v1`，并且必须在生成时登记到 manifest。proposal、specs、design 和 runtime-acceptance partial validation 阶段不得要求或伪造尚未生成的 verification sidecar trace。

## Artifact-specific 布局

- proposal 和 design 的 Delivery Plane 主体不得出现 exhaustive `GA-####` / `SI-###` coverage list、projection mix、coverage column、source/scope coverage suffix 或 alignment gate；这些内容只能写入对应 JSON trace。
- specs 只为真实 OpenSpec delta 创建文件；每个 generated spec 至少包含一个 `### Requirement:`，且必须以短 `## Trace Appendix` 指针块结束。
- `runtime-acceptance.md` 主体只定义 canonical `RS-/OP-/ST-/CH-` rows；source/scope map、coverage closure 和 upstream reconciliation 必须写入 `trace/runtime-acceptance.trace.json`。
- `verification.md` 主体必须包含 `Verification Intent`、`Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`；canonical Proof Slice 模型必须写入 `trace/verification.proof-slices.json`，`runtime-coverage-reconciliation` 和 `slice-consistency-checklist` 必须写入 `trace/verification.trace.json`。
- `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始，并以短 `## Trace Appendix` 指针块结束；AC 主体必须包含 `Resolved Runtime Contract`，coverage、runtime index 和 projection 必须写入 `trace/tasks.trace.json`。

## 禁止模式

- 不得用 checklist、coverage closure、主题汇总行或“全部覆盖”类陈述替代逐项 JSON trace 覆盖。
- 不得用 artifact 自身勾选、`coverage-status = covered` 或空 `missing-proof-slice-ids` 作为 reviewer 语义通过证明。
- 不得在 Delivery Plane 混入只服务审计的 exhaustive source/scope coverage。
- 不得在 trace JSON 中使用 camelCase、snake_case 或带空格的 key。
