## Verification Intent

<!--
本 artifact 定义独立测试意图、行为 oracle 和 test agent 写测试前的一致性预检。
它只从 proposal、specs、design 和 runtime-acceptance.md 推导，不从 tasks.md 或当前实现推导。
它不登记具体执行文件、运行入口选择条件、产物保存位置、执行状态或回归沉淀状态。
-->

- Scope: <!-- 本次需要回归验证的产品/运行时行为范围。 -->
- Source basis: <!-- proposal rows、spec scenarios、design decisions。 -->
- Out of scope: <!-- 明确不验证的 artifact/process/implementation detail。 -->

## Behavior Oracle Matrix

| VID              | Runtime Row IDs                                                                       | Source Basis                                                   | Runtime Behavior                   | Observable Surface                                                      | Oracle                                                                        | Failure Signal                  | Priority                                                 |
| ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| <!-- VID-001 --> | <!-- RS-001, OP-001, ST-001, CH-001；只引用 runtime-acceptance.md 中已定义 rows。 --> | <!-- GA-0001；spec requirement/scenario；design decision。 --> | <!-- public/runtime behavior。 --> | <!-- UI route/API/DB/job/worker/storage/auth/log 等可观察 surface。 --> | <!-- 应成立的断言依据，必须来自 proposal/spec/design/runtime-acceptance。 --> | <!-- 失败时可观察到的偏差。 --> | <!-- required / preserve / manual / not-applicable。 --> |

## Proof Slice Matrix

<!--
Proof Slice 是 test agent 的测试生成单位。VID 定义业务 oracle，不等于 test case。
每个 required VID 至少要有一个 slice；一个 slice 只能有一个 Primary Runtime Row ID、一个 Primary Layer 和一个 Production Owner。
Primary Runtime Row ID 必须是 Runtime Row IDs 中的一个 RS-/OP-/ST-/CH- row，并表示该 slice 的原子行为分支；Runtime Row IDs 可包含必要 supporting rows。
独立 operation、state、failure/retry、auth/security、layout 或 observability branch 必须拆成不同 slice；Oracle Fragment 不得聚合多个独立分支，例如 skeleton、extract_failed、retry。
Production Owner 写单一代码 owner 边界，不写具体测试文件路径。不得写固定命令、runner selector、evidence path 或 deposit status。
Production Owner 必须是 exactly one token，例如 apps/web 或 packages/domain；不得写逗号分隔、斜杠分隔、+ 连接、and/和/与 连接或多个反引号 owner。
多 production boundary proof 必须拆成多个 slice，或选择 public entrypoint owner，并把下游真实边界写入 Fixture / Mock Boundary 或 Notes。
同 owner、同 layer 的多个 atomic slices 可以共享长期测试入口或参数化结构，但失败信号必须能定位到具体 Slice ID。
-->

| Slice ID         | VID              | Runtime Row IDs                                                       | Primary Runtime Row ID                           | Primary Layer                                                                                                                                       | Production Owner                                                                                       | Oracle Fragment                                                   | Primary Assertion Shape                                               | Fixture / Mock Boundary                                                                                                        | Notes                                                              |
| ---------------- | ---------------- | --------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| <!-- PS-001A --> | <!-- VID-001 --> | <!-- RS-001, OP-001；只引用 runtime-acceptance.md 中已定义 rows。 --> | <!-- OP-001；必须包含在 Runtime Row IDs 中。 --> | <!-- unit / component / route/API / DB/integration / contract / worker/job / realtime/SSE / browser/e2e / visual/responsive / security/negative --> | <!-- apps/web；必须是 exactly one owner token，例如 apps/web 或 packages/domain，不写 owner list。 --> | <!-- 从该 VID oracle 拆出的单层、单 primary row 原子行为分支。 --> | <!-- 该 slice 的 primary assertion 形态；不混入其他层 invariant。 --> | <!-- 允许 fixture/mock 与必须保持真实的 default path；协作 production boundary 写在这里或 Notes，不写进 Production Owner。 --> | <!-- source-backed not-applicable/manual/合并建议；否则 None。 --> |

## Suggested Layer Matrix

| VID              | Minimum Sufficient Layers                                                                                                                                                  | Layer Reason                                                                    | Omitted Stable Layers / Reason                              | Manual / Environment Gate                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| <!-- VID-001 --> | <!-- 按 Proof Slice 汇总：unit / component / route/API / DB/integration / contract / worker/job / realtime/SSE / browser/e2e / visual/responsive / security/negative。 --> | <!-- 为什么这些层能稳定证明该 oracle；更高层 smoke 不能替代可低层稳定断言。 --> | <!-- 为什么某些稳定层不适用；不能只写“已有端到端覆盖”。 --> | <!-- 需要人工或环境 gate 时说明 source-backed 理由；否则 None。 --> |

## Harness Rationale

| VID              | Interaction / Boundary Needed                                                                          | Harness Expectation                                                                              | Primary Assertion Shape                                                                   | Failure Localization                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| <!-- VID-001 --> | <!-- click/type/select/submit、route/API call、DB readback、worker consume、security negative 等。 --> | <!-- 真实 browser/component/API/DB/worker/security boundary 的期望形态，不写具体文件或命令。 --> | <!-- 用户可见结果、DTO、DB invariant、event/log/audit fact、authorization result 等。 --> | <!-- 失败时应能定位到哪个行为分支。 --> |

## Mock And Fixture Boundary

| VID              | Allowed Fixture                                 | Allowed Mock                                   | Default Path That Must Remain Real                       | Replaced Side Effect                                 | Compensating Proof Needed                                |
| ---------------- | ----------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| <!-- VID-001 --> | <!-- 输入数据、凭证、claims、确定性时间等。 --> | <!-- 慢速、外部、非确定性边界；无则 None。 --> | <!-- 不能被替换的 production behavior/default path。 --> | <!-- 被 mock 或 fixture 替换的真实 side effect。 --> | <!-- 需要怎样的 default-path proof 补偿；无则 None。 --> |

## Failure And Negative Coverage

| VID              | Required Failure / Negative Branch                                                              | Source Basis              | Observable Failure Signal | Recovery / Next-State Oracle                 | Not Covered / Reason                                  |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| <!-- VID-001 --> | <!-- unauthorized / validation failed / timeout / retry / disabled / empty / redaction 等。 --> | <!-- GA/spec/design。 --> | <!-- 可观察失败信号。 --> | <!-- 恢复、重试、终态或允许 next state。 --> | <!-- 不适用时写 source-backed reason；否则 None。 --> |

## Regression Intent

| VID              | Regression Importance                     | Expected Long-Term Coverage                                             | Not Suitable For Permanent Automated Test / Reason        |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| <!-- VID-001 --> | <!-- high / medium / low + 中文理由。 --> | <!-- 希望长期保留的行为覆盖意图和适合的覆盖层，不写具体文件或命令。 --> | <!-- 不适合自动化时写 source-backed 理由；否则 None。 --> |

## Do Not Test

- 不测试私有 helper、调用次数、DOM 层级、className、快照全文或当前实现分支。
- 不测试 OpenSpec artifact 文本结构、tasks.md 矩阵完整性、change slug、VID 本身或执行产物布局。
- 不用 artifact/config/text scan 作为产品行为 primary proof。
- 不为了适配当前实现而削弱 oracle 或改成 implementation-detail test。
- 不把 `tests/runtime` 或 repo-wide env/ops/workspace/forbidden-drift 检查作为新业务测试默认义务；除非 proposal/spec/design 明确 source-backed，且能归入被测 production owner。

## Trace Appendix

<!-- 本附录是审计平面，不是 Delivery Plane。test agent 以主体 oracle 和 Proof Slice 写测试；主 agent、archive、final reviewer 用本附录检查 runtime coverage reconciliation 和 oracle 一致性。 -->

### Runtime Coverage Reconciliation

| Runtime Row ID  | Row Type                                                           | Source / Scope Basis                                      | Runtime Obligation                                                      | Scope Role                                                                     | VID IDs          | Proof Slice IDs  | Coverage Status                                      | Gap / Not-Covered Reason                                |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- | ---------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| <!-- RS-001 --> | <!-- surface / operation / state-branch / async-realtime-chain --> | <!-- GA/spec/design/runtime-acceptance source basis。 --> | <!-- runtime-acceptance.md 中的 canonical runtime obligation 摘要。 --> | <!-- required behavior / preserve boundary / proof-only / not applicable。 --> | <!-- VID-001 --> | <!-- PS-001A --> | <!-- covered / manual / not-applicable / blocker --> | <!-- covered 时写 None；否则写 source-backed 理由。 --> |

### Oracle Consistency Checklist

- [ ] 每个 VID 都有 proposal/spec/design source basis。
- [ ] 每个 VID 和 Proof Slice 都只引用 `runtime-acceptance.md` 中已定义的 Runtime Row IDs。
- [ ] 每个 oracle 都与 proposal/spec/design 一致。
- [ ] 没有 oracle 引入 source 外行为。
- [ ] 每个 oracle 都能通过 public/runtime behavior 观察。
- [ ] 没有 oracle 要求测试 artifact/process 而非产品行为。
- [ ] 没有 oracle 依赖 implementation detail。
- [ ] 每个 required VID 至少有一个 Proof Slice。
- [ ] 每个 required / preserve / proof-only runtime row 都有 VID 和 Proof Slice，除非有 source-backed manual/not-applicable reason。
- [ ] 每个 Proof Slice 都有单一 Primary Runtime Row ID、Primary Layer、Production Owner、Oracle Fragment、Primary Assertion Shape 和 Fixture / Mock Boundary。
- [ ] 每个 Proof Slice 的 Primary Runtime Row ID 存在于该 slice 的 Runtime Row IDs 中，并且表示单一原子 operation、state、failure/retry、auth/security、layout 或 observability branch。
- [ ] 每个 Proof Slice 的 Production Owner 是单一 owner token，不含逗号、斜杠、+、and/和/与 或多个 owner。
- [ ] 没有 Proof Slice 因 owner/layer 相同而合并多个独立 runtime branches。
- [ ] Proof Slice 不含具体测试路径、固定命令、runner selector、evidence path 或 deposit status。
- [ ] 没有把 `tests/runtime` 或 repo-wide env/ops/workspace/forbidden-drift 当作新业务测试默认义务。
- [ ] 每个 required VID 都说明了最小充分层级、mock/fixture 边界和长期回归意图。
