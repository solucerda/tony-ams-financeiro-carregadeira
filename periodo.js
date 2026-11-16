/* ═══════════════════════════════════════════════════════
   FILTRO DE PERÍODO — um botão só, em todas as telas
   O botão mostra o período atual ("Este mês ▾") e abre uma folha com
   dias, semanas, meses, trimestres, semestres, anos, os últimos meses
   um a um e um intervalo personalizado.
   ═══════════════════════════════════════════════════════ */

"use strict";

const PERIODOS_FIXOS = [
  { grupo: "Dias", itens: [["hoje", "Hoje"], ["ontem", "Ontem"], ["ult7", "Últimos 7 dias"], ["ult15", "Últimos 15 dias"], ["ult30", "Últimos 30 dias"], ["ult60", "Últimos 60 dias"], ["ult90", "Últimos 90 dias"]] },
  { grupo: "Semanas", itens: [["semana", "Esta semana"], ["semana_passada", "Semana passada"]] },
  { grupo: "Meses", itens: [["mes", "Este mês"], ["mes_passado", "Mês passado"], ["ult3m", "Últimos 3 meses"], ["ult6m", "Últimos 6 meses"], ["ult12m", "Últimos 12 meses"]] },
  { grupo: "Trimestre e semestre", itens: [["trimestre", "Este trimestre"], ["trimestre_passado", "Trimestre passado"], ["semestre", "Este semestre"], ["semestre_passado", "Semestre passado"]] },
  { grupo: "Ano", itens: [["ano", "Este ano"], ["ano_passado", "Ano passado"], ["tudo", "Todo o período"]] },
];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function _dHoje() { const [y, m, d] = hoje().split("-").map(Number); return new Date(y, m - 1, d); }
function _iso(d) { return isoLocal(d); }

// {chave, de?, ate?} → {de, ate} em ISO ("" = sem limite)
function intervaloDe(p) {
  p = p || { chave: "tudo" };
  const h = _dHoje(), y = h.getFullYear(), m = h.getMonth();
  const dia = (n) => { const d = new Date(h); d.setDate(d.getDate() + n); return _iso(d); };
  const iniSemana = (desl) => { const d = new Date(h); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + desl * 7); return d; };
  const mesIni = (k) => _iso(new Date(y, m + k, 1));
  const mesFim = (k) => _iso(new Date(y, m + k + 1, 0));
  const tri = Math.floor(m / 3), sem = Math.floor(m / 6);
  const c = p.chave;
  if (c.startsWith("m:")) { const [yy, mm] = c.slice(2).split("-").map(Number); return { de: _iso(new Date(yy, mm - 1, 1)), ate: _iso(new Date(yy, mm, 0)) }; }
  if (c.startsWith("a:")) { const yy = Number(c.slice(2)); return { de: `${yy}-01-01`, ate: `${yy}-12-31` }; }
  switch (c) {
    case "hoje": return { de: dia(0), ate: dia(0) };
    case "ontem": return { de: dia(-1), ate: dia(-1) };
    case "ult7": return { de: dia(-6), ate: dia(0) };
    case "ult15": return { de: dia(-14), ate: dia(0) };
    case "ult30": return { de: dia(-29), ate: dia(0) };
    case "ult60": return { de: dia(-59), ate: dia(0) };
    case "ult90": return { de: dia(-89), ate: dia(0) };
    case "semana": { const i = iniSemana(0), f = new Date(i); f.setDate(i.getDate() + 6); return { de: _iso(i), ate: _iso(f) }; }
    case "semana_passada": { const i = iniSemana(-1), f = new Date(i); f.setDate(i.getDate() + 6); return { de: _iso(i), ate: _iso(f) }; }
    case "mes": return { de: mesIni(0), ate: mesFim(0) };
    case "mes_passado": return { de: mesIni(-1), ate: mesFim(-1) };
    case "ult3m": return { de: mesIni(-2), ate: mesFim(0) };
    case "ult6m": return { de: mesIni(-5), ate: mesFim(0) };
    case "ult12m": return { de: mesIni(-11), ate: mesFim(0) };
    case "trimestre": return { de: _iso(new Date(y, tri * 3, 1)), ate: _iso(new Date(y, tri * 3 + 3, 0)) };
    case "trimestre_passado": return { de: _iso(new Date(y, tri * 3 - 3, 1)), ate: _iso(new Date(y, tri * 3, 0)) };
    case "semestre": return { de: _iso(new Date(y, sem * 6, 1)), ate: _iso(new Date(y, sem * 6 + 6, 0)) };
    case "semestre_passado": return { de: _iso(new Date(y, sem * 6 - 6, 1)), ate: _iso(new Date(y, sem * 6, 0)) };
    case "ano": return { de: `${y}-01-01`, ate: `${y}-12-31` };
    case "ano_passado": return { de: `${y - 1}-01-01`, ate: `${y - 1}-12-31` };
    case "personalizado": return { de: p.de || "", ate: p.ate || "" };
    default: return { de: "", ate: "" };
  }
}
function rotuloPeriodo(p) {
  p = p || { chave: "tudo" };
  if (p.chave.startsWith("m:")) { const [yy, mm] = p.chave.slice(2).split("-").map(Number); return MESES_LONGOS[mm - 1].replace(/^./, c => c.toUpperCase()) + " de " + yy; }
  if (p.chave.startsWith("a:")) return "Ano de " + p.chave.slice(2);
  if (p.chave === "personalizado") {
    const { de, ate } = intervaloDe(p);
    return de && ate ? `${fData(de)} a ${fData(ate)}` : de ? `Desde ${fData(de)}` : ate ? `Até ${fData(ate)}` : "Todo o período";
  }
  for (const g of PERIODOS_FIXOS) for (const [k, r] of g.itens) if (k === p.chave) return r;
  return "Todo o período";
}
const dentroDe = (dataIso, p) => { if (!dataIso) return false; const { de, ate } = intervaloDe(p); return (!de || dataIso >= de) && (!ate || dataIso <= ate); };

// Cada tela registra onde guarda o seu período e o que redesenhar.
const ALVOS_PERIODO = {};
function registrarPeriodo(id, obter, definir) { ALVOS_PERIODO[id] = { obter, definir }; }
function botaoPeriodo(id) {
  const alvo = ALVOS_PERIODO[id];
  const p = alvo ? alvo.obter() : { chave: "tudo" };
  return `<button type="button" class="btn-periodo ${p.chave !== "tudo" ? "ativo" : ""}" data-periodo="${id}" aria-label="Período: ${escHtml(rotuloPeriodo(p))}">
    ${icone("agenda", "icone-sm")}<span>${escHtml(rotuloPeriodo(p))}</span>${icone("chevron-right", "icone-sm btn-periodo-seta")}</button>`;
}
function pintarBotoesPeriodo() {
  document.querySelectorAll("[data-periodo-slot]").forEach(el => { el.innerHTML = botaoPeriodo(el.dataset.periodoSlot); });
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-periodo]");
  if (!b) return;
  const alvo = ALVOS_PERIODO[b.dataset.periodo];
  if (alvo) abrirSeletorPeriodo(alvo.obter(), (p) => { alvo.definir(p); pintarBotoesPeriodo(); });
});

function abrirSeletorPeriodo(atual, aoEscolher) {
  const h = _dHoje();
  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(h.getFullYear(), h.getMonth() - i, 1); return [`m:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, MESES[d.getMonth()] + "/" + String(d.getFullYear()).slice(2)]; });
  const anos = [0, 1, 2, 3].map(k => [`a:${h.getFullYear() - k}`, String(h.getFullYear() - k)]);
  const chip = ([k, r]) => `<button type="button" class="chip-periodo ${atual.chave === k ? "ativo" : ""}" data-escolher="${k}">${r}</button>`;
  const rapidos = [["hoje", "Hoje"], ["ult7", "Últimos 7 dias"], ["mes", "Este mês"], ["mes_passado", "Mês passado"], ["ano", "Este ano"]];
  const outros = PERIODOS_FIXOS.map(g => ({ grupo: g.grupo, itens: g.itens.filter(([k]) => !rapidos.some(r => r[0] === k)) })).filter(g => g.itens.length);
  const aberto = atual.chave && !rapidos.some(r => r[0] === atual.chave) ? " open" : "";
  const html = `<div class="chips-periodo">${rapidos.map(chip).join("")}</div>`
    + `<details class="periodo-mais"${aberto}><summary>Outros períodos…</summary>`
    + outros.map(g => `<h3 class="grupo-titulo">${g.grupo}</h3><div class="chips-periodo">${g.itens.map(chip).join("")}</div>`).join("")
    + `<h3 class="grupo-titulo">Mês a mês</h3><div class="chips-periodo">${meses.map(chip).join("")}</div>`
    + `<h3 class="grupo-titulo">Anos</h3><div class="chips-periodo">${anos.map(chip).join("")}</div>`
    + `<h3 class="grupo-titulo">Personalizado</h3>
      <div class="periodo-personalizado">
        <label>De<input type="date" id="per-de" value="${atual.chave === "personalizado" ? escHtml(atual.de || "") : ""}"></label>
        <label>Até<input type="date" id="per-ate" value="${atual.chave === "personalizado" ? escHtml(atual.ate || "") : ""}"></label>
        <button type="button" class="btn-primario" id="per-aplicar">Aplicar</button>
      </div></details>`;
  abrirModal({ titulo: "Período", tabela: "_periodo", corpoCustom: html, semSalvar: true, folha: true });
  document.querySelectorAll("#modal-campos [data-escolher]").forEach(b => b.addEventListener("click", () => {
    fecharModal(); aoEscolher({ chave: b.dataset.escolher });
  }));
  $("per-aplicar").addEventListener("click", () => {
    const de = $("per-de").value, ate = $("per-ate").value;
    if (!de && !ate) { mostrarErroForm("Escolha pelo menos uma das datas.", null); return; }
    if (de && ate && ate < de) { mostrarErroForm("A data final é antes da inicial.", null); return; }
    fecharModal(); aoEscolher({ chave: "personalizado", de, ate });
  });
}
