// Körper: values, goals and the quarter check from Julian's Notion pages
// "Lebensziele · Körper" and "Kalender Routine · Quartal · Körper".
export const GOALS = { kg: 90, fat: [12, 13], height: 190 };

const M = (id, label) => ({ id, label, unit: 'cm', min: 10, max: 250, hint: '10–250 cm' });
// `hint` is the allowed range as the form names it in its error message.
export const FIELDS = [
  { id: 'kg', label: 'Gewicht', unit: 'kg', min: 30, max: 250, hint: '30–250 kg' },
  { id: 'fat', label: 'Körperfett', unit: '%', min: 3, max: 60, hint: '3–60 %' },
  M('brust', 'Brust'), M('taille', 'Taille'), M('huefte', 'Hüfte'), M('arm', 'Oberarm'), M('bein', 'Oberschenkel'), M('wade', 'Wade'),
  { id: 'run5k', label: '5 km', unit: 'min', min: 600, max: 3600, hint: '10:00–60:00 min', time: true },
  { id: 'hang', label: 'Dead-Hang', unit: 's', min: 1, max: 600, hint: '1–600 s', time: true },
];
export const MEASURES = ['brust', 'taille', 'huefte', 'arm', 'bein', 'wade'];

export const POSES = [{ id: 'vorne', label: 'vorne' }, { id: 'seitlich', label: 'seitlich' }, { id: 'hinten', label: 'hinten' }];

// `auto`: ticks itself once an entry dated in the quarter exists.
export const QUARTER_ITEMS = [
  { id: 'weight', label: 'Gewicht messen', auto: true },
  { id: 'photos', label: 'Körperfotos machen', auto: true },
  { id: 'measures', label: 'Körpermaße aktualisieren', auto: true },
  { id: 'mob', label: 'Mobility-Check', auto: true },
  { id: 'run5k', label: '5-km-Zeit überprüfen', auto: true },
  { id: 'plan', label: 'Trainingsplan kritisch überprüfen' },
  { id: 'pain', label: 'Verletzungen/Schmerzen dokumentieren', link: '#recovery' },
  { id: 'hang', label: 'Dead-Hang-Check', auto: true },
];
