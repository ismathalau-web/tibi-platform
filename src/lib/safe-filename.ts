/**
 * Make a string safe to put inside a Content-Disposition filename.
 * HTTP headers only allow ASCII bytes 0..255, so strip em-dashes, accents, etc.
 */
export function safeFilename(s: string, fallback = 'tibi'): string {
  if (!s) return fallback;
  const ascii = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '-') // drop any non-ASCII to dash
    .replace(/[\s/\\?"<>|:*]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return ascii || fallback;
}
