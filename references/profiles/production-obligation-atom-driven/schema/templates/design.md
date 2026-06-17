## Context

<!-- 总结此 change 的 production context、依赖、现有 specs 与 proposal boundary。不要在主体列 GA coverage；exact source/atom mapping 写入 Trace Appendix。 -->

## Goals / Non-Goals

<!-- Goals 和 Non-Goals 只表达设计目标、边界和 later-change exclusions；exact GA/source trace 写入 Trace Appendix。 -->

## Decisions

<!-- 记录 source-backed implementation decisions。每个 decision 使用 Decision / Source Gap / Minimal Shape / Rejected Expansion 形态；不要加入 coverage/trace 列。 -->

## Architecture / Module Boundary Design

<!-- packages/apps/modules ownership、import direction、exported entry points、forbidden imports、cross-package contracts。 -->

## Domain / Data / Migration Design

<!-- tables/entities/DTOs/commands/migrations/transactions/idempotency/locks/repository contracts/data invariants。 -->

## API / Auth / Security Design

<!-- route handlers、request/response DTO、validation、session/cookie、actor resolver、authorization、return target、redaction、安全失败体。 -->

## Async / Realtime / AI / Worker Design

<!-- jobs、queues、SSE/outbox、provider/sandbox、payloads、retry/recovery、reconciler、locking、deferred boundaries。 -->

## Frontend / UX / Prototype Fidelity Design

<!-- routes、page surfaces、components、objects、state model、events、disabled/failure/retry、responsive、a11y、local-vs-server state。对 mutating controls，写清 owner component、client/runtime/hydration boundary、event trigger、handler/action/API route、payload、response merge/reload persistence 和 error/submitting behavior。 -->

## Observability / Ops / Deployment Design

<!-- log/event names or categories、allowed/forbidden fields、config/env、migration ordering、smoke、rollback、runbook。 -->

## Verification Design

<!-- 每个关键行为映射到 unit / DB integration / route/API / worker / SSE / storage / component / E2E / responsive / stable negative boundary check / smoke。用户可见操作必须有 positive interaction proof；静态 DOM、截图或 SSR/static render 只能作补充。不要生成完整 route/file/table allowlist 这类全仓结构冻结式 guard，除非用户显式要求架构冻结。本节只描述 proof strategy；canonical RS-/OP-/ST-/CH- runtime row registry 必须由 runtime-acceptance.md 承载。 -->

## Rollout / Compatibility

<!-- migration ordering、backfill、compatibility、staging/production rollout、rollback constraints。 -->

## Risks / Trade-offs

<!-- 记录 source-compatible trade-offs，不得扩大 scope。 -->

## Open Questions

<!-- 没有剩余问题时写“无”。 -->

## Trace Appendix

<!-- 本附录是审计平面，不是 Delivery Plane。主 agent、archive、final reviewer 可读取它确认 source/design 覆盖；implementation worker 默认不把本附录表格当作 executable work。 -->

### Production Source Map

<!-- 将此 change 映射到 Global Atom IDs、source files、line ranges 与 exact original sources。不要用整篇文档代替精准 line ranges。 -->

| Global Atom ID | Artifact Projection                                                                                    | Source Document / Lines   | Design Consumption                    | Implementation Boundary                         |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------- | ----------------------------------------------- |
| `GA-0001`      | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation / contextual-only --> | <!-- exact path Lx-Ly --> | <!-- 此 atom 在 design 中约束什么 --> | <!-- module/API/data/UI/worker/ops boundary --> |

### Production Alignment Gate

- Global Atom IDs implemented / preserved / deferred: <!-- GA-0001 implemented, GA-0002 preserved, GA-0003 deferred；逐个枚举 exact IDs，不使用 ranges -->
- Artifact Projection handling: <!-- design-obligation 已进入 design；verification-obligation 已进入 Verification Design/tasks handoff；spec-guard 已体现 preserve / stable negative behavior；无 projection mismatch -->
- Spec scenarios covered by design: <!-- requirement/scenario names -->
- Orphan direct atoms: <!-- none / exact GA blockers -->
- Source-backed implementation decisions minimal: <!-- 是 / blocker；列出关键 decision 与 rejected expansion -->
- Source-defined identifiers used: <!-- workflows/routes/states/data keys/tables/commands/APIs/jobs/events/object keys/entitlements/environments/lifecycle terms -->
- Source trace complete: <!-- 是 / blocker -->
- New identifiers introduced: <!-- 无，或列出并说明 source-backed implementation decision -->
- Interaction trace complete: <!-- 是 / blocker -->
- Data mutation ownership complete: <!-- 是 / 不适用 / blocker -->
- Auth/security/privacy complete: <!-- 是 / 不适用 / blocker -->
- Async/realtime/worker complete: <!-- 是 / 不适用 / blocker -->
- UI/prototype/responsive complete: <!-- 是 / 不适用 / blocker -->
- Observability/ops/deployment complete: <!-- 是 / 不适用 / blocker -->
- Later-change boundaries preserved: <!-- 是 / blocker -->
- Implementation inference remaining: <!-- 无 / open question -->
