const JUNK_PATTERNS: RegExp[] = [
  /\bofficial\b/gi,
  /\bvideo\b/gi,
  /\blyric(s)?\b/gi,
  /\bvisualizer\b/gi,
  /\bhd\b/gi,
  /\b4k\b/gi
];

export function guessArtistTitle(rawTitle: string, uploader?: string): { artist: string; title: string } {
  let title = rawTitle;
  title = title.replace(/\[[^\]]*]/g, " ");
  title = title.replace(/\([^)]*\bofficial\b[^)]*\)/gi, " ");
  for (const re of JUNK_PATTERNS) title = title.replace(re, " ");
  title = title.replace(/\s+/g, " ").trim();

  const parts = title.split(" - ").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { artist: parts[0]!, title: parts.slice(1).join(" - ") };
  }

  return { artist: (uploader ?? "Unknown Artist").trim(), title };
}

export function makeRekordboxFilename(input: { artist: string; title: string; bpm?: number | null; key?: string | null; ext: string }): string {
  const bpm = input.bpm ? Math.round(input.bpm) : null;
  const suffix = bpm || input.key ? ` [${[bpm ? String(bpm) : null, input.key ?? null].filter(Boolean).join(" ")}]` : "";
  return sanitizeFileComponent(`${input.artist} - ${input.title}${suffix}`) + input.ext;
}

export function sanitizeFileComponent(value: string): string {
  // Cross-platform safe-ish: avoid reserved chars and trailing dots/spaces.
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned.length ? cleaned : "Untitled";
}
