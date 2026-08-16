# Master LP Database Mapping

This maps the Master LP Database fields supplied by users to the LP record fields used by the platform.

Primary LP storage is `pe-sub-api` `lp_records`, represented by `Lp` and exposed through `LpDto`. The UI mostly uses the `LpDto` names.

| Master LP Database field | LP API / UI field | Entity property | DB column | Notes |
|---|---|---|---|---|
| Investor Name | `name` | `investorName` | `investor_name` | Required LP identity field. Used with `facility_id` for uniqueness. |
| Parent | `parent` | `parent` | `parent` | Ultimate parent, sponsor, or manager. |
| SPV | `spv` | `spv` | `spv` | Boolean. |
| InvestorType | `type` | `invType` | `inv_type` | Detailed investor type, such as pension fund, endowment, foundation, HNW, institutional, family office. |
| Region | `region` | `region` | `region` | Geographic region. |
| HQ | `hq` | `highQty` | `high_qty` | Boolean high-quality / HQ flag exposed as `hq` in the API. |
| InstitutionalHNW | `type` | `invType` | `inv_type` | No separate LP record field. Normalize into `invType`, typically `Institutional` or `HNW`. If both `InvestorType` and `InstitutionalHNW` are present, keep the more specific `InvestorType` value and use this only as a fallback/category hint. |
| Investment Grade | `ig` | `ig` | `investment_grade` | Boolean. May be manually supplied or derived from ratings rules upstream. |
| Classification | `cls` | `cls` | `classification` | UBS LP Category / UBS classification tier. If the source value is the agent's workbook category instead, use `agentCls` / `agent_cls` instead. |
| Notes | `notes` | `notes` | `notes` | Free text. |
| SP | `sp` | `sp` | `sp` | S&P rating. |
| Moodys | `mdy` | `mdy` | `mdy` | Moody's rating. Extraction rows may call this `moodys`; the LP record field is `mdy`. |
| Fitch | `fitch` | `fitch` | `fitch` | Fitch rating. |
| AUM | `aum` | `aum` | `aum` | Formatted string in the current LP record model. |
| NAV | `nav` | `nav` | `nav` | Formatted string in the current LP record model. |
| PensionAssets | `pension` | `pension` | `pension` | Pension assets. |
| FundingRatio | `pensionFunded` | `pensionFunded` | `pension_funded` | Pension funded percentage / funding ratio. |
| UBSAR | `rate` | `ubsRate` | `ubs_rate` | UBS advance rate. The API exposes this as `rate`; computed BB logic uses it before falling back to classification defaults. |
| AgentAR | `agentRate` | `agentRate` | `agent_rate` | Agent advance rate from the Agent BB. |
| Commitments | `capCommit` | `capCommit` | `cap_commit` | Capital commitment. |
| PercentOfCommitments | `pctCapCommit` | `pctCapCommit` | `pct_cap_commit` | LP commitment as a percentage of total commitments. |
| Called | `calledCap` | `calledCap` | `called_cap` | Called / funded capital. |
| Uncalled | `uc` | `uc` | `uncalled_capital` | Uncalled capital. |
| PercentOfUncalled | `pctUncalled` | `pctUncalled` | `pct_uncalled` | LP uncalled capital as a percentage of total uncalled. |
| CalledPercent | `pctCalled` | `pctCalled` | `pct_called` | Percentage of the LP's own commitment that has been called. |
| AgentCL | `agentConcLimit` | `agentConcLimit` | `agent_conc_limit` | Agent concentration limit. `NUMERIC`; percent scale (`7.5` = 7.5%). |
| UBSCL | `ubsConcLimit` | `ubsConcLimit` | `ubs_conc_limit` | UBS concentration limit. `NUMERIC`; either a percent (`7.5`) or an absolute dollar cap (`25000000`). |
| AgentBB | `abb` | `abb` | `agent_bb` | Agent borrowing base. |
| UBSBB | `ubb` | `ubb` | `ubs_bb` | UBS borrowing base. |
| BBDate | Facility-level `lastRunAt` | `Facility.lastRunAt` | `facilities.last_run_at` | Facility-level last BB run date. Not an LP-level field. |

## Precise Money Columns

Four money fields are stored as a single exact-dollar `NUMERIC(20,2)` column each — there is no formatted display-string sibling (the earlier `*_num` companions were consolidated away, August 2026). The BB engine computes directly off the numeric (`BbCalculationService.dollarM`); DTOs format for display on the way out (`MoneyValues.display`), so the string-typed API/UI contract is unchanged but values are never re-abbreviated: `"$4.2B"` in comes back as `"$4,200,000,000"`.

| Column | Type | Written by |
|---|---|---|
| `uncalled_capital` | `NUMERIC(20,2)` | Extraction ingest (exact decimal) and Shadow BB commit (parsed from the committed string) |
| `cap_commit` | `NUMERIC(20,2)` | Same |
| `aum` | `NUMERIC(20,2)` | Same |
| `agent_bb` | `NUMERIC(20,2)` | Ingest only — agent-reported; a Shadow BB run never overwrites it |

`agent_conc_limit` and `ubs_conc_limit` (renamed from `agent_conc` / `ubs_conc`) are likewise `NUMERIC`. They hold either a percent of total uncalled capital (`7.5`) or an absolute dollar cap (`25000000`); the two are told apart by magnitude at `BbCalculationService.ABSOLUTE_DOLLAR_MIN` (100,000).

## Related LP Fields Not In The Provided Source List

| LP API / UI field | Entity property | DB column | Purpose |
|---|---|---|---|
| `agentCls` | `agentCls` | `agent_cls` | Agent LP Category taken verbatim from the Agent BB. Distinct from UBS `cls`. |
| `clsTag` | `clsTag` | `classification_tag` | Optional classification tag. |
| `agentExcessConc` | `agentExcessConc` | `agent_excess_conc` | Agent excess concentration base. |
| `ubsExcessConc` | `ubsExcessConc` | `ubs_excess_conc` | UBS excess concentration base. |
| `inc` | `inc` | `included` | Included in borrowing-base calculations. |
| `rcl` | `rcl` | `rcl` | Recallable distribution flag. |
| `recallableDist` | `recallableDist` | `recallable_dist` | Recallable distribution amount. |
| `tf` | `tf` | `transferee` | Transferee flag. |
