import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useUsers } from '../../hooks/useUsers';
import { useInventoryLocations, useInventoryLocationStaff } from '../../hooks/useInventoryLocations';
import Select from '../../components/Select';
import EmptyState from '../../components/EmptyState';
import { Page, PageHeading } from '../../components/layout/Page';
import { getErrorMessage } from '../../lib/errors';

export default function InventoryStaffManagement() {
  const { users } = useUsers();
  const { locations } = useInventoryLocations();
  const { assignments, isLoading, assignStaff, unassignStaff } = useInventoryLocationStaff();
  const [userId, setUserId] = useState('');
  const [locationId, setLocationId] = useState('');

  const staffUsers = users.filter((u) => u.role === 'inventory_staff');
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '—';
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? '—';

  const assign = async () => {
    if (!userId || !locationId) return;
    try {
      await assignStaff.mutateAsync({ userId, locationId });
      setUserId(''); setLocationId('');
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to assign staff to this location.'));
    }
  };

  return (
    <Page className="space-y-6">
      <PageHeading
        title="Inventory staff"
        meta="Assign inventory staff to the locations they can see and act on. Add the account itself from Personnel first."
      />

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="block text-13 font-medium text-n-90 mb-1.5">Staff member</label>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="input-field select-field">
            <option value="">Select staff</option>
            {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
        <div className="min-w-[200px]">
          <label className="block text-13 font-medium text-n-90 mb-1.5">Location</label>
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="input-field select-field">
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </div>
        <button onClick={() => void assign()} disabled={assignStaff.isPending || !userId || !locationId} className="btn-primary">
          <Plus className="w-4 h-4" />Assign
        </button>
      </div>

      {staffUsers.length === 0 ? (
        <EmptyState title="No inventory staff accounts yet" description="Create one from the Personnel page with the Inventory Staff role." />
      ) : isLoading ? (
        <div className="skeleton h-32" />
      ) : assignments.length === 0 ? (
        <EmptyState title="No location assignments yet" />
      ) : (
        <div className="card divide-y divide-n-20">
          {assignments.map((a) => (
            <div key={`${a.locationId}-${a.userId}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="text-13 text-n-100">
                <span className="font-semibold">{nameOf(a.userId)}</span>
                <span className="text-n-70"> · {locationName(a.locationId)}</span>
              </div>
              <button
                onClick={() => void unassignStaff.mutateAsync(a)}
                className="w-8 h-8 flex items-center justify-center rounded text-n-70 hover:bg-signal-red-bg hover:text-signal-red transition-colors"
                aria-label="Remove assignment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
