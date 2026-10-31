# Invoice money: rules, limits and where they live

**One implementation.** All invoice-amount validation and arithmetic is in
`backend/src/common/money/invoice-money.ts`. It is plain TypeScript with no
imports, so both halves compile the same file.
- **API:** `backend/src/invoices/utils/invoice-totals.util.ts` wraps it and
  turns the first issue into a 400. The server stays authoritative.
- **Web app:** imports it through the `@invoice-money` alias (Vite `resolve.alias` and
  `tsconfig.app.json` `paths`). The invoice form previews totals with it,
  shows the issues the API would reject, and blocks submit while any remain.
- **Demo data:** sample-data generation computes its totals with it too.

Do not add another copy.

## Rules

| What | Rule | Why |
|---|---|---|
| Amounts | Two decimal places, integer cents internally | **Existing limitation:** every currency uses two decimals, including those whose minor unit differs (JPY, KWD). There is no currency-specific precision |
| Quantity | Integer, 1 to 1,000,000 | |
| Unit price | 0 to 99,999,999.99 | |
| Every computed amount | Each line's subtotal, discount, tax and total, and the invoice's subtotal, discount, tax and total: at most 99,999,999.99 | Amounts are stored as `numeric(12,4)`. Valid-looking quantities and prices can combine into an amount that cannot be stored, so it is rejected before anything is written |
| Tax and discount rates | Optional, 0 to 100, **at most four decimal places** (e.g. 8.875 %) | Stored as `numeric(7,4)` (migration `1761000000000`). A fifth decimal is rejected, not rounded |
| Line arithmetic | Discount = rate of the line subtotal; tax on the amount after discount (`beforeDiscount` also supported); each rounded to the cent **half away from zero**, computed exactly in integers | Floating-point rates rounded some exact half cents down (1.80 at 17.5 % gave 0.31) |
| Invoice totals | Sums of the rounded lines; an optional invoice-level discount percentage replaces the line discounts when larger (not used by the app today) | |

## The web form

- Values are validated **as the API receives them**: JSON, then the
  ValidationPipe's number conversion (`submittedMoneyFields`). Loaded invoices
  carry decimal columns as strings (`"12.5000"`).
- An untouched placeholder line, exactly as "Add item" creates it, is left out
  of the totals and of the submitted invoice. Any other line is submitted. If
  it has no description (or one over 1,000 characters), submit is blocked with
  "Line N: description is required". Nothing is dropped silently.
- Rate inputs accept four decimals (`step="0.0001"`).

## Deploying this change

- **Migration:** run `1761000000000-WidenInvoiceItemRatePrecision`
  (`npm run migration:run`) before the new API serves requests.
  - **Up** widens the two rate columns and keeps every stored value and
    total exactly. Nothing is recalculated, and precision already lost
    (rates stored rounded to 8.88) cannot be recovered.
  - **Down** rounds rates back to two decimals.
- **Limit change:** the API now rejects amounts above 99,999,999.99. Before,
  validation allowed up to 999,999,999,999.99, and such invoices failed while
  being written.

## Tests

- **`backend/src/common/money/invoice-money.spec.ts`:**
  - hand-computed cases;
  - storage-boundary, aggregate-overflow and rate-precision tests;
  - seeded property tests: an exact integer oracle, invariants, and parity
    with the previous API rules except the intended limits.
- **`backend/test/invoice-money.db.spec.ts`** (real PostgreSQL):
  - POST and GET of the cases;
  - four-decimal rates through save, reload and edit;
  - limits with no partial write on create or update;
  - the migration down and up.
- **Frontend:** `frontend/src/utils/invoice-totals.util.test.ts` and
  `frontend/src/pages/Invoices/InvoiceForm.test.tsx`, which cover edit mode
  with decimal strings, real submission payloads and blank-description lines.
