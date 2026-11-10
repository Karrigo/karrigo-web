"use client";

import { cn } from "@/lib/cn";
import {
  MAX_CATEGORIES,
  toggleCategory,
  type Category,
} from "@/lib/categories";

/** Multi-select category chips (1 to 5). `categories` is null when the list couldn't be loaded. */
export function CategoryPicker({
  categories,
  selectedIds,
  onChange,
  onRetry,
  droppedPrevious = false,
  label,
}: {
  categories: Category[] | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onRetry: () => void;
  /** A prefilled category is no longer active and was removed from the selection. */
  droppedPrevious?: boolean;
  label: string;
}) {
  const atMax = selectedIds.length >= MAX_CATEGORIES;
  return (
    <div role="group" aria-label={label}>
      <p className="text-label font-bold">{`${label} (optional, up to ${MAX_CATEGORIES})`}</p>
      {categories === null ? (
        <div className="gap-sm mt-sm flex flex-col items-start">
          <p className="text-site-label text-text-secondary">
            Couldn&rsquo;t load categories. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="text-accent-text text-site-label font-bold"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="gap-sm mt-sm flex flex-wrap">
            {categories.map((c) => {
              const selected = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  disabled={!selected && atMax}
                  onClick={() => onChange(toggleCategory(selectedIds, c.id))}
                  className={cn(
                    "rounded-pill text-nav-link px-lg py-sm font-bold transition-colors duration-(--duration-fast)",
                    selected
                      ? "bg-text text-bg"
                      : "bg-surface-raised text-text",
                    !selected && atMax && "opacity-45",
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          {droppedPrevious && (
            <p className="text-site-chip text-text-secondary mt-xs">
              A previous category is no longer available. Pick another.
            </p>
          )}
          <p className="text-site-chip text-text-secondary mt-xs">
            {categories.length === 0
              ? "No categories are available yet."
              : `${selectedIds.length} of ${MAX_CATEGORIES} selected`}
          </p>
        </>
      )}
    </div>
  );
}
