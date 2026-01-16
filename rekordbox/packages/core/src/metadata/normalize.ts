export type NormalizedMetadata = {
  artist: string;
  title: string;
  version: string | null;
};

const JUNK_TITLE_PATTERNS: RegExp[] = [
  /\b(official\s+video|official\s+music\s+video)\b/gi,
  /\b(official\s+audio)\b/gi,
  /\b(lyric\s+video|lyrics?)\b/gi,
  /\b(visuali[sz]er)\b/gi,
  /\b(hd|4k|8k)\b/gi,
  /\b(full\s+album)\b/gi
];

const VERSION_HINTS = [
  "original mix",
  "extended mix",
  "radio edit",
  "club mix",
  "dub",
  "edit",
  "remix",
  "rework",
  "bootleg",
  "vip mix",
  "vip",
  "mix"
];

export function normalizeFromYouTubeTitle(input: { rawTitle: string; uploader?: string | null }): NormalizedMetadata {
  const raw = (input.rawTitle || "").trim();
  const uploader = (input.uploader ?? "").trim();

  let title = raw;

  // Remove bracketed noise, keep potential version hints to re-extract later.
  title = title.replace(/\[[^\]]*]/g, " ").trim();

  // Remove common junk tokens.
  for (const re of JUNK_TITLE_PATTERNS) title = title.replace(re, " ");
  title = title.replace(/\s+/g, " ").trim();

  // Remove empty parentheses left behind after junk stripping (e.g. "(Lyrics)" -> "()").
  title = title.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim();

  // Split on common artist-title separators.
  const parts = splitArtistTitle(title);
  const artistGuess = parts.artist ?? (uploader || "Unknown Artist");
  let titleGuess = parts.title ?? title;

  // Extract version from parentheses in title part.
  const extracted = extractVersion(titleGuess);
  titleGuess = extracted.title;
  const version = extracted.version;

  // Make Title carry version for maximum Rekordbox predictability.
  const finalTitle = version ? `${titleGuess} (${version})` : titleGuess;

  return {
    artist: toTitleCaseArtist(cleanSpaces(artistGuess)),
    title: cleanSpaces(finalTitle),
    version
  };
}

function splitArtistTitle(value: string): { artist: string | null; title: string | null } {
  const separators = [" - ", " – ", " — ", " — ", " | "];
  for (const sep of separators) {
    const idx = value.indexOf(sep);
    if (idx > 0) {
      const left = value.slice(0, idx).trim();
      const right = value.slice(idx + sep.length).trim();
      if (left && right) return { artist: left, title: right };
    }
  }
  return { artist: null, title: null };
}

function extractVersion(title: string): { title: string; version: string | null } {
  const match = title.match(/\(([^)]{2,80})\)\s*$/);
  if (!match) return { title: cleanSpaces(title), version: null };

  const inside = cleanSpaces(match[1] ?? "");
  const normalized = inside.toLowerCase();
  const isVersiony = VERSION_HINTS.some((h) => normalized.includes(h));
  if (!isVersiony) return { title: cleanSpaces(title), version: null };

  const stripped = cleanSpaces(title.slice(0, match.index).trim());
  return { title: stripped, version: inside };
}

function cleanSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Convert artist name to Title Case for consistency.
 * Handles common edge cases like "DJ", "MC", "feat.", Roman numerals, etc.
 */
function toTitleCaseArtist(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  // Words that should stay uppercase
  const upperWords = new Set(["dj", "mc", "ii", "iii", "iv", "uk", "us", "nyc", "la", "dc", "aka"]);
  // Words that should stay lowercase (unless first word)
  const lowerWords = new Set(["the", "a", "an", "and", "or", "of", "vs", "vs.", "feat", "feat.", "ft", "ft.", "x"]);
  // Common artist name corrections (lowercase key -> correct form)
  const corrections: Record<string, string> = {
    "jay-z": "JAY-Z",
    "jay z": "JAY-Z",
    "a$ap": "A$AP",
    "asap": "A$AP",
    "xxxtentacion": "XXXTentacion",
    "6lack": "6LACK",
    "t-pain": "T-Pain",
    "j cole": "J. Cole",
    "j. cole": "J. Cole",
    "the weeknd": "The Weeknd",
    "d.j.": "DJ",
    "m.c.": "MC",
  };

  // Check for exact match corrections first
  const lowerName = trimmed.toLowerCase();
  if (corrections[lowerName]) return corrections[lowerName];

  // Split and process each word
  const words = trimmed.split(/(\s+|[-&])/);
  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;

    // Preserve separators as-is
    if (/^(\s+|[-&])$/.test(word)) {
      result.push(word);
      continue;
    }

    const lower = word.toLowerCase();

    // Check word-level corrections
    if (corrections[lower]) {
      result.push(corrections[lower]);
      continue;
    }

    // Uppercase words (DJ, MC, etc.)
    if (upperWords.has(lower)) {
      result.push(word.toUpperCase());
      continue;
    }

    // Lowercase words (unless first real word)
    const isFirstWord = result.filter((w) => !/^(\s+|[-&])$/.test(w)).length === 0;
    if (lowerWords.has(lower) && !isFirstWord) {
      result.push(lower);
      continue;
    }

    // Default: capitalize first letter, lowercase rest
    result.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  return result.join("");
}
