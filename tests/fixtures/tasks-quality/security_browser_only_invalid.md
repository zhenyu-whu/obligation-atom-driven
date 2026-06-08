# Fixture: Security Browser Only Invalid

## Verification Appendix

### Runtime Surface Inventory
| Surface ID | Surface Type | Owner | Entry Point | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RSI-001 | auth route handler + DB repository | app/api/admin/items/route.ts | POST /api/admin/items | GA-0001 required behavior | required behavior | AC-001 | T-001 | source-backed admin item creation only |

### Operation Coverage Matrix
| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OCM-001 | admin creates item | POST /api/admin/items | DB mutation | admin sees item | API response and DB row should match | GA-0001 required behavior | required behavior | AC-001 | T-001 | no extra operation |

### State / Branch Coverage Matrix
| State ID | State / Branch | Expected Behavior | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SBM-001 | unauthorized negative branch | request denied and DB unchanged | GA-0002 security boundary | required behavior | AC-001 | T-001 | no auth bypass |

### Async / Realtime Chain Matrix
| Chain ID | Chain Segment | Success Proof | Failure Proof | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARC-NA | Not applicable | none | none | source-backed synchronous route handler | not applicable | AC-001 | T-001 | Not applicable reason：source-backed no worker/SSE/storage async chain |

### Test Layer Plan
| AC ID | Behavior / Boundary | Scope Basis | Required Layers | Test IDs By Layer | Omitted Layers / Reason | Primary Proof Layer | Regression Entry | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | required behavior: admin item creation and security boundary | GA-0001 GA-0002 | browser E2E | browser E2E=T-001 | API/DB/security omitted without valid source-backed reason | browser E2E | T-001 | no scope expansion |

### Test Evidence Matrix
| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path? | Fixture Boundary | Must Fail Before Implementation | Red Command | Expected Red Failure | Observed Red Failure | Green Command | TDD Status | Requires Tests Passed | Evidence Directory | Evidence Produced | Ledger File | CI Runnable? | Source Basis | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | AC-001 | npx playwright test admin-items.spec.ts | admin-items.spec.ts::admin creates item | browser E2E smoke | RSI-001 OCM-001 SBM-001 | yes | local app server | yes | npx playwright test admin-items.spec.ts | item not visible before implementation | observed missing item | npx playwright test admin-items.spec.ts | green-passed | none | test-results/security-browser-only-invalid/AC-001/T-001/ | command.log, ledger.json, browser screenshot only | test-results/security-browser-only-invalid/AC-001/T-001/ledger.json | yes | GA-0001 GA-0002 | required behavior | no scope expansion |

### Regression Test Deposit
| AC ID | Test IDs | Permanent Test File | Regression Command | Behavior Contract | Assertion Oracle | Fixture Boundary | CI Tier | Not Testing | Deposit Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | T-001 | admin-items.spec.ts | npx playwright test admin-items.spec.ts | admin creation works in browser | rendered item appears | local app server only | local/CI | API/DB/security low-level contracts | deposited |
