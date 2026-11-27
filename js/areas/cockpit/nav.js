// Life OS navigation: sidebar in groups on wide screens, a bottom bar with "Mehr" on phones.
const P = {
  cockpit: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  tasks: '<rect x="3.5" y="4" width="5" height="5" rx="1.2"/><path d="M4.8 6.5l1.2 1.2 2-2.4"/><path d="M12 6.5h8.5"/><rect x="3.5" y="14" width="5" height="5" rx="1.2"/><path d="M12 16.5h8.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r="1"/><circle cx="12" cy="14.5" r="1"/><circle cx="15.5" cy="14.5" r="1"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  finance: '<path d="M3 7a2 2 0 0 1 2-2h12v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="14.5" r="1.2"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  log: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  food: '<path d="M12 7c-1.5-2.5-5.5-2.5-6.5.8C4.6 11 6.4 18 9 20c1.2.9 2 .4 3 0 1 .4 1.8.9 3 0 2.6-2 4.4-9 3.5-12.2C17.5 4.5 13.5 4.5 12 7z"/><path d="M12 7c0-2 1-3.5 2.5-4"/>',
  health: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M7 12h2.5l1.2-2.5 2 5 1.3-2.5H17"/>',
  training: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  recovery: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  arena: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  agents: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9h3.5M2.5 15h3.5M18 9h3.5M18 15h3.5"/>',
  notes: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  import: '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
};
export const icon = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[k] || ''}</svg>`;

// [key, address, name] per area, in groups; the group name heads its part of the sidebar.
export const GROUPS = [
  ['', [['cockpit', '#uebersicht', 'Übersicht']]],
  ['Planen', [['tasks', '#aufgaben', 'Aufgaben & Projekte'], ['calendar', '#kalender', 'Kalender & Routinen'], ['goals', '#ziele', 'Ziele & Rückblicke']]],
  ['Geld & Arbeit', [['finance', '#finanzen', 'Finanzen & Investments'], ['school', '#ausbildung', 'Arbeit & Lernen']]],
  ['Körper', [['food', '#ernaehrung', 'Ernährung'], ['health', '#koerper', 'Gesundheit'], ['training', '#training', 'Training'], ['recovery', '#recovery', 'Recovery'], ['arena', '#arena', 'Arena']]],
  ['Kopf & KI', [['notes', '#wissen', 'Wissen'], ['agents', '#agents', 'KI-Agents']]],
];
export const NAV = GROUPS.flatMap(g => g[1]);
const SETTINGS = ['settings', '#einstellungen', 'Einstellungen'];
const IMPORT = ['import', '#import', 'Import'];
const PHONE = ['cockpit', 'tasks', 'calendar', 'training'];
const SHORT = { tasks: 'Aufgaben', calendar: 'Kalender' };
const KEY = { projects: 'tasks', routines: 'calendar', body: 'health', heute: 'cockpit', integrations: 'settings' };

export const navKey = route => KEY[route.area] || route.area;
const cur = (k, key) => (k === key ? ' class="on" aria-current="page"' : '');
const amp = s => s.replace(/&/g, '&amp;');
const link = ([k, h, l], key) => `<a href="${h}"${cur(k, key)}>${icon(k)}<span>${amp(l)}</span></a>`;
const groups = (key, wrap) => GROUPS.map(([g, items]) => `${g ? `<p class="sg">${amp(g)}</p>` : ''}${items.map(n => wrap(link(n, key))).join('')}`).join('');

export const sideNav = key => `<a class="brand" href="#uebersicht">Life OS</a><div class="sl">${groups(key, x => x)}</div><div class="sl end">${link(IMPORT, key)}${link(SETTINGS, key)}</div>`;
export function bottomNav(key) {
  const inMore = !PHONE.includes(key);
  return `${NAV.filter(n => PHONE.includes(n[0])).map(([k, h, l]) => `<a href="${h}"${cur(k, key)}>${icon(k)}<span>${amp(SHORT[k] || l)}</span></a>`).join('')}
  <button type="button" data-nav="more" aria-haspopup="dialog" aria-expanded="false"${inMore ? ' class="on"' : ''}>${icon('more')}<span>Mehr</span></button>`;
}
export const moreList = key => `<h2>Alle Bereiche</h2><div class="morel">${groups(key, x => x)}<p class="sg">System</p>${link(IMPORT, key)}${link(SETTINGS, key)}</div><button class="btn" type="button" data-nav="close">Schließen</button>`;
