"use client";

import { useState, useTransition } from "react";

import { createCategory, moveCategory, renameCategory, setCategoryActive } from "@/app/(admin)/admin/category-actions";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { EmptyState, StatusChip } from "@/components/admin/ui";
import type { Schemas } from "@/lib/api/types";
import { say } from "@/lib/admin/store";

type Category = Schemas["AdminCategoryResponseDto"];

const input =
  "border-text/16 bg-ops-surface text-text placeholder:text-text/45 h-10 min-w-0 rounded-xl border px-3 text-[13px] outline-none";
const link = "text-accent-text text-[12.5px] font-semibold disabled:opacity-40";

/** One type's categories, in the order customers see them. `canEdit` is false
 *  for moderators, who get the list without the controls. */
export function CategoriesBoard({
  type,
  categories,
  canEdit,
}: {
  type: Category["type"];
  categories: Category[];
  canEdit: boolean;
}) {
  const [name, setName] = useState("");
  const [busy, startTransition] = useTransition();
  const noun = type === "FOOD" ? "dish" : "product";

  return (
    <section className="min-w-0">
      {canEdit && (
        <form
          className="border-text/6 flex flex-wrap items-center gap-2 border-b px-lg py-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await createCategory({ name, type });
              say(result.ok ? result.message : result.error);
              if (result.ok) setName("");
            });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={type === "FOOD" ? "New category, e.g. Soups" : "New category, e.g. Beverages"}
            aria-label="New category name"
            className={`${input} flex-[1_1_220px]`}
          />
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="bg-text text-ops-surface h-10 rounded-pill px-[18px] text-[13px] font-bold disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add category"}
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" text={`Add one so ${noun}s can be filed under it.`} />
      ) : (
        categories.map((category, index) => (
          <CategoryRow
            key={category.id}
            category={category}
            canEdit={canEdit}
            first={index === 0}
            last={index === categories.length - 1}
          />
        ))
      )}
    </section>
  );
}

function CategoryRow({
  category,
  canEdit,
  first,
  last,
}: {
  category: Category;
  canEdit: boolean;
  first: boolean;
  last: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, startTransition] = useTransition();

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      const result = await moveCategory(category.id, category.type, direction);
      if (!result.ok) say(result.error);
    });

  return (
    <div className="border-text/6 flex flex-wrap items-center justify-between gap-3 border-b px-lg py-3.5">
      <div className="flex min-w-0 flex-[1_1_240px] items-center gap-2">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await renameCategory(category.id, name);
                say(result.ok ? result.message : result.error);
                if (result.ok) setRenaming(false);
              });
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              aria-label="Category name"
              className={`${input} flex-1`}
            />
            <button type="submit" disabled={busy} className={link}>
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setName(category.name);
                setRenaming(false);
              }}
              className="text-text/62 text-[12.5px] font-semibold"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className="text-text truncate text-[14px] font-semibold">{category.name}</span>
            {!category.isActive && <StatusChip tone="muted">Inactive</StatusChip>}
            {canEdit && (
              <button type="button" onClick={() => setRenaming(true)} className={link}>
                Rename
              </button>
            )}
          </>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy || first}
            onClick={() => move("up")}
            aria-label={`Move ${category.name} up`}
            className={link}
          >
            ↑ Up
          </button>
          <button
            type="button"
            disabled={busy || last}
            onClick={() => move("down")}
            aria-label={`Move ${category.name} down`}
            className={link}
          >
            ↓ Down
          </button>
          {category.isActive ? (
            <ConfirmAction
              size="sm"
              tone="line"
              label="Deactivate"
              title={`Deactivate ${category.name}?`}
              text="It disappears from the list customers and kitchens pick from. Items already filed under it keep it."
              confirm="Deactivate"
              run={setCategoryActive.bind(null, category.id, false)}
            />
          ) : (
            <ConfirmAction
              size="sm"
              tone="go"
              label="Activate"
              title={`Put ${category.name} back on the list?`}
              confirm="Activate"
              run={setCategoryActive.bind(null, category.id, true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
