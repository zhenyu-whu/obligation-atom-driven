<!-- Writer note: writer/repair-writer 只能写当前 artifact 的 JSON trace sections；随后运行 render-production-artifacts.mjs --write 从 trace 生成本 Delivery Plane、Trace Appendix 与 manifest digest。 -->

## Verification Intent

<!--
本 artifact 定义 independent test intent and oracle artifact。
它只从 runtime-acceptance.md 的 canonical rows 推导 Proof Slice，不从 tasks.md、当前实现、测试文件结构或 evidence/deposit 结构推导。
runtime-acceptance.md 是唯一 source-backed runtime/source registry；verification.md 不重复 source mapping，不重新解释 GA/source trace。
-->

- Scope: <!-- 本次需要回归验证的产品/运行时行为范围。 -->
- Runtime source: <!-- runtime-acceptance.md canonical rows；例如 RS-001、OP-001。 -->
- Out of scope: <!-- 明确不验证的 artifact/process/implementation detail。 -->

## Proof Slice Matrix

<!--
Proof Slice 是 test agent 的唯一测试生成单位，也是本 artifact 的原子测试义务全集。
每个 required / preserve / proof-only runtime row 必须拆出所有独立可失败分支；每个分支生成一个 Proof Slice。
Proof Slice 必须覆盖 runtime acceptance 分支；`Persistent Test Required` 只决定 apply 阶段是否生成/确认长期测试代码。
如果同一 runtime row 包含多个操作、状态、失败类、fixture variant、viewport、日志类别、安全分支或 redaction 类别，必须拆成多个 slice。
不得用一个 slice 覆盖 edit/add/delete、success/failure/empty、hit/mismatch、unauthenticated/foreign/deleted、desktop/notebook/mobile、started/succeeded/failed/retried、多个日志类别、多个 redaction 类别等多个独立分支。
verification.md 不新增 source mapping；如需审计 source，通过 Proof Slice -> Runtime Row IDs -> runtime-acceptance canonical row 反查。
Primitive Type 只能是 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization`。
Persistent Test Required 必须是 true/false。business change 且 Manual / Environment Gate 为 None 时必须为 true；foundation change 可逐 slice 为 false。
Proof Evidence Mode 只能是 `durable-test`、`readiness-command`、`build-command`、`codegen-command`、`compose-config-readback`、`static-boundary-readback`、`manual-environment`。true 时必须 durable-test；false 时不得 durable-test。
Manual / Environment Gate 无门禁时写 None；有门禁时必须能通过对应 runtime row 的 source-backed scope role、default path、external boundary 或 no-scope boundary 解释。
-->

| Slice ID        | Runtime Row IDs                                                       | Primary Runtime Row ID                           | Primitive Type                                                                                                      | Branch / Variant                                                                           | Observable Surface                                                      | Oracle Fragment                                                                                                                                           | Failure Signal                          | Primary Layer                                                                                                                                       | Production Owner                                                     | Persistent Test Required                        | Proof Evidence Mode                                                                                                                    | Primary Assertion Shape                                                                        | Fixture / Mock Boundary                                              | Regression Intent                         | Manual / Environment Gate                                |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| <!-- PS-001 --> | <!-- RS-001, OP-001；只引用 runtime-acceptance.md 中已定义 rows。 --> | <!-- OP-001；必须包含在 Runtime Row IDs 中。 --> | <!-- operation / state / failure / negative-boundary / layout / observability / fixture-variant / authorization --> | <!-- 单一分支，例如 add item / empty result / idempotency_mismatch / mobile viewport。 --> | <!-- UI route/API/DB/job/worker/storage/auth/log 等可观察 surface。 --> | <!-- 单一原子行为断言；只能摘取或细分 runtime-acceptance canonical row 的 runtime obligation、observable fact、failure/branch/default/no-scope 字段。 --> | <!-- 该原子断言失败时的可观察偏差。 --> | <!-- unit / component / route/API / DB/integration / contract / worker/job / realtime/SSE / browser/e2e / visual/responsive / security/negative --> | <!-- apps/web；必须是 exactly one owner token，不写 owner list。 --> | <!-- true 或 false；business 默认 true。 --> | <!-- durable-test / readiness-command / build-command / codegen-command / compose-config-readback / static-boundary-readback / manual-environment --> | <!-- 一个清晰失败定位点，例如 render assertion / API status+payload / DB row / log entry。 --> | <!-- 允许 fixture/mock 的边界，以及必须保持真实的 default path。 --> | <!-- high / medium / low + 中文理由。 --> | <!-- None 或 source-backed manual/environment gate。 --> |

## Planned Test Placement Matrix

<!--
由 renderer 从 trace/verification.proof-slices.json 的 test-contract.placement 生成。
只允许目录级 planned-test-directory glob；persistent=true 必须是外置 tests/ 子树并以 /** 结尾，persistent=false 固定为 N/A + nonpersistent-evidence。
不得写具体测试文件、固定命令、runner selector、evidence path、openspec-results/** 或 test-results/**。
-->

| Slice ID        | Persistent Test Required                        | Proof Evidence Mode                                                                                                                    | Planned Test Directory                                      | Placement Basis                                                                                                      | Placement Reason                                                       |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| <!-- PS-001 --> | <!-- true 或 false；必须与 Proof Slice Matrix 一致。 --> | <!-- durable-test / readiness-command / build-command / codegen-command / compose-config-readback / static-boundary-readback / manual-environment --> | <!-- apps/web/tests/component/**；non-persistent 时写 N/A。 --> | <!-- existing-tests-directory / planned-layer-subdirectory / workspace-tests-directory / nonpersistent-evidence --> | <!-- 中文说明，基于当前 repo layout、Primary Layer 和 Production Owner。 --> |

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
列出 source-backed no-scope、external boundary、implementation detail 或 artifact/process 事项。
不得把 required / preserve / proof-only runtime row 的测试义务放入 Do Not Test。
-->

| Item                                                    | Reason                                                        | Runtime Row IDs                     |
| ------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| <!-- 例如 generated markdown formatting internals。 --> | <!-- 为什么不是 runtime/product verification obligation。 --> | <!-- None 或对应 runtime rows。 --> |

## Trace Appendix

Trace file: `trace/verification.trace.json`
Trace schema: `openspec-trace-v1`
Trace digest: `<sha256-to-be-filled-after-trace-json-is-written>`
