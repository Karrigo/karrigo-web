import { CategoriesBoard } from "@/components/admin/CategoriesBoard";
import { OpsPage, OpsPageHeader } from "@/components/admin/OpsPage";
import { LinkTab } from "@/components/admin/ui";
import { api, type Schemas } from "@/lib/api/client";
import { requireAdmin } from "@/lib/admin/session";

type Type = Schemas["AdminCategoryResponseDto"]["type"];

/** The shared categories dishes (FOOD) and store products (GROCERY) are filed
 *  under. They are switched off, never deleted. Moderators can read the list;
 *  changing it is for super admins. */
export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const admin = await requireAdmin();
  const type: Type = (await searchParams).type === "GROCERY" ? "GROCERY" : "FOOD";
  const canEdit = admin.role === "SUPER_ADMIN";

  const categories = await api<Schemas["AdminCategoryResponseDto"][]>("/admin/categories", {
    scope: "admin",
    query: { type },
  });
  const live = categories.filter((c) => c.isActive).length;

  return (
    <OpsPage>
      <OpsPageHeader
        title="Categories"
        meta={`${live} of ${categories.length} active · listed in the order customers see them${
          canEdit ? "" : " · only a super admin can change them"
        }`}
      />
      <div className="bg-ops-surface min-w-0 rounded-[15px]">
        <div className="border-text/6 flex flex-wrap gap-2 border-b px-lg py-3.5">
          <LinkTab href="/categories" label="Food" selected={type === "FOOD"} />
          <LinkTab href="/categories?type=GROCERY" label="Grocery" selected={type === "GROCERY"} />
        </div>
        <CategoriesBoard key={type} type={type} categories={categories} canEdit={canEdit} />
      </div>
    </OpsPage>
  );
}
