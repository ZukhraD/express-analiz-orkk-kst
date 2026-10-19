"use strict";
/* ================================================================ Экспресс-анализ для КМ: данные, хранение, загрузка файлов.
   Все суммы на экране — тыс. тг. Декларации хранятся в тенге (как в документе) и делятся на 1000 при показе.
   Данные — только в этом браузере (localStorage), регистрация не нужна. */
const S = window.SPEC;
var C = { settings: { variant: 0 }, custom: {} };   // нужно разборщику форм основного сайта (app2.js)

/* ---------------------------------------------------------------- числа */
const isNum = v => typeof v === "number" && isFinite(v);
const N = v => (isNum(v) ? v : 0);
function parseNum(s) {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return isFinite(s) ? s : null;
  let t = String(s).trim().replace(/[   \s']/g, "");
  if (t === "" || t === "-" || t === "—") return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith("−") || t.startsWith("-")) { neg = !neg; t = t.slice(1); }
  const seps = (t.match(/[.,]/g) || []).length;
  if (seps > 1) {
    const p = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
    t = (t.length - p - 1 === 3) ? t.replace(/[.,]/g, "") : t.slice(0, p).replace(/[.,]/g, "") + "." + t.slice(p + 1);
  } else t = t.replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const v = parseFloat(t);
  return isFinite(v) ? (neg ? -v : v) : null;
}
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmt(v, kind = "m") {
  if (!isNum(v)) return "";
  const s = kind === "x" ? nf2.format(v) : kind === "p" ? nf1.format(v * 100) + " %" : kind === "1" ? nf1.format(v) : nf0.format(Math.round(v));
  return s.replace("-", "−");
}
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const sum = a => a.reduce((x, y) => x + N(y), 0);

/* ---------------------------------------------------------------- справочники */
const PRODUCTS = ["Кредит", "Кредитная линия", "Овердрафт", "Банковская гарантия"];
const PURPOSES = ["Пополнение оборотных средств", "Приобретение основных средств / инвестиции", "Рефинансирование", "Исполнение контракта", "Другое"];
const PROGRAMS = ["Собственная программа банка", "Гос. программа: субсидирование ставки", "Гос. программа: гарантия фонда", "Гос. программа: субсидирование + гарантия", "Программа институтов развития (БРК, ЕАБР и др.)", "Другая"];
const SCHED = { ann: "Аннуитет (равными платежами)", diff: "Дифференцированный (долг равными долями)", end: "В конце срока (ежемесячно только %)" };
const COLL = { "Недвижимость коммерческая": 30, "Недвижимость жилая": 25, "Земельный участок": 40, "Транспорт": 40, "Спецтехника / оборудование": 45, "Товары в обороте": 50, "Деньги (депозит)": 0, "Права требования / контракт": 50, "Другое": 50 };
const OVERDUE = { no: "нет", past: "были, сейчас нет", now: "есть сейчас" };

/* компактные строки отчётности: ключ → [название, подпись простым языком, ключи основного сайта] */
const FL = {
  bal: [
    ["sec", "Что есть у компании (активы)"],
    ["cash", "Деньги", "касса, счета, краткосрочные депозиты", ["cash", "stinv"]],
    ["ar", "Дебиторская задолженность", "сколько компании должны покупатели и другие", ["ar", "oar"]],
    ["inv", "Запасы", "товары, сырьё, материалы на складе", ["inv"]],
    ["oca", "Прочие текущие активы", "НДС к возмещению, предоплата налогов и т.п.", ["taxa", "oca"]],
    ["fa", "Основные средства и долгосрочные активы", "здания, техника, оборудование, вложения", ["ppe", "intang", "ltinv", "olta"]],
    ["ta", "ИТОГО АКТИВЫ", "", null, "calc"],
    ["sec", "Откуда деньги (обязательства и капитал)"],
    ["ap", "Кредиторская задолженность и авансы", "сколько компания должна поставщикам; авансы покупателей", ["ap", "adv"]],
    ["debt_st", "Кредиты и займы до 1 года", "включая текущую часть долгосрочных и лизинг", ["stloan", "cpltd"]],
    ["debt_lt", "Кредиты, займы и лизинг свыше 1 года", "", ["ltloan", "lease"]],
    ["ol", "Прочие обязательства", "налоги, зарплата, прочие долги", ["taxl", "ocl", "oltl"]],
    ["eq", "Собственный капитал", "уставный капитал + накопленная прибыль + резервы", ["sc", "re", "oeq"]],
    ["re", "в т.ч. нераспределённая прибыль", "накопленная прибыль прошлых лет", ["re"], "sub"],
    ["tle", "ИТОГО ПАССИВЫ", "", null, "calc"],
    ["ta_rep", "Итого активы по отчётности", "для сверки — как в документе", ["ta_rep"], "opt"],
  ],
  pl: [
    ["sec", "Доходы и расходы за период"],
    ["rev", "Выручка", "доход от продажи товаров и услуг, без НДС", ["rev"]],
    ["cogs", "Себестоимость", "закупка товара, сырьё, производство", ["cogs"]],
    ["opex", "Расходы периода", "административные + расходы по реализации", ["selling", "admin"]],
    ["oth", "Прочие доходы минус прочие расходы", "если расходов больше — со знаком минус", null, "oth"],
    ["int", "Проценты по кредитам", "расходы по финансированию", ["int"]],
    ["cit", "Подоходный налог (КПН)", "", ["cit"]],
    ["ni", "ЧИСТАЯ ПРИБЫЛЬ (расчёт)", "", null, "calc"],
    ["ni_rep", "Чистая прибыль по отчётности", "для сверки — как в документе", ["ni_rep"], "opt"],
    ["da", "Амортизация", "необязательно: из пояснений или ДДС; если не знаете — оставьте пустым", [], "opt"],
  ],
  cf: [
    ["sec", "Движение денег (если есть ДДС)"],
    ["ocf", "Чистый поток от основной деятельности", "поступления от покупателей минус оплаты поставщикам, зарплата, налоги", null, "ocf"],
    ["cf_in", "Получено кредитов и займов (и др. финансирование)", "", null, "cfin"],
    ["cf_out", "Погашено кредитов и займов (и др. выплаты)", "", null, "cfout"],
  ],
};
const LINEDEF = {}; for (const b of Object.keys(FL)) for (const l of FL[b]) if (l[0] !== "sec") LINEDEF[l[0]] = { key: l[0], label: l[1], hint: l[2], src: l[3], typ: l[4] || "in", block: b };

/* ---------------------------------------------------------------- хранение */
const STORE = "finkz.express.v1";
let CLIENTS = (() => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; } })();
let X = null;          // открытый клиент
let saveT = 0;
function saveAll(now) {
  clearTimeout(saveT);
  const go = () => { try { localStorage.setItem(STORE, JSON.stringify(CLIENTS)); } catch (e) { toast("Не удалось сохранить: в браузере закончилось место"); } };
  if (now) go(); else saveT = setTimeout(go, 400);
}
function touch() { if (X) { X.updated = Date.now(); X.concl = X.concl || {}; if (!X.concl.edited) X.concl.text = ""; } saveAll(); }
function download(name, text, type = "application/json") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function defPeriods() {
  const y = new Date().getFullYear();
  return [{ id: uid(), date: `${y - 2}-12-31`, months: 12 }, { id: uid(), date: `${y - 1}-12-31`, months: 12 }];
}
function newClient() {
  return {
    id: uid(), created: Date.now(), updated: Date.now(),
    card: { name: "", bin: "", form: "ТОО", regDate: "", activity: "", director: "", owners: "", km: "", phone: "",
      product: "Кредит", purpose: PURPOSES[0], program: PROGRAMS[0], amount: null, term: null, rate: null, sched: "ann", grace: 0, guarPct: null, notes: "",
      loans: [], coll: [], guar: [] },
    per: defPeriods(), fin: {}, files: [], decl: [], concl: { text: "", edited: false },
  };
}
const perLabel = p => { if (!p || !p.date) return "период"; const [y, m] = p.date.split("-"); const mm = N(p.months) || 12; return mm === 12 && m === "12" ? y : `${mm} мес. ${y}`; };
const perIdx = pid => X.per.findIndex(p => p.id === pid);
const fv = (key, pid) => { const v = X.fin?.[key]?.[pid]; return isNum(v) ? v : null; };
function setFv(key, pid, v) { X.fin[key] = X.fin[key] || {}; if (v === null) delete X.fin[key][pid]; else X.fin[key][pid] = v; }

/* значения с расчётными строками */
function val(key, pid) {
  const d = LINEDEF[key];
  if (key === "ta") { const a = ["cash", "ar", "inv", "oca", "fa"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "tle") { const a = ["ap", "debt_st", "debt_lt", "ol", "eq"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "ni") { const r = fv("rev", pid); if (!isNum(r)) return null; return r - N(fv("cogs", pid)) - N(fv("opex", pid)) + N(fv("oth", pid)) - N(fv("int", pid)) - N(fv("cit", pid)); }
  if (key === "debt") { const a = [fv("debt_st", pid), fv("debt_lt", pid)]; return a.some(isNum) ? sum(a) : null; }
  if (key === "ca") { const a = ["cash", "ar", "inv", "oca"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "cl") { const a = ["ap", "debt_st", "ol"].map(k => fv(k, pid)); return a.some(isNum) ? sum(a) : null; }
  if (key === "ebit") { const r = fv("rev", pid); if (!isNum(r)) return null; return r - N(fv("cogs", pid)) - N(fv("opex", pid)); }
  if (key === "ebitda") { const e = val("ebit", pid); return isNum(e) ? e + N(fv("da", pid)) : null; }
  return d ? fv(key, pid) : null;
}

/* ---------------------------------------------------------------- загрузка файлов */
// подсказки единиц: шапка формы и доля сумм с тиынами (как на основном сайте)
function unitHints(sheets) {
  let head = "", n = 0, fr = 0;
  for (const sh of sheets) {
    for (const row of sh.rows.slice(0, 25)) if (row) for (const v of row) if (typeof v === "string") head += " " + v.toLowerCase();
    for (const row of sh.rows) if (row) for (const v of row) if (typeof v === "number" && Math.abs(v) >= 1000) { n++; if (Math.abs(v - Math.round(v)) > 0.004) fr++; }
  }
  const u = /млн\.?\s*(тенге|тг)|миллион\S*\s+тенге/.test(head) ? "m" : /(тыс\S*|тысяч\S*)\s*(\.\s*)?(казахстанских\s+)?(тенге|тг)|в\s+тысячах/.test(head) ? "k" : /(в|единица\s+измерения:?)\s+тенге|,\s*тенге|\(тенге\)/.test(head) ? "t" : "";
  return { head: u, frac: n ? fr / n : 0 };
}
function autoFactor(mx, h) {
  // по уже введённым данным клиента — тот же масштаб
  const ref = []; for (const p of X.per) for (const k of ["rev"]) { const v = fv(k, p.id); if (isNum(v) && v > 0) ref.push(v); }
  for (const p of X.per) { const v = val("ta", p.id); if (isNum(v) && v > 0) ref.push(v); }
  if (ref.length && mx > 0) {
    const r = Math.max(...ref), best = [0.001, 1, 1000].map(f => [f, Math.abs(Math.log10(mx * f / r))]).sort((a, b) => a[1] - b[1])[0];
    if (best[1] < 1.5) return [best[0], "по масштабу уже введённых цифр"];
  }
  if (h.frac >= 0.3) return [0.001, "суммы с тиынами — значит, в тенге"];
  if (h.head === "m") return [1000, "в шапке указано «млн тенге»"];
  if (h.head === "k") return mx >= 1e9 ? [0.001, "в шапке «тыс. тенге», но числа слишком большие — тенге"] : [1, "в шапке указано «тыс. тенге»"];
  if (h.head === "t") return [0.001, "в шапке указано «тенге»"];
  if (mx >= 5e7) return [0.001, "по величине чисел — тенге"];
  return [1, "по величине чисел — тыс. тенге"];
}
const KIND_TXT = { B: "Баланс", P: "ОПиУ", C: "ДДС" };
const CF_IN = ["cf011", "cf012", "cf013", "cf014", "cf015", "cf016"], CF_OUT = ["cf021", "cf022", "cf023", "cf024", "cf025", "cf026", "cf027"];
const CF_FIN_IN = ["cf091", "cf092", "cf093", "cf094"], CF_FIN_OUT = ["cf101", "cf102", "cf103", "cf104", "cf105"];
// значения одной колонки формы → компактные строки
function formToLines(kind, f, prof, w) {
  const raw = {}, found = {};
  for (const m of S.mapping) {
    if (m[0] !== kind) continue;
    const spec = prof === 4 ? (m[6] || "") : m[prof === 1 ? 2 : 3];
    const r = evalSpec(spec, f, w);
    if (r.found) { raw[m[1]] = r.v; found[m[1]] = true; }
  }
  const out = {};
  const pick = keys => keys.some(k => found[k]) ? sum(keys.map(k => raw[k])) : null;
  for (const key of Object.keys(LINEDEF)) {
    const d = LINEDEF[key]; if (d.typ === "calc") continue;
    if ((kind === "B" && d.block !== "bal") || (kind === "P" && d.block !== "pl") || (kind === "C" && d.block !== "cf")) continue;
    let v = null;
    if (d.typ === "oth") { const p = ["ooi", "ooe", "fin_inc", "onoi_in", "onoi_out"]; if (p.some(k => found[k])) v = N(raw.ooi) - N(raw.ooe) + N(raw.fin_inc) + N(raw.onoi_in) - N(raw.onoi_out); }
    else if (d.typ === "ocf") { if ([...CF_IN, ...CF_OUT].some(k => found[k])) v = sum(CF_IN.map(k => raw[k])) - sum(CF_OUT.map(k => raw[k])); }
    else if (d.typ === "cfin") v = pick(CF_FIN_IN);
    else if (d.typ === "cfout") v = pick(CF_FIN_OUT);
    else if (d.src && d.src.length) v = pick(d.src);
    if (v !== null) out[key] = v;
  }
  return out;
}
async function readAnyFile(file) {
  const buf = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name)) {
    const pdf = await PdfReader.read(buf);
    if (pdf.noText) throw new Error("это скан без текста — сайт читает только PDF с текстовым слоем. Загрузите Excel или введите цифры вручную");
    return { pdf, sheets: pdfToSheets(pdf) };
  }
  return { pdf: null, sheets: await readWorkbook(buf) };
}
const FINKEYS_DECL = ["rev", "vat_turn", "vat_ex", "fot", "cit"];
/* один файл: финансовая отчётность (баланс/ОПиУ/ДДС) или налоговая декларация — определяется само */
async function importFile(file, pid, units) {
  if (!/\.(xlsx|xlsm|xls|pdf)$/i.test(file.name)) return [{ err: "формат не подходит — нужен Excel (.xlsx, .xls) или PDF" }];
  let r; try { r = await readAnyFile(file); } catch (e) { return [{ err: "не удалось прочитать: " + e.message }]; }
  // налоговая декларация?
  let dres = null;
  try { dres = r.pdf ? (DocParse.isDecl(r.pdf) >= 3 ? { kind: "decl", decl: DocParse.parseDecl(r.pdf) } : null) : null; } catch (e) { dres = null; }
  // финансовые формы
  const parsed = []; let lastKind = null; const used = [];
  for (const sh of r.sheets) {
    if (sh.hidden && r.sheets.length > 1) continue;
    let kind = detectKind(sh);
    if (kind === "X") { lastKind = null; continue; }
    if (!kind && lastKind) { const mc = mapCodes(lastKind); let n = 0; for (const row of sh.rows) if (row) for (const v of row) if (mc.has(normCode(v))) n++; if (n >= 3) kind = lastKind; }
    if (!kind) continue;
    lastKind = kind;
    const f = parseForm(sh, kind);
    const same = parsed.find(p => p.kind === kind);
    if (same) { if (!f.err) mergeForms(same.f, f); continue; }
    if (f.err) continue;
    used.push(sh); parsed.push({ kind, f });
  }
  if (!parsed.length && !dres && !r.pdf) {
    try { const d = DocParse.readSheets(r.sheets); if (d.kind === "decl") dres = d; } catch (e) { /* не декларация */ }
  }
  if (dres && dres.decl && (!parsed.length || (dres.decl.lines || []).length >= 10)) return [addDecl(dres.decl, file.name)];
  if (!parsed.length) return [{ err: "не нашёл ни баланса, ни ОПиУ, ни ДДС, ни декларации. Нужна стандартная форма с кодами строк — или введите цифры вручную" }];
  // единицы
  const mx = Math.max(...parsed.map(p => p.f.max));
  let factor, why;
  if (units && units !== "auto") { factor = { t: 0.001, k: 1, m: 1000 }[units]; why = "как указано при загрузке"; }
  else [factor, why] = autoFactor(mx, unitHints(used));
  const i = perIdx(pid), prev = i > 0 ? X.per[i - 1] : null, cur = X.per[i];
  const rep = [];
  for (const { kind, f } of parsed) {
    const prof = chooseProfile(f, kind);
    const cols = [[0, cur]];
    // вторая колонка (прошлый период): баланс — всегда; ОПиУ/ДДС — только если оба периода годовые
    if (f.hasPrev && prev && (kind === "B" || (N(cur.months) === 12 && N(prev.months) === 12))) cols.push([1, prev]);
    let n = 0, nPrev = 0;
    for (const [w, p] of cols) {
      const lines = formToLines(kind, f, prof, w);
      for (const [key, v] of Object.entries(lines)) {
        if (w === 1 && isNum(fv(key, p.id))) continue;     // не затираем то, что уже есть
        setFv(key, p.id, Math.round(v * factor * 10) / 10);
        if (w === 0) n++; else nPrev++;
      }
    }
    const uTxt = factor < 0.5 ? "в файле тенге — переведено в тыс. тг" : factor > 2 ? "в файле млн тг — переведено в тыс. тг" : "в файле тыс. тг";
    rep.push({ ok: true, kind, txt: `${KIND_TXT[kind]}: ${n} строк за ${perLabel(cur)}${nPrev ? `, ${nPrev} — за ${perLabel(prev)}` : ""}. ${uTxt} (${why}).` });
  }
  X.files.unshift({ name: file.name, t: Date.now(), what: rep.map(x => KIND_TXT[x.kind]).join(", "), per: perLabel(cur) });
  return rep;
}
function addDecl(d, fname) {
  const keys = DocParse.pickKeys(d, {}), vals = {};
  for (const [key, code] of Object.entries(keys)) { const l = d.lines.find(x => x.code === code); if (l && l.vals.length) vals[key] = l.vals[0]; }
  const o = { id: uid(), file: fname, form: d.form, formName: d.formName, year: d.year, part: d.part, vals };
  // та же декларация повторно — заменяем
  X.decl = X.decl.filter(x => !(x.form === o.form && x.year === o.year && x.part === o.part));
  X.decl.push(o);
  X.files.unshift({ name: fname, t: Date.now(), what: "Декларация " + (d.formName || ""), per: String(d.year || "") });
  const r = vals.rev ?? vals.vat_turn;
  return { ok: true, kind: "D", txt: `${d.formName || "Декларация"} за ${d.year || "год не определён"}${PART_TXT[d.part] ? ", " + PART_TXT[d.part] : ""}${isNum(r) ? ": доход " + fmt(r / 1000) + " тыс. тг" : ": доход не найден — введите вручную"}.` };
}
const PART_TXT = { Y: "год", H1: "1 полугодие", H2: "2 полугодие", Q1: "1 квартал", Q2: "2 квартал", Q3: "3 квартал", Q4: "4 квартал" };
