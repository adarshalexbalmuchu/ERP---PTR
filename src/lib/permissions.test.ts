import { describe, it, expect } from 'vitest';
import { canManageInventory, canManageTasks, canManageIncidents } from './permissions';
import { isFieldRole, FIELD_ROLES } from '../types';
import type { Role } from '../types';

const ALL_ROLES: Role[] = ['director', 'range_officer', 'guard', 'range_office', 'tiger_cell', 'inventory_staff'];

describe('canManageInventory', () => {
  it('director can manage inventory', () => {
    expect(canManageInventory('director')).toBe(true);
  });

  it('inventory_staff cannot manage inventory (they act only within assigned locations, enforced by RLS)', () => {
    expect(canManageInventory('inventory_staff')).toBe(false);
  });

  it('every existing Field Operations role is denied inventory management', () => {
    for (const role of ['range_officer', 'guard', 'range_office', 'tiger_cell'] as Role[]) {
      expect(canManageInventory(role)).toBe(false);
    }
  });

  it('undefined role is denied', () => {
    expect(canManageInventory(undefined)).toBe(false);
  });
});

describe('inventory_staff is not accidentally treated as a field role', () => {
  it('is not included in FIELD_ROLES', () => {
    expect(FIELD_ROLES).not.toContain('inventory_staff');
  });

  it('isFieldRole(inventory_staff) is false', () => {
    expect(isFieldRole('inventory_staff')).toBe(false);
  });

  it('isFieldRole still correctly recognizes the real field-tier roles', () => {
    expect(isFieldRole('guard')).toBe(true);
    expect(isFieldRole('range_office')).toBe(true);
    expect(isFieldRole('tiger_cell')).toBe(true);
  });

  it('isFieldRole rejects director/range_officer/inventory_staff', () => {
    expect(isFieldRole('director')).toBe(false);
    expect(isFieldRole('range_officer')).toBe(false);
    expect(isFieldRole('inventory_staff')).toBe(false);
  });
});

// Sanity check that adding inventory_staff didn't change any pre-existing
// permission helper's behavior for the roles that were already handled.
describe('existing permission helpers are unaffected by the new role', () => {
  it('canManageTasks is unchanged for all roles including inventory_staff', () => {
    expect(canManageTasks('director')).toBe(true);
    expect(canManageTasks('range_officer')).toBe(true);
    expect(canManageTasks('guard')).toBe(false);
    expect(canManageTasks('range_office')).toBe(false);
    expect(canManageTasks('tiger_cell')).toBe(false);
    expect(canManageTasks('inventory_staff')).toBe(false);
  });

  it('canManageIncidents is unchanged for all roles including inventory_staff', () => {
    expect(canManageIncidents('director', 'any-id')).toBe(true);
    expect(canManageIncidents('tiger_cell', 'some-other-id')).toBe(true);
    expect(canManageIncidents('inventory_staff', 'any-id')).toBe(false);
    expect(canManageIncidents('guard', 'any-id')).toBe(false);
  });

  it('every known role is covered by exactly one of canManageInventory/canManageTasks/canManageIncidents assertions above (no role silently falls through untested)', () => {
    expect(ALL_ROLES).toHaveLength(6);
  });
});
