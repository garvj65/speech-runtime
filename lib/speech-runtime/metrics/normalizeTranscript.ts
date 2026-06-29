export function normalizeTranscript(input: string | null | undefined): string {
  return String(input ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[.,?!:;"'()[\]{}।॥]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeWords(input: string | null | undefined): string[] {
  const normalized = normalizeTranscript(input);

  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(" ").filter((token) => token.length > 0);
}
