import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { ReviewQueue } from "@/components/admin/queue/ReviewQueue";
import { loadQueue } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/session";
import { parseVerifiedFilter } from "@/lib/admin/verified";

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ verified?: string | string[] }> }) {
  const admin = await requireAdmin();
  const verified = parseVerifiedFilter((await searchParams).verified);
  const items = await loadQueue("stores", verified);
  const waiting = items.filter((item) => item.status === "PENDING").length;

  return (
    <OpsPage>
      <OpsPageHeader
        title="Stores"
        meta={waiting ? `${waiting} waiting for approval · oldest first` : "Nothing waiting for approval"}
      />
      <ReviewQueue kind="stores" role={admin.role} items={items} verified={verified} />
    </OpsPage>
  );
}
