import { z } from "zod";

/** "personal" or a workspace id; membership is verified server-side, never trusted. */
export const labelContextSchema = z.union([z.literal("personal"), z.cuid()]);

const colorSchema = z.string().trim().min(1).max(30);

export const createLabelSchema = z.object({
  context: labelContextSchema,
  name: z.string().trim().min(1, "labelNameTooShort").max(60),
  color: colorSchema.default("blue"),
});

export const renameLabelSchema = z.object({
  labelId: z.cuid(),
  name: z.string().trim().min(1, "labelNameTooShort").max(60),
  color: colorSchema,
});

export const labelIdSchema = z.object({ labelId: z.cuid() });
