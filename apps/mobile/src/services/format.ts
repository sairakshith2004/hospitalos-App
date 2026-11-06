/** Rupees from integer paise, Indian digit grouping, no floating-point arithmetic on money. */
export function formatPaise(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100).toString();
  const fraction = (abs % 100).toString().padStart(2, '0');
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${negative ? '−' : ''}₹${grouped}.${fraction}`;
}

/** "14:30" in hospital time (Asia/Kolkata, UTC+5:30, no daylight saving) from an ISO instant. */
export function hospitalTime(iso: string): string {
  const minutes = Math.floor(Date.parse(iso) / 60_000) + 330;
  const inDay = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
}

/** Statuses as people read them: "checked_in" → "Checked in". */
export function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
