// What a field is called, and the order in which a signer is led through
// their fields. Shared by the field editor and the signing page.

/** As long as the label the field schema takes. */
export const MAX_FIELD_NAME_LENGTH = 120;

/**
 * The fields a sender may name ("Név", "Adószám"), so the signer knows
 * what to fill in. A radio button's label says what that one button means
 * instead, and signatures, initials and dates need no name.
 */
export function canHaveFieldName(type: string): boolean {
  return (
    type === "text" ||
    type === "number" ||
    type === "dropdown" ||
    type === "checkbox"
  );
}

/** The field's own name when it has one, otherwise the name of its kind. */
export function fieldDisplayName(
  label: string | null | undefined,
  fallback: string,
): string {
  return label?.trim() || fallback;
}

/**
 * The field to lead the signer to after this one: the next that is not
 * done yet, going round to the start of the list, and never this one
 * again. With no current field, the first that is not done. Null when
 * there is nothing left to do elsewhere.
 */
export function findNextOpenRow<Row extends { id: string }>(
  rows: readonly Row[],
  currentId: string | null,
  isDone: (row: Row) => boolean,
): Row | null {
  const currentIndex =
    currentId === null ? -1 : rows.findIndex((row) => row.id === currentId);

  for (let step = 1; step <= rows.length; step += 1) {
    const index = (currentIndex + step + rows.length) % rows.length;
    const row = rows[index]!;

    if (index !== currentIndex && !isDone(row)) {
      return row;
    }
  }

  return null;
}
