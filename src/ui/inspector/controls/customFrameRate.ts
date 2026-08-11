// The custom fps field's parse-and-clamp, pulled out of CustomFrameRateChip
// so it can be tested without a DOM: the class exists to own an <input>
// element, and this is the one decision inside it worth pinning on its own.

export const MIN_CUSTOM_FRAME_RATE_FPS = 1;
export const MAX_CUSTOM_FRAME_RATE_FPS = 240;

// Null means "not a usable number" — empty, non-numeric or whitespace-only —
// and CustomFrameRateChip's caller treats that as a no-op rather than a zero
// or a default, so an accidental blur never re-caps the loop.
export const parseCustomFrameRate = (raw: string): number | null => {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(MAX_CUSTOM_FRAME_RATE_FPS, Math.max(MIN_CUSTOM_FRAME_RATE_FPS, Math.round(parsed)));
};
