// Centralizes quantity/unit rules for the Inventory module so every form
// (requests, approvals, issue, opening balance, item min/reorder levels)
// enforces the same behaviour: positive quantities, no accidental fractions
// for count-based units, and no JS floating-point display artefacts on
// values that ultimately come from Postgres `numeric` columns.
//
// Fraction rules are schema-driven (inventory_units.allows_fractional), not
// inferred from a unit's name/abbreviation — a director can declare the
// rule for any unit, including ones they create later. `undefined` means
// the caller doesn't have unit metadata loaded (e.g. a query that didn't
// join inventory_units); the safe fallback is to allow decimals rather than
// wrongly block a legitimate fractional quantity.

export function isIntegerOnlyUnit(allowsFractional: boolean | undefined): boolean {
  return allowsFractional === false;
}

// HTML number input `step` — restricts the spinner/native validation to
// whole numbers for count-based units, "any" (decimals allowed) otherwise.
export function quantityInputStep(allowsFractional: boolean | undefined): string {
  return isIntegerOnlyUnit(allowsFractional) ? '1' : 'any';
}

export function validateQuantity(qty: number, allowsFractional: boolean | undefined): string | null {
  if (!Number.isFinite(qty) || qty <= 0) return 'Quantity must be greater than 0.';
  if (isIntegerOnlyUnit(allowsFractional) && !Number.isInteger(qty)) {
    return 'Quantity must be a whole number for this unit.';
  }
  return null;
}

// Client-side arithmetic on decimal quantities (e.g. approvedQty - fulfilledQty)
// can produce artefacts like 0.30000000000000004. Balances themselves are
// always authoritative from the DB `numeric` column; this only guards
// derived, client-computed display values.
export function roundQuantity(n: number): number {
  return Math.round(n * 1000) / 1000;
}
