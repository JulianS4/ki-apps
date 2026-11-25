// One JSON file for all areas. Also reads backups of the old Hybrid-Training app.
const INVALID = 'Keine gültige Backup-Datei';
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const validPlan = p => isObj(p) && Array.isArray(p.days) && p.days.length === 7;

export function buildBackup(store, exportedIso) {
  const data = {};
  for (const k of store.keys()) if (k !== 'meta.lastBackup') data[k] = store.get(k);
  return { app: 'ki-apps', v: 1, exported: exportedIso, data };
}

// Sessions merge per key (backup wins), the plan only replaces when it is
// a full week, everything else is replaced as a whole.
function put(store, key, value) {
  if (key === 'train.sess') {
    if (isObj(value)) store.set(key, { ...store.get(key, {}), ...value });
  } else if (key === 'train.plan') {
    if (validPlan(value)) store.set(key, value);
  } else if (key !== 'meta.lastBackup') {
    store.set(key, value);
  }
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
