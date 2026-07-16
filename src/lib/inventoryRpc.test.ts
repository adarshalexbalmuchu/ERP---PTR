import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();

vi.mock('./supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { postOpeningBalance, issueInventoryStock, createInventoryRequest, approveInventoryRequest, rejectInventoryRequest } =
  await import('./inventoryRpc');

beforeEach(() => {
  rpc.mockReset();
});

describe('postOpeningBalance', () => {
  it('calls post_opening_balance with correctly mapped params', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await postOpeningBalance({ itemId: 'item-1', locationId: 'loc-1', quantity: 25, notes: 'seed', idempotencyKey: 'key-1' });
    expect(rpc).toHaveBeenCalledWith('post_opening_balance', {
      p_item_id: 'item-1',
      p_location_id: 'loc-1',
      p_quantity: 25,
      p_notes: 'seed',
      p_idempotency_key: 'key-1',
    });
  });

  it('defaults notes to empty string and idempotency key to null when omitted', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await postOpeningBalance({ itemId: 'item-1', locationId: 'loc-1', quantity: 10 });
    expect(rpc).toHaveBeenCalledWith('post_opening_balance', expect.objectContaining({ p_notes: '', p_idempotency_key: null }));
  });

  it('returns the RPC-reported applied flag (false for a deduped retry)', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const applied = await postOpeningBalance({ itemId: 'item-1', locationId: 'loc-1', quantity: 10, idempotencyKey: 'key-1' });
    expect(applied).toBe(false);
  });

  it('throws a JS Error carrying the Postgres error message on failure', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Only a director can post an opening balance' } });
    await expect(postOpeningBalance({ itemId: 'item-1', locationId: 'loc-1', quantity: 10 }))
      .rejects.toThrow('Only a director can post an opening balance');
  });
});

describe('issueInventoryStock', () => {
  it('calls issue_inventory_stock with correctly mapped params including the idempotency key', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await issueInventoryStock({ requestItemId: 'ri-1', locationId: 'loc-1', quantity: 5, idempotencyKey: 'key-2' });
    expect(rpc).toHaveBeenCalledWith('issue_inventory_stock', expect.objectContaining({
      p_request_item_id: 'ri-1', p_location_id: 'loc-1', p_quantity: 5, p_idempotency_key: 'key-2',
    }));
  });

  it('surfaces a deduped retry as applied = false', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const applied = await issueInventoryStock({ requestItemId: 'ri-1', locationId: 'loc-1', quantity: 5, idempotencyKey: 'key-2' });
    expect(applied).toBe(false);
  });

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Cannot issue more than the approved quantity' } });
    await expect(issueInventoryStock({ requestItemId: 'ri-1', locationId: 'loc-1', quantity: 999 }))
      .rejects.toThrow('Cannot issue more than the approved quantity');
  });
});

describe('createInventoryRequest', () => {
  it('maps items to the RPC jsonb shape', async () => {
    rpc.mockResolvedValue({ data: 'new-request-id', error: null });
    const id = await createInventoryRequest({
      requestingLocationId: 'loc-1',
      items: [{ itemId: 'item-1', requestedQty: 3 }, { itemId: 'item-2', requestedQty: 1.5 }],
    });
    expect(id).toBe('new-request-id');
    expect(rpc).toHaveBeenCalledWith('create_inventory_request', expect.objectContaining({
      p_requesting_location_id: 'loc-1',
      p_items: [{ item_id: 'item-1', requested_qty: 3 }, { item_id: 'item-2', requested_qty: 1.5 }],
    }));
  });

  it('throws when the request must include at least one item', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'A request must include at least one item' } });
    await expect(createInventoryRequest({ requestingLocationId: 'loc-1', items: [] }))
      .rejects.toThrow('A request must include at least one item');
  });
});

describe('approveInventoryRequest / rejectInventoryRequest', () => {
  it('approve maps approvals to the RPC jsonb shape', async () => {
    rpc.mockResolvedValue({ error: null });
    await approveInventoryRequest('req-1', [{ requestItemId: 'ri-1', approvedQty: 4 }]);
    expect(rpc).toHaveBeenCalledWith('approve_inventory_request', {
      p_request_id: 'req-1',
      p_item_approvals: [{ request_item_id: 'ri-1', approved_qty: 4 }],
    });
  });

  it('reject rejects on a permission error from a non-director caller', async () => {
    rpc.mockResolvedValue({ error: { message: 'Only a director can reject a request' } });
    await expect(rejectInventoryRequest('req-1', 'out of stock')).rejects.toThrow('Only a director can reject a request');
  });
});
