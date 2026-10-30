export function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `${amount.toFixed(2)} DH`;
}

// "12,5" ou "12.5" -> 12.5 ; texte vide ou invalide -> null
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}