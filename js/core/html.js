export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// URL- and id-safe lower-case form: 'Äpfel (Bio)' → 'aepfel-bio'.
const UML = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
export const slug = v => String(v ?? '').toLowerCase().replace(/[äöüß]/g, c => UML[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
