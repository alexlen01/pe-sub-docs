# Limited Partner (LP) Mapping & Parent-Child Resolution in Subscription Lines

This document outlines the end-to-end process for mapping a list of Limited Partners (LPs) from uploaded agent borrowing bases to an existing LP Master record. It includes the logic for matching algorithms, UI/UX recommendations for credit analysts, and a robust PostgreSQL database schema to support parent-child entity routing.

---

## Part 1: The Mapping Process Approach

Mapping LPs in Subscription Credit Facilities is a classic data reconciliation challenge. Because borrowing base calculations and concentration limits rely heavily on the ultimate creditworthiness of the LP—which often sits at the parent/sponsor level rather than the specific feeder fund or SPV—rolling up to the Parent record is an excellent strategy.

### Phase 1: Pre-Processing and Normalization
Before the Jaro-Winkler algorithm touches the data, you must clean both the uploaded Borrowing Base (BB) names and the Master LP list. Jaro-Winkler is sensitive to minor variations at the beginning of strings.
*   **Strip Legal Suffixes:** Remove common entities like "LLC," "L.P.", "L.L.P.", "Inc.", "Ltd.", "Fund I", "Fund II", etc.
*   **Standardize Casing and Spacing:** Convert to uppercase and remove extra white spaces or special characters.
*   **Maintain Original Name:** Keep the original uploaded name in a separate column to display to the analyst later.

### Phase 2: The Jaro-Winkler Matching Engine
Run the normalized uploaded LP names against the normalized names in your LP Master list.
*   **Establish Thresholds:** Set a minimum confidence score (e.g., `0.85`). 
    *   *Score > 0.95:* Auto-match (optional, though credit analysts usually prefer to review everything).
    *   *Score 0.85 – 0.95:* Flag for manual review.
    *   *Score < 0.85:* Mark as "New LP" or "No Match Found."
*   **Alias Matching:** If your LP Master has a table of "Known Aliases" (e.g., previous misspellings that analysts have mapped in the past), run the Jaro-Winkler against both the Master Names and the Aliases.

### Phase 3: Parent-Child Resolution Logic (The Core Ask)
Once the algorithm identifies the highest-scoring match in the LP Master, the application needs to apply routing logic before presenting it to the user.

1.  **Retrieve Match Record:** System identifies `Master_LP_Record` based on the highest Jaro-Winkler score.
2.  **Evaluate Parent Column:** System checks the `parent_id` column of the matched `Master_LP_Record`.
3.  **Route Details:**
    *   **If `Parent` is NULL:** The matched LP is the ultimate entity. The system stages the `Master_LP_Record` details (Credit Rating, NAV, Concentration Limit, Commitment Amount) for the BB calculation.
    *   **If `Parent` is POPULATED:** The matched LP is a child/feeder. The system traverses the relationship, fetches the `Parent_Master_Record`, and stages the *Parent's* details for the BB calculation.

### Phase 4: UI/UX for the Credit Analyst
Credit analysts need transparency to trust the system. The mapping screen should not hide the parent-child resolution; it should highlight it. 

Configure your mapping grid with the following columns:

| Uploaded LP Name (From BB) | Suggested Master Match | Match Score | Ultimate Parent (To Be Applied) | Analyst Action |
| :--- | :--- | :--- | :--- | :--- |
| *State Teachers Retirement Sys* | State Teachers Ret. System | 94% | **[Blank/Self]** | `[Accept] / [Search]` |
| *Apollo Global Real Estate Fnd IV* | Apollo GRE IV, LP | 89% | **Apollo Global Management** | `[Accept] / [Search]` |

*   **The "Accept" Action:** When the user clicks "Accept", the system writes a foreign key to the borrowing base line item. If a Parent exists, the system links the borrowing base line item to the *Parent* entity's risk profile, but ideally retains the *Child* entity ID for audit trail purposes.
*   **The "Search/Override" Action:** If the Jaro-Winkler match is wrong, the analyst clicks search, manually queries the Master LP list, and selects the correct entity. The same Parent-Child routing logic immediately applies to the manual selection.

### Phase 5: Feedback Loop
When an analyst accepts a match, save that specific uploaded string as a "Known Alias" to the child record in the LP Master. The next time that exact string is uploaded by the agent, the system will achieve a 100% exact string match, bypassing the need for fuzzy matching entirely, but still executing the Parent routing logic.

---

## Part 2: Database Schema & Architecture

It is highly recommended to **re-use the `lp_master` table as a self-referencing table** rather than creating a separate `lp_master_parent` table. Parent entities and Child/Feeder entities share the exact same data attributes. Creating a separate table forces duplicate schemas and complex `UNION` queries.

### Key Schema Improvements
1.  **Crucial Data Type Fixes:** Financial metrics (`aum`, `nav`, `ubs_default_adv_rate`, etc.) must be `NUMERIC` or `DECIMAL` instead of `VARCHAR` to allow for borrowing base math and proper sorting.
2.  **Parent-Child Linking:** Replace the string `parent` column with `parent_id INTEGER REFERENCES lp_master(id)`. This links the child directly to the parent's actual row, inheriting limits without a string-matching join.
3.  **Nulls over Empty Strings:** Changed default `''` for ratings to allow `NULL`. An unrated LP (`NULL`) is treated very differently in a borrowing base than a blank string.
4.  **Alias Table:** Added a lightweight relational table to store exact strings of uploaded names that have been successfully mapped to the master record.

### Proposed PostgreSQL Schema

```sql
-- 1. Main Master Table (Self-Referencing)
CREATE TABLE lp_master (
    id                      SERIAL          PRIMARY KEY,
    investor_name           VARCHAR(255)    NOT NULL UNIQUE,
    
    -- Hierarchical Routing
    parent_id               INTEGER         REFERENCES lp_master(id) ON DELETE SET NULL,
    is_ultimate_parent      BOOLEAN         NOT NULL DEFAULT TRUE,
    
    -- Flags & Classifications
    spv                     BOOLEAN         NOT NULL DEFAULT FALSE,
    high_quality            BOOLEAN         NOT NULL DEFAULT TRUE,
    investment_grade        BOOLEAN         NOT NULL DEFAULT FALSE,
    investor_type           VARCHAR(255),
    inst_vs_hnw             VARCHAR(50),    -- E.g., 'Institutional' or 'HNW'
    region_location         VARCHAR(255),
    ubs_classification      VARCHAR(255),
    
    -- Ratings (Allow NULL instead of empty strings)
    sp                      VARCHAR(10),
    mdy                     VARCHAR(10),
    fitch                   VARCHAR(10),
    
    -- Financials & Metrics
    -- NUMERIC(19,4) safely handles billions down to 4 decimal places
    aum                     NUMERIC(19, 4), 
    nav                     NUMERIC(19, 4),
    pension_funded_ratio    NUMERIC(5, 4),  -- E.g., 0.8550 for 85.5%
    
    -- Borrowing Base Variables
    ubs_default_adv_rate    NUMERIC(5, 4),  -- E.g., 0.9000 for 90% Advance Rate
    ubs_default_conc_limit  NUMERIC(5, 4),  -- E.g., 0.1500 for 15% Concentration Limit
    
    notes                   TEXT,
    created_at              TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Index for fast parent-child lookups
CREATE INDEX idx_lp_master_parent_id ON lp_master(parent_id);


-- 2. Alias Table for the Jaro-Winkler Feedback Loop
CREATE TABLE lp_aliases (
    id                      SERIAL          PRIMARY KEY,
    lp_master_id            INTEGER         NOT NULL REFERENCES lp_master(id) ON DELETE CASCADE,
    uploaded_name           VARCHAR(255)    NOT NULL UNIQUE,
    created_at              TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- Index for fast exact-match searches during the upload process
CREATE INDEX idx_lp_aliases_uploaded_name ON lp_aliases(uploaded_name);
```
