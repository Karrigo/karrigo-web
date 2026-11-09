import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { ReviewQueue } from "@/components/admin/queue/ReviewQueue";
import { loadQueue } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/session";
import { parseVerifiedFilter } from "@/lib/admin/verified";

export default async function KitchensPage({ searchParams }: { searchParams: Promise<{ verified?: string | string[] }> }) {
  const admin = await requireAdmin();
  const verified = parseVerifiedFilter((await searchParams).verified);
  const items = await loadQueue("kitchens", verified);
  const waiting = items.filter((item) => item.status === "PENDING").length;

  return (
    <OpsPage>
      <OpsPageHeader
        title="Kitchens"
        meta={
          waiting
            ? `${waiting} waiting for approval · oldest first`
            : "Nothing waiting for approval"
        }
      />
      <ReviewQueue kind="kitchens" role={admin.role} items={items} verified={verified} />
    </OpsPage>
  );
}
