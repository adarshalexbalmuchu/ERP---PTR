import { supabase } from './supabase';

// Same shim as inventoryRpc.ts / push.ts's claim_push_subscription — this
// project's hand-written database.types.ts models Functions as an empty
// map (populating it breaks supabase-js's embedded-relationship type
// inference elsewhere in the app), so the typed `supabase.rpc` doesn't
// know this function. Must be invoked as `client.rpc(...)`, not via an
// extracted `const rpc = client.rpc` — supabase-js's rpc() reads
// `this.rest` internally, so a detached call throws.
type PgError = { message: string; code?: string };
const clientWithData = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PgError | null }>;
};
const client = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: PgError | null }>;
};

/** One-time group assignment: creates the occurrence, its discussion, one
    task per active member, and one notification per newly-assigned
    member, as a single server-side transaction. Returns the new
    occurrence id. */
export async function createGroupOccurrence(args: {
  groupId: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  dueAt: string;
  rangeId: string;
}): Promise<string> {
  const { data, error } = await clientWithData.rpc('create_group_occurrence', {
    p_group_id: args.groupId,
    p_title: args.title,
    p_description: args.description ?? '',
    p_category: args.category,
    p_priority: args.priority,
    p_due_at: args.dueAt,
    p_range_id: args.rangeId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Pin/unpin a message — an RPC rather than a raw UPDATE because the
    authority to pin (director, or officer/coordinator within their own
    group/occurrence) is narrower than task_messages_update_own's
    sender-or-director RLS check, and Postgres RLS can't express a
    column-level distinction like that. */
export async function setMessagePinned(messageId: string, pinned: boolean): Promise<void> {
  const { error } = await client.rpc('set_message_pinned', { p_message_id: messageId, p_pinned: pinned });
  if (error) throw new Error(error.message);
}
