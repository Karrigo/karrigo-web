import { z } from "zod";

import { ORDER_STATUSES } from "./types";

/** Shared by the kitchen's forms and its Server Actions, and checked again by
 *  karrigo-be. Prices are typed in whole naira, as a kitchen thinks of them. */

const priceNaira = z
  .number({ message: "Add a price." })
  .int({ message: "Use a whole naira amount." })
  .positive({ message: "Add a price." })
  .max(1_000_000, { message: "That price looks too high. Check it." });

export const dishSchema = z.object({
  sectionId: z.string().min(1, { message: "Pick a section for this dish." }),
  name: z.string().trim().min(2, { message: "Give the dish a name." }).max(80, { message: "Keep the name under 80 characters." }),
  description: z.string().trim().max(200, { message: "Keep the description under 200 characters." }),
  priceNaira,
  /** How a grocery product is sold, e.g. "1 kg" or "pack of 6". */
  unit: z.string().trim().max(30, { message: "Keep the unit under 30 characters." }),
  /** Optional for old callers; the form requires 1 to 5. */
  categoryIds: z.array(z.string().min(1)).max(5, { message: "Pick up to 5 categories." }).optional(),
});

export const sectionSchema = z.object({
  label: z.string().trim().min(2, { message: "Give the section a name, like Swallow or Drinks." }).max(40, { message: "Keep the section name under 40 characters." }),
  note: z.string().trim().max(120, { message: "Keep the note under 120 characters." }),
  /** Which side the section belongs to. Needed when the kitchen serves both. */
  type: z.enum(["FOOD", "GROCERY"]).optional(),
});

export const appealSchema = z
  .string()
  .trim()
  .min(1, { message: "Say why this should be put back." })
  .max(500, { message: "Keep the message under 500 characters." });

export const sidesSchema = z
  .object({ servesFood: z.boolean(), servesGrocery: z.boolean() })
  .refine((s) => s.servesFood || s.servesGrocery, { message: "Keep at least one of food or groceries switched on." });

/** The least a rider is paid per trip, typed in whole naira: 500 to 20,000
 *  in steps of 50. Longer trips pay more by distance on top of this. */
export const riderBaseFeeNaira = z
  .number({ message: "Enter the rider base fee, like 1500." })
  .int({ message: "Use a whole naira amount." })
  .min(500, { message: "The rider base fee can't be below ₦500." })
  .max(20_000, { message: "The rider base fee can't be above ₦20,000." })
  .refine((n) => n % 50 === 0, { message: "Use a multiple of ₦50, like 1500 or 1550." });

export const riderFeeSchema = z.object({ riderBaseFeeNaira });

export const profileSchema = z.object({
  name: z.string().trim().min(2, { message: "Your kitchen needs a name." }).max(60, { message: "Keep the name under 60 characters." }),
  cuisine: z.string().trim().max(60, { message: "Keep this under 60 characters." }),
  riderBaseFeeNaira,
});

export const noticeSchema = z.string().trim().max(140, { message: "Keep the notice under 140 characters." });

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Enter times like 08:00." });

export const hoursSchema = z
  .array(z.object({ day: z.number().int().min(0).max(6), closed: z.boolean(), open: time, close: time }))
  .length(7, { message: "Set all seven days." })
  .refine((days) => new Set(days.map((d) => d.day)).size === 7, { message: "Set all seven days." })
  .refine((days) => days.every((d) => d.closed || d.open !== d.close), {
    message: "Opening and closing time can't be the same.",
  });

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const ticketSchema = z.object({
  subject: z.string().trim().min(2, { message: "Say what the problem is in a few words." }).max(200, { message: "Keep that line under 200 characters." }),
  body: z.string().trim().max(2000, { message: "Keep the details under 2,000 characters." }),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Enter your current password." }),
  newPassword: z
    .string()
    .min(8, { message: "The new password needs at least 8 characters." })
    .max(72, { message: "The new password can be at most 72 characters." }),
});
