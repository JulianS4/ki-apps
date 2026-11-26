// Nutrition content from Julian's Notion pages "Ernährungsplan",
// "Supplementplan" and "Einkaufsliste" (Stand 22.–24.11.2026).
import { slug } from '../../core/html.js';

// slot: fr Frühstück, mi Mittag, sn Snack, ab Abend, dr Drink.
// days: wt Mo–Fr, we Sa–So, all. Protein values (g) are estimates.
const D = (id, slot, days, name, g, ing, free) => ({ id, slot, days, name, g, ing, ...(free ? { free: true } : {}) });
export const DISHES = [
  D('joghurt-bowl', 'fr', 'wt', 'Joghurt Bowl', 45, 'Griechischer Joghurt + Whey + Tahini + Honig + Gefrorene Beeren + Kerne deiner Wahl'),
  D('overnight-oats', 'fr', 'wt', 'Overnight Oats', 45, 'Milch + Haferflocken zart + Whey + geschälte Hanfsamen + Kakaopulver + Zimt + Kurkuma + Mandeln + Walnüsse'),
  D('protein-wrap', 'fr', 'wt', 'High Protein Wrap', 35, 'Vollkornwrap + Eier + Frischkäse + Knoblauch + Pute + Kerne deiner Wahl + Avocado'),
  D('ruehrei-toast', 'fr', 'we', 'Rührei mit Hüttenkäse Toast', 40, 'Vollkornbrot + Eier + Hüttenkäse + Babyspinat + Babytomaten + Kerne deiner Wahl'),
  D('lachs-salat', 'fr', 'we', 'Lachs Salat', 45, 'Eier + Baby-Römersalat + Gekochte Linsen + Gurke + Kapern + Geräucherter Lachs/Forelle + Petersilie + Haselnüsse + Kerne deiner Wahl · Dressing: Natives Olivenöl extra + Knoblauch + Sumach + Zitrone'),
  D('aldi', 'mi', 'wt', 'Aldi', 30, 'frei, Protein schätzen', true),
  D('ofen-platte', 'mi', 'we', 'Ofen Platte', 55, 'Hähnchenbrust + Kartoffel-Wedges + Natives Olivenöl extra + Paprika + Süßkartoffel + Brokkoli + Parmesan + Kerne deiner Wahl'),
  D('quinoa-bowl', 'mi', 'we', 'Quinoa Power Bowl', 30, 'Quinoa + Kichererbsen (geröstet) + Avocado + Cherrytomaten + Rucola + Feta + Kürbiskerne'),
  D('lachspfanne', 'ab', 'wt', 'Lachspfanne mit Süßkartoffeln', 35, 'Lachsfilet + Süßkartoffel-Würfel + Brokkoli + Knoblauch + Natives Olivenöl + Zitronensaft + Dill'),
  D('linsen-dahl', 'ab', 'wt', 'Hähnchen mit Linsen-Dahl', 50, 'Hähnchenbrust + Rote Linsen + Kokosmilch + Tomaten + Zwiebel + Kurkuma + Kreuzkümmel + Ingwer + Koriander'),
  D('bolognese', 'ab', 'wt', 'Bolognese', 45, 'Rinderhackfleisch (mager) + Zucchini-Nudeln oder Vollkornnudeln + Tomaten + Zwiebel + Knoblauch + Basilikum + Parmesan'),
  D('steak', 'ab', 'we', 'Gegrilltes Steak mit Gemüse', 50, 'Rinderfilet oder Hüftsteak + Ofenkartoffeln + Gegrillter Spargel + Cherrytomaten + Knoblauchbutter + Rosmarin'),
  D('kabeljau', 'ab', 'we', 'Gebackener Kabeljau mit Quinoa', 45, 'Kabeljaufilet + Quinoa + Babyspinat + Kapern + Zitronenschale + Natives Olivenöl + Kräuter der Provence'),
  D('fruechte', 'sn', 'all', 'Früchte & Beeren', 2, 'statt Süßigkeiten'),
  D('datteln', 'sn', 'all', 'Datteln', 2, 'statt Süßigkeiten'),
  D('schokolade', 'sn', 'all', 'Dunkle Schokolade > 80 %', 3, 'statt Süßigkeiten'),
  D('nuesse', 'sn', 'all', 'Nüsse (ungesalzen)', 6, 'statt Chips'),
  D('sonnenblumenkerne', 'sn', 'all', 'Sonnenblumenkerne', 6, 'statt Chips, ungesalzen'),
  D('kichererbsen', 'sn', 'all', 'Geröstete Kichererbsen', 8, 'statt Chips'),
  D('chips', 'sn', 'all', 'Linsen- oder Kichererbsenchips', 7, 'statt Chips'),
  D('tee', 'dr', 'all', 'Tee', 0, 'Grüner/Schwarzer Tee, statt Kaffee'),
  D('matcha', 'dr', 'all', 'Matcha', 0, 'statt Kaffee'),
  D('smoothie', 'dr', 'all', 'Smoothie', 3, 'statt Softdrinks, auch selbst gepresste Säfte'),
  D('shake', 'dr', 'all', 'Protein Shake', 25, 'statt Milchshakes'),
];

export const SLOTS = { fr: 'Frühstück', mi: 'Mittag', sn: 'Snacks', ab: 'Abendessen', dr: 'Drinks' };
export const SLOT_ORDER = ['fr', 'mi', 'sn', 'ab', 'dr'];

// shake: grams of protein a supplement brings along (logged as a shake).
export const SUPPS = [
  { id: 'omega', group: 'morgens', name: 'Omega 3 EPA & DHA + Vitamin D3 K2' },
  { id: 'ingwer', group: 'morgens', name: 'Ingwer + Bio-Honig + 1 TL Schwarzkümmelöl' },
  { id: 'kreatin', group: 'morgens', name: 'Kreatin + Protein', shake: 25 },
  { id: 'flohsamen', group: 'mittags', name: 'Flohsamenschalen + Rote-Bete-Saft', hint: 'zum Mittagessen' },
  { id: 'magnesium', group: 'abends', name: 'Magnesium + Glycin + Zink' },
  { id: 'kirsch', group: 'abends', name: 'Sauerkirschsaft' },
];
export const SUPP_GROUPS = ['morgens', 'mittags', 'abends'];
export const SUPP_LABELS = { morgens: 'Morgens', mittags: 'Mittags', abends: 'Abends' };

const C = (cat, ...names) => ({ cat, items: names.map(name => ({ id: slug(name), name })) });
export const SHOP = [
  C('Milchprodukte & Eier', 'Griechischer Joghurt', 'Milch', 'Hüttenkäse', 'Frischkäse', 'Feta', 'Parmesan', 'Butter', 'Eier', 'Kokosmilch'),
  C('Fleisch & Fisch', 'Hähnchenbrust', 'Putenbrust', 'Rinderhackfleisch (mager)', 'Rinderfilet oder Hüftsteak', 'Lachsfilet', 'Geräucherter Lachs oder Forelle', 'Kabeljaufilet'),
  C('Obst', 'Zitronen', 'Gefrorene Beeren', 'Bananen', 'Äpfel'),
  C('Snacks & Getränke', 'Datteln', 'Dunkle Schokolade (> 80 %)', 'Geröstete Kichererbsen', 'Linsen- oder Kichererbsenchips', 'Grüner / Schwarzer Tee', 'Matcha'),
  C('Gemüse', 'Avocado', 'Babyspinat', 'Baby-Römersalat', 'Rucola', 'Cherrytomaten', 'Gurke', 'Brokkoli', 'Paprika', 'Zucchini', 'Spargel', 'Süßkartoffeln', 'Kartoffeln', 'Zwiebeln', 'Knoblauch', 'Ingwer'),
  C('Kohlenhydrate & Hülsenfrüchte', 'Haferflocken (zart)', 'Vollkornwraps', 'Vollkornbrot', 'Vollkornnudeln', 'Quinoa', 'Kichererbsen', 'Rote Linsen', 'Linsen (zum Kochen)'),
  C('Vorrat', 'Whey', 'Natives Olivenöl extra', 'Gehackte Tomaten (Dose)', 'Kapern', 'Kakaopulver'),
  C('Nüsse, Kerne & Samen', 'Mandeln', 'Walnüsse', 'Haselnüsse', 'Geschälte Hanfsamen', 'Kürbiskerne', 'Tahini', 'Kernemix: Sonnenblumenkerne, Chiasamen, Leinsamen (ungesalzen)'),
  C('Gewürze & Kräuter', 'Jodsalz & Pfeffer', 'Honig', 'Zimt', 'Kurkuma', 'Kreuzkümmel', 'Sumach', 'Oregano', 'Paprikapulver', 'Kräuter der Provence', 'Basilikum', 'Dill', 'Koriander', 'Petersilie', 'Rosmarin'),
];
export const SHOP_NOTE = 'Alles Bio, wenn möglich · So viel TK wie möglich';

export const RULES = [['softdrinks', 'Softdrinks'], ['fastfood', 'Fast Food'], ['suess', 'Süßigkeiten/Snacks'], ['alkohol', 'Alkohol'], ['kaffee', 'Kaffee'], ['verarbeitet', 'Stark Verarbeitetes']];
export const FOOD_NOTE = 'Jodsalz verwenden · so viel Bio wie möglich';
export const WATER = { goal: 3500, full: 4000, bottles: [330, 500, 750, 1000], bottle: 500 };
export const LAST_MEAL = '19:00';
