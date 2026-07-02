<!-- Writer note: writer/repair-writer 只能写当前 artifact 的 JSON trace sections；随后运行 render-production-artifacts.mjs --write 从 trace 生成本 Delivery Plane、Trace Appendix 与 manifest registry entry。 -->

## Why

<!-- 说明此 production change 的动机：它解决或解锁了哪个产品、架构、production-readiness 或 verification 缺口？不要在主体列 GA coverage；exact atom/source 映射写入 JSON trace。 -->

## Change Plan Boundary

<!-- 从 final change packet 摘要当前 change 的 closed-loop outcome、in scope、out of scope、dependencies、archive readiness。不要在主体列 direct/contextual atom 清单；`change-plan.md` 只在自动推断或依赖顺序核对时引用，不得覆盖 final packet。 -->

## What Changes

<!-- 描述此 change 修改的 source-backed 产品行为、生产代码、data/API contracts、routes、objects、jobs、events、auth/security rules、storage、billing/entitlement rules、observability、deployment 与 verification surfaces。只写行为和边界，不写审计映射；需要列表效果时在 trace 中显式使用数组或 Markdown 换行，renderer 不自动拆分字符串。 -->

## Capabilities

### New Capabilities

<!-- 描述新增 capabilities。将 <name> 替换为 kebab-case identifier；只有包含 spec-requirement 或 spec-guard delta 的 capability 才会创建 specs/<name>/spec.md。纯 design-obligation / verification-obligation capability 不创建空 spec；若整个 change 无 spec-level delta，specs artifact 用 specs/no-spec-delta/README.md marker 完成。 -->

- `<name>`: <概述该 capability 的交付范围、行为边界和 readiness 要求；exact atom mapping 写入 JSON trace>

### Modified Capabilities

<!-- 描述 REQUIREMENTS 发生变化的 existing capabilities。使用 openspec/specs/ 中已有 spec 名称；没有 requirement 变化时留空。 -->

- `<existing-name>`: <说明变化的 requirement、guard 或 delivery boundary；exact atom mapping 写入 JSON trace>

## Non-Goals

<!-- 只写当前 final packet direct rows、owner-scoped non-direct boundary rows 或 packet out-of-scope summary 支撑的 non-goal。不得从 Phase 4 wide source window、change-plan 通用摘要或其它 packet owned atoms 摘取后续能力名称；不要在主体列 GA coverage，也不要把边界说明扩展成全仓结构冻结式 guard。 -->

## Impact

<!-- 说明受影响的 apps、packages、database migrations、APIs、workers、queues、SSE/outbox events、frontend routes、components、assets、auth/security/privacy boundaries、observability、deployment、verification commands 与 dependencies。 -->

## Rollout / Readiness

<!-- 说明 migration ordering、environment/config needs、backfill、compatibility、staging/production smoke、operational runbook、monitoring/audit readiness；不适用时写“无”。 -->

## Trace Appendix

Trace file: `trace/proposal.trace.json`
Trace schema: `openspec-trace-v1`
