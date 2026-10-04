/**
 * Terugadres uit de URL (?terug=/dashboard/klanten/...), bijvoorbeeld als Jessi
 * vanaf de klantkaart een drukproef opent. Alleen paden binnen het dashboard,
 * zodat niemand via een link naar een andere site kan doorsturen.
 */
export function veiligTerugPad(v: string | string[] | null | undefined): string | null {
  const t = String(Array.isArray(v) ? v[0] : v ?? '').trim();
  if (!t.startsWith('/dashboard/') || t.includes('//') || t.includes('\\') || t.length > 300) return null;
  return /^[\w\-/?=&%.]+$/.test(t) ? t : null;
}
