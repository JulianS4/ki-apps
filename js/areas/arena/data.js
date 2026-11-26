// Arena: Julian vs. Uygar, tasks as in Julian's Notion page "Arena"
// (Daily Performance, Stand 25.11.2026). The live list is shared online.
export const PLAYERS = { julian: 'Julian', uygar: 'Uygar' };

export const TASKS = [
  { id: 'health', name: 'Health', kind: 'yes', hint: '8 h Quality Sleep · Healthy Nutrition · 3 L Water', order: 1, archived: false },
  { id: 'income', name: 'Income', kind: 'value', unit: '€', goal: 50, hint: 'How much money did you earn today?', order: 2, archived: false },
  { id: 'skills', name: 'Skills', kind: 'yes', hint: 'Did you learn a new skill today?', order: 3, archived: false },
  { id: 'training', name: 'Training', kind: 'yes', hint: 'Did you train hard today?', order: 4, archived: false },
  { id: 'work', name: 'Work Hours', kind: 'value', unit: 'h', goal: 10, hint: 'How many hours did you work today?', order: 5, archived: false },
];
