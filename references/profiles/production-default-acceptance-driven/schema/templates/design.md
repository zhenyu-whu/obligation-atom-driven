<!-- Writer note: writer/repair-writer 只能写当前 artifact 的 JSON trace sections；随后运行 render-production-artifacts.mjs --write 从 trace 生成本 Delivery Plane、Trace Appendix 与 manifest digest。 -->

## Context

<!-- 总结此 change 的 production context、依赖、现有 specs 与 proposal boundary。不要在主体列 SI coverage；exact scope/source mapping 写入 JSON trace。 -->

## Goals / Non-Goals

<!-- Goals 和 Non-Goals 均必须追溯到 proposal/specs/baseline。 -->

## Decisions

<!-- 记录 implementation decisions。每个 decision 使用 Decision / Source Gap / Minimal Shape / Rejected Expansion 形态；不要加入 coverage/trace 列。 -->

## Architecture / Module Boundary Design

<!-- packages/apps/modules ownership、import direction、exported entry points、forbidden imports、cross-package contracts。 -->

## Domain / Data / Migration Design

<!-- tables/entities/DTOs/commands/migrations/transactions/idempotency/locks/repository contracts/data invariants。 -->

## API / Auth / Security Design

<!-- route handlers、request/response DTO、validation、session/cookie、actor resolver、authorization、return target、redaction、安全失败体。 -->

## Async / Realtime / AI / Worker Design

<!-- jobs、queues、SSE/outbox、provider/sandbox、payloads、retry/recovery、reconciler、locking、deferred boundaries。 -->

## Frontend / UX Design

<!-- routes、page surfaces、components、objects、state model、events、disabled/failure/retry、responsive、a11y、local-vs-server state。对 mutating controls，写清 owner component、client/runtime/hydration boundary、event trigger、handler/action/API route、payload、response merge/reload persistence 和 error/submitting behavior。 -->

## Observability / Ops / Deployment Design

<!-- log/event names or categories、allowed/forbidden fields、config/env、migration ordering、smoke、rollback、runbook。 -->

## Verification Design

<!-- 每个关键行为映射到 unit / DB integration / route/API / worker / SSE / storage / component / E2E / responsive / static guard / smoke。用户可见操作必须有 positive interaction proof；静态 DOM、截图或 SSR/static render 只能作补充。本节只描述 proof strategy；canonical RS-/OP-/ST-/CH- runtime row registry 必须由 runtime-acceptance.md 承载。 -->

## Rollout / Compatibility

<!-- migration ordering、backfill、compatibility、staging/production rollout、rollback constraints。 -->

## Risks / Trade-offs

<!-- 记录 production-compatible trade-offs，不得扩大 scope。 -->

## Open Questions

<!-- 没有剩余问题时写“无”。 -->

## Trace Appendix

Trace file: `trace/design.trace.json`
Trace schema: `openspec-trace-v1`
Trace digest: `<sha256-to-be-filled-after-trace-json-is-written>`
