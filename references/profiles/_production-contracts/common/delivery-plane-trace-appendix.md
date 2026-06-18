# Delivery Plane / Trace Appendix Contract

本文件定义两个 production schema 的共同 artifact 布局。

## 总体布局

- 每个 artifact 主体是 Delivery Plane，只承载 reviewer、implementer 或 tester 直接消费的交付契约。
- `## Trace Appendix` 必须位于 artifact 末尾，用于覆盖映射、source/scope trace、runtime projection、reconciliation、alignment gate 和 archive/preflight 审计。
- `## Trace Appendix` 后不得追加任何其它 artifact section。
- 下游 artifacts 可以读取上游 `Trace Appendix` 建立 coverage；不得把 appendix 表格行当作新增需求、测试计划、执行状态、evidence path、deposit status 或 worker executable work。

## Artifact-specific 布局

- proposal 和 design 的 Delivery Plane 主体不得出现 exhaustive `GA-####` / `SI-###` coverage list、projection mix、coverage column、source/scope coverage suffix 或 alignment gate；这些内容只允许出现在 `Trace Appendix`。
- specs 只为真实 OpenSpec delta 创建文件；每个 generated spec 至少包含一个 `### Requirement:`，且必须以 `## Trace Appendix` 结束。
- `runtime-acceptance.md` 主体只定义 canonical `RS-/OP-/ST-/CH-` rows；source/scope map、coverage closure 和 upstream reconciliation 必须在 `Trace Appendix`。
- `verification.md` 主体必须包含 `Verification Intent`、`Proof Slice Matrix`、`Layer / Harness / Fixture Notes`、`Do Not Test`；`Runtime Coverage Reconciliation` 和 `Slice Consistency Checklist` 必须在 `Trace Appendix`。
- `tasks.md` 必须以 `## AC-### <name>` Delivery Plane sections 开始，并以 `## Trace Appendix` 结束；AC 主体必须包含 `Resolved Runtime Contract`，appendix 保留 coverage、runtime index 和 projection。

## 禁止模式

- 不得用 checklist、coverage closure、主题汇总行或“全部覆盖”类陈述替代逐项覆盖。
- 不得用 artifact 自身勾选、`Coverage Status = covered` 或 `Missing Proof Slice IDs = None` 作为 reviewer 语义通过证明。
- 不得在 Delivery Plane 混入只服务审计的 exhaustive source/scope coverage。
