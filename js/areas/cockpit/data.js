// Cockpit choices, defaults and the clearly marked example data set.
import { addDaysUtc, addMonths } from './logic.js';

export const ACC_TYPES = [['giro', 'Girokonto'], ['tagesgeld', 'Tagesgeld'], ['depot', 'Depot / ETF'], ['bar', 'Bargeld'], ['sonstiges', 'Sonstiges']];
export const CURS = [['EUR', 'Euro (€)'], ['USD', 'US-Dollar ($)'], ['GBP', 'Pfund (£)'], ['CHF', 'Franken (CHF)']];
export const CAT_KINDS = [['ausgabe', 'Ausgabe'], ['einnahme', 'Einnahme'], ['sparen', 'Zurückgelegt (Sparen, Übertrag)']];
export const EVERY = [['monat', 'monatlich'], ['quartal', 'vierteljährlich'], ['halbjahr', 'halbjährlich'], ['jahr', 'jährlich'], ['woche', 'wöchentlich']];
export const SUB_STATUS = [['aktiv', 'aktiv'], ['pausiert', 'pausiert'], ['gekuendigt', 'gekündigt']];
export const PREP = [['offen', 'nicht angefangen'], ['begonnen', 'angefangen'], ['fast', 'fast fertig'], ['fertig', 'vorbereitet']];
export const PROJ_STATUS = [['aktiv', 'aktiv'], ['pausiert', 'pausiert'], ['idee', 'Idee'], ['abgeschlossen', 'abgeschlossen']];
export const AGENT_STATUS = [['unbekannt', 'unbekannt'], ['bereit', 'bereit'], ['beschaeftigt', 'beschäftigt'], ['fehlgeschlagen', 'fehlgeschlagen'], ['pausiert', 'pausiert']];
export const TOPICS = [['business', 'Business & Projekte'], ['ki', 'KI & Agents'], ['ausbildung', 'Arbeit & Ausbildung'], ['finanzen', 'Finanzen'], ['training', 'Training & Erholung'], ['privat', 'Persönlich & Ideen']];
export const label = (opts, v) => (opts.find(o => o[0] === v) || ['', v || ''])[1];

const cat = (id, name, kind = 'ausgabe') => ({ id, name, kind, src: 'manuell' });
export const DEFAULT_CATS = [
  cat('wohnen', 'Wohnen'), cat('essen', 'Essen & Trinken'), cat('mobilitaet', 'Mobilität'), cat('abos', 'Abos & Verträge'), cat('freizeit', 'Freizeit'),
  cat('bildung', 'Bildung'), cat('gesundheit', 'Gesundheit & Sport'), cat('business', 'Business-Ausgaben'), cat('sonstiges', 'Sonstiges'),
  cat('gehalt', 'Gehalt & Vergütung', 'einnahme'), cat('business-ein', 'Business-Einnahmen', 'einnahme'), cat('einnahmen', 'Sonstige Einnahmen', 'einnahme'),
  cat('sparen', 'Sparen & Investieren', 'sparen'),
];
const proj = (id, name) => ({ id, name, status: 'aktiv', goal: '', prog: 0, notes: '', links: [], src: 'manuell' });
export const DEFAULT_PROJECTS = [proj('reselling', 'Reselling'), proj('personal-brand', 'Personal Brand'), proj('sensito', 'Sensito')];

// Every example is invented, named "Beispiel" and tagged src: 'beispiel'.
export function demoData(today) {
  const d = n => addDaysUtc(today, n), B = 'beispiel', m0 = today.slice(0, 8) + '01';
  const hist = (end, steps) => steps.map((c, i) => ({ d: addMonths(end, i - steps.length + 1), c }));
  const acc = (id, name, type, bal, asOf, steps) => ({ id, name, type, cur: 'EUR', bal, asOf, src: B, hist: hist(asOf, [...steps, bal]) });
  let n = 0;
  const tx = (day, amt, payee, c, a = 'bsp-giro') => ({ id: 'bsp-tx' + n++, d: day, amt, payee, cat: c, acc: a, note: '', src: B });
  const lm = addMonths(m0, -1);
  return {
    accounts: [
      acc('bsp-giro', 'Beispiel-Girokonto', 'giro', 184217, d(-2), [120000, 135500, 98040, 151230, 162075]),
      acc('bsp-tg', 'Beispiel-Tagesgeld', 'tagesgeld', 530000, d(-10), [400000, 430000, 460000, 490000, 500000]),
      acc('bsp-depot', 'Beispiel-Depot (ETF)', 'depot', 1248055, d(-1), [980000, 1015000, 1062000, 1110500, 1189000]),
    ],
    cats: DEFAULT_CATS.map(c => ({ ...c, src: B })),
    tx: [
      tx(m0, 115000, 'Beispiel-Ausbildungsbetrieb', 'gehalt'), tx(addDaysUtc(m0, 1), -35000, 'Beispiel-Miete', 'wohnen'),
      tx(addDaysUtc(m0, 2), -6240, 'Beispiel-Supermarkt', 'essen'), tx(addDaysUtc(m0, 4), -1299, 'Beispiel-Streaming', 'abos'),
      tx(addDaysUtc(m0, 5), -2990, 'Beispiel-Fitnessstudio', 'gesundheit'), tx(addDaysUtc(m0, 6), -30000, 'Beispiel-Sparplan', 'sparen'),
      tx(addDaysUtc(m0, 8), -4800, 'Beispiel-Tankstelle', 'mobilitaet'), tx(addDaysUtc(m0, 9), 8500, 'Beispiel-Käufer', 'business-ein'),
      tx(addDaysUtc(m0, 11), -5815, 'Beispiel-Supermarkt', 'essen'), tx(addDaysUtc(m0, 13), -1400, 'Beispiel-Kino', 'freizeit'),
      tx(addDaysUtc(m0, 15), -2350, 'Beispiel-Großhändler', 'business'),
      tx(lm, 115000, 'Beispiel-Ausbildungsbetrieb', 'gehalt'), tx(addDaysUtc(lm, 1), -35000, 'Beispiel-Miete', 'wohnen'),
      tx(addDaysUtc(lm, 3), -7120, 'Beispiel-Supermarkt', 'essen'), tx(addDaysUtc(lm, 6), -30000, 'Beispiel-Sparplan', 'sparen'),
      tx(addDaysUtc(lm, 12), -3900, 'Beispiel-Restaurant', 'essen'), tx(addDaysUtc(lm, 18), -1099, 'Beispiel-Musikdienst', 'abos', 'bsp-giro'),
    ].filter(t => t.d <= today),
    budgets: { essen: 25000, freizeit: 10000, abos: 4000, mobilitaet: 8000 },
    subs: [
      { id: 'bsp-s1', name: 'Beispiel-Streaming', amt: 1299, cur: 'EUR', every: 'monat', next: d(9), pay: 'Beispiel-Girokonto', cat: 'abos', status: 'aktiv', src: B },
      { id: 'bsp-s2', name: 'Beispiel-Musikdienst', amt: 1099, cur: 'EUR', every: 'monat', next: d(21), pay: 'Beispiel-Kreditkarte', cat: 'abos', status: 'aktiv', src: B },
      { id: 'bsp-s3', name: 'Beispiel-Cloudspeicher', amt: 2999, cur: 'EUR', every: 'jahr', next: d(140), pay: 'Beispiel-Girokonto', cat: 'abos', status: 'aktiv', src: B },
      { id: 'bsp-s4', name: 'Beispiel-Fitnessstudio', amt: 2990, cur: 'EUR', every: 'monat', next: d(5), pay: 'Beispiel-Girokonto', cat: 'gesundheit', status: 'aktiv', src: B },
      { id: 'bsp-s5', name: 'Beispiel-Zeitschrift', amt: 450, cur: 'EUR', every: 'monat', next: d(-12), pay: 'Beispiel-Girokonto', cat: 'abos', status: 'gekuendigt', src: B },
    ],
    depts: [
      { id: 'bsp-d1', name: 'Beispiel-Abteilung Einkauf', from: d(-80), to: d(10), note: '', src: B },
      { id: 'bsp-d2', name: 'Beispiel-Abteilung Vertrieb', from: d(11), note: '', src: B },
    ],
    exams: [
      { id: 'bsp-e1', subj: 'Rechnungswesen', d: d(3), time: '08:00', place: 'Raum 12 (Beispiel)', prep: 'begonnen', src: B },
      { id: 'bsp-e2', subj: 'BWL', d: d(8), time: '09:45', place: 'Raum 7 (Beispiel)', prep: 'offen', src: B },
      { id: 'bsp-e3', subj: 'Deutsch', d: d(15), time: '11:30', place: 'Aula (Beispiel)', prep: 'offen', src: B },
      { id: 'bsp-e4', subj: 'Englisch', d: d(30), place: 'Raum 3 (Beispiel)', prep: 'offen', src: B },
      { id: 'bsp-e5', subj: 'Englisch', d: d(-20), prep: 'fertig', grade: 2, src: B },
      { id: 'bsp-e6', subj: 'BWL', d: d(-40), prep: 'fertig', grade: 1.7, src: B },
    ],
    stasks: [
      { id: 'bsp-t1', subj: 'Rechnungswesen', text: 'Übungsblatt Buchungssätze', due: d(2), done: false, src: B },
      { id: 'bsp-t2', subj: 'BWL', text: 'Kapitel 4 zusammenfassen', due: d(5), done: false, src: B },
      { id: 'bsp-t3', subj: 'Deutsch', text: 'Erörterung gliedern', due: d(-1), done: true, src: B },
    ],
    projects: [
      { ...proj('reselling', 'Reselling'), goal: '20 Artikel listen (Beispiel)', prog: 45, notes: 'Beispiel-Notiz zum Projekt.', src: B, upd: d(-1) },
      { ...proj('personal-brand', 'Personal Brand'), goal: '3 Beiträge pro Woche (Beispiel)', prog: 20, src: B, upd: d(-6) },
      { ...proj('sensito', 'Sensito'), goal: 'Prototyp fertigstellen (Beispiel)', prog: 60, links: [{ label: 'Beispiel-Link', url: 'https://example.com' }], src: B, upd: d(-3) },
    ],
    ptasks: [
      { id: 'bsp-p1', proj: 'reselling', text: 'Fotos für 5 Artikel machen', due: d(1), done: false, src: B },
      { id: 'bsp-p2', proj: 'sensito', text: 'Feedback einsammeln', due: d(-1), done: false, src: B },
      { id: 'bsp-p3', proj: 'personal-brand', text: 'Redaktionsplan Dezember', due: d(6), done: false, src: B },
    ],
    log: [
      [-2, 'reselling', 'Artikel fotografiert und gelistet', 95, 0, 0], [-4, 'reselling', 'Verkauf abgewickelt', 30, 8500, 2350],
      [-5, 'sensito', 'Prototyp getestet', 120, 0, 1500], [-8, 'personal-brand', 'Beitrag geschrieben', 60, 0, 0],
      [-12, 'sensito', 'Gespräch mit Testnutzer', 45, 0, 0], [-15, 'reselling', 'Einkauf auf Flohmarkt', 150, 0, 4000],
      [-22, 'personal-brand', 'Video geschnitten', 90, 0, 0], [-35, 'reselling', 'Zwei Verkäufe', 40, 12000, 0],
      [-41, 'sensito', 'Konzept überarbeitet', 180, 0, 0],
    ].map(([o, p, text, min, inc, exp], i) => ({ id: 'bsp-l' + i, d: d(o), proj: p, text: text + ' (Beispiel)', min, inc, exp, src: B })),
    agents: [
      { id: 'bsp-a1', name: 'Beispiel-Agent Recherche', job: 'Sammelt jeden Morgen Nachrichten', status: 'bereit', asOf: d(-1), last: 'gestern 07:00', next: 'morgen 07:00', result: 'Bericht erstellt (Beispiel)', issues: '', runtime: '3 min', cost: 4, src: B },
      { id: 'bsp-a2', name: 'Beispiel-Agent Postfach', job: 'Sortiert E-Mails vor', status: 'fehlgeschlagen', asOf: d(0), last: 'heute 06:30', next: '', result: '', issues: 'Anmeldung abgelaufen (Beispiel)', runtime: '', src: B },
    ],
    notes: [
      { id: 'bsp-n1', title: 'Einkaufsregeln Reselling (Beispiel)', topic: 'business', tags: ['reselling'], projects: ['reselling'], body: 'Nur kaufen, wenn die Marge passt. Siehe [[Preisliste (Beispiel)]].\nFotos immer bei Tageslicht.', created: d(-30), upd: d(-2), src: B },
      { id: 'bsp-n2', title: 'Preisliste (Beispiel)', topic: 'business', tags: ['reselling', 'preise'], projects: ['reselling'], body: 'Beispielwerte für Einkauf und Verkauf.', created: d(-28), upd: d(-28), src: B },
      { id: 'bsp-n3', title: 'Ideen für Agents (Beispiel)', topic: 'ki', tags: ['agents'], projects: [], body: 'Ein Agent könnte die [[Preisliste (Beispiel)]] aktuell halten.', created: d(-10), upd: d(-10), src: B },
      { id: 'bsp-n4', title: 'Lernplan BWL (Beispiel)', topic: 'ausbildung', tags: ['bwl'], projects: [], body: 'Kapitel 3 und 4 wiederholen, dann Übungsaufgaben.', created: d(-6), upd: d(-6), src: B },
    ],
  };
}
