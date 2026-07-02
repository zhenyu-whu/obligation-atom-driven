# Verification Artifact Contract

## 目的

`verification.md` 是 independent test intent and oracle artifact。Proof Slice 是唯一测试义务单位；新格式下 canonical Proof Slice 模型必须写入 `trace/verification.proof-slices.json`，`verification.md` 中的 `Proof Slice Matrix` 只是该 JSON 的人类可读镜像。本 artifact 不生成、不引用额外业务 oracle 分组 ID，不定义测试执行计划。

## 写入前

- 读取 `trace/runtime-acceptance.trace.json` 的 canonical row index、delivery-plane canonical rows 和 runtime coverage map。
- 必要时只为一致性核对读取 `trace/proposal.trace.json`、实际生成的 `trace/specs/*.trace.json` 或 `trace/specs/no-spec-delta/README.trace.json`，以及 `trace/design.trace.json`；不得用它们在 verification 中重新建立 source/scope mapping。no-delta trace 存在时不得从 specs 派生测试 oracle。
- 索引每个 `RS-/OP-/ST-/CH-` row 的 row type、scope role、runtime obligation、observable fact、default path policy、external boundary、failure/branch/default/no-scope boundary。
- 对每个 required / preserve / proof-only runtime row 抽取所有独立可失败分支；每个分支生成一个 Proof Slice，或给出 source/scope-backed manual/not-applicable reason。Proof Slice 必须一一覆盖 runtime acceptance 分支，但是否生成持久测试由 slice 自身的 persistence 字段决定。
- 当 `proposal-alignment-gate.change-kind` 为 `foundation` 时，Proof Slice 只能从有效 foundation runtime rows 派生；不得为 not-applicable、pure design/reference/guard/future rows 生成 required Proof Slice。
- 建立 trace-backed runtime row branch inventory、manual/not-applicable inventory、proof slice model、Markdown Proof Slice Matrix mirror rows、Planned Test Placement Matrix mirror rows、runtime coverage reconciliation、slice consistency checklist inputs 和 `delivery-plane` render payload。
- writer 只写 `trace/verification.trace.json` 和 `trace/verification.proof-slices.json`；`verification.md`、Trace Appendix 和 manifest registry entry 必须由 renderer 从同一 trace-backed Proof Slice ID 集写入。
- Proof Slice JSON 是 canonical 测试义务模型，verification.md matrix 必须由它镜像生成。

## Proof Slice JSON Canonical Model

- 新 change 必须在 `trace/manifest.json` 写入 `trace-contract-version: "proof-slices-v1"`。
- 新 change 必须生成 `trace/verification.proof-slices.json`，其 `trace-schema` 固定为 `openspec-proof-slices-v1`；`trace/manifest.json` 如保留，只登记 `trace-path` 和 `trace-schema` 等非权威 registry metadata。
- `trace/verification.proof-slices.json` 顶层必须包含：`artifact-id`、`artifact-path`、`change-name`、`schema-name`、`source-interface`、`proof-slice-summary`、`proof-slices`。
- 每个 `proof-slices[]` row 必须包含 Markdown `Proof Slice Matrix` 的全部语义字段：`slice-id`、`runtime-row-ids`、`primary-runtime-row-id`、`primitive-type`、`branch-variant`、`observable-surface`、`oracle-fragment`、`failure-signal`、`primary-layer`、`production-owner`、`persistent-test-required`、`proof-evidence-mode`、`primary-assertion-shape`、`fixture-mock-boundary`、`regression-intent`、`manual-environment-gate`。
- `persistent-test-required` 必须是 boolean。`proof-evidence-mode` 只能是 `durable-test`、`readiness-command`、`build-command`、`codegen-command`、`compose-config-readback`、`static-boundary-readback`、`manual-environment`。
- `persistent-test-required: true` 时，`proof-evidence-mode` 必须为 `durable-test`，`test-contract.primary-test-cardinality` 必须为 `exactly-one`，`test-contract.test-title-prefix` 必须等于 `slice-id`。
- `persistent-test-required: false` 时，`proof-evidence-mode` 不得为 `durable-test`，`test-contract.primary-test-cardinality` 必须为 `none`；如提供 `test-title-prefix`，仍必须等于 `slice-id`。
- business change 中，若 `manual-environment-gate` 为 `None` / 空 / `null`，Proof Slice 默认必须 `persistent-test-required: true`。foundation change 可按 slice 标记 `persistent-test-required: false`，但仍必须给出非持久 evidence mode。
- 每个 `proof-slices[]` row 必须包含 `test-contract`，固定包含：`primary-test-cardinality`、`test-title-prefix`、`allow-shared-setup: true`、`allow-multi-slice-primary-test: false`、`waiver-required-for-multi-slice: true`。
- 每个 `test-contract` 必须包含 `placement` object，并固定包含 `planned-test-directory`、`placement-basis`、`placement-reason`。`placement-basis` 只能是 `existing-tests-directory`、`planned-layer-subdirectory`、`workspace-tests-directory`、`nonpersistent-evidence`。
- `persistent-test-required: true` 时，`placement.planned-test-directory` 必须是基于当前 repo layout、`Production Owner` 和 `Primary Layer` 规划的外置 `tests/` 目录 glob，必须以 `/**` 结尾；不得写具体测试文件、`.spec.*` / `.test.*`、固定命令、runner selector、evidence path 或 `openspec-results/**` / `test-results/**`。
- `persistent-test-required: true` 的 layer 默认子树：`unit -> tests/unit/**`，`component -> tests/component/**`，`route/API -> tests/api/**` 或 `tests/contract/**`，`DB/integration -> tests/integration/**`，`contract -> tests/contract/**`，`worker/job -> tests/worker/**`，`realtime/SSE -> tests/integration/**`，`browser/e2e` / `visual/responsive -> tests/e2e/**`，`security/negative -> tests/security/**` 或能真实触达边界的 layer 子树。
- `persistent-test-required: false` 时，`placement.planned-test-directory` 固定为 `N/A`，`placement.placement-basis` 固定为 `nonpersistent-evidence`；该 slice 不得进入 `proof-test-results[]`，apply 阶段只能通过 `proof-evidence-results[]` 验证。
- 若确需合并多个 Proof Slice 到同一 primary test，必须在 `test-contract` 中显式设置 `allow-multi-slice-primary-test: true` 并提供 `multi-slice-waiver`，包含 `slice-ids` 和中文 `reason`；普通 operation/state/failure/security/layout/observability 分支不得使用 waiver。
- JSON object key 必须使用 kebab-case。解释性字段值必须遵守中文约束。

## Proof Slice Matrix

- `Proof Slice Matrix` 必须是 `trace/verification.proof-slices.json` 的完整镜像；writer 不得手工维护两套不同 truth。
- reviewer 和 validator 必须逐字段比对 renderer 输出的 Markdown matrix 与 JSON canonical row；任一漂移都是 artifact blocker。

- Columns 必须包含：`Slice ID`、`Runtime Row IDs`、`Primary Runtime Row ID`、`Primitive Type`、`Branch / Variant`、`Observable Surface`、`Oracle Fragment`、`Failure Signal`、`Primary Layer`、`Production Owner`、`Persistent Test Required`、`Proof Evidence Mode`、`Primary Assertion Shape`、`Fixture / Mock Boundary`、`Regression Intent`、`Manual / Environment Gate`。
- `Slice ID` 使用 `PS-###`，文件内唯一。
- `Runtime Row IDs` 只能引用 runtime-acceptance 中已定义 rows。
- `Primary Runtime Row ID` 必须存在于同一行 `Runtime Row IDs` 中，并作为 coverage/trace anchor。
- 每个 Proof Slice 只能有一个 primary runtime row、一个 primitive type、一个 branch/variant、一个 primary layer、一个 production owner 和一个 primary assertion shape。
- `Primitive Type` 只能是 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization`。
- `Primary Layer` 只能是 `unit`、`component`、`route/API`、`DB/integration`、`contract`、`worker/job`、`realtime/SSE`、`browser/e2e`、`visual/responsive`、`security/negative`。
- `Production Owner` 必须是单一 production code boundary token，不得包含 owner list、测试路径或 evidence 路径。
- Propose 阶段只允许在 `test-contract.placement` 和 renderer 生成的 placement matrix 中写目录级 planned test directory glob；不得写具体测试文件、固定命令、runner selector、evidence path 或执行状态。`Production Owner` 仍只表示 planned production boundary，不得写成测试目录。

## Planned Test Placement Matrix

- `Planned Test Placement Matrix` 必须是 `trace/verification.proof-slices.json` 中 `test-contract.placement` 的完整镜像；writer 不得手工维护两套不同 truth。
- Columns 必须包含：`Slice ID`、`Persistent Test Required`、`Proof Evidence Mode`、`Planned Test Directory`、`Placement Basis`、`Placement Reason`。
- 对 `persistent-test-required=true` 的 slice，`Planned Test Directory` 必须是目录 glob，必须以 `/**` 结尾，且必须落在外置 `tests/` 子树中，并匹配该 slice 的 `Primary Layer` 默认子树。
- 对 `persistent-test-required=false` 的 slice，`Planned Test Directory` 固定为 `N/A`，`Placement Basis` 固定为 `nonpersistent-evidence`。
- 该 matrix 只规划目录级落点，不是执行计划；不得出现具体 test/spec 文件名、测试命令、runner selector、`openspec-results/**`、`test-results/**` 或其它 evidence path。

## 原子性要求

- `Branch / Variant`、`Oracle Fragment`、`Failure Signal` 和 `Primary Assertion Shape` 必须表达单一原子断言维度。
- 不得把 edit/add/delete、replay/mismatch、success/failure、retryable/nonretryable/empty/timeout、多个 viewport、多个日志类别、多个 redaction 类别或多个 auth/security negative branch 合并为一个 slice。
- Operation row 的 success、failure、disabled、validation、rejected、not-found、unauthorized、cross-user、soft-deleted、unsupported 和 recovery 分支必须按 runtime row 语义拆分。
- Chain row 的 no-queue、no-worker、no-action、no-reservation、no-lock、no-SSE、no-polling 等负向边界必须按 runtime row 语义拆分或明确 not-applicable。
- Observability row 的每个日志类别与每个 redaction 类别必须拆分或有 source/scope-backed reason。
- Layout row 的每个页面和每个 viewport 必须拆分或有 source/scope-backed reason。
- Fixture/provider row 的 success、retryable failure、nonretryable failure、empty result、timeout 等分支必须拆分或有 source/scope-backed reason。

## JSON Trace Plane

- `trace/verification.trace.json` 的 `runtime-coverage-reconciliation` 必须包含每个 required / preserve / proof-only runtime row。
- 每行必须列出 expected Proof Slice IDs、missing Proof Slice IDs、coverage status 和 gap/not-covered reason。
- `Coverage Status = covered` 仅当 missing 为 `None`，expected slices 全部存在于 `trace/verification.proof-slices.json` 且均为原子 slice。
- `manual` / `not-applicable` 必须通过对应 runtime row 的 source/scope role、default path、external boundary 或 no-scope boundary 解释。
- artifact 末尾只保留短 `## Trace Appendix` 指针块。该指针仍指向 `trace/verification.trace.json`；`trace/verification.proof-slices.json` 由 validator 直接按约定路径读取，并可由 manifest registry 登记，不在 artifact 正文写入测试路径、测试命令或 evidence。

## Reviewer Focus

- 是否只从 `trace/runtime-acceptance.trace.json` 推导 oracle。
- `trace/verification.proof-slices.json` 是否存在，并与 `Proof Slice Matrix` 完全一致。
- `test-contract.placement` 是否存在，并与 `Planned Test Placement Matrix` 完全一致；durable slice 是否规划到合法 layer 子树，non-persistent slice 是否使用 `N/A + nonpersistent-evidence`。
- 是否遗漏或合并 runtime row 显式分支。
- `persistent-test-required` 与 `proof-evidence-mode` 是否满足 change-kind、manual gate 和 test-contract 约束。
- Reconciliation 是否真实闭合。
- `Primary Layer` 是否为合法枚举，`Production Owner` 是否为单一 planned production boundary token，且未写成测试路径、命令、runner、evidence 或 deposit 路径。
- 是否写入具体测试文件、命令、runner、evidence、deposit 或 artifact/process oracle；目录级 planned test glob 只能出现在 placement 字段和 renderer 生成的 placement matrix 中。
