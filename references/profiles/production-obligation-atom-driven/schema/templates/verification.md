## Verification Intent

<!--
本 artifact 定义独立测试意图、行为 oracle 和 test agent 写测试前的一致性预检。
它只从 proposal、specs 和 design 推导，不从 tasks.md 或当前实现推导。
它不登记具体执行文件、运行入口选择条件、产物保存位置、执行状态或回归沉淀状态。
-->

- Scope: <!-- 本次需要回归验证的产品/运行时行为范围。 -->
- Source basis: <!-- proposal rows、spec scenarios、design decisions。 -->
- Out of scope: <!-- 明确不验证的 artifact/process/implementation detail。 -->

## Behavior Oracle Matrix

| VID | Source Basis | Runtime Behavior | Observable Surface | Oracle | Failure Signal | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| <!-- VID-001 --> | <!-- GA-0001；spec requirement/scenario；design decision。 --> | <!-- public/runtime behavior。 --> | <!-- UI route/API/DB/job/worker/storage/auth/log 等可观察 surface。 --> | <!-- 应成立的断言依据，必须来自 proposal/spec/design。 --> | <!-- 失败时可观察到的偏差。 --> | <!-- required / preserve / manual / not-applicable。 --> |

## Suggested Layer Matrix

| VID | Minimum Sufficient Layers | Layer Reason | Omitted Stable Layers / Reason | Manual / Environment Gate |
| --- | --- | --- | --- | --- |
| <!-- VID-001 --> | <!-- unit / component / route/API / DB / worker / realtime / browser / security / visual / ops。 --> | <!-- 为什么这些层能稳定证明该 oracle；更高层 smoke 不能替代可低层稳定断言。 --> | <!-- 为什么某些稳定层不适用；不能只写“已有端到端覆盖”。 --> | <!-- 需要人工或环境 gate 时说明 source-backed 理由；否则 None。 --> |

## Harness Rationale

| VID | Interaction / Boundary Needed | Harness Expectation | Primary Assertion Shape | Failure Localization |
| --- | --- | --- | --- | --- |
| <!-- VID-001 --> | <!-- click/type/select/submit、route/API call、DB readback、worker consume、security negative 等。 --> | <!-- 真实 browser/component/API/DB/worker/security/ops boundary 的期望形态，不写具体文件或命令。 --> | <!-- 用户可见结果、DTO、DB invariant、event/log/audit fact、authorization result 等。 --> | <!-- 失败时应能定位到哪个行为分支。 --> |

## Mock And Fixture Boundary

| VID | Allowed Fixture | Allowed Mock | Default Path That Must Remain Real | Replaced Side Effect | Compensating Proof Needed |
| --- | --- | --- | --- | --- | --- |
| <!-- VID-001 --> | <!-- 输入数据、凭证、claims、确定性时间等。 --> | <!-- 慢速、外部、非确定性边界；无则 None。 --> | <!-- 不能被替换的 production behavior/default path。 --> | <!-- 被 mock 或 fixture 替换的真实 side effect。 --> | <!-- 需要怎样的 default-path proof 补偿；无则 None。 --> |

## Failure And Negative Coverage

| VID | Required Failure / Negative Branch | Source Basis | Observable Failure Signal | Recovery / Next-State Oracle | Not Covered / Reason |
| --- | --- | --- | --- | --- | --- |
| <!-- VID-001 --> | <!-- unauthorized / validation failed / timeout / retry / disabled / empty / redaction 等。 --> | <!-- GA/spec/design。 --> | <!-- 可观察失败信号。 --> | <!-- 恢复、重试、终态或允许 next state。 --> | <!-- 不适用时写 source-backed reason；否则 None。 --> |

## Regression Intent

| VID | Regression Importance | Expected Long-Term Coverage | Not Suitable For Permanent Automated Test / Reason |
| --- | --- | --- | --- |
| <!-- VID-001 --> | <!-- high / medium / low + 中文理由。 --> | <!-- 希望长期保留的行为覆盖意图和适合的覆盖层，不写具体文件或命令。 --> | <!-- 不适合自动化时写 source-backed 理由；否则 None。 --> |

## Do Not Test

- 不测试私有 helper、调用次数、DOM 层级、className、快照全文或当前实现分支。
- 不测试 OpenSpec artifact 文本结构、tasks.md 矩阵完整性、change slug、VID 本身或执行产物布局。
- 不用 artifact/config/text scan 作为产品行为 primary proof。
- 不为了适配当前实现而削弱 oracle 或改成 implementation-detail test。

## Oracle Consistency Checklist

- [ ] 每个 VID 都有 proposal/spec/design source basis。
- [ ] 每个 oracle 都与 proposal/spec/design 一致。
- [ ] 没有 oracle 引入 source 外行为。
- [ ] 每个 oracle 都能通过 public/runtime behavior 观察。
- [ ] 没有 oracle 要求测试 artifact/process 而非产品行为。
- [ ] 没有 oracle 依赖 implementation detail。
- [ ] 每个 required VID 都说明了最小充分层级、mock/fixture 边界和长期回归意图。
