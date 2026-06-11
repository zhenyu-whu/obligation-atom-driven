# Fixture: Non Runtime Simple

## Verification Appendix

### Runtime Surface Inventory
| Surface ID | Surface Type | Owner | Entry Point | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RSI-NA | Not applicable | none | none | source-backed docs-only change | not applicable | AC-001 | T-001 | Not applicable reason：source-backed docs-only；不触及 runtime route/control/API/data mutation/auth/DB/worker/SSE/storage/provider/state/branch |

### Operation Coverage Matrix
| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OCM-NA | Not applicable | none | none | none | none | source-backed docs-only change | not applicable | AC-001 | T-001 | Not applicable reason：source-backed docs-only；无 runtime operation |

### State / Branch Coverage Matrix
| State ID | State / Branch | Expected Behavior | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SBM-NA | Not applicable | none | source-backed docs-only change | not applicable | AC-001 | T-001 | Not applicable reason：source-backed docs-only；无 state/branch |

### Async / Realtime Chain Matrix
| Chain ID | Chain Segment | Success Proof | Failure Proof | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARC-NA | Not applicable | none | none | source-backed docs-only change | not applicable | AC-001 | T-001 | Not applicable reason：source-backed docs-only；无 async/realtime chain |

### Test Layer Plan
| AC ID | Behavior / Boundary | Scope Basis | Required Layers | Test IDs By Layer | Omitted Layers / Reason | Primary Proof Layer | Regression Entry | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | proof-only schema wording remains internally consistent | source-backed docs-only change | config/ops/check | config/ops/check=T-001 | unit/component/API/DB/security/browser not-applicable：source-backed docs-only，无 runtime behavior | config/ops/check | T-001 | 不新增 runtime 行为 |

### Test Evidence Matrix
| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path Level | Fixture Boundary | Verification Expectation | Evidence Status | Requires Tests Passed | Evidence Directory | Evidence Produced | CI Runnable? | Scope Basis | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | AC-001 | python3 references/agent-runtime/scripts/validate_tasks_quality.py tests/fixtures/tasks-quality/non_runtime_simple.md | tests/fixtures/tasks-quality/non_runtime_simple.md::schema-only | config/ops/check | RSI-NA OCM-NA SBM-NA ARC-NA | static-analysis | static fixture only | validator pass for docs-only fixture | passed | none | openspec-results/non-runtime-simple/AC-001/T-001/ | command.log, validator pass | yes | docs-only fixture | proof-only | 不新增 runtime 行为 |

### Regression Test Deposit
| AC ID | Test IDs | Permanent Test File | Regression Command | Behavior Contract | Assertion Oracle | Fixture Boundary | CI Tier | Not Testing | Deposit Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | T-001 | tests/fixtures/tasks-quality/non_runtime_simple.md | python3 tests/test_validate_tasks_quality.py | docs-only tasks still retain Testing Quality Core | validator reports zero errors for docs-only fixture | static fixture only | local/CI | runtime behavior, because source basis is docs-only | deposited |
