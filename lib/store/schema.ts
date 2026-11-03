import { z } from "zod";

import { riderBaseFeeNaira } from "@/lib/kitchen/schema";

/** The store's name and the least a rider is paid per trip. Checked again by karrigo-be. */
export const storeDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Your store needs a name." })
    .max(60, { message: "Keep the name under 60 characters." }),
  riderBaseFeeNaira,
});
