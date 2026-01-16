export type DjTagSuggestion = {
  kind: "track" | "set" | "podcast" | "video" | "unknown";
  genre: string | null;
  energy: `${1 | 2 | 3 | 4 | 5}/5` | null;
  time: string | null; // Warmup | Peak | Closing | etc
  vibe: string | null; // comma-separated
  confidence: number; // 0..1
  notes: string;
};

type MinimalInfo = {
  title?: string | null;
  uploader?: string | null;
  description?: string | null;
  duration?: number | null; // seconds
  webpage_url?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
};

export function heuristicClassifyDjTags(info: MinimalInfo): DjTagSuggestion {
  const title = (info.title ?? "").toLowerCase();
  const uploader = (info.uploader ?? "").toLowerCase();
  const desc = (info.description ?? "").toLowerCase();
  const duration = info.duration ?? null;

  const text = `${title}\n${uploader}\n${desc}`;

  const categories = (info.categories ?? []).map((c) => c.toLowerCase());
  const tags = (info.tags ?? []).map((t) => String(t).toLowerCase());
  const hasMusicCategory = categories.some((c) => c.includes("music"));
  const hasMusicTags = tags.some((t) => /\b(music|audio|song|track|remix|mix|dj|house|techno|afro|amapiano)\b/i.test(t));
  const hasMusicSignals = hasMusicCategory || hasMusicTags;

  const looksLikeTutorial =
    /\b(how to dj|dj tutorial|tutorial|lesson|masterclass|learn to dj|dj tips)\b/i.test(text) ||
    // Tooling/skill keywords strongly imply education rather than a performance upload.
    /\b(rekordbox|serato|traktor|cdj|controller|beatmatch|beat matching|hot cue|hotcue|quantize|phrasing)\b/i.test(text);
  const hasMixKeywords =
    /\b(live set|dj set|dj live|live dj|live mix|dj mix|mix|set at|session|livestream|live stream|boiler room|resident advisor|ra live|essential mix)\b/i.test(
      text
    );
  const hasSetTags = tags.some((t) => {
    // Tags often come in compressed forms like "livedjset" or "djliveset".
    if (/(livedjset|djset|djliveset|liveset|livemix|djmix|radioshow)/i.test(t)) return true;
    return /\b(dj|mix|set|boilerroom|boiler room|essentialmix|essential mix|radio show|podcast)\b/i.test(t);
  });
  const hasSetSignals = hasMixKeywords || hasSetTags;

  const looksLikeSet =
    /\b(full set)\b/i.test(text) ||
    (hasSetSignals && (duration === null || duration >= 20 * 60)) ||
    // Some channels label sets as "session" without explicit "mix" keywords.
    (/\b(session)\b/i.test(text) && (duration === null || duration >= 20 * 60));

  const hasPodcastKeywords = /\b(podcast|radio show|episode)\b/i.test(text);
  const hasLiveSetKeywords =
    /\b(live set|dj set|dj live|live dj|live mix|dj mix|session|livestream|live stream|boiler room|resident advisor|ra live|essential mix)\b/i.test(
      text
    );
  const looksLikePodcast =
    hasPodcastKeywords && !hasLiveSetKeywords && (duration === null || duration >= 15 * 60) && (hasSetSignals || hasMusicSignals);

  const kind: DjTagSuggestion["kind"] = looksLikeTutorial
    ? "video"
    : looksLikePodcast
    ? "podcast"
    : looksLikeSet
      ? "set"
      : hasMusicSignals
        ? "track"
        : title
          ? "video"
          : "unknown";

  // Genre heuristics (expanded DJ taxonomy - order matters, more specific first)
  let genre: string | null = null;

  // Afro/Amapiano variants
  if (/\bamapiano\b/.test(text)) genre = "Amapiano";
  else if (/\bafro\s*house\b/.test(text) || /\bafro\b/.test(text)) genre = "Afro House";

  // Techno variants (more specific first)
  else if (/\bhard\s*techno\b/.test(text) || /\bindustrial\s*techno\b/.test(text)) genre = "Hard Techno";
  else if (/\bmelodic\s*techno\b/.test(text)) genre = "Melodic Techno";
  else if (/\bminimal\s*techno\b/.test(text) || /\bminimal\b/.test(text)) genre = "Minimal Techno";
  else if (/\bacid\s*techno\b/.test(text) || /\bacid\b/.test(text)) genre = "Acid";
  else if (/\bpeak\s*time\s*techno\b/.test(text) || /\bdriving\s*techno\b/.test(text)) genre = "Peak Time Techno";
  else if (/\btechno\b/.test(text)) genre = "Techno";

  // House variants (more specific first)
  else if (/\btech\s*house\b/.test(text)) genre = "Tech House";
  else if (/\bprogressive\s*house\b/.test(text) || /\bprogressive\b/.test(text)) genre = "Progressive House";
  else if (/\bdeep\s*house\b/.test(text)) genre = "Deep House";
  else if (/\bfunky\s*house\b/.test(text) || /\bfunky\b/.test(text)) genre = "Funky House";
  else if (/\bsoulful\s*house\b/.test(text) || /\bsoulful\b/.test(text)) genre = "Soulful House";
  else if (/\bjackin\b/.test(text) || /\bjackin'\s*house\b/.test(text)) genre = "Jackin House";
  else if (/\bmelodic\s*house\b/.test(text) || /\bmelodic\b/.test(text)) genre = "Melodic House & Techno";
  else if (/\bhouse\b/.test(text)) genre = "House";

  // Bass music
  else if (/\bdrum\s*(and|&|n)\s*bass\b/.test(text) || /\bdnb\b/.test(text) || /\bjungle\b/.test(text)) genre = "Drum & Bass";
  else if (/\bdubstep\b/.test(text)) genre = "Dubstep";
  else if (/\buk\s*garage\b/.test(text) || /\bukg\b/.test(text) || /\b2[- ]?step\b/.test(text)) genre = "UK Garage";
  else if (/\bbreaks\b/.test(text) || /\bbreakbeat\b/.test(text)) genre = "Breaks";
  else if (/\bbassline\b/.test(text) || /\bbass\s*house\b/.test(text)) genre = "Bass House";

  // Trance variants
  else if (/\bpsy\s*trance\b/.test(text) || /\bpsytrance\b/.test(text) || /\bgoa\b/.test(text)) genre = "Psytrance";
  else if (/\buplifting\s*trance\b/.test(text) || /\buplifting\b/.test(text)) genre = "Uplifting Trance";
  else if (/\btrance\b/.test(text)) genre = "Trance";

  // Other electronic
  else if (/\bdisco\b/.test(text) || /\bnu[\s-]?disco\b/.test(text)) genre = "Disco / Nu-Disco";
  else if (/\belectro\b/.test(text)) genre = "Electro";
  else if (/\bdowntempo\b/.test(text) || /\bchill\s*out\b/.test(text) || /\bambient\b/.test(text)) genre = "Downtempo";

  // Fallback
  else genre = null;

  // Energy/time heuristics (only when explicitly signaled).
  let energy: DjTagSuggestion["energy"] = null;
  let time: string | null = null;
  if (/\b(warmup|warm up|opening)\b/.test(text)) {
    energy = "2/5";
    time = "Warmup";
  } else if (/\b(closing|afterhours|after hours)\b/.test(text)) {
    energy = "3/5";
    time = "Closing";
  } else if (/\b(peak|banger|festival|main stage)\b/.test(text)) {
    energy = "4/5";
    time = "Peak";
  } else {
    energy = null;
    time = null;
  }

  // Vibe heuristics (comma-separated; only when explicitly signaled).
  const vibes: string[] = [];
  if (/\btribal\b/.test(text)) vibes.push("Tribal");
  if (/\borganic\b/.test(text)) vibes.push("Organic");
  if (/\bvocal\b/.test(text)) vibes.push("Vocal");
  if (/\binstrumental\b/.test(text)) vibes.push("Instrumental");
  if (/\bdark\b/.test(text)) vibes.push("Dark");
  if (/\bminimal\b/.test(text)) vibes.push("Minimal");
  if (/\blatin\b/.test(text)) vibes.push("Latin");
  if (/\bgroovy\b/.test(text) || /\bfunky\b/.test(text)) vibes.push("Groovy");
  if (/\bhypnotic\b/.test(text)) vibes.push("Hypnotic");
  if (/\bdriving\b/.test(text)) vibes.push("Driving");
  if (/\bmelodic\b/.test(text) && genre !== "Melodic Techno" && genre !== "Melodic House & Techno") vibes.push("Melodic");
  if (/\buplifting\b/.test(text) && genre !== "Uplifting Trance") vibes.push("Uplifting");
  if (/\benergetic\b/.test(text) || /\bhigh[\s-]?energy\b/.test(text)) vibes.push("Energetic");
  if (/\bchill\b/.test(text) || /\brelaxed\b/.test(text)) vibes.push("Chill");

  const vibe = vibes.length ? vibes.join(", ") : null;

  // Confidence: heuristic only (conservative by default).
  let confidence = 0;
  if (kind !== "unknown") confidence += 0.25;
  if (hasMusicSignals) confidence += 0.15;
  if (genre) confidence += 0.4;
  if (energy || time) confidence += 0.15;
  if (vibe) confidence += 0.1;

  if (confidence === 0) {
    console.log(`[autoclassify] Zero confidence for: "${info.title}" by "${info.uploader}"`);
    console.log(`[autoclassify] Categories: ${categories.join(", ") || "none"}`);
    console.log(`[autoclassify] Tags: ${tags.join(", ") || "none"}`);
  }

  const notes =
    kind === "podcast"
      ? "Detected long-form podcast/show; DJ tags may be less relevant."
      : kind === "set"
        ? "Detected long-form mix/set; tags are approximate."
        : kind === "video"
          ? "Detected tutorial/video; DJ tags are omitted."
        : "Heuristic classification from YouTube metadata (conservative; may return nulls).";

  return {
    kind,
    genre: kind === "video" || kind === "podcast" ? null : genre ?? (kind === "track" || kind === "set" ? "Other" : null),
    energy,
    time,
    vibe,
    confidence: Math.max(0, Math.min(1, confidence)),
    notes
  };
}
