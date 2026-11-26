// Reads a ZIP (e.g. an Obsidian vault) in the browser: stored and deflated
// entries, names in UTF-8 or the old DOS code page. Nothing leaves the device.
export const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const NOT_ZIP = 'Keine ZIP-Datei – bitte den Vault-Ordner als ZIP wählen.';
const utf8 = new TextDecoder('utf-8', { fatal: true });

function name(bytes, flagged) {
  if (flagged) return new TextDecoder().decode(bytes);
  try { return utf8.decode(bytes); } catch (e) { return [...bytes].map(b => (b < 128 ? String.fromCharCode(b) : CP437[b - 128])).join(''); }
}

// The table of contents at the end of the file: every entry with where its data sits.
export function listZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 65557; i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error(NOT_ZIP);
  const count = v.getUint16(end + 10, true), cdOff = v.getUint32(end + 16, true);
  if (count === 0xffff || cdOff === 0xffffffff) throw new Error('Diese ZIP-Datei ist zu groß (über 4 GB oder 65.535 Dateien).');
  const entries = [], problems = [];
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw new Error(NOT_ZIP);
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
    const n = v.getUint16(p + 28, true), x = v.getUint16(p + 30, true), c = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const path = name(bytes.subarray(p + 46, p + 46 + n), flags & 0x800);
    p += 46 + n + x + c;
    if (path.endsWith('/')) continue;
    if (flags & 1) problems.push({ path, why: 'passwortgeschützt' });
    else if (method !== 0 && method !== 8) problems.push({ path, why: 'unbekannte Komprimierung' });
    else entries.push({ name: path, method, csize, size, local });
  }
  return { entries, problems };
}

export async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Dein Browser kann komprimierte ZIP-Dateien nicht entpacken – bitte Browser oder iOS aktualisieren.');
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// One entry's content; the local header can carry its own extra field.
export async function readEntry(bytes, e) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (e.local + 30 > bytes.length || v.getUint32(e.local, true) !== 0x04034b50) throw new Error('beschädigt');
  const start = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
  if (start + e.csize > bytes.length) throw new Error('beschädigt');
  const data = bytes.subarray(start, start + e.csize);
  return e.method === 8 ? inflateRaw(data) : data.slice();
}
