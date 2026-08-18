/* TEST İÇİN SAHTE VERİTABANI — gerçek Redis'e bağlanmaz.
   nx desteği ŞART: yoksa lib/kv-yaz.js'deki yazma kilidi hiç devreye girmez
   ve testler var olmayan veri kaybı raporlar. */
const store = new Map();
const kopya = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

export const kv = {
  async get(key) { return kopya(store.get(key)); },
  async set(key, value, opts = {}) {
    if (opts && opts.nx && store.has(key)) return null;   // kilit alınamadı
    store.set(key, kopya(value));
    return "OK";
  },
  async del(...keys) { let n = 0; for (const k of keys.flat()) if (store.delete(k)) n++; return n; },
  async keys(pattern = "*") {
    const re = new RegExp("^" + String(pattern).split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    return [...store.keys()].filter((k) => re.test(k));
  },
  async incr(key) { const v = (Number(store.get(key)) || 0) + 1; store.set(key, v); return v; },
  async expire() { return 1; },
  async mget(...keys) { return keys.flat().map((k) => kopya(store.get(k))); },
  async flushall() { store.clear(); return "OK"; },
};
export default kv;
export const createClient = () => kv;
