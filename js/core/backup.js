// One JSON file for all areas. Also reads backups of the old Hybrid-Training app.
const INVALID = 'Keine gültige Backup-Datei';
export const STORAGE_FAILED = 'Speichern nicht möglich – Speicher voll oder privater Modus?';
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const validPlan = p => isObj(p) && Array.isArray(p.days) && p.days.length === 7;

export function buildBackup(store, exportedIso) {
  const data = {};
  for (const k of store.keys()) if (k !== 'meta.lastBackup') data[k] = store.get(k);
  return { app: 'ki-apps', v: 1, exported: exportedIso, data };
}

// Date-keyed maps merge per key (backup wins), so loading an older backup
// never wipes entries made since. Complaints merge by id. The plan only
// replaces when it is a full week, everything else is replaced as a whole.
const PER_KEY = ['train.sess', 'rec.morning', 'rec.mobility', 'rec.weekly', 'rec.blocks', 'rec.flags', 'food.days', 'body.weight', 'rout.days'];
function put(store, key, value) {
  let ok = true;
  if (PER_KEY.includes(key)) {
    if (isObj(value)) ok = store.set(key, { ...store.get(key, {}), ...value });
  } else if (key === 'rec.complaints') {
    if (Array.isArray(value)) {
      const byId = new Map((store.get(key, []) || []).map(c => [c.id, c]));
      for (const c of value) if (isObj(c)) byId.set(c.id, c);
      ok = store.set(key, [...byId.values()]);
    }
  } else if (key === 'train.plan') {
    if (validPlan(value)) ok = store.set(key, value);
  } else if (key !== 'meta.lastBackup') {
    ok = store.set(key, value);
  }
  if (!ok) throw new Error(STORAGE_FAILED);
}

export function importBackup(obj, store) {
  if (!isObj(obj)) throw new Error(INVALID);
  if (obj.app === 'hybrid-training' && isObj(obj.sess)) {
    put(store, 'train.plan', obj.plan);
    put(store, 'train.sess', obj.sess);
    return { kind: 'hybrid-training', sessions: Object.keys(obj.sess).length };
  }
  if (obj.app === 'ki-apps' && isObj(obj.data)) {
    for (const [k, v] of Object.entries(obj.data)) put(store, k, v);
    return { kind: 'ki-apps', sessions: isObj(obj.data['train.sess']) ? Object.keys(obj.data['train.sess']).length : 0 };
  }
  throw new Error(INVALID);
}
