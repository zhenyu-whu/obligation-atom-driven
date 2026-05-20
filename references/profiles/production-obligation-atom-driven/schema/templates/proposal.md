## Obligation Atom Preconditions

<!-- 列出当前 change 使用的 change slug、final packet index、final change packet、global atom index，以及按需读取的 capability atom view files。不得创建或依赖任何 proposal 前置 source artifact。若 final packet 有 blocker，停止而不是填写后续章节。 -->

## Why

<!-- 说明此 production change 的动机：它解决或解锁了哪个产品、架构、production-readiness 或 verification 缺口？引用 exact Global Atom IDs，例如 GA-0001。 -->

## Change Plan Boundary

<!-- 从 final change packet 摘要当前 change 的 closed-loop outcome、in scope、out of scope、direct atoms、contextual atoms、dependencies、archive readiness。`change-plan.md` 只在自动推断或依赖顺序核对时引用，不得覆盖 final packet。 -->

## What Changes

<!-- 描述此 change 修改的 source-backed 产品行为、生产代码、data/API contracts、routes、objects、jobs、events、auth/security rules、storage、billing/entitlement rules、observability、deployment 与 verification surfaces。引用 exact GA-#### IDs，不使用 ranges。 -->

## Capabilities

### New Capabilities
<!-- 描述新增 capabilities。将 <name> 替换为 kebab-case identifier；只有包含 spec-requirement 或 spec-guard delta 的 capability 才会创建 specs/<name>/spec.md。纯 design-obligation / verification-obligation capability 不创建空 spec。 -->
- `<name>`: <概述该 capability 覆盖的范围；Global Atoms: GA-...>

### Modified Capabilities
<!-- 描述 REQUIREMENTS 发生变化的 existing capabilities。使用 openspec/specs/ 中已有 spec 名称；没有 requirement 变化时留空。 -->
- `<existing-name>`: <说明变化的 requirement；Global Atoms: GA-...>

## Change Atom Coverage Register

<!-- 每个 final change packet 的 direct atom 一行。Global Atom ID 必须来自 `obligation-atom-index.md`，每行只能一个 GA ID，不重新编号，不使用 ranges。Direct row 的 Artifact Projection 只能使用 spec-requirement / spec-guard / design-obligation / verification-obligation；contextual-only 只用于非 direct context/boundary row，不能出现在 Direct Owning Atoms。Projection Source 写 final-packet、global-index 或 inferred-from-legacy-packet。Downstream Coverage 必须匹配 projection；后续 artifacts 必须引用这些 exact GA IDs。Direct atom 不得留下 orphan downstream coverage。 -->

| Global Atom ID | Source Document | Lines | Atom Type | Artifact Projection | Projection Source | Normativity | Coverage Status | Packet Capability | Source Fact | Propose Use | Evidence Need | Downstream Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GA-0001` | <!-- exact source path --> | <!-- Lx-Ly --> | <!-- atom type --> | <!-- spec-requirement / spec-guard / design-obligation / verification-obligation --> | <!-- final-packet / global-index / inferred-from-legacy-packet --> | <!-- must / should / must-not / context --> | <!-- direct / explicit-non-goal / contextual-preserve / ... --> | <!-- planned capability --> | <!-- source fact，中文解释或精确 source phrase --> | <!-- canonical propose use --> | <!-- browser-e2e / integration / contract / ... --> | <!-- proposal/spec/design/tasks coverage expectation，必须匹配 projection --> |

## Production Source Coverage

<!-- 列出此 change 必须保持一致的 exact source files、line ranges 与 exact GA IDs。不要新增宽泛整篇文档读取义务。 -->

## Source Window Read Set

<!-- 对每个 direct atom，列出已定点重读的 original source window。Contextual、preserve、non-goal atom 只在需要精确边界时列入。不要用整篇文档代替 line ranges。 -->

| Global Atom ID | Source Window | Re-read Purpose | Interpretation Result |
| --- | --- | --- | --- |
| `GA-0001` | <!-- exact source path Lx-Ly --> | <!-- scope / identifier / failure path / verification / boundary --> | <!-- confirmed / refined / blocker；说明是否改变 proposal interpretation --> |

## Non-Goals

<!-- 明确排除 source-backed later-change boundaries、global forbidden drift、explicit non-goals、prototype-only-not-production atoms 与 out-of-scope work；适用时引用 GA IDs。 -->

## Impact

<!-- 说明受影响的 apps、packages、database migrations、APIs、workers、queues、SSE/outbox events、frontend routes、components、assets、auth/security/privacy boundaries、observability、deployment、verification scripts 与 dependencies。 -->

## Rollout / Readiness

<!-- 说明 migration ordering、environment/config needs、backfill、compatibility、staging/production smoke、operational runbook、monitoring/audit readiness；不适用时写“无”。 -->

## Proposal Alignment Gate

- Proposal input mode: <!-- canonical change packet + global atom index；不得填写任何前置 source artifact -->
- Change slug: <!-- exact slug -->
- Final packet index consumed: <!-- path -->
- Global atom index consumed: <!-- path -->
- Final change packet consumed: <!-- path -->
- Capability atom view files consumed: <!-- paths / 未额外读取，按 final packet 分组 -->
- Direct atoms covered by proposal: <!-- GA-0001, GA-0002, ...；逐个枚举，不使用 ranges -->
- Artifact projection coverage: <!-- 每个 direct GA 的 projection 已记录；design/verification atoms 未被强制列为 spec requirement -->
- Contextual / preserve / non-goal atoms captured: <!-- GA-...；逐个枚举或说明无 -->
- Source windows re-read for direct atoms: <!-- GA-0001 -> path Lx-Ly, GA-0002 -> path Lx-Ly；无遗漏或列 blocker -->
- Orphan direct atoms: <!-- none / 具体 GA blocker -->
- Capability increments covered or gap-classified: <!-- 说明 -->
- Blockers: <!-- 无 / 具体 blocker -->
