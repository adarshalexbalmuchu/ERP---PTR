import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyAffectedRows } from './mutationVerification';

describe('verifyAffectedRows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports complete when every requested ID comes back', () => {
    const result = verifyAffectedRows({
      requestedIds: ['a', 'b', 'c'],
      returnedRows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      entityName: 'incident',
    });
    expect(result).toEqual({ updatedIds: ['a', 'b', 'c'], failedIds: [], outcome: 'complete' });
  });

  it('reports partial when only some requested IDs come back', () => {
    const result = verifyAffectedRows({
      requestedIds: ['a', 'b', 'c'],
      returnedRows: [{ id: 'a' }, { id: 'c' }],
      entityName: 'incident',
    });
    expect(result.outcome).toBe('partial');
    expect(result.updatedIds).toEqual(['a', 'c']);
    expect(result.failedIds).toEqual(['b']);
  });

  it('reports none when no requested IDs come back', () => {
    const result = verifyAffectedRows({
      requestedIds: ['a', 'b'],
      returnedRows: [],
      entityName: 'incident',
    });
    expect(result).toEqual({ updatedIds: [], failedIds: ['a', 'b'], outcome: 'none' });
  });

  it('collapses duplicate returned IDs instead of over-counting them', () => {
    const result = verifyAffectedRows({
      requestedIds: ['a', 'b'],
      returnedRows: [{ id: 'a' }, { id: 'a' }, { id: 'b' }],
      entityName: 'incident',
    });
    expect(result).toEqual({ updatedIds: ['a', 'b'], failedIds: [], outcome: 'complete' });
  });

  it('ignores returned IDs that were never requested', () => {
    const result = verifyAffectedRows({
      requestedIds: ['a'],
      returnedRows: [{ id: 'a' }, { id: 'unexpected-id' }],
      entityName: 'incident',
    });
    expect(result).toEqual({ updatedIds: ['a'], failedIds: [], outcome: 'complete' });
  });

  it('treats an empty requested list as vacuously complete', () => {
    const result = verifyAffectedRows({
      requestedIds: [],
      returnedRows: [],
      entityName: 'incident',
    });
    expect(result).toEqual({ updatedIds: [], failedIds: [], outcome: 'complete' });
  });

  it('treats null/undefined returned rows (e.g. an error path) as zero updates', () => {
    const asNull = verifyAffectedRows({ requestedIds: ['a', 'b'], returnedRows: null, entityName: 'incident' });
    expect(asNull).toEqual({ updatedIds: [], failedIds: ['a', 'b'], outcome: 'none' });

    const asUndefined = verifyAffectedRows({ requestedIds: ['a'], returnedRows: undefined, entityName: 'incident' });
    expect(asUndefined).toEqual({ updatedIds: [], failedIds: ['a'], outcome: 'none' });
  });

  it('logs technical context (entity name and failed IDs) when the outcome is not complete, without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyAffectedRows({ requestedIds: ['a', 'b'], returnedRows: [{ id: 'a' }], entityName: 'task' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('task');
    expect(warnSpy.mock.calls[0][1]).toMatchObject({ failedIds: ['b'] });
  });

  it('does not log when the outcome is complete', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyAffectedRows({ requestedIds: ['a'], returnedRows: [{ id: 'a' }], entityName: 'task' });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
