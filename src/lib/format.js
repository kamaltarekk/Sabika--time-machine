/** أدوات تنسيق أرقام/نسب بالعربي. */

const egp = new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0,
});

const plain = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });

export function formatEGP(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return egp.format(Math.round(value));
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return plain.format(value);
}

/** نسبة من 0..1 (أو أكتر) كـ % بالعربي. */
export function formatPct(share, digits = 0) {
  if (share == null || Number.isNaN(share)) return '—';
  const fmt = new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
  return `${fmt.format(share * 100)}%`;
}

export function formatGrams(grams) {
  if (grams == null || Number.isNaN(grams)) return '—';
  const fmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });
  return `${fmt.format(grams)} جرام`;
}
