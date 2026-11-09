// 12345.5 -> "12 345,50 DH" (séparateur de milliers pour lire les montants d'un coup d'œil)
export function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  const [whole, decimals] = Math.abs(amount).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? '-' : ''}${grouped},${decimals} DH`;
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