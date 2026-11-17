import { z } from "zod";

export const idSchema = z.string().trim().min(1);
export const nonEmptyStringSchema = z.string().trim().min(1);
export const emailSchema = z.string().trim().email().max(320);
export const nameSchema = nonEmptyStringSchema.max(120);
// The same checks as emailSchema and nameSchema, with the messages a sender
// sees in Hungarian when adding signers and copy recipients.
export const recipientEmailSchema = z
  .string({ error: "Adj meg egy e-mail-címet." })
  .trim()
  .email("Adj meg egy érvényes e-mail-címet.")
  .max(320, "Az e-mail-cím legfeljebb 320 karakter lehet.");
export const recipientNameSchema = z
  .string({ error: "Add meg a nevet." })
  .trim()
  .min(1, "Add meg a nevet.")
  .max(120, "A név legfeljebb 120 karakter lehet.");
export const envelopeTitleSchema = z
  .string({ error: "Add meg a szerződés címét." })
  .trim()
  .min(1, "Add meg a szerződés címét.")
  .max(160, "A szerződés címe legfeljebb 160 karakter lehet.");
export const unixTimestampSchema = z.number().int().nonnegative();
export const normalizedCoordinateSchema = z.number().finite().min(0).max(1);
export const normalizedSizeSchema = z.number().finite().gt(0).max(1);

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    emptyStringToUndefined,
    z.string().max(maxLength).optional(),
  );
}
