# risk-report-list

## Intent

| Question | Answer |
| --- | --- |
| Who uses this | Risk analysts who already know the portfolio names |
| How often | Several times an hour during the morning close |
| Primary action | Run a fresh report against the selected portfolio |
| When it fails | The run times out and the analyst has to explain the gap |
| At realistic scale | Four hundred rows on a bad day, twelve on a normal one |

## Layout

- header
  - portfolio selector
  - run report button
- report table
- footer with the last run time

## Components

Reused:
- `DataTable` — src/components/ui/data-table.tsx
- `Select` — src/components/ui/select.tsx

New:
- `RiskReportRow` — src/components/risk-report-row.tsx

## Hierarchy

1. Run report button
2. Report table
3. Portfolio selector
4. Last run time

## States

**Empty** — No reports yet for this portfolio, with the run button repeated inline as the way out

**Loading** — Skeleton rows at the last known row count so the table does not collapse and jump

**Error** — The run failed, the reason the service gave, and a retry that keeps the selected portfolio

**Populated at scale** — Four hundred rows paginated at fifty, newest first, with the count stated above the table

## Revisions

- 2026-09-22T10:31:00.000Z (redispatch) — First draft ranked the portfolio selector first. Running a report is the primary action; selecting is setup for it.
