import { kv } from "@vercel/kv";
import { TEMIZ_VERI, cagir } from "./denetim.mjs";
process.env.SITE_PASSWORD = "ownerpw";
const OWNER = { "x-site-password": "ownerpw", "content-type": "application/json" };
let g = 0, k = 0;
const kontrol = (ad, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗ !!!"} ${ad}${d ? " — " + d : ""}`); ok ? g++ : k++; };
const { default: h } = await import("../api/data.js");

console.log("ORTAK ŞİFRE DURUMU DENETİMİ\n");
await kv.set("marcus-os-data", TEMIZ_VERI());

delete process.env.STAFF_PASSWORD;
let r = await cagir(h, { method: "GET", headers: OWNER, query: {}, body: {} });
kontrol("ortak şifre YOKken false bildiriliyor", r.govde.guvenlik.ortakSifreAktif === false, String(r.govde.guvenlik.ortakSifreAktif));

process.env.STAFF_PASSWORD = "ortak123";
r = await cagir(h, { method: "GET", headers: OWNER, query: {}, body: {} });
kontrol("ortak şifre VARken true bildiriliyor", r.govde.guvenlik.ortakSifreAktif === true, String(r.govde.guvenlik.ortakSifreAktif));

// Ortak sifreyle giris gercekten calisiyor mu (kart bosuna degil)
r = await cagir(h, { method: "GET", headers: { "x-site-password": "ortak123" }, query: {}, body: {} });
kontrol("ortak şifreyle personel girişi çalışıyor", r.kod === 200 && r.govde.role === "staff", `HTTP ${r.kod}, rol: ${r.govde.role}`);
delete process.env.STAFF_PASSWORD;


// Ortak sifre YOKKEN kisisel hesaplar calismaya devam ediyor mu
import crypto from "crypto";
const hash = (x, salt) => crypto.scryptSync(x, salt, 64).toString("hex");
const b64 = (t) => Buffer.from(String(t), "utf8").toString("base64");
delete process.env.STAFF_PASSWORD;
const v = TEMIZ_VERI();
v.personelHesaplari = [{ id: "p9", ad: "Test", kullaniciAdi: "test", sifreHash: hash("1234", "s"), sifreSalt: "s", izinler: { cekimEdit: true } }];
await kv.set("marcus-os-data", v);
r = await cagir(h, { method: "GET", headers: { "x-staff-username-b64": b64("test"), "x-staff-password-b64": b64("1234") }, query: {}, body: {} });
kontrol("ortak şifre yokken KİŞİSEL hesap girişi çalışıyor", r.kod === 200 && r.govde.role === "staff", `HTTP ${r.kod}`);
r = await cagir(h, { method: "GET", headers: { "x-site-password": "ownerpw" }, query: {}, body: {} });
kontrol("yönetici girişi etkilenmedi", r.kod === 200);

console.log(`\nSONUÇ: ${g} geçti, ${k} kaldı`);
