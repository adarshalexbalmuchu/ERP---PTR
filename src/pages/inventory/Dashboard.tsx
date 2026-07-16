import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useInventoryStock } from '../../hooks/useInventoryStock';
import { useInventoryRequests } from '../../hooks/useInventoryRequests';
import { useInventoryLocations } from '../../hooks/useInventoryLocations';
import { canManageInventory } from '../../lib/permissions';
import { Page, PageHeading, SectionTitle } from '../../components/layout/Page';
import InventoryHome from '../mobile/InventoryHome';

function Metric({ label, value, tone = 'default', onClick }: {
  label: string; value: number; tone?: 'default' | 'red' | 'amber'; onClick: () => void;
}) {
  const cls = tone === 'red' ? 'text-signal-red' : tone === 'amber' ? 'text-signal-amber' : 'text-n-100';
  return (
    <button onClick={onClick} className="text-left card p-3 hover:bg-n-10 transition-colors">
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
      <div className="text-13 text-n-80 mt-0.5">{label}</div>
    </button>
  );
}

export default function InventoryDashboard() {
  const isMobile = useIsMobile();
  const currentUser = useStore((s) => s.currentUser);
  const isDirector = canManageInventory(currentUser?.role);
  const navigate = useNavigate();
  const { stock } = useInventoryStock();
  const { requests } = useInventoryRequests();
  const { locations } = useInventoryLocations();

  if (isMobile) return <InventoryHome />;

  const base = isDirector ? '/director/inventory' : '/inventory';
  const lowStock = stock.filter((s) => s.minStock !== undefined && s.availableQty <= s.minStock);
  const pendingApproval = requests.filter((r) => r.status === 'Submitted');
  const myPending = requests.filter((r) => r.status === 'Draft' || r.status === 'Submitted' || r.status === 'Approved' || r.status === 'PartiallyApproved');

  return (
    <Page className="space-y-6">
      <PageHeading title={isDirector ? 'Inventory dashboard' : 'My inventory'} meta={isDirector ? `${locations.length} location${locations.length === 1 ? '' : 's'}` : undefined} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isDirector ? (
          <>
            <Metric label="Locations" value={locations.length} onClick={() => navigate(`${base}/locations`)} />
            <Metric label="Low stock items" value={lowStock.length} tone={lowStock.length > 0 ? 'red' : 'default'} onClick={() => navigate(`${base}/stock`)} />
            <Metric label="Awaiting approval" value={pendingApproval.length} tone={pendingApproval.length > 0 ? 'amber' : 'default'} onClick={() => navigate(`${base}/requests`)} />
            <Metric label="Total requests" value={requests.length} onClick={() => navigate(`${base}/requests`)} />
          </>
        ) : (
          <>
            <Metric label="Low stock items" value={lowStock.length} tone={lowStock.length > 0 ? 'red' : 'default'} onClick={() => navigate(`${base}/stock`)} />
            <Metric label="My open requests" value={myPending.length} tone={myPending.length > 0 ? 'amber' : 'default'} onClick={() => navigate(`${base}/requests`)} />
          </>
        )}
      </div>

      {isDirector && pendingApproval.length > 0 && (
        <section>
          <SectionTitle>Needs attention</SectionTitle>
          <div className="card divide-y divide-n-20">
            {pendingApproval.slice(0, 5).map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`${base}/requests/${r.id}`)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-n-10 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-13 font-semibold text-n-100 truncate">{r.requestingLocationName ?? '—'}</div>
                  <div className="text-xs text-n-70">{r.items.length} item{r.items.length === 1 ? '' : 's'} · {r.requestedByName ?? '—'}</div>
                </div>
                <span className="text-xs font-semibold px-2 h-6 rounded-full flex items-center bg-signal-amber/10 text-signal-amber flex-shrink-0">Submitted</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
