"use client";

import Image from "next/image";
import { useOptimistic, useState, useTransition } from "react";

import {
  addDish,
  addSection,
  appealFlag,
  removeDish,
  removeSection,
  saveDish,
  saveSection,
  setSoldOut,
  uploadDishPhoto,
} from "@/app/(order)/my-kitchen/actions";
import { FormError, PhotoUpload, SubmitButton, field, fieldLabel } from "@/components/partners/parts";
import { cn } from "@/lib/cn";
import { formatKobo } from "@/lib/money";
import type { Dish, MenuSection } from "@/lib/kitchen/types";
import { Switch, panel, type Result } from "./parts";

const quiet = "text-accent-text text-site-label font-bold disabled:opacity-50";

/**
 * The whole menu on one page: sections, the dishes in them, and a switch on
 * every dish for the moment the egusi finishes. Editing happens in place —
 * a kitchen changing a price mid-service should not have to leave the list.
 */
export function MenuEditor({
  kitchenName,
  sections,
  servesFood,
  servesGrocery,
}: {
  kitchenName: string;
  sections: MenuSection[];
  servesFood: boolean;
  servesGrocery: boolean;
}) {
  const options = sections.map((s) => ({ id: s.id, label: s.label, type: s.type }));
  const both = servesFood && servesGrocery;

  return (
    <div className="gap-lg flex flex-col">
      {sections.length === 0 && (
        <div className={panel}>
          <p className="text-site-title">{kitchenName} has no menu yet</p>
          <p className="text-site-body text-text-secondary mt-xs">
            {servesGrocery && !servesFood
              ? "Start with a section — Rice & grains, Drinks, Toiletries — then add the products that go in it."
              : "Start with a section — Swallow, Rice, Drinks — then add the dishes that go in it."}
          </p>
        </div>
      )}

      {sections.map((s) => (
        <Section key={s.id} section={s} options={options} showSide={both} />
      ))}

      <NewSection first={sections.length === 0} servesFood={servesFood} servesGrocery={servesGrocery} />
    </div>
  );
}

function Section({ section, options, showSide }: { section: MenuSection; options: { id: string; label: string; type: MenuSection["type"] }[]; showSide: boolean }) {
  const grocery = section.type === "GROCERY";
  const noun = grocery ? "product" : "dish";
  // A dish can only move to a section on its own side.
  const sameSide = options.filter((o) => o.type === section.type);
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(section.dishes.length === 0);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <section className={panel}>
      <div className="gap-md flex flex-wrap items-baseline justify-between">
        <div className="min-w-0">
          <h2 className="text-h1 font-extrabold">{section.label}</h2>
          {showSide && (
            <p className="text-site-chip text-text-secondary mt-xs font-semibold">{grocery ? "Groceries" : "Food"}</p>
          )}
          {section.note && <p className="text-site-label text-text-secondary mt-xs">{section.note}</p>}
        </div>
        <div className="gap-lg flex shrink-0">
          <button type="button" onClick={() => setRenaming((v) => !v)} className={quiet}>
            {renaming ? "Close" : "Rename"}
          </button>
          {section.dishes.length === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeSection(section.id);
                  if (!result.ok) setError(result.error);
                })
              }
              className="text-text-secondary text-site-label font-semibold disabled:opacity-50"
            >
              {busy ? "Removing…" : "Remove section"}
            </button>
          )}
        </div>
      </div>
      <FormError>{error}</FormError>

      {renaming && (
        <SectionForm
          label={section.label}
          note={section.note}
          idle="Save section"
          save={(input) => saveSection(section.id, input)}
          done={() => setRenaming(false)}
        />
      )}

      {section.dishes.length > 0 && (
        <ul className="mt-md">
          {section.dishes.map((d) => (
            <DishRow key={d.id} dish={d} options={sameSide} grocery={grocery} />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="bg-surface-raised/50 rounded-field mt-lg p-lg">
          <DishForm
            sectionId={section.id}
            options={sameSide}
            idle={`Add ${noun}`}
            working="Adding…"
            grocery={grocery}
            save={addDish}
            // Stay open: a kitchen setting up its menu adds dishes in a run.
            done={() => {}}
            clearOnSave
          />
          {section.dishes.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className="text-text-secondary text-site-label mt-md font-semibold">
              Done adding
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={cn(quiet, "mt-lg")}>
          + Add a {noun} to {section.label}
        </button>
      )}
    </section>
  );
}

function DishRow({ dish, options, grocery }: { dish: Dish; options: { id: string; label: string }[]; grocery: boolean }) {
  const noun = grocery ? "product" : "dish";
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [soldOut, setOptimistic] = useOptimistic(dish.soldOut);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <li className="border-surface-raised border-b py-md last:border-b-0">
      <div className="gap-md flex items-center">
        <div className="bg-surface-raised rounded-field relative size-[56px] shrink-0 overflow-hidden">
          {dish.imageUrl && <Image src={dish.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-site-question truncate", soldOut && "text-text-secondary line-through")}>{dish.name}</p>
          <p className="text-site-label text-text-secondary">
            {dish.unit && `${dish.unit} · `}
            {formatKobo(dish.priceKobo)}
            {soldOut && <span className="text-danger-text font-semibold"> · Sold out</span>}
          </p>
          {dish.flag && (
            <p className="bg-danger-bg text-danger-text rounded-field text-site-chip mt-xs inline-block px-md py-xs font-bold">
              {dish.flag.appealedAt ? "Hidden by Karrigo · appeal sent" : "Hidden by Karrigo"}
            </p>
          )}
          <button type="button" onClick={() => { setEditing((v) => !v); setConfirming(false); }} className={cn(quiet, "mt-xs block")}>
            {editing ? "Close" : "Edit"}
          </button>
        </div>
        <div className="gap-xs flex shrink-0 flex-col items-center">
          <Switch
            checked={!soldOut}
            disabled={busy}
            label={soldOut ? `Put ${dish.name} back on the menu` : `Mark ${dish.name} sold out`}
            onChange={(available) => {
              setError("");
              startTransition(async () => {
                setOptimistic(!available);
                const result = await setSoldOut(dish.id, !available);
                if (!result.ok) setError(result.error);
              });
            }}
          />
          <span className="text-site-chip text-text-secondary">{soldOut ? "Sold out" : "Available"}</span>
        </div>
      </div>
      <FormError>{error}</FormError>

      {dish.flag && <FlagNotice dish={dish} />}

      {editing && (
        <div className="bg-surface-raised/50 rounded-field gap-lg mt-md flex flex-col p-lg">
          <DishForm
            dish={dish}
            sectionId={dish.sectionId}
            options={options}
            idle={`Save ${noun}`}
            working="Saving…"
            grocery={grocery}
            save={(input) => saveDish(dish.id, input)}
            done={() => setEditing(false)}
          />
          <PhotoUpload
            label="Photo"
            done={!!dish.imageUrl}
            doneLabel="Photo added"
            fields={{ id: dish.id }}
            upload={uploadDishPhoto}
          />
          {confirming ? (
            <div className="gap-md flex flex-wrap items-center">
              <span className="text-danger-text text-site-label font-bold">Remove {dish.name} from your {grocery ? "store" : "menu"}?</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeDish(dish.id);
                    if (!result.ok) {
                      setError(result.error);
                      setConfirming(false);
                    }
                  })
                }
                className="bg-danger text-bg rounded-pill text-site-label px-lg py-sm font-bold disabled:opacity-50"
              >
                {busy ? "Removing…" : "Yes, remove"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="text-text-secondary text-site-label font-semibold">
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="text-text-secondary hover:text-danger-text text-site-label self-start font-semibold">
              Remove this {noun}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function DishForm({
  dish,
  sectionId,
  options,
  idle,
  working,
  save,
  done,
  clearOnSave = false,
  grocery = false,
}: {
  grocery?: boolean;
  dish?: Dish;
  sectionId: string;
  options: { id: string; label: string }[];
  idle: string;
  working: string;
  save: (input: { sectionId: string; name: string; description: string; priceNaira: number; unit: string }) => Promise<Result>;
  done: () => void;
  clearOnSave?: boolean;
}) {
  const [name, setName] = useState(dish?.name ?? "");
  const [price, setPrice] = useState(dish ? String(Math.round(dish.priceKobo / 100)) : "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [unit, setUnit] = useState(dish?.unit ?? "");
  const [section, setSection] = useState(sectionId);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <form
      className="gap-md flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await save({ sectionId: section, name, description, priceNaira: Number(price), unit: grocery ? unit : "" });
          if (!result.ok) return setError(result.error);
          setError("");
          if (clearOnSave) {
            setName("");
            setPrice("");
            setDescription("");
            setUnit("");
          }
          done();
        });
      }}
    >
      <div className="gap-md grid sm:grid-cols-[2fr_1fr]">
        <label className={fieldLabel}>
          {grocery ? "Product" : "Dish"}
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder={grocery ? "Peak milk, tin" : "Pounded yam & egusi"} className={field} />
        </label>
        <label className={fieldLabel}>
          Price, ₦
          <input value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setError(""); }} inputMode="numeric" placeholder="2800" className={field} />
        </label>
      </div>
      {grocery && (
        <label className={fieldLabel}>
          Sold as (optional)
          <input value={unit} onChange={(e) => { setUnit(e.target.value); setError(""); }} placeholder="1 kg, pack of 6" className={field} />
        </label>
      )}
      <label className={fieldLabel}>
        {grocery ? "Details (optional)" : "What comes with it (optional)"}
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={grocery ? "400g tin" : "With assorted meat"} className={field} />
      </label>
      {dish && options.length > 1 && (
        <label className={fieldLabel}>
          Section
          <select value={section} onChange={(e) => setSection(e.target.value)} className={cn(field, "appearance-none")}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} idle={idle} working={working} />
    </form>
  );
}

function SectionForm({
  label: savedLabel = "",
  note: savedNote = "",
  idle,
  save,
  done,
}: {
  label?: string;
  note?: string;
  idle: string;
  save: (input: { label: string; note: string }) => Promise<Result>;
  done: () => void;
}) {
  const [label, setLabel] = useState(savedLabel);
  const [note, setNote] = useState(savedNote);
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <form
      className="gap-md mt-lg flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await save({ label, note });
          if (!result.ok) return setError(result.error);
          setError("");
          if (!savedLabel) {
            setLabel("");
            setNote("");
          }
          done();
        });
      }}
    >
      <div className="gap-md grid sm:grid-cols-2">
        <label className={fieldLabel}>
          Section name
          <input value={label} onChange={(e) => { setLabel(e.target.value); setError(""); }} placeholder="Swallow" className={field} />
        </label>
        <label className={fieldLabel}>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Served with your choice of soup" className={field} />
        </label>
      </div>
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} idle={idle} working="Saving…" />
    </form>
  );
}

/** Why Karrigo hid a product, and the owner's appeal against it. If ops declines an appeal the answer shows here and the owner can appeal again. */
function FlagNotice({ dish }: { dish: Dish }) {
  const flag = dish.flag!;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition();

  return (
    <div className="bg-danger-bg rounded-field mt-md p-lg">
      <p className="text-danger-text text-site-label font-bold">
        Customers can&rsquo;t see {dish.name} because Karrigo flagged it.
      </p>
      {flag.note && <p className="text-site-label mt-xs">{flag.note}</p>}
      {flag.appealedAt ? (
        <p className="text-site-label text-text-secondary mt-md">
          You appealed{flag.appealNote ? `: “${flag.appealNote}”` : "."} Karrigo will look at it and get back to you.
        </p>
      ) : (
        <form
          className="gap-sm mt-md flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await appealFlag(dish.id, message);
              if (!result.ok) return setError(result.error);
              setError("");
            });
          }}
        >
          {flag.appealResponse && (
            <p className="bg-surface-raised rounded-field text-site-label px-lg py-md">
              <span className="font-bold">We reviewed your appeal.</span> “{flag.appealResponse}” You can appeal again.
            </p>
          )}
          <label className={fieldLabel}>
            {flag.appealResponse ? "Appeal again" : "Appeal this flag"}
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setError(""); }}
              rows={2}
              maxLength={500}
              placeholder="Say what's wrong with the flag, or what you've changed"
              className={cn(field, "resize-y")}
            />
          </label>
          <FormError>{error}</FormError>
          <SubmitButton busy={busy} idle={flag.appealResponse ? "Appeal again" : "Send appeal"} working="Sending…" />
        </form>
      )}
    </div>
  );
}

function NewSection({ first, servesFood, servesGrocery }: { first: boolean; servesFood: boolean; servesGrocery: boolean }) {
  const [open, setOpen] = useState(first);
  const both = servesFood && servesGrocery;
  const [type, setType] = useState<"FOOD" | "GROCERY" | "">(both ? "" : servesGrocery ? "GROCERY" : "FOOD");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(quiet, "self-start")}>
        + Add a section
      </button>
    );
  }
  return (
    <section className={panel}>
      <h2 className="text-h1 font-extrabold">{first ? "Your first section" : "New section"}</h2>
      {both && (
        <div className="mt-md" role="radiogroup" aria-label="Which side is this section for?">
          <p className="text-label font-bold">This section is for</p>
          <div className="gap-sm mt-sm flex flex-wrap">
            {(["FOOD", "GROCERY"] as const).map((side) => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={type === side}
                onClick={() => setType(side)}
                className={cn(
                  "rounded-pill text-nav-link px-lg py-sm font-bold transition-colors duration-(--duration-fast)",
                  type === side ? "bg-text text-bg" : "bg-surface-raised text-text",
                )}
              >
                {side === "FOOD" ? "Food" : "Groceries"}
              </button>
            ))}
          </div>
          <p className="text-site-chip text-text-secondary mt-xs">It can&rsquo;t be changed once the section is made.</p>
        </div>
      )}
      <SectionForm
        idle="Add section"
        save={(input) =>
          both && !type
            ? Promise.resolve({ ok: false as const, error: "Choose whether this section is for food or groceries." })
            : addSection({ ...input, ...(type ? { type } : {}) })
        }
        done={() => setOpen(false)}
      />
    </section>
  );
}
