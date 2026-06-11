# Fixture: Security Data Behavior

## Verification Appendix

### Runtime Surface Inventory
| Surface ID | Surface Type | Owner | Entry Point | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RSI-001 | auth route handler + DB repository | app/api/admin/items/route.ts and item repository | POST /api/admin/items | GA-0001 required behavior | required behavior | AC-001 | T-001 T-002 T-003 T-004 | source-backed admin item creation only |

### Operation Coverage Matrix
| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OCM-001 | authenticated admin creates item | POST /api/admin/items | insert item record | admin sees created item | API response id matches DB row | GA-0001 required behavior | required behavior | AC-001 | T-001 T-002 T-004 | no non-admin workflow added |
| OCM-002 | unauthenticated request | POST /api/admin/items | reject request | error state rendered | authorization failure without DB write | GA-0002 security boundary | required behavior | AC-001 | T-003 T-004 | no auth bypass |

### State / Branch Coverage Matrix
| State ID | State / Branch | Expected Behavior | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SBM-001 | authorized success | DB row committed once | GA-0001 required behavior | required behavior | AC-001 | T-001 T-002 | no extra status enum |
| SBM-002 | unauthorized negative branch | request denied and DB unchanged | GA-0002 security boundary | required behavior | AC-001 | T-003 | no bypass branch |

### Async / Realtime Chain Matrix
| Chain ID | Chain Segment | Success Proof | Failure Proof | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARC-NA | Not applicable | none | none | source-backed synchronous route handler | not applicable | AC-001 | T-001 T-002 T-003 T-004 | Not applicable reason：source-backed no worker/SSE/storage async chain |

### Test Layer Plan
| AC ID | Behavior / Boundary | Scope Basis | Required Layers | Test IDs By Layer | Omitted Layers / Reason | Primary Proof Layer | Regression Entry | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | required behavior: admin item creation persists exactly once and rejects unauthorized requests | GA-0001 GA-0002 | route/API contract; DB/integration; security/negative; browser E2E | route/API contract=T-001; DB/integration=T-002; security/negative=T-003; browser E2E=T-004 | unit/component not-applicable：source-backed behavior is route/auth/DB contract | DB/integration | T-001 T-002 T-003 T-004 | no unplanned admin features |

### Test Evidence Matrix
| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path Level | Fixture Boundary | Verification Expectation | Evidence Status | Requires Tests Passed | Evidence Directory | Evidence Produced | CI Runnable? | Source Basis | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | AC-001 | npm test -- apps/admin/api/admin-items.route.contract.test.ts | apps/admin/api/admin-items.route.contract.test.ts::admin create contract | route/API contract | RSI-001 OCM-001 | route-handler-real-service | in-process route handler with test auth token | route returns expected create contract | passed | none | openspec-results/security-data-behavior/AC-001/T-001/ | command.log, route contract log | yes | GA-0001 | required behavior | no scope expansion |
| T-002 | AC-001 | npm test -- packages/db/admin-items.repository.integration.test.ts | packages/db/admin-items.repository.integration.test.ts::persists once | DB/integration | RSI-001 OCM-001 SBM-001 | db-integration | transaction-scoped test database | row is inserted exactly once | passed | T-001 | openspec-results/security-data-behavior/AC-001/T-002/ | command.log, DB assertion log | yes | GA-0001 | required behavior | no scope expansion |
| T-003 | AC-001 | npm test -- apps/admin/api/admin-items.security.test.ts | apps/admin/api/admin-items.security.test.ts::rejects unauthenticated write | security/negative | RSI-001 OCM-002 SBM-002 | route-handler-real-service | transaction-scoped test database, no auth token | unauthenticated write is rejected and does not mutate DB | passed | T-001 T-002 | openspec-results/security-data-behavior/AC-001/T-003/ | command.log, negative auth log | yes | GA-0002 | required behavior | no scope expansion |
| T-004 | AC-001 | npx playwright test tests/e2e/admin-items.spec.ts | tests/e2e/admin-items.spec.ts::admin default path creates item | browser E2E | RSI-001 OCM-001 OCM-002 | browser-e2e | local app server and test database | browser default path shows persisted item | passed | T-001 T-002 T-003 | openspec-results/security-data-behavior/AC-001/T-004/ | command.log, browser trace and DB readback | yes | GA-0001 GA-0002 | required behavior | no scope expansion |

### Regression Test Deposit
| AC ID | Test IDs | Permanent Test File | Regression Command | Behavior Contract | Assertion Oracle | Fixture Boundary | CI Tier | Not Testing | Deposit Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | T-001 T-002 T-003 T-004 | apps/admin/api/admin-items.route.contract.test.ts; packages/db/admin-items.repository.integration.test.ts; apps/admin/api/admin-items.security.test.ts; tests/e2e/admin-items.spec.ts | npm test -- apps/admin/api/admin-items.route.contract.test.ts && npm test -- packages/db/admin-items.repository.integration.test.ts && npm test -- apps/admin/api/admin-items.security.test.ts && npx playwright test tests/e2e/admin-items.spec.ts | admin creation is authorized, persisted once, and unauthorized writes do not mutate DB | public API status/body, DB row count, and authorization denial | in-process route handler, transaction-scoped DB, local app server | local/CI | private helper calls and DOM structure | deposited |
