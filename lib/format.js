export function formatYear(value) {
  const match = String(value ?? '').match(/\b(?:18\d{2}|19\d{2}|20\d{2}|21\d{2})\b/);
  if (!match) return '';
  const year = Number(match[0]);
  return year >= 1888 && year <= new Date().getFullYear() + 5 ? match[0] : '';
}

export function formatRating(value) {
  const rating = Number.parseFloat(value);
  return Number.isFinite(rating) && rating > 0 && rating <= 10 ? rating : null;
}
