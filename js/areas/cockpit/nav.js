// Life OS navigation: sidebar on wide screens, a bottom bar with "Mehr" on phones.
const P = {
  cockpit: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  finance: '<path d="M3 7a2 2 0 0 1 2-2h12v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="14.5" r="1.2"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  log: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  agents: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9h3.5M2.5 15h3.5M18 9h3.5M18 15h3.5"/>',
  notes: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  health: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
};
export const icon = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[k] || ''}</svg>`;

export const NAV = [['cockpit', '#uebersicht', 'Übersicht'], ['finance', '#finanzen', 'Finanzen'], ['school', '#ausbildung', 'Ausbildung'], ['projects', '#projekte', 'Projekte'],
  ['log', '#business-log', 'Business Log'], ['agents', '#agents', 'KI-Agents'], ['notes', '#wissen', 'Wissen'], ['health', '#heute', 'Training & Erholung']];
const SETTINGS = ['settings', '#einstellungen', 'Einstellungen'];
const PHONE = ['cockpit', 'finance', 'school', 'health'];
const SHORT = { health: 'Training' };
const HEALTH = ['heute', 'training', 'recovery', 'food', 'routines', 'body', 'arena'];

export function navKey(route) {
  if (route.area === 'projects') return route.view === 'log' ? 'log' : 'projects';
  if (HEALTH.includes(route.area)) return 'health';
  if (route.area === 'settings' || route.area === 'integrations') return 'settings';
  return route.area;
}
const cur = (k, key) => (k === key ? ' class="on" aria-current="page"' : '');
const link = ([k, h, l], key) => `<a href="${h}"${cur(k, key)}>${icon(k)}<span>${l}</span></a>`;

export const sideNav = key => `<a class="brand" href="#uebersicht">Life OS</a><div class="sl">${NAV.map(n => link(n, key)).join('')}</div><div class="sl end">${link(SETTINGS, key)}</div>`;
export function bottomNav(key) {
  const inMore = !PHONE.includes(key);
  return `${NAV.filter(n => PHONE.includes(n[0])).map(([k, h, l]) => `<a href="${h}"${cur(k, key)}>${icon(k)}<span>${SHORT[k] || l}</span></a>`).join('')}
  <button type="button" data-nav="more" aria-haspopup="dialog" aria-expanded="false"${inMore ? ' class="on"' : ''}>${icon('more')}<span>Mehr</span></button>`;
}
export const moreList = key => `<h2>Alle Bereiche</h2><ul class="morel">${[...NAV, SETTINGS].map(n => `<li>${link(n, key)}</li>`).join('')}</ul><button class="btn" type="button" data-nav="close">Schließen</button>`;
