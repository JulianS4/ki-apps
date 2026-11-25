// Calendar helpers. All day strings are local 'YYYY-MM-DD'.
export const DAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
export const DN = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };

const p2 = n => String(n).padStart(2, '0');
export const ds = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
export const today = () => ds(new Date());
export const dayIdx = d => (d.getDay() + 6) % 7;
export const monday = (d = new Date()) => {
  const m = new Date(d);
  m.setHours(12, 0, 0, 0);
  m.setDate(m.getDate() - dayIdx(m));
  return m;
};
// Noon avoids off-by-one days around daylight-saving switches.
const noon = day => new Date(day + 'T12:00:00');
export const addDays = (day, n) => { const d = noon(day); d.setDate(d.getDate() + n); return ds(d); };
export const dshort = day => { const d = noon(day); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
export const dfmt = day => DN[DAYS[dayIdx(noon(day))]] + ' ' + dshort(day);
