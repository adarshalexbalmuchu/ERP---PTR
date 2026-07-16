import { FileBarChart } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { Page, PageHeading } from '../../components/layout/Page';

// Phase 1 placeholder — full reporting (consumption trends, purchase
// history, expiry forecasts) needs the procurement/batch-tracking data
// from Phase 3 to be meaningful. The route exists now so the nav entry
// isn't a dead link, per the module's page list.
export default function InventoryReports() {
  return (
    <Page>
      <PageHeading title="Inventory reports" />
      <EmptyState
        icon={<FileBarChart className="w-7 h-7" />}
        title="Reports are coming in a later phase"
        description="Once procurement and batch tracking are in place, this page will show consumption trends, purchase history, and expiry forecasts."
      />
    </Page>
  );
}
