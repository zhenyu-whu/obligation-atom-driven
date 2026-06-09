# Fixture: UI API Behavior

## Verification Appendix

### Runtime Surface Inventory
| Surface ID | Surface Type | Owner | Entry Point | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RSI-001 | UI route + route/API contract | app/example/page.tsx and app/api/example/route.ts | /example and POST /api/example | SI-001 required behavior | required behavior | AC-001 | T-001 T-002 T-003 | scope-backed route and API only |

### Operation Coverage Matrix
| Operation ID | Trigger | Control / Route | Request / Action | Expected Rendered UI Update | API/Data Assertion | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OCM-001 | user submits form | /example submit button | POST /api/example | success message rendered | response includes accepted=true | SI-001 required behavior | required behavior | AC-001 | T-001 T-002 T-003 | no extra operation beyond submitted form |

### State / Branch Coverage Matrix
| State ID | State / Branch | Expected Behavior | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SBM-001 | success and validation failure | success renders confirmation; invalid input renders message | SI-001 required behavior | required behavior | AC-001 | T-001 T-002 T-003 | no unrequested states |

### Async / Realtime Chain Matrix
| Chain ID | Chain Segment | Success Proof | Failure Proof | Source Basis | Scope Role | AC IDs | Test IDs | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARC-001 | browser request to route handler | route handler returns accepted=true | handler returns validation error for invalid payload | SI-001 required behavior | required behavior | AC-001 | T-002 T-003 | no worker or SSE chain |

### Test Layer Plan
| AC ID | Behavior / Boundary | Scope Basis | Required Layers | Test IDs By Layer | Omitted Layers / Reason | Primary Proof Layer | Regression Entry | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | required behavior: form submission calls API and renders contract result | SI-001 required behavior | component; route/API contract; browser E2E | component=T-001; route/API contract=T-002; browser E2E=T-003 | DB/security not-applicable：scope-backed no persistence or auth boundary | route/API contract | T-001 T-002 T-003 | no extra route or state |

### Test Evidence Matrix
| Test ID | AC ID | Fixed Command | Test File / Name | Layer | Covers Rows | Default Path? | Fixture Boundary | Must Fail Before Implementation | Red Command | Expected Red Failure | Observed Red Failure | Green Command | TDD Status | Requires Tests Passed | Evidence Directory | Evidence Produced | Ledger File | CI Runnable? | Scope Basis | Scope Role | No-Scope-Expansion Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | AC-001 | npm test -- example-form.component.test.tsx | example-form.component.test.tsx::renders validation and submit state | component | RSI-001 OCM-001 SBM-001 | yes | jsdom, no network | yes | npm test -- example-form.component.test.tsx | submit state assertion fails before implementation | observed failing assertion for missing success state | npm test -- example-form.component.test.tsx | green-passed | none | test-results/ui-api-behavior/AC-001/T-001/ | command.log, ledger.json, component test log | test-results/ui-api-behavior/AC-001/T-001/ledger.json | yes | SI-001 | required behavior | no scope expansion |
| T-002 | AC-001 | npm test -- example-route.contract.test.ts | example-route.contract.test.ts::post returns accepted contract | route/API contract | RSI-001 OCM-001 ARC-001 | yes | in-process route handler, no external service | yes | npm test -- example-route.contract.test.ts | accepted contract fails before implementation | observed 404 before implementation | npm test -- example-route.contract.test.ts | green-passed | T-001 | test-results/ui-api-behavior/AC-001/T-002/ | command.log, ledger.json, route contract log | test-results/ui-api-behavior/AC-001/T-002/ledger.json | yes | SI-001 | required behavior | no scope expansion |
| T-003 | AC-001 | npx playwright test tests/e2e/example-form.spec.ts | tests/e2e/example-form.spec.ts::user submits default path | browser E2E | RSI-001 OCM-001 SBM-001 ARC-001 | yes | local app server only | yes | npx playwright test tests/e2e/example-form.spec.ts | confirmation not rendered before implementation | observed missing confirmation | npx playwright test tests/e2e/example-form.spec.ts | green-passed | T-001 T-002 | test-results/ui-api-behavior/AC-001/T-003/ | command.log, ledger.json, browser trace and screenshot | test-results/ui-api-behavior/AC-001/T-003/ledger.json | yes | SI-001 | required behavior | no scope expansion |

### Regression Test Deposit
| AC ID | Test IDs | Permanent Test File | Regression Command | Behavior Contract | Assertion Oracle | Fixture Boundary | CI Tier | Not Testing | Deposit Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-001 | T-001 T-002 T-003 | example-form.component.test.tsx; example-route.contract.test.ts; tests/e2e/example-form.spec.ts | npm test -- example-form.component.test.tsx && npm test -- example-route.contract.test.ts && npx playwright test tests/e2e/example-form.spec.ts | user submit path calls route/API contract and renders accepted result | public response contract and rendered user-visible message | jsdom, in-process route handler, local app server | local/CI | private helper structure and CSS classes | deposited |
