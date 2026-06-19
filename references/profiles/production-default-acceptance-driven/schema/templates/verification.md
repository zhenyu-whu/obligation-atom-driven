## Verification Intent

<!--
本 artifact 定义 independent test intent and oracle artifact。
它只从 runtime-acceptance.md 的 canonical rows 推导 Proof Slice，不从 tasks.md、当前实现、测试文件结构或 evidence/deposit 结构推导。
runtime-acceptance.md 是唯一 scope-backed runtime/scope registry；verification.md 不重复 scope basis，不重新解释 proposal/spec/design trace。
-->

- Scope: <!-- 本次需要回归验证的产品/运行时行为范围。 -->
- Runtime source: <!-- runtime-acceptance.md canonical rows；例如 RS-001、OP-001。 -->
- Out of scope: <!-- 明确不验证的 artifact/process/implementation detail。 -->

## Proof Slice Matrix

<!--
Proof Slice 是 test agent 的唯一测试生成单位，也是本 artifact 的原子测试义务全集。
每个 required / preserve / proof-only runtime row 必须拆出所有独立可失败分支；每个分支生成一个 Proof Slice。
如果同一 runtime row 包含多个操作、状态、失败类、fixture variant、viewport、日志类别、安全分支或 redaction 类别，必须拆成多个 slice。
不得用一个 slice 覆盖 edit/add/delete、success/failure/empty、hit/mismatch、unauthenticated/foreign/deleted、desktop/notebook/mobile、started/succeeded/failed/retried、多个日志类别、多个 redaction 类别等多个独立分支。
verification.md 不新增 scope basis；如需审计 scope，通过 Proof Slice -> Runtime Row IDs -> runtime-acceptance row 反查。
Primitive Type 只能是 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization`。
Manual / Environment Gate 无门禁时写 None；有门禁时必须能通过对应 runtime row 的 scope role、default path、external boundary 或 no-scope boundary 解释。
-->

| Slice ID        | Runtime Row IDs                                                       | Primary Runtime Row ID                           | Primitive Type                                                                                                      | Branch / Variant                                                                           | Observable Surface                                                      | Oracle Fragment                                                                                                                                           | Failure Signal                          | Primary Layer                                                                                                                                       | Production Owner                                                     | Primary Assertion Shape                                                                        | Fixture / Mock Boundary                                              | Regression Intent                         | Manual / Environment Gate                               |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| <!-- PS-001 --> | <!-- RS-001, OP-001；只引用 runtime-acceptance.md 中已定义 rows。 --> | <!-- OP-001；必须包含在 Runtime Row IDs 中。 --> | <!-- operation / state / failure / negative-boundary / layout / observability / fixture-variant / authorization --> | <!-- 单一分支，例如 add item / empty result / idempotency_mismatch / mobile viewport。 --> | <!-- UI route/API/DB/job/worker/storage/auth/log 等可观察 surface。 --> | <!-- 单一原子行为断言；只能摘取或细分 runtime-acceptance canonical row 的 runtime obligation、observable fact、failure/branch/default/no-scope 字段。 --> | <!-- 该原子断言失败时的可观察偏差。 --> | <!-- unit / component / route/API / DB/integration / contract / worker/job / realtime/SSE / browser/e2e / visual/responsive / security/negative --> | <!-- apps/web；必须是 exactly one owner token，不写 owner list。 --> | <!-- 一个清晰失败定位点，例如 render assertion / API status+payload / DB row / log entry。 --> | <!-- 允许 fixture/mock 的边界，以及必须保持真实的 default path。 --> | <!-- high / medium / low + 中文理由。 --> | <!-- None 或 scope-backed manual/environment gate。 --> |

## Layer / Harness / Fixture Notes

<!--
按 Slice ID 或 Slice ID Set 补充跨 slice 的 layer、harness、fixture 说明。
这里不定义新的测试义务；所有可执行义务必须已经出现在 Proof Slice Matrix。
-->

| Slice ID Set            | Layer Reason                                                               | Harness Expectation                                                             | Mock / Fixture Boundary                                | Omitted Stable Layers / Reason                                               |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| <!-- PS-001, PS-002 --> | <!-- 为什么这些 slice 的 primary layer 足以证明对应 runtime behavior。 --> | <!-- 需要的 runner、browser、DB、worker、clock、network 或 visual harness。 --> | <!-- 哪些依赖可 mock，哪些 default path 必须真实。 --> | <!-- 被刻意省略的稳定层和原因；不得省略 runtime row 要求的唯一可观察层。 --> |

## Do Not Test

<!--
列出 scope-backed no-scope、external boundary、implementation detail 或 artifact/process 事项。
不得把 required / preserve / proof-only runtime row 的测试义务放入 Do Not Test。
-->

| Item                                                    | Reason                                                        | Runtime Row IDs                     |
| ------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| <!-- 例如 generated markdown formatting internals。 --> | <!-- 为什么不是 runtime/product verification obligation。 --> | <!-- None 或对应 runtime rows。 --> |

## Trace Appendix

Trace file: `trace/verification.trace.json`
Trace schema: `openspec-trace-v1`
Trace digest: `<sha256-to-be-filled-after-trace-json-is-written>`
