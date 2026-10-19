# UI guidelines

Khaapa is used by students between classes, often on a phone, often in a rush.
Every screen should be understood in a few seconds.

## Page recipe (top to bottom)

1. **Title + one sentence** saying what the page is for (`PageHeader` or `Explainer`).
2. **The main action**, if there is one (`ActionCard`, or one primary button). One per page.
3. **At most 4 headline numbers** (`KpiRow` + `KpiTile`), each with a short label.
4. **One picture** when the data has a shape (`ColumnChart`, `BarList`, `SplitBar`, `Meter`).
5. **Details folded away** (`Disclosure`, tabs, "show more"), not dumped on the page.

## Rules

- Plain words. "Money in the drawer", not "expected cash". "Bought at", not "unit cost".
- One idea per card. Generous spacing (`space-y-8` between sections, `p-5` cards).
- Never show more than ~7 rows by default; offer "Show all".
- Lists on phones are cards, not wide tables.
- Status uses an icon or word **and** colour, never colour alone.
- Empty states say what to do next (`EmptyState` with an action).
- Forms ask only for what's needed. Payment proof is a screenshot only.

## Charts (`src/components/charts.tsx`)

- Colours: `--series-1` (green), `--series-2` (blue), `--series-3` (orange), in that
  order. They passed the colour-blind check in light and dark. `--series-muted` is for
  context. Text is never coloured like the data.
- One series: no legend (the title says it). Two or more: a legend.
- Bars ≤ 24px with a 4px rounded end; hairline gridlines; every mark has a tooltip.
- A single number is a `KpiTile`, not a chart. Part-to-whole is a `SplitBar`, never a pie.
- No dual axes. Two measures with different scales get two charts.
