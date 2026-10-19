import { z } from "zod";

export const shareholderInput = z.object({
  name: z.string().trim().min(1),
  contact: z.string().trim().max(200).nullish(),
  shares: z.number().int().positive(),
  pricePerShare: z.number().int().nonnegative(),
  boughtOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).nullish(),
});
