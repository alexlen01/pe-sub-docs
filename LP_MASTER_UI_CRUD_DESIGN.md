# LP Master — Expose Golden Records in the UI + CRUD API — Solution Design

**Status:** Draft for review · **Author:** Solution Architect · **Date:** 2026-07-17
**Related:** `LP_DB_EXTRACT_DESIGN.md` (the one-off extract that populates `lp_master`)

---

## 0. TL;DR

The **golden LP records in `lp_master` are never shown in the app.** The screen *named* "LP Master"
is actually facility-centric — its **View All LPs** button lists `lp_records` (per-facility
positions), not the bank-wide golden profiles. This proposal adds a sibling **View Master LPs**
view on that same screen, backed by the **two missing CRUD endpoints** (`POST` create, `PUT`
update); list / get / delete already exist on both the API and the `api.lpMaster` client.

This is **not** the same as the "only 1,518 loaded, expected 20,000" observation — see §1, which
shows the extract is behaving correctly and 20,000 was never a record count.

---

## 1. Data-model reconciliation (why the numbers are what they are)

The concern was that the extract "loads only 1,518 LP records instead of 20,000." A per-column
analysis of the export settles it: **the 20,000 rows are not 20,000 distinct records.**

| Count | Meaning | Table |
|------:|---------|-------|
| 20,000 | Raw export **rows** | (source only — never a table row count) |
| **65** | Distinct `AccountID` (facilities) | `facilities` |
| **300** | Distinct `InvestorName` (golden LPs) | **`lp_master`** |
| **1,518** | Distinct `(AccountID, InvestorName)` positions | `lp_records` |

`20,000 ≈ 65 × 300` — the export is a near-full facility × investor grid, and each
`(facility, investor)` position is **physically repeated ~13× with only randomized values**.
Proof, from the single most-duplicated pair (`AccountID 5VX1128` / `Apex Alternative Assets Trust`,
16 rows):

- **Constant across all 16 rows** (identity/key): `AccountID`, `FndName`, `InvestorName`, `Parent`,
  `SPV`, `InvestorType`, `HQ`, `InstitutionalHNW`, `InvestmentGrade`, `FundingRatio`, `AgentCL`, `BBDate`.
- **Varies** (noise only): `Commitments` (16 distinct), `Uncalled`, `UBSAR`, `UBSCL`, `AgentBB`,
  `UBSBB`, ratings, `AUM`/`NAV`, etc.
- Adding **every** plausible discriminator — `(AccountID, InvestorName, SPV, Parent)` — still yields
  **1,518**, not more. There is **no hidden dimension** (sleeve/vintage/SPV) that would make the
  16 rows distinct positions.

**Conclusion.** An LP holds exactly one position in a facility; `lp_records` is correctly keyed
`(facility, investor)` and the DB enforces it (`existsByFacilityIdAndInvestorName`). Loading all
20,000 would store 16 mutually-contradictory rows for the *same* LP in the *same* facility —
which the schema forbids and which is semantically meaningless. **1,518 is the correct count.**
The two meaningful numbers a user should be able to *see* are **1,518 positions** (already visible)
and **300 golden LPs** (this proposal). *If* the real (non-synthetic) LP DB ever carries a genuine
sub-position key, that is a separate grain change (new export column → widen the dedup key → widen
`lp_records` uniqueness); it is out of scope here and not evidenced by the current file.

---

## 2. The gap (what's actually missing)

| Layer | Today | Gap |
|-------|-------|-----|
| DB | `lp_master` populated (300 golden LPs) | — |
| API read | `GET /api/lp-master`, `/{id}`, `/count`, `/investor-types` | — |
| API write | `DELETE /{id}` (ANALYST); `POST /ingest`, `/clear` (SERVICE) | **No create, no update** |
| UI client | `api.lpMaster.list/get/count/investorTypes/remove` | **No create, no update** |
| UI screen | "LP Master" screen shows facilities → **`lp_records`** | **`lp_master` golden records never rendered; no edit form** |

So "expose LP Master with CRUD" reduces to: **2 API endpoints + 2 client methods + 1 new view
(table + edit form) on an existing screen.**

---

## 3. Scope

**In scope**
- API: `POST /api/lp-master` (create), `PUT /api/lp-master/{id}` (full update). ANALYST-gated, audited.
- Client: `api.lpMaster.create`, `api.lpMaster.update`.
- UI: a **View Master LPs** view on the existing LP Master screen — golden-record table + **Add LP**
  + inline/modal **edit form**, reusing the delete already wired.

**Out of scope**
- Any change to the extract grain or the 1,518 count (§1).
- Per-facility financials (commitments, BB, called/uncalled) — those live on `lp_records`, never `lp_master`.
- Bulk edit / CSV upload from the UI (the ingest job remains the canonical bulk path).
- Workflow/approval on edits (maker-checker) — deferred to Phase 2, consistent with Shadow BB.

---

## 4. API design (pe-sub-api)

### 4.1 New endpoints

| Method | Path | Body → Returns | RBAC | Notes |
|--------|------|----------------|------|-------|
| `POST` | `/api/lp-master` | `LpMasterUpsertRequest` → `201` `LpMasterDto` | ANALYST | 409 if `investorName` already exists (unique). |
| `PUT` | `/api/lp-master/{id}` | `LpMasterUpsertRequest` → `200` `LpMasterDto` | ANALYST | 404 if id absent; 409 if rename collides with another row. |

Existing `GET`/`DELETE`/`ingest`/`clear` are unchanged. Reads stay open to all authenticated roles
(incl. VIEWER); mutations are ANALYST — mirroring the existing `DELETE /{id}` curation gate.

### 4.2 Request DTO (Java record, per project rules)

```java
public record LpMasterUpsertRequest(
    @NotBlank String name,               // investor_name (unique key)
    String parent,
    boolean spv,
    boolean hq,                          // high_qty
    String investorType,
    String instVsHnw,
    String regionLocation,
    boolean ig,
    String cls,                          // ubs_classification
    String sp, String mdy, String fitch,
    String aum, String nav, String pension, String pensionFunded,
    String rate,                         // ubs_default_adv_rate
    String ubsConc,                      // ubs_default_conc_limit
    String notes
) {}
```

- Field names/JSON mirror `LpMasterDto` exactly (round-trip parity — pe-sub-api rule: any new field
  must round-trip POST → GET). `id`/`createdAt`/`updatedAt` are server-owned and never accepted.
- Validation: `@Valid` on the body; `name` `@NotBlank`. String scale fields stay **as-is** (LP Size
  is stored verbatim — no rounding/parsing, per the precision rule).

### 4.3 Service & repo

- `LpMasterService.create(req)` / `update(id, req)` — both in the service layer (no DB logic in the
  controller). Reuse `LpMasterRepository`; add `existsByInvestorName(String)` and, for rename
  collision, `existsByInvestorNameAndIdNot(String, Integer)`.
- Uniqueness conflicts surface as **409 `ProblemDetail`** via `@RestControllerAdvice` (map the
  existing/duplicate-key case explicitly rather than leaking a 500).
- Audit every mutation through `AuditLogService` ("LP Master Created" / "LP Master Updated",
  investor name + id), matching the existing delete audit; `NotificationService.broadcast` likewise.
- **Interaction with write-back:** `lp_master` credit-profile fields are also synced by
  `LpMasterWriteBackService` at Shadow BB settle points. A manual `PUT` is a curation override; note
  in the endpoint Javadoc that a later Shadow BB settle can overwrite `rate`/`ubsConc`/`cls`. No
  locking in Phase 1.

### 4.4 Docs & tests (required by pe-sub-api rules)

- Update `README.md` (new endpoints/response shape) and `pe-sub-docs/openapi.yaml`.
- Integration tests (Zonky embedded PG, extend `IntegrationTestBase`): create→GET round-trip (all
  fields); update mutates + bumps `updatedAt`; duplicate-name create → 409; rename-collision → 409;
  update missing id → 404; non-ANALYST → 403; create then GET list shows the row.

---

## 5. UI design (pe-sub-ui)

### 5.1 New view on the existing LP Master screen

The screen already has `view: 'grid' | 'list'`. Add **`'master'`**.

- **Entry point:** next to the existing **View All {N} LPs** button in the grid filter bar
  ([LPMaster/index.tsx:704](../pe-sub-ui/src/screens/LPMaster/index.tsx#L704)), add
  **`View Master {count} LP records →`**, where `{count}` comes from `api.lpMaster.count()`.
  Clicking sets `view='master'` and loads `api.lpMaster.list()`.
- **Why here:** keeps the two lenses on one screen — *positions* (facility → `lp_records`) vs
  *golden profiles* (`lp_master`) — which is the mental model in §1.

### 5.2 Golden-record table (columns)

Only golden fields — **no per-facility columns** (no Rank/Commitments/BB/Called/Uncalled, which are
`lp_records`-only):

Investor Name · Parent · SPV · Region/Location · Investor Type · Inst vs HNW · Investment Grade ·
UBS LP Classification · S&P · Moody's · Fitch · LP Size · Size Measure · UBS Default Advance Rate ·
UBS Default Conc Limit · Notes · Last Updated.

Reuse the existing `useSortableRows` / `usePagination` / `useColumnResize` / `Tag` / `lpSizeFormat`
machinery already in this file. Filters: search (name/parent), Investor Type (`api.lpMaster.investorTypes()`),
UBS Classification.

### 5.3 Edit form (create + update)

- **Pattern:** a modal editor modeled on the existing `FacilityDetailOverlay` (shared `Modal`,
  sectioned Identity / Classification / Ratings / Financial Scale / UBS Credit Profile), which is the
  established edit surface on this screen. (Inline expand-to-edit is the stated UX preference; a
  sectioned modal is acceptable for a wide admin record and matches the neighbouring facility editor —
  final call in §7.)
- **Add LP** button (ANALYST only) opens the form empty → `api.lpMaster.create` → `201` → refresh list.
- Row click → form prefilled → `api.lpMaster.update(id, …)` → refresh.
- **Delete** reuses `api.lpMaster.remove` (already present) with the existing confirm affordance.
- **RBAC:** gate Add/Edit/Delete on `canEdit` (Analyst / Account-Transaction Manager), exactly as the
  facility and LP-record editors on this screen already do. VIEWER sees the table read-only.
- Empty/error states per UI rules (no silent fallback; surface `loadError`).

### 5.4 Tests

- Screen test: golden rows render real fixture values (not `—`), master view toggles from the button.
- Service test: `create`/`update` call the right verb/URL with a mocked `fetch` mirroring the contract.

---

## 6. Delivery slices

1. **API** — request DTO + service create/update + repo methods + advice mapping + audit; tests; README/openapi.
2. **Client** — `api.lpMaster.create/update`; service test.
3. **UI** — `'master'` view + button + table; then the create/update/delete form.

Each slice is independently shippable; slice 1 is the only backend change.

---

## 7. Open decisions (need product sign-off before build)

1. **Edit surface:** sectioned **modal** (matches the adjacent facility editor) vs **inline
   expand-to-edit** (stated general preference). *Recommend modal here* for a ~19-field admin record.
2. **Manual Create:** allow creating a golden LP by hand, or restrict `lp_master` writes to the
   ingest + edits only (no create)? *Recommend allow create*, ANALYST-gated, since off-export LPs occur.
3. **Rename semantics:** `investorName` is the unique key but `lp_records` link by `lp_master_id`
   (FK), so a rename is safe for linkage. Confirm renames are allowed (with 409 on collision).
4. **Write-back precedence:** accept that a later Shadow BB settle may overwrite manually-edited
   `rate`/`ubsConc`/`cls` (Phase 1), or protect manual edits (Phase 2 maker-checker)?
