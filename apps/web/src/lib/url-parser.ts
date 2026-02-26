const YT_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[^\s&"'<>]+/gi;

export function extractYouTubeUrls(text: string): string[] {
  const matches = text.match(YT_REGEX);
  if (!matches) return [];
  // Dedupe while preserving order
  return [...new Set(matches)];
}
