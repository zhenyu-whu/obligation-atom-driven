## Verification Intent

<!--
本 artifact 定义测试意图、行为 oracle 和 test agent 写测试前的一致性预检。
它只从 proposal/specs/design 推导，不从 tasks.md 或当前实现推导。
它不登记具体测试文件、固定测试命令、evidence path 或沉淀状态。
-->

- Scope: <!-- 本次需要回归验证的产品/运行时行为范围。 -->
- Source basis: <!-- proposal rows、spec scenarios、design decisions。 -->
- Out of scope: <!-- 明确不验证的 artifact/process/implementation detail。 -->

## Behavior Oracle Matrix

| VID | Source Basis | Runtime Behavior | Observable Surface | Oracle | Failure Signal | Priority |
| --- | ------------ | ---------------- | ------------------ | ------ | -------------- | -------- |
| <!-- VID-001 --> | <!-- SI-001；spec requirement/scenario；design decision。 --> | <!-- public/runtime behavior。 --> | <!-- UI route/API/DB/job/worker/storage/auth/log 等可观察 surface。 --> | <!-- 应成立的断言依据，必须来自 proposal/spec/design。 --> | <!-- 失败时可观察到的偏差。 --> | <!-- required / preserve / manual / not-applicable。 --> |

## Suggested Layer Matrix

| VID | Suggested Layers | Layer Reason | Omitted Stable Layers / Reason | Manual / Environment Gate |
| --- | ---------------- | ------------ | ------------------------------- | ------------------------- |
| <!-- VID-001 --> | <!-- unit / component / route/API / DB / worker / browser / security / visual / ops。 --> | <!-- 为什么这些层能验证该 oracle。 --> | <!-- 为什么某些稳定层不适用。 --> | <!-- 需要人工或环境 gate 时说明 scope-backed 理由；否则 None。 --> |

## Mock And Fixture Boundary

| VID | Allowed Fixture | Allowed Mock | Default Path That Must Remain Real | Replaced Side Effect | Compensating Proof Needed |
| --- | --------------- | ------------ | ---------------------------------- | -------------------- | ------------------------- |
| <!-- VID-001 --> | <!-- 输入数据、凭证、claims、确定性时间等。 --> | <!-- 慢速、外部、非确定性边界；无则 None。 --> | <!-- 不能被替换的 production behavior/default path。 --> | <!-- 被 mock 或 fixture 替换的真实 side effect。 --> | <!-- 需要由哪个 default-path proof 补偿；无则 None。 --> |

## Regression Intent

| VID | Regression Importance | Expected Long-Term Coverage | Not Suitable For Permanent Automated Test / Reason |
| --- | --------------------- | --------------------------- | -------------------------------------------------- |
| <!-- VID-001 --> | <!-- high / medium / low + 中文理由。 --> | <!-- 希望长期保留的行为覆盖意图，不写具体文件或命令。 --> | <!-- 不适合自动化时写 source/scope-backed 理由；否则 None。 --> |

## Do Not Test

- 不测试私有 helper、调用次数、DOM 层级、className、快照全文或当前实现分支。
- 不测试 OpenSpec artifact 文本结构、tasks.md 矩阵完整性、change slug、AC ID、VID 本身、evidence directory 或 Regression Deposit 行。
- 不用 artifact/config/text scan 作为产品行为 primary proof。
- 不为了适配当前实现而削弱 oracle 或改成 implementation-detail test。

## Oracle Consistency Checklist

- [ ] 每个 VID 都有 proposal/spec/design source basis。
- [ ] 每个 oracle 都与 proposal/spec/design 一致。
- [ ] 没有 oracle 引入 scope 外行为。
- [ ] 每个 oracle 都能通过 public/runtime behavior 观察。
- [ ] 没有 oracle 要求测试 artifact/process 而非产品行为。
- [ ] 没有 oracle 依赖 implementation detail。
