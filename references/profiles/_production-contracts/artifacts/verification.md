# Verification Artifact Contract

## 目的

`verification.md` 是 independent test intent and oracle artifact。Proof Slice 是唯一测试义务单位；新格式下 canonical Proof Slice 模型必须写入 `trace/verification.proof-slices.json`，`verification.md` 中的 `Proof Slice Matrix` 只是该 JSON 的人类可读镜像。本 artifact 不生成、不引用额外业务 oracle 分组 ID，不定义测试执行计划。

## 写入前

- 读取 `runtime-acceptance.md` 的 canonical rows。
- 必要时只为一致性核对读取 proposal、实际生成的 delta specs 和 design；不得用它们在 verification 中重新建立 source/scope mapping。
- 索引每个 `RS-/OP-/ST-/CH-` row 的 row type、scope role、runtime obligation、observable fact、default path policy、external boundary、failure/branch/default/no-scope boundary。
- 对每个 required / preserve / proof-only runtime row 抽取所有独立可失败分支；每个分支生成一个 Proof Slice，或给出 source/scope-backed manual/not-applicable reason。

## Proof Slice JSON Canonical Model

- 新 change 必须在 `trace/manifest.json` 写入 `trace-contract-version: "proof-slices-v1"`。
- 新 change 必须生成 `trace/verification.proof-slices.json`，其 `trace-schema` 固定为 `openspec-proof-slices-v1`，并在 `trace/manifest.json` 登记 `trace-path`、`trace-schema` 和 `trace-digest`。
- `trace/verification.proof-slices.json` 顶层必须包含：`artifact-id`、`artifact-path`、`change-name`、`schema-name`、`source-interface`、`proof-slice-summary`、`proof-slices`。
- 每个 `proof-slices[]` row 必须包含 Markdown `Proof Slice Matrix` 的全部语义字段：`slice-id`、`runtime-row-ids`、`primary-runtime-row-id`、`primitive-type`、`branch-variant`、`observable-surface`、`oracle-fragment`、`failure-signal`、`primary-layer`、`production-owner`、`primary-assertion-shape`、`fixture-mock-boundary`、`regression-intent`、`manual-environment-gate`。
- 每个 `proof-slices[]` row 必须包含 `test-contract`，默认值固定为：`primary-test-cardinality: "exactly-one"`、`test-title-prefix: "<slice-id>"`、`allow-shared-setup: true`、`allow-multi-slice-primary-test: false`、`waiver-required-for-multi-slice: true`。
- 若确需合并多个 Proof Slice 到同一 primary test，必须在 `test-contract` 中显式设置 `allow-multi-slice-primary-test: true` 并提供 `multi-slice-waiver`，包含 `slice-ids` 和中文 `reason`；普通 operation/state/failure/security/layout/observability 分支不得使用 waiver。
- JSON object key 必须使用 kebab-case。解释性字段值必须遵守中文约束。

## Proof Slice Matrix

- `Proof Slice Matrix` 必须是 `trace/verification.proof-slices.json` 的完整镜像；writer 不得手工维护两套不同 truth。
- reviewer 和 validator 必须逐字段比对 Markdown matrix 与 JSON canonical row；任一漂移都是 artifact blocker。

- Columns 必须包含：`Slice ID`、`Runtime Row IDs`、`Primary Runtime Row ID`、`Primitive Type`、`Branch / Variant`、`Observable Surface`、`Oracle Fragment`、`Failure Signal`、`Primary Layer`、`Production Owner`、`Primary Assertion Shape`、`Fixture / Mock Boundary`、`Regression Intent`、`Manual / Environment Gate`。
- `Slice ID` 使用 `PS-###`，文件内唯一。
- `Runtime Row IDs` 只能引用 runtime-acceptance 中已定义 rows。
- `Primary Runtime Row ID` 必须存在于同一行 `Runtime Row IDs` 中，并作为 coverage/trace anchor。
- 每个 Proof Slice 只能有一个 primary runtime row、一个 primitive type、一个 branch/variant、一个 primary layer、一个 production owner 和一个 primary assertion shape。
- `Primitive Type` 只能是 `operation`、`state`、`failure`、`negative-boundary`、`layout`、`observability`、`fixture-variant`、`authorization`。
- `Primary Layer` 只能是 `unit`、`component`、`route/API`、`DB/integration`、`contract`、`worker/job`、`realtime/SSE`、`browser/e2e`、`visual/responsive`、`security/negative`。
- `Production Owner` 必须是单一 production code boundary token，不得包含 owner list、测试路径或 evidence 路径。
- 自动化 Proof Slice（`Manual / Environment Gate` 为 `None`、空或 `null`）的 `Production Owner + Primary Layer` 必须能映射到 `test-quality-strength.md` 定义的 placement-policy compliant `tests/**` 落点；无合法落点时必须修订 owner/layer，或给出 source/scope-backed manual/not-applicable reason。

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
- artifact 末尾只保留短 `## Trace Appendix` 指针块。该指针仍指向 `trace/verification.trace.json`；`trace/verification.proof-slices.json` 由 manifest 登记，不在 artifact 正文写入测试路径、测试命令或 evidence。

## Reviewer Focus

- 是否只从 runtime-acceptance 推导 oracle。
- `trace/verification.proof-slices.json` 是否存在、登记 manifest digest，并与 `Proof Slice Matrix` 完全一致。
- 是否遗漏或合并 runtime row 显式分支。
- Reconciliation 是否真实闭合。
- 自动化 Proof Slice 的 `Production Owner + Primary Layer` 是否都有 placement-policy compliant `tests/**` 落点。
- 是否写入测试路径、命令、runner、evidence、deposit 或 artifact/process oracle。
