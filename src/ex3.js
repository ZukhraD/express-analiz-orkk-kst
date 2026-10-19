"use strict";
/* ================================================================ Экспресс-анализ: интерфейс */
const $ = (s, el = document) => el.querySelector(s);
let PAGE = "card", UPL = { pid: null, units: "auto", log: [] };
const PAGES = [["card", "Карточка клиента"], ["fin", "Финансовая отчётность"], ["an", "Анализ"], ["prob", "Проблемы"], ["concl", "Заключение"]];
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2800); }
const tip = t => `<span class="tip" title="${esc(t)}">?</span>`;
const T = v => isNum(v) ? fmt(v) : "—";
const num = (v, key, extra = "") => `<input class="inp num" inputmode="decimal" data-k="${key}" value="${isNum(v) ? fmt(v, Math.abs(v) < 100 && v % 1 ? "1" : "m") : ""}" ${extra}>`;
const fld = (label, inner, cls = "") => `<label class="fld ${cls}"><span>${label}</span>${inner}</label>`;
const opts = (list, cur) => list.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(t)}</option>`; }).join("");

/* ---------------------------------------------------------------- главная */
function renderHome() {
  X = null;
  const list = CLIENTS.slice().sort((a, b) => b.updated - a.updated);
  document.body.innerHTML = `<div class="home">
    <div class="hero"><h1>Экспресс-анализ для КМ</h1>
      <p>Быстро понять, подходит ли клиент для финансирования, ещё до сбора полного пакета документов. Внесите данные клиента и запрос, загрузите баланс и ОПиУ — сайт сам посчитает показатели, подсветит проблемы и расхождения и напишет заключение простым языком.</p>
      <div class="row"><button class="btn primary big" data-act="new">+ Новый клиент</button><button class="btn alt big" data-act="demo">Пример для заполнения</button><button class="btn alt2 big" data-act="openfile">Открыть файл клиента</button></div></div>
    <div class="how">${PAGES.map(([, t], i) => `<div><b><em>${i + 1}</em>${t}</b><span>${["данные клиента, запрос, залог, текущие кредиты", "загрузка Excel/PDF или ввод цифр, декларации", "ключевые показатели и сколько можно дать", "что не так и что уточнить у клиента", "итог для руководителя — можно править и печатать"][i]}</span></div>`).join("")}</div>
    <h2 style="margin-bottom:10px">Клиенты</h2>
    ${list.length ? `<div class="clist">${list.map(c => { const v = clientVerdict(c); return `<div class="citem" data-open="${c.id}"><div class="nm"><b>${esc(c.card.name || "Без названия")}${c.demo ? ' <span class="tag nd">пример</span>' : ""}</b><span class="small muted">${esc([c.card.bin, c.card.product, isNum(c.card.amount) ? fmt(c.card.amount) + " тыс. тг" : ""].filter(Boolean).join(" · "))} · изменён ${new Date(c.updated).toLocaleDateString("ru-RU")}</span></div><span class="tag ${v.sev}">${esc(v.title)}</span><button class="xbtn" title="Удалить" data-del="${c.id}">×</button></div>`; }).join("")}</div>`
      : `<div class="empty">Пока нет клиентов. Нажмите «Новый клиент» или посмотрите «Пример для заполнения».</div>`}
    <p class="small muted" style="margin-top:20px">Данные хранятся только в этом браузере на этом компьютере и никуда не отправляются. Регистрация не нужна. Чтобы перенести клиента на другой компьютер — кнопка «Сохранить в файл» внутри клиента. Все суммы — в тыс. тенге.</p>
  </div><div id="toast"></div><input type="file" id="ofile" accept=".json" class="hidden">`;
}
function clientVerdict(c) { const keep = X; X = c; let v; try { v = verdict(problems()); } catch (e) { v = { sev: "nd", title: "—" }; } X = keep; return v; }

/* ---------------------------------------------------------------- оболочка клиента */
function renderClient() {
  const pr = problems(), v = verdict(pr);
  const dots = { card: X.card.name && N(X.card.amount) ? "ok" : "nd", fin: X.per.some(p => isNum(fv("rev", p.id))) ? "ok" : "nd", an: v.sev, prob: pr.some(p => p.sev === "crit") ? "crit" : pr.some(p => p.sev === "risk") ? "risk" : pr.some(p => p.sev === "chk") ? "chk" : "ok", concl: v.sev };
  const body = { card: pageCard, fin: pageFin, an: pageAn, prob: pageProb, concl: pageConcl }[PAGE](pr, v);
  document.body.innerHTML = `<div class="app"><nav class="rail">
    <div class="brand"><span>Экспресс-анализ<small>для кредитного менеджера</small></span></div>
    <div class="client"><b>${esc(X.card.name || "Новый клиент")}</b><button data-act="home">← ко всем клиентам</button></div>
    <ol class="steps">${PAGES.map(([id, t]) => `<li><button data-page="${id}"${PAGE === id ? ' aria-current="page"' : ""}>${t}<span class="dot ${dots[id]}"></span></button></li>`).join("")}</ol>
    <div class="foot"><button class="btn ghost" style="padding-left:0" data-act="save">Сохранить в файл</button><br>Все суммы — тыс. тг. Данные только в этом браузере.</div>
  </nav><main class="main">${body}</main></div><div id="toast"></div><input type="file" id="ufile" multiple accept=".xlsx,.xlsm,.xls,.pdf" class="hidden">`;
  const cur = document.querySelector('.steps [aria-current="page"]'); if (cur && window.innerWidth <= 860) cur.scrollIntoView({ inline: "center", block: "nearest" });
  if (PAGE === "concl") { const ta = $("#concl"); if (ta) ta.style.height = Math.max(560, ta.scrollHeight + 10) + "px"; }
}
// перерисовка с сохранением фокуса и прокрутки
function rerender() {
  const a = document.activeElement, key = a && a.dataset ? a.dataset.k : null, y = window.scrollY, ms = $(".main")?.scrollTop;
  renderClient();
  window.scrollTo(0, y); if ($(".main") && ms) $(".main").scrollTop = ms;
  if (key) { const el = document.querySelector(`[data-k="${CSS.escape(key)}"]`); if (el) { el.focus(); if (el.matches("input.num")) el.select(); else if (el.tagName === "INPUT" && /text|search/.test(el.type) && el.setSelectionRange) { const n = el.value.length; el.setSelectionRange(n, n); } } }
}

/* ---------------------------------------------------------------- 1. Карточка */
function pageCard() {
  const c = X.card, m = analyze(), lp = m.newPay;
  const cin = (f, ph = "", type = "text") => `<input class="inp" type="${type}" data-k="c.${f}" value="${esc(c[f] ?? "")}" placeholder="${esc(ph)}">`;
  const cnum = (f, ph = "") => num(c[f], "c." + f, ph ? `placeholder="${esc(ph)}"` : "");
  const csel = (f, list) => `<select class="inp" data-k="c.${f}">${opts(list, c[f])}</select>`;
  const loans = c.loans || [], coll = c.coll || [], guar = c.guar || [];
  return `<div class="pagehead"><div class="lead"><h1>Карточка клиента</h1><p>Кто клиент, что он просит и какие у него уже есть кредиты. Серые поля заполняете вы; суммы — в тыс. тенге.</p></div></div>
  <section class="panel"><h2>Клиент</h2><p class="hint">Данные из регистрационных документов или со слов клиента.</p>
    <div class="grid">
      ${fld("Наименование", cin("name", "ТОО «…»"))}
      ${fld("Форма", csel("form", ["ТОО", "ИП", "АО", "КХ / ФХ", "Другое"]))}
      ${fld("БИН / ИИН", cin("bin", "12 цифр"))}
      ${fld("Дата регистрации", cin("regDate", "", "date"))}
      ${fld("Вид деятельности", cin("activity", "чем занимается"), "wide")}
      ${fld("Руководитель", cin("director"))}
      ${fld("Учредители (доли)", cin("owners", "ФИО — 100 %"))}
      ${fld("Контакт клиента", cin("phone"))}
      ${fld("Кредитный менеджер", cin("km"))}
    </div></section>
  <section class="panel"><h2>Запрашиваемые условия</h2><p class="hint">Что просит клиент. По этим цифрам считается будущий ежемесячный платёж.</p>
    <div class="grid">
      ${fld("Продукт", csel("product", PRODUCTS))}
      ${fld("Цель", csel("purpose", PURPOSES))}
      ${fld("Программа финансирования", `<input class="inp" list="progs" data-k="c.program" value="${esc(c.program || "")}"><datalist id="progs">${PROGRAMS.map(p => `<option value="${esc(p)}">`).join("")}</datalist>`)}
      ${fld("Сумма займа, тыс. тг", cnum("amount"))}
      ${fld("Срок, мес.", cnum("term"))}
      ${fld("Ставка, % годовых", cnum("rate"))}
      ${fld("Погашение", csel("sched", Object.entries(SCHED)))}
      ${fld("Льготный период по долгу, мес.", cnum("grace", "0"))}
      ${fld(`Гарантия фонда, % от суммы <i>(если есть)</i>`, cnum("guarPct", "например, 50"))}
      ${fld("Ежемесячный платёж по новому кредиту", `<div class="calcbox">${lp ? fmt(lp.pay) + " тыс. тг" : "— укажите сумму, срок и ставку"}</div>${lp ? `<span class="small muted">${esc(lp.note)}${N(c.grace) ? `; в льготный период ~${fmt(lp.grace)} тыс. тг` : ""}</span>` : ""}`)}
    </div></section>
  <section class="panel"><h2>Взносы по действующим кредитам</h2><p class="hint">Все кредиты, займы и лизинг компании (и учредителя, если он гасит их из денег бизнеса). Платёж — примерный ежемесячный. Если кредит будет погашен новым — отметьте «рефинансируется».</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">Кредитор</th><th class="l">Вид</th><th>Остаток долга</th><th>Платёж в месяц</th><th class="l">Погашение до</th><th class="l">Просрочки</th><th class="l">Рефинанси&shy;руется</th><th></th></tr></thead><tbody>
    ${loans.map((l, i) => `<tr><td class="c"><input class="inp txt" data-k="a.loans.${i}.bank" value="${esc(l.bank || "")}" placeholder="банк / МФО / лизинг"></td>
      <td class="c"><select class="inp" data-k="a.loans.${i}.kind">${opts(["Кредит", "Кредитная линия", "Овердрафт", "Лизинг", "Заём", "Кредитная карта"], l.kind)}</select></td>
      <td class="c">${num(l.balance, `a.loans.${i}.balance`)}</td><td class="c">${num(l.pay, `a.loans.${i}.pay`)}</td>
      <td class="c"><input class="inp txt" type="month" data-k="a.loans.${i}.end" value="${esc(l.end || "")}"></td>
      <td class="c"><select class="inp" data-k="a.loans.${i}.overdue">${opts(Object.entries(OVERDUE), l.overdue || "no")}</select></td>
      <td style="text-align:center"><input type="checkbox" data-k="a.loans.${i}.refin"${l.refin ? " checked" : ""}></td>
      <td class="x"><button class="xbtn" data-rm="loans.${i}" title="Удалить">×</button></td></tr>`).join("")}
    ${loans.length ? `<tr class="tot"><td class="l" colspan="2">Итого</td><td>${T(m.loanBal)}</td><td>${T(sum(loans.map(l => l.pay)))}</td><td colspan="4" class="l small">${m.refinBal ? `рефинансируется ${fmt(m.refinBal)}; ` : ""}платежи без рефинансируемых: ${T(m.payExist)}</td></tr>` : `<tr><td colspan="8" class="l muted">Действующих кредитов нет — или добавьте их.</td></tr>`}
    </tbody></table></div><div class="row" style="margin-top:10px"><button class="btn" data-add="loans">+ Кредит</button></div></section>
  <section class="panel"><h2>Залог и залогодатели</h2><p class="hint">Дисконт подставляется по виду залога — его можно изменить под правила банка. Залоговая стоимость = рыночная × (1 − дисконт).</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">Вид залога</th><th class="l">Описание</th><th class="l">Залогодатель</th><th>Рыночная стоимость</th><th>Дисконт, %</th><th>Залоговая стоимость</th><th></th></tr></thead><tbody>
    ${coll.map((z, i) => `<tr><td class="c"><select class="inp" data-k="a.coll.${i}.type">${opts(Object.keys(COLL), z.type)}</select></td>
      <td class="c"><input class="inp txt" data-k="a.coll.${i}.desc" value="${esc(z.desc || "")}" placeholder="адрес, марка, площадь"></td>
      <td class="c"><input class="inp txt" data-k="a.coll.${i}.owner" value="${esc(z.owner || "")}" placeholder="сам клиент / ФИО"></td>
      <td class="c">${num(z.value, `a.coll.${i}.value`)}</td><td class="c">${num(z.disc, `a.coll.${i}.disc`)}</td>
      <td>${T(N(z.value) * (1 - N(z.disc) / 100))}</td><td class="x"><button class="xbtn" data-rm="coll.${i}">×</button></td></tr>`).join("")}
    ${coll.length ? `<tr class="tot"><td class="l" colspan="3">Итого</td><td>${T(m.collMkt)}</td><td></td><td>${T(m.collDisc)}</td><td></td></tr>` : `<tr><td colspan="7" class="l muted">Залог не добавлен.</td></tr>`}
    </tbody></table></div><div class="row" style="margin-top:10px"><button class="btn" data-add="coll">+ Залог</button>${N(c.amount) ? `<span class="small muted">Покрытие суммы займа: <b>${isNum(m.coll) ? fmt(m.coll, "p") : "—"}</b>${m.guarAmt ? ` (включая гарантию фонда ${fmt(m.guarAmt)} тыс. тг)` : ""}</span>` : ""}</div></section>
  <section class="panel"><h2>Гаранты</h2><p class="hint">Кто ещё отвечает по кредиту: учредитель, супруг(а), связанная компания.</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">ФИО / наименование</th><th class="l">Тип</th><th class="l">Связь с клиентом</th><th class="l">Доход / имущество (кратко)</th><th></th></tr></thead><tbody>
    ${guar.map((g, i) => `<tr><td class="c"><input class="inp txt" data-k="a.guar.${i}.name" value="${esc(g.name || "")}"></td>
      <td class="c"><select class="inp" data-k="a.guar.${i}.type">${opts(["Физическое лицо", "Юридическое лицо"], g.type)}</select></td>
      <td class="c"><input class="inp txt" data-k="a.guar.${i}.rel" value="${esc(g.rel || "")}" placeholder="учредитель, супруг(а)…"></td>
      <td class="c"><input class="inp txt" data-k="a.guar.${i}.note" value="${esc(g.note || "")}"></td>
      <td class="x"><button class="xbtn" data-rm="guar.${i}">×</button></td></tr>`).join("") || `<tr><td colspan="5" class="l muted">Гарантов нет.</td></tr>`}
    </tbody></table></div><div class="row" style="margin-top:10px"><button class="btn" data-add="guar">+ Гарант</button></div></section>
  <section class="panel"><h2>Комментарий менеджера</h2><p class="hint">Всё важное со слов клиента: сезонность, крупные контракты, планы. Попадёт в заключение.</p>
    <textarea class="inp" data-k="c.notes" rows="4">${esc(c.notes || "")}</textarea></section>
  <div class="row noprint"><button class="btn primary" data-page="fin">Дальше: финансовая отчётность →</button></div>`;
}

/* ---------------------------------------------------------------- 2. Финансовая отчётность */
function pageFin() {
  if (!UPL.pid || perIdx(UPL.pid) < 0) UPL.pid = X.per[X.per.length - 1].id;
  const P = X.per, dy = declYears();
  const rows = blk => FL[blk].map(l => {
    if (l[0] === "sec") return `<tr class="sec"><td colspan="${P.length + 1}">${esc(l[1])}</td></tr>`;
    const d = LINEDEF[l[0]];
    const cells = P.map(p => d.typ === "calc" ? `<td>${T(val(d.key, p.id))}</td>` : `<td class="c">${num(fv(d.key, p.id), `f.${d.key}.${p.id}`)}</td>`).join("");
    return `<tr class="${d.typ === "calc" ? "tot" : ""}"><td class="l"${d.typ === "sub" ? ' style="padding-left:24px"' : ""}>${esc(d.label)}${d.hint ? `<span class="note">${esc(d.hint)}</span>` : ""}</td>${cells}</tr>`;
  }).join("");
  const head = `<thead><tr><th class="l" style="min-width:280px">Строка, тыс. тг</th>${P.map(p => `<th>${esc(perLabel(p))}</th>`).join("")}</tr></thead>`;
  return `<div class="pagehead"><div class="lead"><h1>Финансовая отчётность</h1><p>Загрузите баланс, ОПиУ и (если есть) ДДС в Excel или PDF — сайт сам найдёт нужные строки и разложит цифры по периодам. Можно и вручную: просто впишите суммы в таблицу. Налоговые декларации (100.00, 910.00, 300.00) загружаются туда же — сайт сверит их с выручкой.</p></div></div>
  <section class="panel"><h2>Периоды</h2><p class="hint">Обычно два последних года. Если есть отчётность за текущий год (например, 9 месяцев) — добавьте третий период: показатели будут пересчитаны в годовые.</p>
    <div class="tw"><table class="t" style="width:auto"><thead><tr><th class="l">Период</th><th class="l">Отчётная дата</th><th>Месяцев</th><th></th></tr></thead><tbody>
    ${P.map((p, i) => `<tr><td class="l"><b>${esc(perLabel(p))}</b></td><td class="c"><input class="inp txt" type="date" data-k="p.${i}.date" value="${esc(p.date || "")}"></td><td class="c" style="width:90px">${num(p.months, `p.${i}.months`)}</td><td class="x">${P.length > 1 ? `<button class="xbtn" data-rmper="${i}" title="Удалить период и его цифры">×</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>${P.length < 3 ? `<div class="row" style="margin-top:10px"><button class="btn" data-act="addper">+ Период</button></div>` : ""}</section>
  <section class="panel noprint"><h2>Загрузить документы</h2>
    <div class="row" style="margin-bottom:10px">${fld("В какой период загружать", `<select class="inp" data-upl="pid">${opts(P.map(p => [p.id, perLabel(p)]), UPL.pid)}</select>`)}${fld("Единицы в файле", `<select class="inp" data-upl="units">${opts([["auto", "определить сами"], ["t", "тенге"], ["k", "тыс. тенге"], ["m", "млн тенге"]], UPL.units)}</select>`)}</div>
    <div class="drop" id="drop"><b>Перетащите файлы сюда</b>или <button class="btn" data-act="pick">выберите на компьютере</button><div class="small muted" style="margin-top:6px">Excel (.xlsx, .xls) или PDF с текстом (не скан). Если в форме есть колонка за прошлый год — она попадёт в предыдущий период.</div></div>
    ${UPL.log.length ? `<div class="flist">${UPL.log.map(r => `<div class="fitem ${r.ok ? "ok" : "err"}"><span class="ic">${r.ok ? "✓" : "!"}</span><div class="fn"><b>${esc(r.file)}</b><br>${esc(r.txt || r.err)}</div></div>`).join("")}</div><p class="small muted" style="margin-top:8px">Проверьте цифры в таблице ниже — особенно итоги: «Итого активы» должны совпасть с документом.</p>` : ""}
  </section>
  <section class="panel"><h2>Баланс</h2><div class="tw"><table class="t">${head}<tbody>${rows("bal")}</tbody></table></div></section>
  <section class="panel"><h2>Отчёт о прибылях и убытках (ОПиУ)</h2><p class="hint">Расходы — положительными числами. Для неполного года — цифры с начала года (как в отчётности).</p><div class="tw"><table class="t">${head}<tbody>${rows("pl")}</tbody></table></div></section>
  <section class="panel"><h2>Движение денежных средств (ДДС)</h2><p class="hint">Необязательно. Если ДДС нет — пропустите.</p><div class="tw"><table class="t">${head}<tbody>${rows("cf")}</tbody></table></div></section>
  <section class="panel"><h2>Налоговые декларации</h2><p class="hint">Загружаются в окно выше. Или внесите доход вручную. Суммы — в тыс. тг.</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">Форма</th><th class="l">Год</th><th class="l">Период</th><th>Доход</th><th>Оборот по НДС</th><th class="l">Файл</th><th></th></tr></thead><tbody>
    ${(X.decl || []).slice().sort((a, b) => (a.year - b.year) || String(a.form).localeCompare(b.form) || String(a.part).localeCompare(b.part)).map(d => { const i = X.decl.indexOf(d); return `<tr><td class="c"><select class="inp" data-k="d.${i}.form">${opts([["100", "100.00 КПН"], ["910", "910.00 упрощённая"], ["300", "300.00 НДС"], ["200", "200.00 ИПН/СН"], ["220", "220.00 ИПН"]].concat(["100", "910", "300", "200", "220"].includes(d.form) ? [] : [[d.form, d.formName || d.form]]), d.form)}</select></td>
      <td class="c" style="width:90px">${num(d.year, `d.${i}.year`)}</td>
      <td class="c"><select class="inp" data-k="d.${i}.part">${opts(Object.entries(PART_TXT), d.part)}</select></td>
      <td class="c">${num(isNum(d.vals?.rev) ? d.vals.rev / 1000 : null, `d.${i}.rev`)}</td>
      <td class="c">${num(isNum(d.vals?.vat_turn) ? d.vals.vat_turn / 1000 : null, `d.${i}.vat_turn`)}</td>
      <td class="l small muted">${esc(d.file || "вручную")}</td><td class="x"><button class="xbtn" data-rmdecl="${i}">×</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="l muted">Деклараций нет.</td></tr>`}
    </tbody></table></div><div class="row" style="margin-top:10px"><button class="btn" data-act="adddecl">+ Декларация вручную</button></div>
    ${dy.length ? `<p class="small" style="margin-top:10px">Итого по годам: ${dy.map(y => `<b>${y.year}</b> — доход ${isNum(y.rev) ? fmt(y.rev) : "—"}${isNum(y.vat) ? `, оборот НДС ${fmt(y.vat)}` : ""}`).join("; ")} тыс. тг.</p>` : ""}
  </section>
  ${X.files.length ? `<p class="small muted">Загружено файлов: ${X.files.length}. Последние: ${X.files.slice(0, 5).map(f => esc(f.name)).join(", ")}.</p>` : ""}
  <div class="row noprint"><button class="btn primary" data-page="an">Дальше: анализ →</button></div>`;
}

/* ---------------------------------------------------------------- 3. Анализ */
function kpi(sev, title, value, unit, explain, note, hint) {
  return `<div class="kpi ${sev}"><div class="k"><span>${esc(title)} ${hint ? tip(hint) : ""}</span><span class="tag ${sev}">${SEVT[sev]}</span></div><div class="v">${value}${unit ? ` <small>${unit}</small>` : ""}</div><div class="e">${explain}</div>${note ? `<div class="n">${note}</div>` : ""}</div>`;
}
function sevBy(v, ok, min, higherBetter = true) { if (!isNum(v)) return "nd"; return higherBetter ? (v >= ok ? "ok" : v >= min ? "chk" : "risk") : (v <= ok ? "ok" : v <= min ? "chk" : "risk"); }
function pageAn(pr, v) {
  const m = analyze(), c = X.card;
  if (!m.pl && !m.bal) return `<div class="pagehead"><div class="lead"><h1>Анализ</h1></div></div><div class="verdict nd"><div class="vicon">?</div><div><div class="big">Нет финансовых данных</div><p>Загрузите или внесите баланс и ОПиУ на странице «Финансовая отчётность».</p></div></div><button class="btn primary" data-page="fin">Перейти к отчётности</button>`;
  const ann = m.k !== 1 ? ` (${perLabel(m.pl)} → в годовом выражении)` : "";
  const dscrSev = !isNum(m.dscr) ? "nd" : m.dscr >= NORM.dscr_ok ? "ok" : m.dscr >= NORM.dscr_min ? "chk" : "crit";
  const k = [
    kpi(m.rev > 0 ? (isNum(m.revGr) ? sevBy(m.revGr, NORM.rev_drop_chk, NORM.rev_drop_risk) : "ok") : "nd", "Выручка за год", T(m.rev), "тыс. тг", `Сколько компания продаёт за год${ann}.`, isNum(m.revGr) ? `Изменение к прошлому году: <b>${m.revGr >= 0 ? "+" : ""}${fmt(m.revGr, "p")}</b>` : "Динамику посчитать нельзя — нужен ещё один полный год."),
    kpi(!m.pl ? "nd" : m.ni > 0 ? "ok" : "risk", "Чистая прибыль", T(m.ni), "тыс. тг", m.ni > 0 ? `Компания зарабатывает: из каждых 100 тенге выручки остаётся ${fmt(m.nm * 100, "1")} тенге прибыли.` : "Компания работает в убыток.", isNum(m.gm) ? `Наценка (валовая маржа): ${fmt(m.gm, "p")}` : ""),
    kpi(dscrSev, "Хватает ли денег на платежи", isNum(m.dscr) ? fmt(m.dscr, "x") : "—", "", isNum(m.dscr) ? `Бизнес зарабатывает ~${T(m.cashMonth)} тыс. тг в месяц, а платить по всем кредитам нужно ~${T(m.payTotal)}. Нужно не меньше ${fmt(NORM.dscr_ok, "x")}: т.е. на каждый тенге платежа — ${fmt(NORM.dscr_ok, "x")} тенге дохода.` : "Нет данных о платежах или о прибыли.", m.daKnown ? "" : "Амортизация не указана — оценка осторожная.", "DSCR = (EBITDA − КПН) / 12 ÷ платежи по всем кредитам в месяц"),
    kpi(sevBy(m.lev, NORM.lev_ok, NORM.lev_max, false), "Долговая нагрузка", isNum(m.lev) ? fmt(m.lev, "1") : "—", "лет", isNum(m.lev) ? `За сколько лет компания могла бы погасить все долги (с новым кредитом — ${T(m.debtNew)} тыс. тг), если бы весь заработок шёл на это. Норма — до ${fmt(NORM.lev_ok, "1")}.` : "Нет данных о долгах или EBITDA.", "", "Долг / EBITDA. EBITDA — прибыль до процентов, налогов и амортизации"),
    kpi(c.product === "Овердрафт" ? "nd" : sevBy(m.coll, NORM.coll_ok, NORM.coll_min), "Покрытие залогом", isNum(m.coll) ? fmt(m.coll, "p") : "—", "", isNum(m.coll) ? `Залог с учётом дисконта${m.guarAmt ? " и гарантии фонда" : ""} покрывает эту долю суммы займа. Норма — от 100 %.` : "Нет суммы займа или залога.", m.collDisc ? `Залоговая стоимость: ${T(m.collDisc)} тыс. тг` : ""),
    kpi(sevBy(m.liq, NORM.liq_ok, NORM.liq_min), "Ликвидность", isNum(m.liq) ? fmt(m.liq, "x") : "—", "", "Хватает ли денег, дебиторки и запасов, чтобы закрыть долги до года. Норма — от 1.", "", "Текущие активы / текущие обязательства"),
    kpi(!isNum(m.eqr) ? "nd" : N(m.eq) < 0 ? "crit" : sevBy(m.eqr, NORM.eq_ok, NORM.eq_min), "Собственные средства", isNum(m.eqr) ? fmt(m.eqr, "p") : "—", "", "Какая часть имущества компании принадлежит ей самой, а не куплена в долг. Норма — от 20 %.", isNum(m.eq) ? `Капитал: ${T(m.eq)} тыс. тг` : ""),
  ];
  const keyRows = [["Выручка", p => fv("rev", p.id)], ["Чистая прибыль", p => val("ni", p.id)], ["EBITDA (заработок до процентов и налогов)", p => val("ebitda", p.id)], ["Активы", p => val("ta", p.id)], ["Собственный капитал", p => fv("eq", p.id)], ["Кредиты и займы", p => val("debt", p.id)], ["Дебиторская задолженность", p => fv("ar", p.id)], ["Запасы", p => fv("inv", p.id)]];
  return `<div class="pagehead"><div class="lead"><h1>Анализ</h1><p>Короткая картина: самое главное о бизнесе клиента. Цвет плашки: зелёный — норма, жёлтый — проверить, красный — риск.</p></div></div>
  <div class="verdict ${v.sev}"><div class="vicon">${v.icon}</div><div><div class="big">${esc(v.title)}</div><p>${esc(v.text)}</p></div></div>
  <div class="kpis">${k.join("")}</div>
  <section class="panel"><h2>Сколько можно дать</h2><p class="hint">Расчёт по текущему заработку бизнеса и платежам по действующим кредитам, с запасом ${Math.round((NORM.dscr_ok - 1) * 100)} % на непредвиденное — при тех же сроке, ставке и способе погашения.</p>
    <div class="maxsum">
      <div><span class="small muted">Запрашивают</span><div class="v">${T(c.amount)} <small class="muted">тыс. тг</small></div><span class="small">платёж ~${m.newPay ? fmt(m.newPay.pay) : "—"} в месяц</span></div>
      <div><span class="small muted">Свободно для нового платежа</span><div class="v">${isNum(m.payFree) ? T(Math.max(0, m.payFree)) : "—"} <small class="muted">тыс. тг / мес.</small></div><span class="small">заработок ${T(m.cashMonth)} − платежи ${T(m.payExist)}, с запасом</span></div>
      <div><span class="small muted">Максимальная сумма по доходам</span><div class="v">${isNum(m.maxAmt) ? T(Math.floor(m.maxAmt / 100) * 100) : "—"} <small class="muted">тыс. тг</small></div><span class="small">${isNum(m.maxAmt) && N(c.amount) ? (m.maxAmt >= N(c.amount) ? "запрос укладывается" : "запрос больше — " + (m.maxAmt > 0 ? "снизить сумму или увеличить срок" : "доходов не хватает")) : ""}</span></div>
    </div></section>
  <section class="panel"><h2>Ключевые цифры</h2><p class="hint">Тыс. тг, как в отчётности (неполный год — с начала года, без пересчёта).</p>
    <div class="tw"><table class="t"><thead><tr><th class="l">Показатель</th>${X.per.map(p => `<th>${esc(perLabel(p))}</th>`).join("")}</tr></thead><tbody>
    ${keyRows.map(([t, f]) => `<tr><td class="l">${t}</td>${X.per.map(p => { const x = f(p); return `<td class="${isNum(x) && x < 0 ? "neg" : ""}">${T(x)}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table></div></section>
  <section class="panel"><h2>Платежи в месяц</h2>
    <div class="tw"><table class="t" style="max-width:640px"><tbody>
      <tr><td class="l">Заработок бизнеса в месяц (EBITDA − КПН) / 12</td><td>${T(m.cashMonth)}</td></tr>
      ${(c.loans || []).map(l => `<tr><td class="l">— ${esc(l.bank || "кредитор")} (${esc(l.kind || "")})${l.refin ? " — рефинансируется, не учитывается" : ""}</td><td>${l.refin ? "<s>" + T(l.pay) + "</s>" : T(l.pay)}</td></tr>`).join("")}
      <tr><td class="l">— новый кредит</td><td>${m.newPay ? T(m.newPay.pay) : "—"}</td></tr>
      <tr class="tot"><td class="l">Все платежи</td><td>${T(m.payTotal)}</td></tr>
      <tr class="tot"><td class="l">Остаётся после платежей</td><td class="${m.cashMonth - m.payTotal < 0 ? "neg" : ""}">${isNum(m.cashMonth) ? T(m.cashMonth - m.payTotal) : "—"}</td></tr>
    </tbody></table></div>${isNum(m.ocf) ? `<p class="small muted" style="margin-top:8px">По ДДС поток от основной деятельности — ${T(m.ocf)} тыс. тг в год (${T(m.ocf / 12)} в месяц).</p>` : ""}</section>
  <div class="row noprint"><button class="btn primary" data-page="prob">Дальше: проблемы →</button></div>`;
}

/* ---------------------------------------------------------------- 4. Проблемы */
function pageProb(pr) {
  const cnt = s => pr.filter(p => p.sev === s).length;
  const groups = [["crit", "Стоп-факторы"], ["risk", "Риски"], ["chk", "Проверить и уточнить"], ["nd", "Не хватает данных"]];
  return `<div class="pagehead"><div class="lead"><h1>Проблемы и расхождения</h1><p>Что сайт нашёл в данных клиента. У каждой проблемы — объяснение простым языком и что сделать. Расхождения — это когда цифры из разных источников не совпадают (баланс и список кредитов, отчётность и декларация).</p></div></div>
  <div class="cnt">${groups.map(([s, t]) => `<span class="tag ${s}">${t}: ${cnt(s)}</span>`).join("")}</div>
  ${pr.length ? groups.map(([s, t]) => { const L = pr.filter(p => p.sev === s); return L.length ? `<h2 style="margin:18px 0 10px">${t}</h2>` + L.map(p => `<div class="prob ${p.sev}"><div class="hd"><span class="tag ${p.sev}">${SEVT[p.sev]}</span><b>${esc(p.title)}</b><span class="area">${esc(p.area)}</span></div><p class="why">${esc(p.why)}</p>${p.todo ? `<div class="todo">${esc(p.todo)}</div>` : ""}</div>`).join("") : ""; }).join("")
    : `<div class="verdict ok"><div class="vicon">✓</div><div><div class="big">Проблем не найдено</div><p>По введённым данным критичных моментов и расхождений нет.</p></div></div>`}
  <div class="row noprint" style="margin-top:14px"><button class="btn primary" data-page="concl">Дальше: заключение →</button></div>`;
}

/* ---------------------------------------------------------------- 5. Заключение */
function pageConcl(pr, v) {
  X.concl = X.concl || { text: "", edited: false };
  if (!X.concl.text) X.concl.text = buildConclusion(pr, v);
  return `<div class="pagehead"><div class="lead"><h1>Заключение</h1><p>Сайт написал заключение сам по всем данным. Текст можно править — правки сохраняются. «Сформировать заново» вернёт автоматический текст.</p></div>
    <div class="row noprint"><button class="btn" data-act="regen">Сформировать заново</button><button class="btn" data-act="copy">Копировать текст</button><button class="btn primary" data-act="print">Печать / PDF</button></div></div>
  <div class="verdict ${v.sev}"><div class="vicon">${v.icon}</div><div><div class="big">${esc(v.title)}</div><p>${esc(v.text)}</p></div></div>
  ${X.concl.edited ? `<p class="edited noprint">Текст изменён вручную — автоматически не обновляется.</p>` : ""}
  <textarea class="concl" id="concl" data-k="concl" spellcheck="true">${esc(X.concl.text)}</textarea>
  <div class="printonly">${esc(X.concl.text)}</div>`;
}
function buildConclusion(pr, v) {
  const c = X.card, m = analyze(), L = [], t = x => isNum(x) ? fmt(x) + " тыс. тг" : "нет данных";
  const today = new Date().toLocaleDateString("ru-RU");
  L.push(`ЭКСПРЕСС-АНАЛИЗ КЛИЕНТА (предварительная оценка)`);
  L.push(`Дата: ${today}${c.km ? `. Кредитный менеджер: ${c.km}` : ""}`);
  L.push("");
  L.push(`ВЫВОД: ${v.title.toUpperCase()}`);
  L.push(v.text);
  L.push("");
  L.push("1. КЛИЕНТ И ЗАПРОС");
  L.push(`${c.name || "Клиент"}${c.bin ? `, БИН/ИИН ${c.bin}` : ""}${c.regDate ? `, зарегистрирован ${new Date(c.regDate).toLocaleDateString("ru-RU")}${isNum(m.age) ? ` (работает ${m.age >= 24 ? Math.floor(m.age / 12) + " лет" : m.age + " мес."})` : ""}` : ""}.`);
  if (c.activity) L.push(`Деятельность: ${c.activity}.`);
  if (c.director || c.owners) L.push([c.director ? `Руководитель: ${c.director}` : "", c.owners ? `учредители: ${c.owners}` : ""].filter(Boolean).join("; ") + ".");
  L.push(`Запрос: ${(c.product || "кредит").toLowerCase()} на сумму ${t(c.amount)}, срок ${c.term || "—"} мес., ставка ${isNum(c.rate) ? fmt(c.rate, "1") + " %" : "—"}, цель — ${(c.purpose || "").toLowerCase()}. Программа: ${c.program || "не указана"}.`);
  if (m.newPay) L.push(`Ежемесячный платёж по новому кредиту — около ${t(m.newPay.pay)} (${m.newPay.note}).`);
  L.push("");
  L.push("2. ФИНАНСОВОЕ ПОЛОЖЕНИЕ");
  if (m.pl) {
    L.push(`Выручка за ${perLabel(m.pl)} — ${t(fv("rev", m.pl.id))}${m.k !== 1 ? ` (в пересчёте на год ~${t(m.rev)})` : ""}${isNum(m.revGr) ? `; ${m.yr === m.pl ? "" : `за ${perLabel(m.yr)} `}${m.revGr >= 0 ? "рост" : "снижение"} на ${fmt(Math.abs(m.revGr), "p")} к прошлому году` : ""}.`);
    L.push(m.ni >= 0 ? `Бизнес прибыльный: чистая прибыль ${t(val("ni", m.pl.id))}, из каждых 100 тенге выручки остаётся ${fmt(m.nm * 100, "1")} тенге.` : `Бизнес убыточный: чистый убыток ${t(val("ni", m.pl.id))}.`);
    L.push(`Заработок до процентов, налогов и амортизации (EBITDA) — ${t(m.ebitda)} в год${m.daKnown ? "" : " (без амортизации — оценка осторожная)"}.`);
  } else L.push("Данных о выручке и прибыли нет.");
  if (m.bal) {
    L.push(`На ${new Date(m.bal.date).toLocaleDateString("ru-RU")}: активы ${t(m.ta)}, собственный капитал ${t(m.eq)} (${isNum(m.eqr) ? fmt(m.eqr, "p") : "—"} от активов), кредиты и займы ${t(m.debt)}.`);
    if (isNum(m.liq)) L.push(`Ликвидность ${fmt(m.liq, "x")} — ${m.liq >= NORM.liq_ok ? "текущих активов хватает на погашение долгов до года" : "текущих активов не хватает на погашение долгов до года"}.`);
  }
  if (isNum(m.ocf)) L.push(`По ДДС поток от основной деятельности — ${t(m.ocf)} в год.`);
  L.push("");
  L.push("3. ПЛАТЁЖЕСПОСОБНОСТЬ");
  const loans = c.loans || [];
  L.push(loans.length ? `Действующие кредиты: ${loans.length}, общий остаток ${t(m.loanBal)}, платежи ${t(m.payExist)} в месяц${m.refinBal ? ` (без рефинансируемых на ${t(m.refinBal)})` : ""}.` : "Действующих кредитов по данным клиента нет.");
  if (loans.some(l => l.overdue && l.overdue !== "no")) L.push(`Просрочки: ${loans.filter(l => l.overdue && l.overdue !== "no").map(l => `${l.bank || "кредитор"} — ${OVERDUE[l.overdue]}`).join("; ")}.`);
  if (isNum(m.dscr)) {
    L.push(`Бизнес зарабатывает около ${t(m.cashMonth)} в месяц; со всеми платежами, включая новый кредит, нужно платить ${t(m.payTotal)} в месяц. Покрытие платежей ${fmt(m.dscr, "x")} (норма от ${fmt(NORM.dscr_ok, "x")}) — ${m.dscr >= NORM.dscr_ok ? "денег хватает с запасом" : m.dscr >= 1 ? "денег хватает впритык" : "денег не хватает"}.`);
    if (isNum(m.maxAmt) && N(c.amount)) L.push(m.maxAmt >= N(c.amount) ? `Запрошенная сумма укладывается в возможности клиента (по доходам — до ~${t(Math.floor(m.maxAmt / 100) * 100)}).` : m.maxAmt > 0 ? `По доходам клиент может обслуживать кредит примерно до ${t(Math.floor(m.maxAmt / 100) * 100)} на тех же условиях — это меньше запрошенного.` : "При текущих доходах новый кредит клиенту не по силам.");
  }
  if (isNum(m.lev)) L.push(`Все долги с новым кредитом — ${t(m.debtNew)}, это ${fmt(m.lev, "1")} годового заработка (норма до ${fmt(NORM.lev_ok, "1")}).`);
  L.push("");
  L.push("4. ОБЕСПЕЧЕНИЕ");
  const coll = c.coll || [];
  if (coll.length) {
    coll.forEach(z => L.push(`– ${z.type}${z.desc ? ": " + z.desc : ""}${z.owner ? `, залогодатель — ${z.owner}` : ""}; рыночная ${t(z.value)}, залоговая ${t(N(z.value) * (1 - N(z.disc) / 100))} (дисконт ${fmt(N(z.disc), "m")} %).`));
  } else L.push("Залог не указан.");
  if (m.guarAmt) L.push(`Гарантия фонда ${fmt(N(c.guarPct), "m")} % — ${t(m.guarAmt)}.`);
  if (isNum(m.coll)) L.push(`Покрытие суммы займа — ${fmt(m.coll, "p")}${m.coll >= NORM.coll_ok ? ", достаточно" : ", недостаточно"}.`);
  const g = c.guar || [];
  if (g.length) L.push(`Гаранты: ${g.map(x => `${x.name || "—"}${x.rel ? ` (${x.rel})` : ""}`).join("; ")}.`);
  L.push("");
  L.push("5. ПРОБЛЕМЫ И РАСХОЖДЕНИЯ");
  const serious = pr.filter(p => p.sev !== "ok");
  if (serious.length) serious.forEach((p, i) => L.push(`${i + 1}) [${SEVT[p.sev]}] ${p.title}. ${p.why}`));
  else L.push("Существенных проблем и расхождений не выявлено.");
  L.push("");
  L.push("6. РЕКОМЕНДАЦИЯ И ДАЛЬНЕЙШИЕ ДЕЙСТВИЯ");
  if (v.sev === "crit") L.push("Заявку дальше не вести до устранения стоп-факторов. Сообщить клиенту о причинах.");
  else if (v.sev === "nd") L.push("Дособрать данные и повторить экспресс-анализ.");
  else if (v.sev === "ok") L.push("Клиент предварительно соответствует требованиям. Запросить полный пакет документов и передать на анализ.");
  else L.push(`Клиента можно рассматривать при условии: ${[isNum(m.maxAmt) && N(c.amount) > m.maxAmt && m.maxAmt > 0 ? `снижение суммы до ~${t(Math.floor(m.maxAmt / 100) * 100)} или увеличение срока` : "", isNum(m.coll) && m.coll < NORM.coll_ok ? "дополнительный залог или гарантия фонда" : ""].filter(Boolean).join("; ") || "закрытие вопросов ниже"}.`);
  const todos = [...new Set(pr.filter(p => p.todo && p.sev !== "ok").map(p => p.todo))];
  if (todos.length) { L.push("Что запросить / уточнить у клиента:"); todos.forEach(x => L.push("– " + x)); }
  if (c.notes) { L.push(""); L.push("КОММЕНТАРИЙ МЕНЕДЖЕРА"); L.push(c.notes); }
  L.push("");
  L.push("Экспресс-анализ предварительный и не заменяет полного анализа и решения кредитного комитета. Суммы — в тыс. тенге.");
  return L.join("\n");
}
