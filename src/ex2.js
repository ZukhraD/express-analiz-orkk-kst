"use strict";
/* ================================================================ Экспресс-анализ: расчёты, проблемы, вердикт.
   Пороговые значения собраны здесь, чтобы их легко было поменять под методику банка. */
const NORM = {
  dscr_ok: 1.25, dscr_min: 1.0,            // покрытие платежей
  lev_ok: 3.5, lev_max: 5,                 // долг / EBITDA (с новым кредитом)
  liq_ok: 1.0, liq_min: 0.7,               // текущая ликвидность
  eq_ok: 0.2, eq_min: 0.1,                 // доля собственного капитала
  rev_drop_chk: -0.1, rev_drop_risk: -0.2, // падение выручки
  wc_term: 36,                             // макс. срок для пополнения оборотных средств, мес.
  wc_share: 0.5,                           // сумма кредита к годовой выручке — проверить, если больше
  diff_pct: 0.1, diff_abs: 1000,           // расхождение: больше 10 % и больше 1 000 тыс. тг
};
const SEVW = { crit: 4, risk: 3, chk: 2, nd: 1, ok: 0 };
const SEVT = { crit: "Стоп-фактор", risk: "Риск", chk: "Проверить", nd: "Нет данных", ok: "Норма" };

/* ---------------------------------------------------------------- платёж по новому кредиту */
function loanPay(c = X.card) {
  const A = N(c.amount), n = Math.max(1, N(c.term) - N(c.grace)), r = N(c.rate) / 100 / 12;
  if (!A || !N(c.term)) return null;
  if (c.product === "Кредитная линия" || c.product === "Овердрафт") {
    // линия: считаем как кредит на срок (консервативно); овердрафт — только проценты
    if (c.product === "Овердрафт") return { pay: A * r, first: A * r, grace: 0, note: "только проценты (овердрафт гасится оборотами)" };
  }
  if (c.sched === "end") return { pay: A * r, first: A * r, grace: A * r, balloon: A, note: "ежемесячно только проценты, долг — одной суммой в конце срока" };
  if (c.sched === "diff") return { pay: A / n + A * r, first: A / n + A * r, grace: A * r, note: "первый платёж самый большой, потом уменьшается" };
  const p = r ? A * r / (1 - Math.pow(1 + r, -n)) : A / n;
  return { pay: p, first: p, grace: A * r, note: "равными платежами" };
}
// какую сумму можно обслуживать при заданном ежемесячном платеже (те же условия)
function amountForPay(pay, c = X.card) {
  if (!(pay > 0)) return 0;
  const n = Math.max(1, N(c.term) - N(c.grace)), r = N(c.rate) / 100 / 12;
  if (c.product === "Овердрафт" || c.sched === "end") return r ? pay / r : 0;
  if (c.sched === "diff") return pay / (1 / n + r);
  return r ? pay * (1 - Math.pow(1 + r, -n)) / r : pay * n;
}
const monthsBetween = (iso, ref = new Date()) => { const d = new Date(iso); if (!iso || isNaN(d)) return null; return (ref.getFullYear() - d.getFullYear()) * 12 + ref.getMonth() - d.getMonth(); };

/* ---------------------------------------------------------------- основной расчёт */
function analyze() {
  const c = X.card, P = X.per;
  const withRev = P.filter(p => isNum(fv("rev", p.id)));
  const withBal = P.filter(p => isNum(val("ta", p.id)));
  const pl = withRev[withRev.length - 1] || null, bal = withBal[withBal.length - 1] || null;
  const fulls = withRev.filter(p => N(p.months) === 12);
  const yr = fulls[fulls.length - 1] || null, yr0 = fulls[fulls.length - 2] || null;
  const k = pl ? 12 / (N(pl.months) || 12) : 1;             // перевод в годовое выражение
  const m = { pl, bal, yr, yr0, k };
  if (pl) {
    m.rev = fv("rev", pl.id) * k; m.ni = val("ni", pl.id) * k; m.ebit = val("ebit", pl.id) * k;
    m.da = fv("da", pl.id); m.daKnown = isNum(m.da); m.ebitda = val("ebitda", pl.id) * k;
    m.cit = N(fv("cit", pl.id)) * k; m.int = N(fv("int", pl.id)) * k;
    m.gm = m.rev ? (m.rev - N(fv("cogs", pl.id)) * k) / m.rev : null;
    m.nm = m.rev ? m.ni / m.rev : null;
    m.cashYear = m.ebitda - m.cit;                         // деньги, которые бизнес зарабатывает за год до платежей по кредитам
    m.cashMonth = m.cashYear / 12;
    m.ocf = fv("ocf", pl.id); if (isNum(m.ocf)) m.ocf *= k;
  }
  if (yr && yr0) { const a = fv("rev", yr0.id), b = fv("rev", yr.id); m.revGr = a ? b / a - 1 : null; }
  if (bal) {
    m.ta = val("ta", bal.id); m.eq = fv("eq", bal.id); m.debt = N(val("debt", bal.id));
    m.ca = val("ca", bal.id); m.cl = val("cl", bal.id);
    m.liq = m.cl ? m.ca / m.cl : null; m.eqr = m.ta ? N(m.eq) / m.ta : null;
  }
  // кредиты
  m.payKnown = isNum(c.payExist) || (c.loans || []).length > 0;
  m.payExist = isNum(c.payExist) ? c.payExist : sum((c.loans || []).filter(l => !l.refin).map(l => l.pay));
  m.newPay = loanPay();
  m.payTotal = m.payExist + (m.newPay ? m.newPay.pay : 0);
  if (isNum(m.cashMonth)) {
    m.dscr = m.payTotal > 0 ? m.cashMonth / m.payTotal : null;
    m.payFree = m.cashMonth / NORM.dscr_ok - m.payExist;    // сколько ещё можно платить в месяц с запасом 25 %
    m.maxAmt = Math.max(0, amountForPay(m.payFree));
  }
  m.debtNew = m.debt + N(c.amount);
  if (isNum(m.ebitda) && m.ebitda > 0) m.lev = m.debtNew / m.ebitda;
  return m;
}

/* ---------------------------------------------------------------- проблемы и расхождения */
function problems(m = analyze()) {
  const c = X.card, out = [];
  const add = (sev, area, title, why, todo) => out.push({ sev, area, title, why, todo });
  const T = v => fmt(v) + " тыс. тг";
  // полнота
  if (!c.name) add("nd", "Карточка", "Не указано наименование клиента", "Без названия заключение будет неполным.", "Заполните «Карточку клиента».");
  if (!N(c.amount) || !N(c.term)) add("nd", "Карточка", "Не указаны сумма или срок кредита", "Без суммы и срока нельзя посчитать будущий платёж и хватит ли на него денег.", "Укажите сумму, срок и ставку в «Карточке клиента».");
  if (!m.pl) add("nd", "Отчётность", "Нет данных о выручке и прибыли (ОПиУ)", "Без отчёта о прибылях и убытках нельзя понять, зарабатывает ли бизнес.", "Загрузите ОПиУ или внесите цифры вручную в «Финансовой отчётности».");
  if (!m.bal) add("nd", "Отчётность", "Нет баланса", "Без баланса не видно долгов, собственных средств и имущества компании.", "Загрузите баланс или внесите цифры вручную.");
  // стоп-факторы
  if (m.bal && isNum(m.eq) && m.eq < 0) add("crit", "Капитал", "Отрицательный собственный капитал", `Долгов у компании больше, чем всего имущества: капитал ${T(m.eq)}. Накопленные убытки «съели» собственные средства.`, "Обычно это стоп-фактор. Уточнить у риск-менеджера, возможно ли финансирование при докапитализации учредителем.");
  // платёжеспособность
  if (isNum(m.dscr)) {
    if (m.dscr < NORM.dscr_min) add("crit", "Платёжеспособность", "Денег не хватает на платежи по кредитам", `Бизнес зарабатывает ~${T(m.cashMonth)} в месяц, а платить по всем кредитам (вместе с новым) нужно ~${T(m.payTotal)}. Покрытие ${fmt(m.dscr, "x")} — меньше 1.`, m.maxAmt > 0 ? `Снизить сумму до ~${T(Math.floor(m.maxAmt / 100) * 100)} или увеличить срок; проверить, нет ли неучтённых доходов (обороты по счетам).` : "При текущих доходах новый кредит не обслуживается. Проверить обороты по счетам и возможность рефинансирования.");
    else if (m.dscr < NORM.dscr_ok) add("chk", "Платёжеспособность", "Запас по платежам маленький", `Покрытие платежей ${fmt(m.dscr, "x")}: денег хватает впритык, нужно не меньше ${fmt(NORM.dscr_ok, "x")}.`, `Рассмотреть сумму до ~${T(Math.floor(m.maxAmt / 100) * 100)} или больший срок; подтвердить выручку выписками.`);
  } else if (m.pl && m.payTotal > 0 && m.cashMonth <= 0) add("crit", "Платёжеспособность", "Бизнес не зарабатывает денег на платежи", "Операционный результат отрицательный — платить по кредитам не из чего.", "Без подтверждённого источника погашения заявку не вести.");
  if (m.pl && !m.daKnown) add("nd", "Отчётность", "Не указана амортизация", "Без неё денежный поток считается по прибыли — это осторожная (заниженная) оценка.", "Если есть ДДС или пояснения к отчётности — внесите амортизацию в ОПиУ.");
  if (isNum(m.lev)) {
    if (m.lev > NORM.lev_max) add("risk", "Долговая нагрузка", "Слишком много долгов относительно заработка", `Все долги с новым кредитом (${T(m.debtNew)}) в ${fmt(m.lev, "1")} раза больше годового заработка (EBITDA ${T(m.ebitda)}). Норма — до ${fmt(NORM.lev_ok, "1")}.`, "Снизить сумму или рассмотреть рефинансирование действующих долгов.");
    else if (m.lev > NORM.lev_ok) add("chk", "Долговая нагрузка", "Долговая нагрузка повышенная", `Долги в ${fmt(m.lev, "1")} раза больше годового заработка (норма до ${fmt(NORM.lev_ok, "1")}).`, "Учесть в заключении; проверить, на что пойдёт кредит и даст ли он рост выручки.");
  } else if (m.pl && m.ebitda <= 0 && (m.debtNew > 0)) add("risk", "Долговая нагрузка", "Заработка нет, а долги есть", "Операционный результат отрицательный, поэтому долги обслуживать не из чего.", "Выяснить причины убытка и источник погашения.");
  // прибыль и выручка
  if (m.pl && m.ni < 0) add("risk", "Прибыль", "Компания работает в убыток", `Чистый убыток ${T(m.ni)} за ${perLabel(m.pl)}${m.k !== 1 ? " (в годовом выражении)" : ""}.`, "Узнать причину (разовые расходы, сезонность, рост затрат) и есть ли улучшение в текущем году.");
  if (isNum(m.revGr)) {
    if (m.revGr <= NORM.rev_drop_risk) add("risk", "Выручка", "Выручка сильно упала", `За ${perLabel(m.yr)} выручка снизилась на ${fmt(-m.revGr, "p")} к ${perLabel(m.yr0)}.`, "Узнать причину; запросить выручку за текущий год (выписки, декларации).");
    else if (m.revGr <= NORM.rev_drop_chk) add("chk", "Выручка", "Выручка снизилась", `Снижение на ${fmt(-m.revGr, "p")} к прошлому году.`, "Уточнить причину у клиента.");
  }
  if (isNum(m.ocf) && m.ocf < 0) add("risk", "Деньги", "Отрицательный денежный поток от основной деятельности", `По ДДС бизнес за год потратил на основную деятельность больше, чем получил: ${T(m.ocf)}. Прибыль «на бумаге» может не превращаться в деньги.`, "Проверить рост дебиторки и запасов; подтвердить поступления выписками.");
  // баланс
  if (isNum(m.liq)) {
    if (m.liq < NORM.liq_min) add("risk", "Ликвидность", "Текущих долгов намного больше, чем быстрых активов", `Коэффициент текущей ликвидности ${fmt(m.liq, "x")}: на 1 тенге долгов до года приходится ${fmt(m.liq, "x")} тенге денег, дебиторки и запасов.`, "Проверить, не придётся ли гасить краткосрочные долги за счёт нового кредита.");
    else if (m.liq < NORM.liq_ok) add("chk", "Ликвидность", "Ликвидность ниже нормы", `Коэффициент ${fmt(m.liq, "x")} (норма от ${fmt(NORM.liq_ok, "x")}).`, "Учесть в заключении.");
  }
  if (isNum(m.eqr) && N(m.eq) >= 0) {
    if (m.eqr < NORM.eq_min) add("risk", "Капитал", "Почти всё имущество куплено на заёмные деньги", `Собственный капитал — только ${fmt(m.eqr, "p")} от активов (норма от ${fmt(NORM.eq_ok, "p")}).`, "Уточнить возможность вложений учредителя.");
    else if (m.eqr < NORM.eq_ok) add("chk", "Капитал", "Мало собственного капитала", `Капитал ${fmt(m.eqr, "p")} от активов (норма от ${fmt(NORM.eq_ok, "p")}).`, "Учесть в заключении.");
  }
  // условия
  if (c.purpose === PURPOSES[0] && N(c.term) > NORM.wc_term) add("chk", "Условия", "Длинный срок для пополнения оборотки", `Срок ${c.term} мес.; для оборотных средств обычно не больше ${NORM.wc_term}.`, "Уточнить срок по программе.");
  if (m.pl && N(c.amount) && c.purpose === PURPOSES[0] && N(c.amount) > m.rev * NORM.wc_share) add("chk", "Условия", "Сумма велика для оборота компании", `Запрашивают ${T(c.amount)} — это ${fmt(N(c.amount) / m.rev, "p")} годовой выручки.`, "Попросить клиента обосновать потребность (контракты, план закупок).");
  if (c.sched === "end" && N(c.amount) && c.product === "Кредит") add("chk", "Условия", "Погашение долга одной суммой в конце", `В конце срока нужно будет вернуть сразу ${T(c.amount)}.`, "Понять, из каких денег будет погашение (контракт, сезон, рефинансирование).");

  /* --- расхождения (сверки) */
  const big = (a, b) => isNum(a) && isNum(b) && Math.abs(a - b) > NORM.diff_abs && Math.abs(a - b) > NORM.diff_pct * Math.max(Math.abs(a), Math.abs(b));
  for (const p of X.per) {
    const ta = val("ta", p.id), tle = val("tle", p.id), L = perLabel(p);
    if (isNum(ta) && isNum(tle) && Math.abs(ta - tle) > Math.max(5, 0.005 * ta)) add("chk", "Расхождения", `Баланс не сходится (${L})`, `Активы ${T(ta)}, а пассивы ${T(tle)} — разница ${T(ta - tle)}. Скорее всего, ошибка при вводе или загрузке.`, "Сверить строки с документом.");
    const tr = fv("ta_rep", p.id);
    if (isNum(ta) && isNum(tr) && Math.abs(ta - tr) > Math.max(5, 0.005 * tr)) add("chk", "Расхождения", `Итог активов не совпадает с отчётностью (${L})`, `По строкам ${T(ta)}, в документе ${T(tr)}.`, "Проверить, все ли строки баланса заполнены.");
    const ni = val("ni", p.id), nr = fv("ni_rep", p.id);
    if (isNum(ni) && isNum(nr) && Math.abs(ni - nr) > Math.max(5, 0.02 * Math.abs(nr))) add("chk", "Расхождения", `Чистая прибыль не совпадает с отчётностью (${L})`, `По строкам ${T(ni)}, в документе ${T(nr)}.`, "Проверить прочие доходы/расходы и налог.");
  }
  // долг по балансу и взнос по кредитам
  if (m.bal && !m.payKnown && m.debt > NORM.diff_abs) add("chk", "Платёжеспособность", "Не указан взнос по действующим кредитам", `В балансе кредитов и займов на ${T(m.debt)}, а ежемесячный взнос по ним не указан — платёжеспособность получится завышенной.`, "Узнать у клиента примерную сумму платежей в месяц и внести в «Запрашиваемые условия».");
  if (m.bal && m.payKnown && m.payExist === 0 && m.debt > NORM.diff_abs) add("chk", "Расхождения", "Кредиты в балансе есть, а взнос указан нулевой", `В балансе кредитов и займов на ${T(m.debt)}.`, "Уточнить у клиента: возможно, это заём учредителя без графика или кредит уже погашен.");
  if (m.pl && m.debt > NORM.diff_abs && !m.int) add("chk", "Расхождения", "Есть кредиты, но нет расходов на проценты", "В балансе есть займы, а в ОПиУ проценты не отражены.", "Уточнить: беспроцентный заём учредителя или ошибка в отчётности.");
  // нераспределённая прибыль vs чистая прибыль
  if (m.yr && m.yr0) {
    const d = N(fv("re", m.yr.id)) - N(fv("re", m.yr0.id)), ni = val("ni", m.yr.id);
    if (isNum(fv("re", m.yr.id)) && isNum(fv("re", m.yr0.id)) && big(d, ni)) add("chk", "Расхождения", "Прибыль не «дошла» до капитала", `Чистая прибыль за ${perLabel(m.yr)} — ${T(ni)}, а нераспределённая прибыль изменилась на ${T(d)}.`, d < ni ? "Возможно, выплачены дивиденды — уточнить сумму (это деньги, ушедшие из бизнеса)." : "Возможны корректировки прошлых лет — уточнить у бухгалтера.");
    // дебиторка растёт быстрее выручки
    const a0 = fv("ar", m.yr0.id), a1 = fv("ar", m.yr.id);
    if (isNum(a0) && isNum(a1) && a0 > 0 && isNum(m.revGr) && a1 / a0 - 1 > m.revGr + 0.3) add("chk", "Расхождения", "Дебиторская задолженность растёт быстрее выручки", `Дебиторка выросла на ${fmt(a1 / a0 - 1, "p")}, а выручка — на ${fmt(m.revGr, "p")}. Покупатели стали дольше платить или часть продаж «на бумаге».`, "Запросить расшифровку дебиторки: крупные должники и сроки.");
  }
  // декларации vs ОПиУ
  for (const s of declYears()) {
    const p = X.per.find(pp => N(pp.months) === 12 && pp.date && pp.date.startsWith(String(s.year)) && isNum(fv("rev", pp.id)));
    if (!p) continue;
    const r = fv("rev", p.id);
    if (isNum(s.rev) && big(r, s.rev)) add("chk", "Расхождения", `Выручка в отчётности не совпадает с декларацией (${s.year})`, `В ОПиУ ${T(r)}, в декларации (${s.forms}) ${T(s.rev)} — разница ${fmt(Math.abs(r / s.rev - 1), "p")}.`, r > s.rev ? "Выручка в отчётности больше, чем показано налоговой — уточнить причину; верить меньшей цифре." : "В декларации доход больше — проверить, полная ли отчётность (может быть другая деятельность).");
    if (isNum(s.vat) && s.vat > 0 && r > s.vat * (1 + NORM.diff_pct) && r - s.vat > NORM.diff_abs) add("chk", "Расхождения", `Оборот по НДС меньше выручки (${s.year})`, `Оборот по декларациям НДС ${T(s.vat)}, выручка ${T(r)}.`, "Проверить, все ли кварталы 300.00 загружены.");
  }
  return out.sort((a, b) => SEVW[b.sev] - SEVW[a.sev]);
}
// декларации по годам (тыс. тг)
function declYears() {
  const by = {};
  for (const d of X.decl || []) {
    if (!d.year) continue;
    const y = by[d.year] = by[d.year] || { year: d.year, rev: null, vat: null, parts: {}, forms: new Set() };
    const v = d.vals || {};
    if (isNum(v.rev) && ["100", "110", "910", "220", "150", "913"].includes(d.form)) { const key = d.form + d.part; if (!y.parts[key]) { y.parts[key] = 1; y.rev = N(y.rev) + v.rev / 1000; y.forms.add(d.form + ".00"); } }
    if (d.form === "300" && (isNum(v.vat_turn) || isNum(v.vat_ex))) { y.vat = N(y.vat) + (N(v.vat_turn) + N(v.vat_ex)) / 1000; }
  }
  return Object.values(by).map(y => ({ ...y, forms: [...y.forms].join(", ") })).sort((a, b) => a.year - b.year);
}

/* ---------------------------------------------------------------- вердикт */
function verdict(probs) {
  const has = s => probs.some(p => p.sev === s), n = s => probs.filter(p => p.sev === s).length;
  const ess = probs.filter(p => p.sev === "nd" && /ОПиУ|баланса|сумма или срок/.test(p.title));
  if (ess.length) return { sev: "nd", icon: "?", title: "Недостаточно данных для вывода", text: "Заполните недостающее: " + ess.map(p => p.title.toLowerCase()).join("; ") + "." };
  if (has("crit")) return { sev: "crit", icon: "✕", title: "Предварительно не подходит", text: "Есть стоп-фактор(ы). Без их устранения заявку дальше не вести." };
  if (n("risk") >= 2) return { sev: "risk", icon: "!", title: "Сомнительно — нужна доработка", text: "Несколько серьёзных рисков. Возможна заявка на других условиях: меньше сумма, больше срок, дополнительное обеспечение." };
  if (has("risk")) return { sev: "chk", icon: "!", title: "Подходит с условиями", text: "Есть один серьёзный риск — его нужно закрыть до подачи заявки." };
  if (has("chk")) return { sev: "chk", icon: "✓", title: "Предварительно подходит, нужны уточнения", text: "Критичных проблем нет, но есть вопросы, которые надо прояснить с клиентом." };
  return { sev: "ok", icon: "✓", title: "Предварительно подходит", text: "Критичных проблем и расхождений не найдено. Можно собирать полный пакет документов." };
}
