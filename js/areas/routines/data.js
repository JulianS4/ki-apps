// Morning and evening routine from Julian's Notion page "Morgen & Abend Routine"
// (Stand 24.11.2026). Times are for Mo–Do; logic.js shifts weekends and Fr/Sa evenings.
import { slug } from '../../core/html.js';

const S = (id, from, to, title, link) => ({ id, from, ...(to ? { to } : {}), title, ...(link ? { link } : {}) });

export const MORNING = [
  S('wecker', '06:00', null, 'Wecker · 5500K Beleuchtung'),
  S('wasser', '06:00', '06:05', '500 ml trinken · Bett machen · Rollladen auf & Fenster zu', 'water'),
  S('grandpa', '06:05', '06:10', 'Anziehen → Chinese Grandpa Routine im Tageslicht', 'grandpa'),
  S('toilette', '06:10', '06:20', 'Toilette'),
  S('mund', '06:20', '06:25', 'Mundroutine'),
  S('dusche', '06:25', '06:35', 'Duschroutine'),
  S('abtrocknen', '06:35', '06:45', 'Abtrocknen · Skincare · Haare'),
  S('deo', '06:45', '06:55', 'Deo · Anziehen · Parfum'),
  S('tasche', '06:55', '07:00', 'Tasche & Essentials packen', 'pack'),
  S('los', '07:00', null, 'Losfahren'),
];

export const EVENING = [
  S('shutdown', '20:30', null, 'PC Shutdown · Alexa Regengeräusche (automatisch)'),
  S('dusche', '20:30', '20:45', 'Duschroutine (an Trainingstagen) · Zahnroutine'),
  S('abtrocknen', '20:45', '20:55', 'Abtrocknen · Skincare · Fenster auf'),
  S('mobility', '20:55', '21:10', 'Mobility Routine (15 min · Upper/Lower laut Recoveryplan)', 'mobility'),
  S('lesen', '21:10', '21:28', 'Lesen · Supplements', 'supps'),
  S('box', '21:28', '21:30', 'Box-Breathing', 'breath'),
  S('schlafen', '21:30', null, 'Schlafen · Lichter aus (automatisch)'),
];

const C = (cat, ...names) => ({ cat, items: names.map(name => ({ id: slug(name), name })) });
export const PACK = [
  C('Tasche', 'Metall-Flasche', 'Glas-Frühstücksbehälter', 'Metall-Mittagessenbehälter', 'Zuckerfreier Kaugummi', 'Mouthwash', 'Taschentücher', 'Deo', 'Laptop oder Tablet', 'Ladekabel'),
  C('Essentials', 'Handy', 'AirPods', 'Fitbit Edge', 'Mosolf-Chip', 'Schlüssel', 'Geldbeutel'),
];

// Chinese Grandpa Routine: je 30 s, in the step format of the guided timer.
export const GRANDPA = ['Lymphatic Hops', 'Deep Squat', 'Arm Waves/Half Squat', 'Golf Swings', 'High Knee', 'Deep Breathing', 'Tapping auf Lymphknoten', 'Sitzen in Seiza']
  .map((title, i) => ({ at: i * 30, title, hint: '30 s' }));
export const GRANDPA_END = 240;

export const PHONE_NOTE = 'Kein Handy in dieser Zeit. Einfach in der Handyhalterung lassen.';
export const LABELS = { morgen: 'Morgenroutine', abend: 'Abendroutine' };
