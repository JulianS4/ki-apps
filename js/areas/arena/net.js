// Arena online. One interface, two implementations:
// - firebaseNet(conn): Firestore + anonymous sign-in, SDK loaded on first use;
// - memNet(server, conn): an in-memory stand-in for tests that enforces the
//   same rights as firestore.rules (claim with the right key, own days only).
// Interface: ready (getter, Promise), info(), create(), watchTasks(cb),
// watchDays(from, to, cb), putDay(doc), putTask(task), status(), close().
// Errors are Error('offline' | 'denied' | 'config').
import { PLAYERS } from './data.js';
import { cleanTasks } from './logic.js';

export const SDK_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.player < b.player ? -1 : 1);

// ---------------- in-memory stand-in ----------------
export function memServer({ offline = false } = {}) {
  const arenas = new Map();
  let n = 0;
  const deny = () => { throw new Error('denied'); };
  const notify = a => { for (const f of [...a.subs]) f(); };
  const only = () => [...arenas.values()][0] || deny();
  return {
    offline,
    newUid: () => 'u' + (++n),
    arena: code => arenas.get(code) || null,
    create(code, { start, tasks, keys }) {
      if (arenas.has(code)) deny();
      arenas.set(code, { start, keys: { ...keys }, claims: new Set(), tasks: new Map(cleanTasks(tasks).map(t => [t.id, t])), days: new Map(), subs: new Set() });
    },
    claim(code, player, uid, key) {
      const a = arenas.get(code);
      if (!a || !(player in PLAYERS) || a.keys[player] !== key) deny();
      a.claims.add(player + '_' + uid);
    },
    member(code, uid) {
      const a = arenas.get(code);
      return !!a && (a.claims.has('julian_' + uid) || a.claims.has('uygar_' + uid));
    },
    putDay(code, uid, doc) {
      const a = arenas.get(code);
      if (!a || !a.claims.has(doc.player + '_' + uid)) deny();
      a.days.set(doc.player + '_' + doc.date, JSON.parse(JSON.stringify(doc)));
      notify(a);
    },
    putTask(code, uid, task) {
      const a = arenas.get(code);
      if (!a || !this.member(code, uid)) deny();
      a.tasks.set(task.id, { ...task });
      notify(a);
    },
    // Test helpers: "the other player writes", and reading a stored day.
    putDayAs(player, doc) {
      const a = only();
      if (doc.player !== player) deny();
      a.days.set(doc.player + '_' + doc.date, JSON.parse(JSON.stringify(doc)));
      notify(a);
    },
    day(player, date) {
      for (const a of arenas.values()) { const d = a.days.get(player + '_' + date); if (d) return d; }
      return null;
    },
  };
}

export function memNet(server, conn) {
  const uid = server.newUid(), offs = new Set();
  let claimP = null;
  const watch = f => {
    const a = server.arena(conn.code);
    if (!a) return () => {};
    a.subs.add(f);
    f();
    const off = () => { a.subs.delete(f); offs.delete(off); };
    offs.add(off);
    return off;
  };
  const member = () => server.member(conn.code, uid);
  return {
    get ready() {
      return claimP || (claimP = Promise.resolve().then(() => {
        if (server.offline) throw new Error('offline');
        try { server.claim(conn.code, conn.player, uid, conn.key); } catch (e) { throw new Error('denied'); }
      }));
    },
    async info() {
      const a = server.arena(conn.code);
      if (!a) throw new Error('denied');
      return { start: a.start };
    },
    async create({ start, tasks, keys }) {
      if (server.offline) throw new Error('offline');
      server.create(conn.code, { start, tasks, keys });
      server.claim(conn.code, conn.player, uid, conn.key);
    },
    watchTasks: cb => watch(() => { if (member()) cb([...server.arena(conn.code).tasks.values()].sort((x, y) => x.order - y.order)); }),
    watchDays: (from, to, cb) => watch(() => { if (member()) cb([...server.arena(conn.code).days.values()].filter(d => d.date >= from && d.date <= to).sort(byDate)); }),
    async putDay({ date, values, points, total }) { server.putDay(conn.code, uid, { player: conn.player, date, values, points, total }); },
    async putTask(task) { server.putTask(conn.code, uid, task); },
    status: () => ({ pending: false }),
    close() { for (const off of [...offs]) off(); },
  };
}

// ---------------- Firebase ----------------
let loader = () => Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(SDK_BASE + f)))
  .then(([app, auth, fs]) => ({ A: app, Au: auth, F: fs }));
let sdk = null;
export const setSdkLoader = fn => { loader = fn; sdk = null; };
const loadSdk = () => sdk || (sdk = Promise.resolve().then(loader).catch(e => { sdk = null; throw e; }));

function why(e) {
  const c = String((e && (e.code || e.message)) || '');
  if (/permission|denied|unauthenticated/i.test(c)) return 'denied';
  if (/api-key|invalid-api|configuration|project|app-not-authorized|operation-not-allowed|admin-restricted/i.test(c)) return 'config';
  return 'offline';
}
const fail = e => new Error(why(e));

export function firebaseNet(conn) {
  let base = null, claimP = null, pending = false;
  const offs = new Set();
  // Sign in once per device (the anonymous user is kept by Firebase) and open
  // Firestore with its offline cache.
  const boot = () => base || (base = (async () => {
    const { A, Au, F } = await loadSdk();
    const name = 'arena-' + conn.code.slice(0, 8);
    const app = A.getApps().find(x => x.name === name) || A.initializeApp(conn.cfg, name);
    // No popup/redirect helper: on iOS getAuth() would load an extra Google
    // script and iframe up front, which also slows sign-in in a dead zone.
    let auth;
    try { auth = Au.initializeAuth(app, { persistence: [Au.indexedDBLocalPersistence, Au.browserLocalPersistence] }); } catch (e) { auth = Au.getAuth(app); }
    const user = await new Promise(ok => { const off = Au.onAuthStateChanged(auth, u => { off(); ok(u); }); });
    if (!user) await Au.signInAnonymously(auth);
    let db;
    try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentSingleTabManager() }) }); } catch (e) { db = F.getFirestore(app); }
    return { F, db, uid: auth.currentUser.uid };
  })().catch(e => { base = null; throw fail(e); }));
  const at = (F, db, ...p) => F.doc(db, 'arenas', conn.code, ...p);
  const claimDoc = ({ F, db, uid }) => F.setDoc(at(F, db, 'claims', `${conn.player}_${uid}`), { player: conn.player, uid, key: conn.key });
  const watch = make => {
    let off = null, closed = false;
    boot().then(b => { if (!closed) off = make(b); }).catch(() => {});
    const stop = () => { closed = true; if (off) off(); offs.delete(stop); };
    offs.add(stop);
    return stop;
  };
  return {
    // A device that claimed before can start from the offline cache; a first
    // claim needs the server.
    get ready() {
      return claimP || (claimP = (async () => {
        const b = await boot();
        const sent = claimDoc(b).catch(e => { throw fail(e); });
        sent.catch(() => {});
        let tm;
        const timeout = new Promise((_, no) => { tm = setTimeout(() => no(new Error('offline')), 8000); });
        try {
          await Promise.race([sent, timeout]);
        } catch (e) {
          if (e.message !== 'offline') throw e;
          const cached = await b.F.getDocsFromCache(b.F.collection(b.db, 'arenas', conn.code, 'tasks')).catch(() => null);
          if (!cached || cached.empty) throw e;
        } finally { clearTimeout(tm); }
      })().catch(e => { claimP = null; throw e; }));
    },
    async info() {
      const b = await boot();
      try {
        const s = await b.F.getDoc(b.F.doc(b.db, 'arenas', conn.code));
        if (!s.exists()) throw new Error('denied');
        return { start: s.data().start };
      } catch (e) { throw fail(e); }
    },
    async create({ start, tasks, keys }) {
      try {
        const b = await boot(), { F, db } = b;
        await F.setDoc(F.doc(db, 'arenas', conn.code), { start, v: 1 });
        await F.setDoc(at(F, db, 'keys', 'julian'), { key: keys.julian });
        await F.setDoc(at(F, db, 'keys', 'uygar'), { key: keys.uygar });
        await claimDoc(b);
        const batch = F.writeBatch(db);
        for (const t of cleanTasks(tasks)) batch.set(at(F, db, 'tasks', t.id), t);
        await batch.commit();
      } catch (e) { throw e.message && ['offline', 'denied', 'config'].includes(e.message) ? e : fail(e); }
    },
    watchTasks: cb => watch(({ F, db }) => F.onSnapshot(F.collection(db, 'arenas', conn.code, 'tasks'),
      s => cb(s.docs.map(d => d.data()).sort((x, y) => x.order - y.order)), () => {})),
    watchDays: (from, to, cb) => watch(({ F, db }) => F.onSnapshot(
      F.query(F.collection(db, 'arenas', conn.code, 'days'), F.where('date', '>=', from), F.where('date', '<=', to)),
      { includeMetadataChanges: true },
      s => { pending = s.metadata.hasPendingWrites; cb(s.docs.map(d => d.data()).sort(byDate)); }, () => {})),
    // Writes go to the offline cache at once; the promise settles when the
    // server has them, so callers don't wait on it.
    async putDay({ date, values, points, total }) {
      const { F, db } = await boot();
      pending = true;
      return F.setDoc(at(F, db, 'days', `${conn.player}_${date}`), { player: conn.player, date, values, points, total }).catch(e => { throw fail(e); });
    },
    async putTask(task) {
      const { F, db } = await boot();
      return F.setDoc(at(F, db, 'tasks', task.id), task).catch(e => { throw fail(e); });
    },
    status: () => ({ pending }),
    close() { for (const stop of [...offs]) stop(); },
  };
}
