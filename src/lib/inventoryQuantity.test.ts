import { describe, it, expect } from 'vitest';
import { isIntegerOnlyUnit, quantityInputStep, validateQuantity, roundQuantity } from './inventoryQuantity';

describe('isIntegerOnlyUnit', () => {
  it('is true when allowsFractional is explicitly false (e.g. Piece, Box)', () => {
    expect(isIntegerOnlyUnit(false)).toBe(true);
  });

  it('is false when allowsFractional is true (e.g. Kilogram, Litre)', () => {
    expect(isIntegerOnlyUnit(true)).toBe(false);
  });

  it('defaults to decimal-allowed when unit metadata is unavailable (undefined)', () => {
    expect(isIntegerOnlyUnit(undefined)).toBe(false);
  });
});

describe('quantityInputStep', () => {
  it('is "1" for integer-only units', () => {
    expect(quantityInputStep(false)).toBe('1');
  });

  it('is "any" for decimal-capable or unknown units', () => {
    expect(quantityInputStep(true)).toBe('any');
    expect(quantityInputStep(undefined)).toBe('any');
  });
});

describe('validateQuantity', () => {
  it('rejects zero and negative quantities', () => {
    expect(validateQuantity(0, true)).not.toBeNull();
    expect(validateQuantity(-1, false)).not.toBeNull();
  });

  it('rejects non-finite quantities', () => {
    expect(validateQuantity(NaN, true)).not.toBeNull();
    expect(validateQuantity(Infinity, true)).not.toBeNull();
  });

  it('rejects fractional quantities for integer-only units', () => {
    expect(validateQuantity(2.5, false)).not.toBeNull();
    expect(validateQuantity(1.1, false)).not.toBeNull();
  });

  it('accepts whole quantities for integer-only units', () => {
    expect(validateQuantity(3, false)).toBeNull();
  });

  it('accepts fractional quantities for decimal-capable units', () => {
    expect(validateQuantity(2.5, true)).toBeNull();
    expect(validateQuantity(0.75, true)).toBeNull();
  });

  it('accepts fractional quantities when unit metadata is unknown (safe fallback, no false rejection)', () => {
    expect(validateQuantity(1.5, undefined)).toBeNull();
  });
});

describe('roundQuantity', () => {
  it('clears floating-point subtraction artefacts', () => {
    expect(roundQuantity(0.3 - 0.1)).toBe(0.2);
  });

  it('preserves precision up to 3 decimal places', () => {
    expect(roundQuantity(1.234)).toBe(1.234);
  });

  it('is a no-op for integers', () => {
    expect(roundQuantity(5)).toBe(5);
  });
});
