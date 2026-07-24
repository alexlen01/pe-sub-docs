# PE Sub Platform — MVP Summary & Delivery Plan

**Document Date:** July 23, 2026  
**Status:** Ready for Business approval  
**Scope Lock-In:** Recommended this quarter  

---

## Executive Summary

The PE Sub Platform is **90% complete** and **ready for MVP delivery** this year. All core workflows that automate the manual borrowing-base process (Steps 1–6 of NEW_BB_PROCESS_FLOW) are built, tested, and containerized. Remaining work is cloud infrastructure setup and business user testing — **no material feature development required.**

**MVP Timeline:** 6–8 weeks from cloud architecture approval → production launch.

---

## What Is DONE (Ship Now)

### Core Workflows — 100% Complete

| Workflow | Status | Business Value |
|----------|--------|-----------------|
| **1. Upload Agent BB** | ✅ Drag-and-drop UI, multipart file handling | Analysts upload Excel files from deal sites (SyndTrak, Intralinks, Debt Domain) |
| **2. Extract & Map Fields** | ✅ XLSX/CSV parsing, 25+ agent bank formats, live field confidence scores | Automatic column → canonical field mapping; manual override for new formats |
| **3. Review Extraction** | ✅ Extracted LP table with unrecognized columns flagged | Analyst confirms extraction quality before proceeding |
| **4. Fuzzy Name Matching** | ✅ Jaro-Winkler + Levenshtein scoring, auto-accept ≥95%, manual review 80–94% | Links agent BB LPs to LP Master; creates new records for unmatched LPs |
| **5. LP Classification & Rate Assignment** | ✅ Borrowing Base Criteria Matrix (rating band × % funded), live rate preview, per-LP overrides | Auto-populates UBS advance rates and concentration limits from master data; analyst adjusts as needed |
| **6. Run Shadow BB** | ✅ Server-side Java calculation engine, breach detection, snapshot persistence | Computes Shadow BB, flags concentration violations (Single LP, Top-10, Unrated, Non-US), stores results |
| **7. View & Export Results** | ✅ Read-only BB grid (14 computed fields), collateral PDF, XLSX export | Credit officers see per-LP BB contribution, concentration excess, breach alerts |

### Supporting Systems — 100% Complete

| System | Status | Business Value |
|--------|--------|-----------------|
| **LP Master** | ✅ Bank-wide LP record CRUD, 32-field schema, deletion with referential checks | Single source of truth for LP identity, ratings, AUM, pension status, investor type |
| **BB Templates** | ✅ Auto-learn agent bank formats (sheet name, header row, group headers), import via Excel | No manual format detection needed after first confirmed extraction per bank |
| **Field Mapping Dictionary** | ✅ Canonical field aliases (Core/Bank/User tiers), blocklist, AI suggestions | New column headers learned and re-used automatically across submissions |
| **Configuration** | ✅ Advance rate matrix, concentration limits, eligibility rules — all DB-backed, hot-reloadable | Credit team can adjust underwriting parameters without code changes |
| **Collateral Reports** | ✅ PDF certificate generation, Agent Bank Exposure analysis, Concentration Exposures list, EAR trend | Exportable to Excel; archive-ready for loan administration |
| **Audit Trail** | ✅ Immutable event log (upload, extraction, matching, classification, calculation, config changes) | Compliance audit trail; who did what, when, why |
| **Batch Ingestion** (pe-sub-jobs) | ✅ CSV seeding (facilities, LP Master, LP per-facility seeds), BB template directory auto-import | Automated weekly/monthly data feeds into platform |
| **Dashboard** | ✅ Facility summary table (agent BB vs UBS BB, delta, status), live donut chart | One-screen overview of all facilities and latest BB figures |

**Total: 15 production-ready features = MVP scope.**

---

## What Needs to Be Done (Next 5 Months)

### 1. Cloud Architecture & Infrastructure (Weeks 1–2)

**Decision Points (UBS Cloud Service Catalog):**
- ✅ **Compute:** AKS (Azure Kubernetes Service) — CONFIRMED
- ⏳ **Database:** Azure Database for PostgreSQL Flexible Server — NEEDS APPROVAL
- ⏳ **Container Registry:** ACR (Azure Container Registry) — NEEDS APPROVAL
- ⏳ **UI Hosting:** Web App vs. AKS Ingress — DECISION PENDING
- ⏳ **API Gateway:** Application Gateway vs. Service Mesh — NEEDS SIZING

**Deliverables:**
- Cloud architecture diagram (AKS topology, networking, ingress)
- Azure resource quotas and cost model
- Network security group rules (inbound: 443/HTTPS; internal: 3001, 3002, 3003 ClusterIP)

**Ownership:** UBS Cloud Infrastructure Team  
**Effort:** 1 week (given existing guidance on AKS)

---

### 2. Infrastructure-as-Code (Weeks 2–4)

**What to build:** Terraform templates for Azure resources
- AKS cluster (node pools, RBAC)
- Azure Database for PostgreSQL (version 16, flexible server tier)
- Azure Container Registry (image push/pull policies)
- Application Gateway / Load Balancer (SSL termination, routing rules)
- Key Vault (secrets: database password, API keys, certificate private keys)
- Virtual networks, subnets, security groups

**Deliverables:**
- `pe-sub-infra/terraform/` directory with modules
  - `main.tf` (root module)
  - `modules/aks/`, `modules/database/`, `modules/networking/`, `modules/keyvault/`, `modules/acr/`
- `terraform.dev.tfvars`, `terraform.qa.tfvars`, `terraform.prod.tfvars` (environment configs)
- Deployment runbook (terraform init → plan → apply)

**Ownership:** PE Sub Platform Team (lead) + UBS Cloud Team (review)  
**Effort:** 5–7 days  
**Can run in parallel with #1**

---

### 3. CI/CD Pipeline (Weeks 2–4)

**Build & Deploy Automation:**
- Trigger: Git push to main branch
- Steps:
  1. Build Docker images for all 4 services (pe-sub-ui, pe-sub-api, pe-sub-extraction, pe-sub-jobs)
  2. Run test suites (vitest for UI, Maven tests for backends)
  3. Push images to ACR with git commit SHA tag
  4. Deploy to DEV environment (Helm or kustomize)
  5. Deploy to QA on approval
  6. Manual approval for PROD deployment

**Deliverables:**
- `.github/workflows/ci-cd.yml` (GitHub Actions) or Azure Pipelines YAML
- Helm charts in `pe-sub-infra/helm/` or kustomize overlays
- Environment-specific configs (dev/qa/prod datasource, extraction service URL, security mode)
- Deployment runbook

**Ownership:** PE Sub Platform Team  
**Effort:** 3–5 days

---

### 4. Authentication & Secrets Management (Week 3)

**Setup:**
1. **Entra ID SSO** — Configure reverse proxy (Application Gateway or external gateway) to inject `X-Auth-User` and `X-Auth-Roles` headers
2. **Enable gateway mode** — Set `APP_SECURITY_MODE=gateway` in all backend services (no code change)
3. **Key Vault integration** — Spring Boot auto-resolves `@azure.keyvault.secret` placeholders for database password, API keys
4. **Certificate management** — cert-manager + Let's Encrypt for HTTPS (TLS termination at Application Gateway)

**Deliverables:**
- Entra ID app registration (client ID, client secret)
- Azure Key Vault setup (secrets: DB password, JWT keys, API credentials)
- cert-manager Helm chart deployed
- SSL/TLS certificate provisioning (HTTPS for all services)

**Ownership:** UBS Security + PE Sub Platform Team  
**Effort:** 1–2 days (gateway config); 1 day (Entra ID setup)

---

### 5. Data Migration & Seeding (Week 4)

**Prepare production data:**
1. Export LP Master from current system (20k+ LPs across 65 facilities)
2. Transform to CSV format expected by pe-sub-jobs batch ingestion
3. Seed DEV/QA databases (smoke test data)
4. Create test submissions (historical Agent BBs)
5. Verify Shadow BB calculations match legacy system (data validation)

**Deliverables:**
- `pe-sub-jobs/data/lp_master.csv` (anonymized, validated)
- `pe-sub-jobs/data/facilities.csv` (UBS account numbers, loan amounts, maturity dates)
- Migration runbook (CSV → database schema mapping)
- Data validation report (row counts, field coverage, calculation accuracy)

**Ownership:** PE Sub Platform Team + Credit Operations  
**Effort:** 2–3 days

---

### 6. User Acceptance Testing (UAT) — Weeks 5–7

**Participants:** 3–5 credit officers + 2 analysts (BUSA PE Sub Finance team)

**Test Scenarios (Sign-Off Criteria):**

| Scenario | Test Case | Success Criteria |
|----------|-----------|------------------|
| **Upload & Extraction** | Upload an Agent BB file (Goldman Sachs format) | File parsed, 500+ LPs extracted, ≥95% field confidence for commitment/uncalled columns |
| **Field Mapping** | Encounter unrecognized column (new bank format) | Column appears in "Unrecognized" list; analyst maps to canonical field; next extraction re-uses mapping |
| **LP Name Matching** | Match 500 agent LPs against 20k LP Master | ≥90% auto-accepted (score ≥95%), ≤10% require review (score 80–94%), remaining discarded or new records created |
| **Shadow BB Calculation** | Run BB on matched LPs | Advance rates applied per classification × % funded; concentration limits enforced; breach alerts flagged per config |
| **Breach Detection** | Force breach scenario (1 LP > 15% of BB) | Single LP breach detected and flagged red; warning for 50–60% breach band |
| **Collateral Export** | Generate PDF collateral certificate | PDF contains facility summary (BB, delta, rate), per-LP grid (uncalled, rate, BB contribution), breach list |
| **Audit Trail** | Review audit log for submission workflow | Every step logged (upload timestamp, extracted LP count, matched LPs, shadow BB run, PDF export) with user name and IP |
| **Data Persistence** | Submit two BBs in succession (same facility) | First snapshot persists; second snapshot accessible via snapshot selector; can compare side-by-side |
| **LP Master Update** | Update an LP's classification on second submission | Override saved in shadow_bb_overrides JSONB; does not mutate LP Master; can reset to defaults |
| **Batch Ingestion** | Seed facility + LP Master via CSV (pe-sub-jobs) | CSV ingested on startup; data persists to PostgreSQL; dashboard shows facilities and LP count |
| **Configuration Change** | Update concentration limit threshold (Config screen) | New threshold applied on next Shadow BB run without redeployment; old snapshots retain previous threshold |
| **Performance** | Ingest and calculate BB for 2k-LP facility | Extraction completes in <10 sec, matching in <20 sec, calculation in <5 sec; no timeouts |

**Acceptance Criteria:**
- ✅ All 11 test scenarios pass without critical bugs
- ✅ Credit team sign-off: "Platform accurately computes Shadow BB and automates the manual workflow"
- ✅ Data validation: Shadow BB totals match legacy system (within $1M rounding tolerance for $500M+ facilities)
- ✅ Performance: Submission cycle (upload → results) completes in <5 minutes for typical 500-LP file

**Ownership:** BUSA PE Sub Finance Team (test execution) + QA / Platform Team (defect triage)  
**Duration:** 2–3 weeks  
**Defect Handling:** Critical (blocks workflow) = hotfix; Major (data accuracy) = fix before PROD; Minor (UI) = Phase 2

---

### 7. Compliance & Approval (Week 7)

**Sign-Offs Required:**
1. **Credit Risk:** Shadow BB engine calculations verified against legacy system
2. **Data Governance:** LP Master schema, data retention policy, audit trail meets 7-year requirement
3. **Security:** Entra ID SSO enabled, Key Vault secrets rotated, network security groups approved
4. **Operations:** Runbooks for deployment, incident response, and data recovery documented

**Deliverables:**
- Risk assessment memo (ShadowBB engine validation, LP matching accuracy, concentration breach detection)
- Data governance policy (LP Master ownership, change approval, deletion procedures)
- Security scan report (OWASP Top 10, dependency scanning, secrets scanning)
- Operational runbooks (deployment, backup/restore, troubleshooting, on-call escalation)

**Ownership:** Risk/Compliance/Security teams  
**Effort:** 1 week (parallel with UAT)

---

### 8. PROD Deployment (Week 8)

**Prerequisites:**
- ✅ UAT sign-off from BUSA PE Sub Finance
- ✅ Compliance approvals in place
- ✅ Data migration validated
- ✅ Entra ID SSO & Key Vault operational
- ✅ Terraform infrastructure deployed and tested in QA

**Deployment Steps:**
1. Create PROD AKS cluster and Azure Database
2. Run Flyway migrations (schema + seed data)
3. Push Docker images to ACR
4. Deploy helm releases (pe-sub-ui, pe-sub-api, pe-sub-extraction, pe-sub-jobs)
5. Verify all health checks (GET /health on each service)
6. Smoke test (upload test file, run Shadow BB, export PDF)
7. DNS cutover (point pesubapi.ubs.com to PROD ingress)
8. Announce launch

**Ownership:** PE Sub Platform Team (lead) + UBS Cloud Team (infra support)  
**Duration:** 1–2 days  
**Go-live window:** Business hours (avoid Friday afternoon)

---

## Timeline & Resource Plan

```
Week 1-2:   Cloud architecture decision + Terraform design
Week 2-4:   Terraform development + CI/CD pipeline setup (parallel)
Week 3-4:   Auth/secrets setup (parallel)
Week 4:     Data migration & seeding
Week 5-7:   UAT (3 weeks, overlaps with final testing)
Week 7:     Compliance sign-offs
Week 8:     PROD deployment & go-live

Total:      8 weeks (6–8 weeks as stated, accounting for approval delays)
```

**Resources Required:**
- 1 Platform Lead (Terraform, CI/CD, deployment orchestration)
- 2 Backend Engineers (UAT support, defect fixes)
- 1 Frontend Engineer (UI testing, minor fixes)
- 1 Data Engineer (CSV seeding, validation)
- 1 QA/Test Lead (UAT planning, sign-off criteria)
- Support from: UBS Cloud Team, Security, Risk/Compliance, BUSA PE Sub Finance team

---

## What Is NOT Included (Phase 2)

The following features are **designed but deferred** to Year 2 (post-launch enhancements):

| Feature | Why Deferred | Business Impact |
|---------|--------------|-----------------|
| **Multi-Facility LP Dedup** | Complex workflow; requires new LP record linking model | Addresses edge case where same LP appears across multiple funds (affects <5% of submissions) |
| **Advanced Portfolio Analytics** | Requires new analytics engine; out of scope for core BB automation | Forecasting, trend reporting, scenario modeling (Phase 2 enhancement) |
| **Notification Service** | Email/Slack alerts (architecture designed; implementation not critical for launch) | Analysts currently refresh screen manually; asyncio alerts are nice-to-have |
| **Scheduled Job Monitoring UI** | Job history visibility (pe-sub-jobs runs batch feeds in background) | Ops team monitors via Kubernetes logs; UI dashboard is future enhancement |

**Business Context:** MVP delivery focuses on **automating the manual BB workflow** (upload → extract → match → classify → calculate). Phase 2 adds **analytics and operational visibility** for mature deployments.

---

## UAT Sign-Off Criteria (Business Owner Checklist)

**Before production launch, BUSA PE Sub Finance must confirm:**

- [ ] **Extraction Accuracy:** Agent BB files parsed correctly; ≥95% field mapping success rate; new bank formats can be learned via Field Mapping Dictionary
- [ ] **Matching Quality:** LP names matched against LP Master with ≥90% confidence; credit team review queue is small (<10% of LPs)
- [ ] **Shadow BB Correctness:** Calculated BB totals reconcile to legacy system within $1M (for $500M+ facilities)
- [ ] **Breach Detection:** Concentration rules (Single LP, Top-10, Unrated, Non-US) working as designed; threshold configuration validated
- [ ] **Data Persistence:** Submissions persist across sessions; snapshots can be compared side-by-side; audit trail shows all changes
- [ ] **Performance:** Typical workflow (500-LP submission) completes in <5 minutes; no timeouts or crashes
- [ ] **Usability:** Analyst training completed; team can operate platform without platform engineer support
- [ ] **Compliance:** Audit trail meets 7-year retention; role-based access control (RBAC) enforced (Analyst vs. Manager)

**Sign-Off:** Approval by BUSA PE Sub Finance Lead + UBS Technology Risk & Compliance

---

## Success Metrics (Year 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to Process 1 Agent BB** | <2 hours (vs. 2–3 days manual) | Average from first 10 submissions in PROD |
| **LP Match Success Rate** | ≥90% auto-accepted | Audit log analysis |
| **Shadow BB Calculation Accuracy** | ±$1M vs. legacy system (for $500M+ facilities) | Data reconciliation report |
| **Operational Uptime** | ≥99.5% (SLA) | Prometheus/alerting metrics |
| **User Adoption** | 100% of BUSA PE Sub Finance team trained | Audit trail login events |
| **Cost Savings** | ~$200k/year (FTE reduction) | Operational efficiency calculation |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Cloud architecture delayed | 2–4 week slippage | Start Terraform design in Week 1 (not blocked by final approval) |
| UAT finds critical data accuracy bug | Delays PROD launch | Parallel UAT + defect fixing (fix during UAT, not after) |
| Entra ID SSO integration fails | Blocks PROD deployment | Test gateway mode auth in QA before UAT; have rollback plan (dev-mode fallback) |
| Data migration incomplete | Limits initial facility coverage | Start CSV preparation in Week 1; validate early |
| PE Sub Finance team unavailable for UAT | Extends timeline | Schedule UAT window early (Week 5) with confirmed participant list |

**Contingency:** If PROD launch slips beyond Week 8, extend UAT to QA permanently (month-long operational trial before going live).

---

## Recommendation

**Approve MVP scope lock-in** (15 production-ready features, Phase 2 deferrals documented).

**Next action:** Confirm cloud architecture (Compute, Database, Registry, UI hosting) with UBS Cloud Service Catalog. Once approved, start Terraform design and CI/CD setup in parallel. Platform team is ready to ship on 8-week timeline.

**Go/No-Go Decision Point:** End of Week 4 (after UAT planning is complete; final decision on any deferrals or scope adjustments).

