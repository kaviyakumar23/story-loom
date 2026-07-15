export function safeNextPath(value: string | null | undefined, fallback = '/books'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
