# German Construction Standards — Implementation Reference

TenderFish implements five core German construction standards end-to-end, from database schema through AI extraction to UI display.

---

## 1. DIN 276 — Cost Classification

**What it is:** The standard cost grouping system for German construction. Costs are organised into 8 top-level groups (KG 100–800), each with 2–3 levels of detail.

| KG   | Category                     | Example Sub-groups              |
|------|------------------------------|---------------------------------|
| 100  | Grundstück (Land)            | Purchase, ancillary costs       |
| 200  | Vorbereitende Maßnahmen      | Demolition, site preparation    |
| 300  | Baukonstruktionen             | Foundation, walls, roof, facade |
| 400  | Technische Anlagen (MEP)     | HVAC, electrical, plumbing      |
| 500  | Außenanlagen                  | Landscaping, external works     |
| 600  | Ausstattung                   | Furnishings, artwork            |
| 700  | Baunebenkosten                | Architect/engineer fees         |
| 800  | Finanzierung                  | Financing costs                 |

**In code:**

- **Constants** — 118 cost groups defined in `packages/shared/src/constants.ts` with code, label, and hierarchy level (1/2/3).
- **DB tables** — `costSnapshots` (immutable snapshot per cost stage) + `costLineItems` (individual KG entries with code, level, net/gross amounts, quantity, unit price, data state) + `costBenchmarks` (reference values per KG/region/project type).
- **Validators** — `isValidDIN276Code()`, `getDIN276Level()`, `getDIN276ParentCode()` in `packages/shared/src/validators.ts`.
- **API** — CRUD at `/api/projects/:id/cost-snapshots` and `/cost-snapshots/:id/line-items` (single + batch up to 500).
- **AI** — Pipeline step `cost_estimation` auto-generates a KG 100–800 breakdown from uploaded documents.
- **UI** — `apps/web/src/app/projects/[id]/costs/page.tsx` displays snapshots, line items, and stage progression.

---

## 2. HOAI — Architect/Engineer Fee Regulation

**What it is:** Defines 9 service phases (Leistungsphasen, LPH 1–9) and fee calculation rules based on project cost and complexity zone.

| LPH | Phase                          | Fee % (Buildings) |
|-----|--------------------------------|-------------------|
| 1   | Grundlagenermittlung           | 2%                |
| 2   | Vorplanung                     | 7%                |
| 3   | Entwurfsplanung                | 15%               |
| 4   | Genehmigungsplanung            | 3%                |
| 5   | Ausführungsplanung             | 25%               |
| 6   | Vorbereitung der Vergabe       | 10%               |
| 7   | Mitwirkung bei der Vergabe     | 4%                |
| 8   | Objektüberwachung              | 32%               |
| 9   | Objektbetreuung                | 2%                |

**Fee zones I–V** scale from simple structures (sheds) to complex buildings (hospitals). A fee table with 10 cost thresholds (€25K–€25M) provides min/max orientation values per zone.

**In code:**

- **Constants** — All 9 LPH definitions, fee percentages per phase, 5 fee zones, and a full HOAI 2021 fee table in `constants.ts`. Specialist disciplines (Tragwerk, TGA) have separate percentage distributions.
- **DB table** — `hoaiFeeCalculations` stores service type, fee zone, anrechenbare Kosten (eligible costs = KG 300 + 400), base fee, total fee, commissioned phases array, and per-phase fee breakdown.
- **AI** — Pipeline steps `lph_mapping` and `hoai_fee_calc` automatically determine the fee zone, commissioned phases, and calculate fees from extracted project data.
- **UI** — `apps/web/src/app/projects/[id]/phases/` shows all 9 LPH with status, task counts, and required outputs.

---

## 3. VOB — Construction Contract Procedures

**What it is:** The three-part German construction contracting framework: VOB/A (tendering), VOB/B (contract terms), VOB/C (technical specifications per trade).

### VOB/A — Tendering procedures

7 procurement routes defined, from open tendering (Öffentliche Ausschreibung) to direct award (Direktauftrag).

### VOB/B — Contract execution

Key lifecycle milestones tracked: Zuschlag (award) → Ausführungsbeginn (commencement) → Abnahme (acceptance) → Schlussrechnung (final invoice) → Gewährleistungsende (warranty expiry).

**Nachträge (variation orders):** 6 types per §2 VOB/B — quantity deviations, scope changes, additional works, disruption claims, daywork, and self-performance.

**Payments:** Abschlagszahlungen (interim), Teilschlussrechnung (partial final), Schlussrechnung (final account), with 5% Sicherheitseinbehalt (retention).

**Warranty:** 4 years VOB/B (§13 Abs. 4), 5 years BGB Werkvertrag.

### VOB/C — Trade specifications

35 DIN 18xxx ATVs mapped (e.g. DIN 18330 Concrete, DIN 18331 Masonry, DIN 18382 Electrical).

**In code:**

- **Constants** — All 7 tendering procedures, 8 VOB/B milestones, 6 Nachtrag types, 4 payment types, 35 ATV references in `constants.ts`.
- **DB tables:**
  - `contracts` — type (vob_b/bgb), tendering procedure, award/completion dates, retention, warranty months, VOB/C reference, DIN 276 cost group mapping.
  - `nachtraege` — type, VOB §-reference, amounts (requested/approved), schedule impact, status workflow.
  - `payments` — type, invoice dates, cumulative totals, retention deductions.
  - `abnahmen` — formal acceptance type, attendees, defect records with severity, warranty start date.
- **Validators** — `isValidNachtragNumber()` (NT-XXX format), `calculateWarrantyEndDate()`.
- **AI** — Pipeline step `vob_packages` defines trade packages with DIN 18xxx references and recommended tendering procedure per package.

---

## 4. GAEB — Data Exchange for Construction

**What it is:** The standard XML/binary format for exchanging bills of quantities (Leistungsverzeichnisse) between project parties during tendering and execution.

### Exchange phases

| Phase | Extension | Purpose                            |
|-------|-----------|-------------------------------------|
| 81    | .x81      | Cost estimate                       |
| 83    | .x83      | Tender BoQ (no prices)              |
| 84    | .x84      | Bid submission (priced)             |
| 86    | .x86      | Awarded contract                    |
| 89    | .x89      | Variation order                     |

### BoQ structure

Los (lot) → Titel (section) → Position (line item). Nine position types including Normalposition (standard), Eventualposition (contingency), Pauschalposition (lump sum), and Alternativposition.

**In code:**

- **Constants** — 10 GAEB exchange phases, BoQ hierarchy levels, 9 position types in `constants.ts`.
- **DB tables:**
  - `leistungsverzeichnisse` — LV number, exchange phase, cost group code, totals, GAEB file reference.
  - `lvPositionen` — position number (Ordnungszahl), type, short/long text, quantity, unit, unit price, DIN 276 mapping.
  - `gaebExchangeLogEntries` — import/export audit trail with file sizes and error logs.
- **Validators** — `isValidGaebFileExtension()` checks `.x81`–`.x90`, `.x11`, and XML variants.

---

## 5. Cost Logic — Snapshot Lifecycle

Costs progress through 5 DIN 276 stages, each with increasing accuracy:

```
Kostenrahmen (LPH 1, ±30%)
  → Kostenschätzung (LPH 2, ±20%)
    → Kostenberechnung (LPH 3, ±10%)
      → Kostenanschlag (LPH 6-7, ±5%)
        → Kostenfeststellung (LPH 8, final)
```

### Workflow

1. **Draft** — snapshot created, line items added at the required KG detail level.
2. **Submitted** — ready for review.
3. **Approved** — locked, immutable, timestamped.
4. **Superseded** — replaced by a newer snapshot at the same stage.

### Key design decisions

- **Immutable snapshots** — no edits after approval; new snapshot supersedes the old one for full audit trail.
- **Amounts in cents** — all monetary values stored as integers (basis points for VAT) to avoid floating-point errors.
- **Data state per line item** — every cost entry is tagged CONFIRMED, DERIVED, UNCLEAR, or MISSING to track extraction confidence.
- **Multi-level detail** — Kostenrahmen needs only KG Level 1; Kostenberechnung requires Level 3.
- **Benchmarking** — `costBenchmarks` table provides reference €/m² per KG, project type, and region for AI-generated estimates.

### Gate integration

Each gate checks the appropriate cost stage as a prerequisite:

| Gate | Required Cost Stage   | Other Key Prerequisites          |
|------|-----------------------|----------------------------------|
| A    | —                     | Project name, location, client   |
| B    | Kostenrahmen          | HOAI fee zone, risk scan         |
| C    | Kostenschätzung       | HOAI scope per discipline        |
| D    | Kostenberechnung      | VOB procedure, Bauantrag         |
| E    | Kostenanschlag        | Contracts awarded, SiGePlan      |
| F    | Kostenfeststellung    | Abnahmen complete, warranty      |

---

## AI Pipeline

The 12-step AI pipeline ties everything together:

1. Parse uploaded documents (PDF, images via OCR)
2. Extract 40+ structured facts (cost, HOAI, VOB, regulatory fields)
3. Classify project type and complexity
4. Map to HOAI LPH 1–9
5. Generate DIN 276 Kostenrahmen (KG 100–800)
6. Calculate HOAI fee estimate (zone + phases)
7. Define VOB trade packages with DIN 18xxx references
8. Check regulatory requirements (Bauantrag, Brandschutz, GEG, SiGeKo)
9. Generate schedule model across all 9 LPH
10. Build responsibility/RACI matrix
11. Run gate eligibility check (Gates A–F)
12. Configure dashboard

Every extracted fact is tagged with a **data state** (CONFIRMED/DERIVED/UNCLEAR/MISSING) and a **source quote** from the original document for traceability.
