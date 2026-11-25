// Recovery content from Julian's Notion page "Recovery" (Stand 24.11.2026).

const S = (at, title, hint = '') => ({ at, title, hint });

// Guided mobility: `at` is the second a step starts. Routines end at 15:00;
// on Saturdays the last step simply runs 5 minutes longer (20:00).
export const MOBILITY = {
  A: {
    name: 'Upper',
    steps: [
      S(0, 'Cat-Cow', '8–10 langsame Wdh'),
      S(90, 'Thread the Needle', '45 s/Seite'),
      S(180, 'Wall Slides', '10–15 Wdh'),
      S(270, 'Doorway Chest Stretch', '45 s/Seite'),
      S(360, 'Lat Stretch', '45 s/Seite'),
      S(450, 'Cross-Body Shoulder Stretch', '45 s/Seite'),
      S(540, 'Upper Trap / Neck Stretch', '45 s/Seite'),
      S(630, 'Thoracic Extension', '8–10 Wdh'),
      S(750, "Child's Pose mit Seit-Reach", '75 s/Seite'),
    ],
  },
  B: {
    name: 'Lower',
    steps: [
      S(0, 'Deep Squat Hold'),
      S(90, 'Couch Stretch', '45 s/Seite'),
      S(180, '90/90 Hip Stretch', '45 s/Seite'),
      S(270, 'Seated Forward Fold'),
      S(360, 'Calf Stretch', '45 s/Seite'),
      S(450, 'Adductor Rockbacks', '10–15/Seite'),
      S(570, 'Pigeon Stretch', '60 s/Seite'),
      S(690, 'Ankle Dorsiflexion', '45 s/Seite'),
      S(780, "Child's Pose → Deep Squat", 'je 1 min'),
    ],
  },
};

// Recovery blocks shown as a checklist on their days.
export const BLOCKS = {
  mi: [
    { t: 'Joggen ohne Musik, Podcast oder Hörbuch' },
    { t: 'Abendessen + Mealprep · 60 min' },
    { t: 'Personal Time, keine Arbeit, kein Deep Work · 60 min' },
  ],
  sa: [
    { t: 'Mobility: Waden, Achillessehne, Hamstrings, Adduktoren, Hüftbeuger · 20 min', link: 'mobility' },
    { t: 'Warme Dusche oder Sauna (optional) · 15 min' },
    { t: 'Personal Time inkl. 5 min Box-Breathing · 25 min' },
  ],
  so: [
    { t: 'Spaziergang ohne Kopfhörer · 30 min' },
    { t: 'Mobility Upper · 15 min', link: 'mobility' },
    { t: 'Wochen-Check · 15 min', link: 'weekly' },
    { t: 'Frühstück in Ruhe, danach Kirche · 30 min' },
    { t: 'Nachmittags Personal Time, kaum Bildschirm' },
  ],
};

// Reps in reserve per cycle week (week 7 is the deload).
export const RIR = [
  { week: 1, main: '3', iso: '2–3', goal: 'Technik, Gewichte aus Woche 4' },
  { week: 2, main: '2–3', iso: '2', goal: 'Steigern' },
  { week: 3, main: '2', iso: '1–2', goal: 'Steigern' },
  { week: 4, main: '1–2', iso: '1', goal: 'Steigern' },
  { week: 5, main: '1–2', iso: '0–1', goal: 'Hart' },
  { week: 6, main: '1', iso: '0–1', goal: 'Peak' },
  { week: 7, main: '3–4', iso: '4', goal: 'Deload' },
];

export const DELOAD_RULES = [
  'Sätze halbieren, ~90 % Gewicht von Woche 6, 3–4 RIR',
  'Sprints und Sprünge mit halbem Volumen, ~90 % Tempo',
  'Joggen locker, Athlete Day nur Technik + Mobility',
  '30 min früher ins Bett, Kalorien und Protein nicht kürzen',
  'Keine PR-Versuche, keine neuen Übungen',
];

// Week 1 of the first cycle; cycles repeat every 7 weeks from here.
export const CYCLE_ANCHOR = '2026-10-19';

export const AMPEL = {
  gruen: { label: 'Grün', advice: 'Training wie geplant' },
  gelb: { label: 'Gelb', advice: 'Gewichte halten, 1 Wdh mehr im Tank, pro Übung 1 Isolationssatz weniger' },
  rot: { label: 'Rot', advice: 'Halbe Sätze oder Pause. 2× Rot pro Woche → Deload vorziehen' },
};

export const SIGH = '2× durch die Nase einatmen, lang durch den Mund aus. Bei Stress und nach dem Training.';
