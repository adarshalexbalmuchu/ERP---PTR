export type MutationOutcome = 'complete' | 'partial' | 'none';

export interface VerifyAffectedRowsInput {
  /** IDs the caller asked to update. */
  requestedIds: string[];
  /** Rows Supabase actually reports as updated (via `.select('id')` on the
      update) — RLS silently drops rows the caller isn't allowed to touch,
      so this is the only reliable signal of what really changed. `null`/
      `undefined` covers the "we never got a response to check" case (e.g.
      a transport error the caller already handled before this is called). */
  returnedRows: { id: string }[] | null | undefined;
  /** Used only for log messages — never surfaced to the user. */
  entityName: string;
}

export interface VerifyAffectedRowsResult {
  updatedIds: string[];
  failedIds: string[];
  outcome: MutationOutcome;
}

/** Compares what was requested against what the database actually reports
    as changed, so a mutation hook can never call an RLS-filtered no-op a
    "success" just because Postgres/PostgREST didn't throw an error.
    Single-record callers should treat anything but 'complete' as a failure;
    bulk callers can use 'partial' to report a mixed result. */
export function verifyAffectedRows({ requestedIds, returnedRows, entityName }: VerifyAffectedRowsInput): VerifyAffectedRowsResult {
  const requested = [...new Set(requestedIds)];
  const returnedIds = new Set((returnedRows ?? []).map((r) => r.id));

  const updatedIds = requested.filter((id) => returnedIds.has(id));
  const failedIds = requested.filter((id) => !returnedIds.has(id));

  const outcome: MutationOutcome =
    updatedIds.length === requested.length ? 'complete' :
    updatedIds.length === 0 ? 'none' :
    'partial';

  if (outcome !== 'complete') {
    const unexpectedIds = [...returnedIds].filter((id) => !requested.includes(id));
    console.warn(
      `[${entityName}] mutation affected ${updatedIds.length}/${requested.length} requested row(s).`,
      { failedIds, ...(unexpectedIds.length > 0 ? { unexpectedIds } : {}) },
    );
  }

  return { updatedIds, failedIds, outcome };
}

/** Turns a verified result into the exact user-facing wording for a bulk
    action — kept alongside verifyAffectedRows so every bulk mutation hook
    reports the same way instead of each caller inventing its own copy. */
export function describeBulkOutcome(result: VerifyAffectedRowsResult, requestedCount: number, nounPlural: string): string {
  if (result.outcome === 'complete') return `${requestedCount} ${nounPlural} updated.`;
  if (result.outcome === 'none') return `No ${nounPlural} could be updated. You may not have permission, or they may have changed.`;
  return `${result.updatedIds.length} of ${requestedCount} ${nounPlural} were updated. ${result.failedIds.length} could not be changed.`;
}

/** Exact copy for a single-record mutation that verified as unaffected —
    kept here so every single-record hook uses the same wording. */
export const SINGLE_RECORD_NOT_UPDATED_MESSAGE =
  'This record could not be updated. You may not have permission, or it may have changed.';
