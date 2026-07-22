/**
 * Appends " 2", " 3", etc. to `candidate` if it already exists in `existing`.
 * Returns the original name if no collision.
 */
export function dedupName(existing: string[], candidate: string): string {
  if (!existing.includes(candidate)) {
    return candidate;
  }
  let counter = 2;
  while (existing.includes(`${candidate} ${counter}`)) {
    counter++;
  }
  return `${candidate} ${counter}`;
}
