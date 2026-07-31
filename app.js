/* ═══════════════════════════════════════════════════════
   GERENCIADOR FINANCEIRO — TA TRANSPORTE (Pá Carregadeira)
   HTML + CSS + JS puro · Supabase · Chart.js — sem build
   ═══════════════════════════════════════════════════════ */

"use strict";

/* ── Estado global ─────────────────────────────────────── */
let sb = null;                 // cliente Supabase
const dados = { saldoInicial: 0, lanc: [], rec: [], die: [], age: [] };
let filtroExt = { mes: "todos", grupo: "todos", busca: "" };
let filtroCliente = "todos";
const graficos = {};           // instâncias Chart.js

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const GRUPOS_SAIDA = ["Combustível","Financiamento","Investimento","Manutenção",
  "Pessoal","Seguro Frota","Tarifas","Taxas fixas","Outras despesas"];
const CORES_GRUPO = {
  "Combustível":"#F5B301","Financiamento":"#F0564A","Investimento":"#7A8CF0",
  "Manutenção":"#FF8C42","Pessoal":"#4EC9D4","Seguro Frota":"#C77DFF",
  "Tarifas":"#8B919C","Taxas fixas":"#6B7280","Outras despesas":"#A3A8B4",
  "Recebimentos":"#3ECF8E"
};

/* ── Utilidades ────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const brl  = (v) => (v ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const brl0 = (v) => (v ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });
const num  = (v, d=1) => (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits:d });
const mesLabel = (ym) => { const [a,m] = ym.split("-"); return `${MESES[+m-1]}/${a.slice(2)}`; };
const fData = (iso) => { const [a,m,d] = iso.split("-"); return `${d}/${m}/${a.slice(2)}`; };
const hoje = () => new Date().toISOString().slice(0,10);
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("oculto");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("oculto"), 3200);
}

/* ── Inicialização ─────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  if (!SUPABASE_URL || SUPABASE_URL.includes("COLE_AQUI")) {
    $("tela-config").classList.remove("oculto");
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await sb.auth.getSession();
  if (session) iniciarApp(); else mostrarLogin();

  $("form-login").addEventListener("submit", fazerLogin);
  $("btn-sair").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
});

function mostrarLogin() {
  $("tela-login").classList.remove("oculto");
}

async function fazerLogin(ev) {
  ev.preventDefault();
  const btn = $("login-btn"), erro = $("login-erro");
  btn.disabled = true; btn.textContent = "Entrando…";
  erro.classList.add("oculto");
  const { error } = await sb.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-senha").value
  });
  btn.disabled = false; btn.textContent = "Entrar";
  if (error) {
    erro.textContent = "E-mail ou senha incorretos. Confira e tente de novo.";
    erro.classList.remove("oculto");
    return;
  }
  $("tela-login").classList.add("oculto");
  iniciarApp();
}

async function iniciarApp() {
  $("tela-login").classList.add("oculto");
  $("app").classList.remove("oculto");

  // navegação por abas
  $("abas").addEventListener("click", (ev) => {
    const b = ev.target.closest(".aba");
    if (!b) return;
    document.querySelectorAll(".aba").forEach(x => x.classList.toggle("ativa", x === b));
    document.querySelectorAll(".secao").forEach(s => s.classList.add("oculto"));
    $("aba-" + b.dataset.aba).classList.remove("oculto");
  });

  // botões "novo"
  $("ext-novo").addEventListener("click", () => abrirModalLancamento(null));
  $("rec-novo").addEventListener("click", () => abrirModalRecebimento(null));
  $("die-novo").addEventListener("click", () => abrirModalDiesel(null));
  $("age-novo").addEventListener("click", () => abrirModalAgenda(null));

  // filtros do extrato
  $("ext-filtro-mes").addEventListener("change", e => { filtroExt.mes = e.target.value; renderExtrato(); });
  $("ext-filtro-grupo").addEventListener("change", e => { filtroExt.grupo = e.target.value; renderExtrato(); });
  $("ext-busca").addEventListener("input", e => { filtroExt.busca = e.target.value; renderExtrato(); });

  // cliques delegados (cartões de cliente e linhas da agenda)
  $("rec-clientes").addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-cliente]");
    if (card) filtrarCliente(card.dataset.cliente);
  });
  $("age-corpo").addEventListener("click", (ev) => {
    if (ev.target.closest(".linha-total")) return;
    const tr = ev.target.closest("[data-item]");
    if (tr) abrirModalAgendaItem(tr.dataset.item, tr.dataset.dia);
  });

  // modal
  $("modal-cancelar").addEventListener("click", fecharModal);
  $("modal-fundo").addEventListener("click", (ev) => { if (ev.target === $("modal-fundo")) fecharModal(); });

  await carregarTudo();
}

/* ── Carga de dados ────────────────────────────────────── */
async function carregarTudo() {
  $("carregando").classList.remove("oculto");
  try {
    const [cfg, lanc, rec, die, age] = await Promise.all([
      sb.from("config").select("*"),
      sb.from("lancamentos").select("*").order("data").order("id"),
      sb.from("recebimentos").select("*").order("data").order("id"),
      sb.from("diesel").select("*").order("data").order("id"),
      sb.from("agenda").select("*").order("item").order("mes"),
    ]);
    const erro = cfg.error || lanc.error || rec.error || die.error || age.error;
    if (erro) throw erro;

    const si = (cfg.data || []).find(c => c.chave === "saldo_inicial");
    dados.saldoInicial = si ? Number(si.valor) : 0;
    dados.lanc = (lanc.data || []).map(normNum);
    dados.rec  = (rec.data  || []).map(normNum);
    dados.die  = (die.data  || []).map(normNum);
    dados.age  = (age.data  || []).map(normNum);

    $("carregando").classList.add("oculto");
    $("aba-painel").classList.remove("oculto");
    renderTudo();
  } catch (e) {
    $("carregando").textContent =
      "Não foi possível carregar os dados. Confira se o script schema.sql foi executado no Supabase e se a URL/anon key do config.js estão corretas. (" + (e.message || e) + ")";
  }
}

// Supabase devolve numeric como string — converte tudo que for número
function normNum(obj) {
  const o = { ...obj };
  for (const k in o) {
    if (o[k] !== null && o[k] !== "" && typeof o[k] === "string" && /^-?\d+(\.\d+)?$/.test(o[k])) {
      o[k] = Number(o[k]);
    }
  }
  return o;
}

function renderTudo() {
  renderSaldoTopo();
  rodarSemTravar(renderPainel, "Painel");
  rodarSemTravar(prepararFiltrosExtrato, "Extrato (filtros)");
  rodarSemTravar(renderExtrato, "Extrato");
  rodarSemTravar(renderRecebimentos, "Recebimentos");
  rodarSemTravar(renderDiesel, "Diesel");
  rodarSemTravar(renderAgenda, "Agenda");
}

// Executa uma função de renderização isoladamente: se uma aba falhar
// (ex.: um gráfico), as demais abas continuam sendo exibidas normalmente.
function rodarSemTravar(fn, nome) {
  try { fn(); }
  catch (e) {
    console.error("Falha ao renderizar " + nome + ":", e);
    toast("Não foi possível carregar '" + nome + "' — veja o console (F12) para detalhes.");
  }
}

/* ── Cálculos ──────────────────────────────────────────── */
function saldoAtual() {
  return dados.lanc.reduce((s, l) => s + l.entrada - l.saida, dados.saldoInicial);
}

function renderSaldoTopo() {
  const s = saldoAtual();
  const el = $("saldo-topo");
  el.textContent = brl(s);
  el.className = "topo-saldo-valor " + (s >= 0 ? "pos" : "neg");
}

/* ═══════════════ PAINEL ═══════════════ */
function renderPainel() {
  // KPIs
  let ent = 0, sai = 0;
  for (const l of dados.lanc) { ent += l.entrada; sai += l.saida; }
  let horas = 0, faturado = 0;
  for (const r of dados.rec) { horas += r.horas; faturado += r.valor_total; }
  let litros = 0, custoDie = 0, horasMaq = 0;
  for (const d of dados.die) {
    litros += d.litros; custoDie += d.valor_total;
    if (d.horas) horasMaq += d.horas;
  }
  const custoHora = horasMaq > 0 ? custoDie / horasMaq : 0;
  const s = saldoAtual();
  const res = ent - sai;

  $("kpis-painel").innerHTML = [
    kpi("Saldo em caixa", brl(s), "bancos + dinheiro", s >= 0 ? "pos" : "neg"),
    kpi("Entradas no período", brl0(ent), "", "pos"),
    kpi("Saídas no período", brl0(sai), "", "neg"),
    kpi("Resultado", brl0(res), "entradas − saídas", res >= 0 ? "pos" : "neg"),
    kpi("Horas faturadas", num(horas) + " h", brl0(faturado) + " gerados"),
    kpi("Diesel por hora", brl(custoHora), num(litros,0) + " L · " + brl0(custoDie)),
  ].join("");

  // Fluxo mensal
  const porMes = {};
  for (const l of dados.lanc) {
    const ym = l.data.slice(0,7);
    if (!porMes[ym]) porMes[ym] = { entradas:0, saidas:0 };
    porMes[ym].entradas += l.entrada;
    porMes[ym].saidas   += l.saida;
  }
  const yms = Object.keys(porMes).sort();
  let acc = dados.saldoInicial;
  const saldos = yms.map(ym => (acc += porMes[ym].entradas - porMes[ym].saidas));

  desenharGrafico("graf-fluxo", {
    type: "bar",
    data: {
      labels: yms.map(mesLabel),
      datasets: [
        { label:"Entradas", data: yms.map(y => porMes[y].entradas), backgroundColor:"#3ECF8E", borderRadius:3, maxBarThickness:34 },
        { label:"Saídas",   data: yms.map(y => porMes[y].saidas),   backgroundColor:"#F0564A", borderRadius:3, maxBarThickness:34 },
        { label:"Saldo", type:"line", data: saldos, borderColor:"#F5B301", backgroundColor:"#F5B301",
          borderWidth:2.5, pointRadius:3, tension:.15 },
      ]
    },
    options: opcoesGrafico({ moeda:true })
  });

  // Saídas por grupo (barras CSS)
  const porGrupo = {};
  for (const l of dados.lanc) {
    if (!l.saida || l.grupo === "Recebimentos") continue;
    porGrupo[l.grupo] = (porGrupo[l.grupo] || 0) + l.saida;
  }
  const lista = Object.entries(porGrupo).sort((a,b) => b[1]-a[1]);
  const max = lista.length ? lista[0][1] : 1;
  $("grupos-painel").innerHTML = lista.map(([g,v]) => `
    <div class="grupo-linha">
      <span class="grupo-nome">${escHtml(g)}</span>
      <div class="grupo-barra-fundo">
        <div class="grupo-barra" style="width:${(v/max*100).toFixed(1)}%;background:${CORES_GRUPO[g]||"#8B919C"}"></div>
      </div>
      <span class="grupo-valor">${brl0(v)}</span>
    </div>`).join("") || '<div class="vazio">Sem saídas registradas.</div>';
}

function kpi(rotulo, valor, sub, cls) {
  return `<div class="kpi">
    <div class="kpi-rotulo">${rotulo}</div>
    <div class="kpi-valor ${cls||""}">${valor}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
  </div>`;
}

/* ═══════════════ EXTRATO ═══════════════ */
function prepararFiltrosExtrato() {
  const meses = [...new Set(dados.lanc.map(l => l.data.slice(0,7)))].sort();
  $("ext-filtro-mes").innerHTML =
    '<option value="todos">Todos os meses</option>' +
    meses.map(m => `<option value="${m}" ${m===filtroExt.mes?"selected":""}>${mesLabel(m)}</option>`).join("");
  const grupos = [...new Set(dados.lanc.map(l => l.grupo))].sort();
  $("ext-filtro-grupo").innerHTML =
    '<option value="todos">Todos os grupos</option>' +
    grupos.map(g => `<option ${g===filtroExt.grupo?"selected":""}>${escHtml(g)}</option>`).join("");
}

function renderExtrato() {
  // saldo corrido na ordem cronológica
  let acc = dados.saldoInicial;
  const comSaldo = dados.lanc.map(l => ({ ...l, saldo: (acc += l.entrada - l.saida) }));

  const q = filtroExt.busca.trim().toLowerCase();
  const filtrado = comSaldo.filter(l =>
    (filtroExt.mes === "todos" || l.data.slice(0,7) === filtroExt.mes) &&
    (filtroExt.grupo === "todos" || l.grupo === filtroExt.grupo) &&
    (!q || (l.descricao + " " + l.subgrupo + " " + l.grupo).toLowerCase().includes(q))
  ).reverse();

  let ent = 0, sai = 0;
  for (const l of filtrado) { ent += l.entrada; sai += l.saida; }
  $("ext-resumo").innerHTML =
    `<span>${filtrado.length} lançamentos</span>
     <span class="pos">Entradas ${brl0(ent)}</span>
     <span class="neg">Saídas ${brl0(sai)}</span>
     <span>Líquido ${brl0(ent - sai)}</span>`;

  $("ext-corpo").innerHTML = filtrado.map(l => {
    const valor = l.entrada > 0 ? l.entrada : -l.saida;
    return `<tr>
      <td class="td-data">${fData(l.data)}</td>
      <td><span class="chip" style="border-color:${CORES_GRUPO[l.grupo]||"#3A3F48"};color:${CORES_GRUPO[l.grupo]||"#A3A8B4"}">${escHtml(l.grupo)}</span></td>
      <td class="td-desc">${escHtml(l.descricao || l.subgrupo || "—")}</td>
      <td class="td-mudo">${escHtml(l.banco)}</td>
      <td class="num ${valor >= 0 ? "pos" : "neg"}">${brl(valor)}</td>
      <td class="num td-saldo ${l.saldo < 0 ? "neg" : ""}">${brl0(l.saldo)}</td>
      <td><button class="btn-editar" onclick="abrirModalLancamento(${l.id})" title="Editar">✎</button></td>
    </tr>`;
  }).join("") ||
  '<tr><td colspan="7" class="vazio">Nenhum lançamento para este filtro. Ajuste o mês ou o grupo acima.</td></tr>';
}

function abrirModalLancamento(id) {
  const l = id ? dados.lanc.find(x => x.id === id) : null;
  const tipo = l ? (l.entrada > 0 ? "entrada" : "saida") : "saida";
  abrirModal({
    titulo: l ? "Editar lançamento" : "Novo lançamento",
    tabela: "lancamentos", id,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: l?.data || hoje() },
      { nome:"_tipo", rotulo:"Tipo", tipo:"select", opcoes:["saida|Saída","entrada|Entrada"], valor: tipo },
      { nome:"grupo", rotulo:"Grupo", tipo:"select", opcoes: GRUPOS_SAIDA.concat("Recebimentos"), valor: l?.grupo || "Combustível" },
      { nome:"banco", rotulo:"Conta", tipo:"select", opcoes:["Bradesco","Caixa"], valor: l?.banco || "Bradesco" },
      { nome:"_valor", rotulo:"Valor (R$)", tipo:"numero", valor: l ? (l.entrada > 0 ? l.entrada : l.saida) : "" },
      { nome:"descricao", rotulo:"Descrição", tipo:"texto", largo:true, valor: l?.descricao || "" },
    ],
    montar(f) {
      const v = Number(f._valor);
      if (!v || v <= 0) throw "Informe um valor maior que zero.";
      return {
        data: f.data,
        banco: f.banco,
        grupo: f._tipo === "entrada" ? "Recebimentos" : f.grupo,
        subgrupo: "",
        entrada: f._tipo === "entrada" ? v : 0,
        saida:   f._tipo === "saida"   ? v : 0,
        descricao: f.descricao.trim(),
      };
    }
  });
}

/* ═══════════════ RECEBIMENTOS ═══════════════ */
function renderRecebimentos() {
  // resumo por cliente
  const porCliente = {};
  for (const r of dados.rec) {
    const c = r.cliente;
    if (!porCliente[c]) porCliente[c] = { horas:0, faturado:0, recebido:0 };
    porCliente[c].horas    += r.horas;
    porCliente[c].faturado += r.valor_total;
    porCliente[c].recebido += r.valor_pago;
  }
  $("rec-clientes").innerHTML = Object.entries(porCliente).map(([c, d]) => {
    const aberto = d.faturado - d.recebido;
    return `<div class="cliente-cartao ${filtroCliente === c ? "ativo" : ""}" data-cliente="${escHtml(c)}">
      <div class="cliente-nome">${escHtml(c)}</div>
      <div class="cliente-dados">
        <div><span>Horas</span><b>${num(d.horas)} h</b></div>
        <div><span>Faturado</span><b>${brl0(d.faturado)}</b></div>
        <div><span>Recebido</span><b class="pos">${brl0(d.recebido)}</b></div>
        <div><span>Em aberto</span><b class="${aberto > 0.5 ? "neg" : ""}">${brl0(aberto)}</b></div>
      </div>
    </div>`;
  }).join("");

  const filtrado = dados.rec
    .filter(r => filtroCliente === "todos" || r.cliente === filtroCliente)
    .slice().reverse();

  $("rec-corpo").innerHTML = filtrado.map(r => `<tr>
    <td class="td-data">${fData(r.data)}</td>
    <td>${escHtml(r.cliente)}</td>
    <td class="num td-mudo">${r.hora_inicial != null ? num(r.hora_inicial) + " → " + num(r.hora_final) : "—"}</td>
    <td class="num">${r.horas ? num(r.horas) : "—"}</td>
    <td class="num td-mudo">${r.valor_hora ? brl0(r.valor_hora) : "—"}</td>
    <td class="num">${r.valor_total ? brl0(r.valor_total) : "—"}</td>
    <td class="num ${r.valor_pago ? "pos" : ""}">${r.valor_pago ? brl0(r.valor_pago) : "—"}</td>
    <td class="td-mudo">${escHtml(r.forma) || "—"}</td>
    <td><button class="btn-editar" onclick="abrirModalRecebimento(${r.id})" title="Editar">✎</button></td>
  </tr>`).join("") ||
  '<tr><td colspan="9" class="vazio">Nenhum registro. Use o botão acima para lançar horas trabalhadas ou pagamentos.</td></tr>';
}

function filtrarCliente(c) {
  filtroCliente = (filtroCliente === c) ? "todos" : c;
  renderRecebimentos();
}

function abrirModalRecebimento(id) {
  const r = id ? dados.rec.find(x => x.id === id) : null;
  const clientes = [...new Set(dados.rec.map(x => x.cliente))];
  abrirModal({
    titulo: r ? "Editar registro" : "Novo registro",
    tabela: "recebimentos", id,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: r?.data || hoje() },
      { nome:"cliente", rotulo:"Cliente", tipo:"texto", valor: r?.cliente || "", lista: clientes },
      { nome:"hora_inicial", rotulo:"Horímetro inicial", tipo:"numero", valor: r?.hora_inicial ?? "" },
      { nome:"hora_final", rotulo:"Horímetro final", tipo:"numero", valor: r?.hora_final ?? "" },
      { nome:"valor_hora", rotulo:"Valor da hora (R$)", tipo:"numero", valor: r?.valor_hora ?? 350 },
      { nome:"valor_pago", rotulo:"Valor pago (R$)", tipo:"numero", valor: r?.valor_pago ?? 0 },
      { nome:"forma", rotulo:"Forma de pagamento", tipo:"select", largo:true,
        opcoes:["|—","Bradesco- Empresa","Caixa - Dinheiro","Pix","Cheque"], valor: r?.forma || "" },
    ],
    montar(f) {
      if (!f.cliente.trim()) throw "Informe o cliente.";
      const hi = f.hora_inicial === "" ? null : Number(f.hora_inicial);
      const hf = f.hora_final === "" ? null : Number(f.hora_final);
      const horas = (hi != null && hf != null) ? Math.max(0, hf - hi) : 0;
      const vh = Number(f.valor_hora) || 0;
      return {
        data: f.data, cliente: f.cliente.trim(),
        hora_inicial: hi, hora_final: hf, horas,
        valor_hora: vh, valor_total: horas * vh,
        valor_pago: Number(f.valor_pago) || 0,
        forma: f.forma,
      };
    }
  });
}

/* ═══════════════ DIESEL ═══════════════ */
function renderDiesel() {
  let litros = 0, custo = 0, horas = 0;
  const pontos = [];
  for (const d of dados.die) {
    litros += d.litros; custo += d.valor_total;
    if (d.horas) horas += d.horas;
    if (d.valor_unit > 0 && d.litros > 0) pontos.push({ x: fData(d.data), y: d.valor_unit });
  }
  $("kpis-diesel").innerHTML = [
    kpi("Diesel consumido", num(litros,0) + " L", brl0(custo) + " no período"),
    kpi("Preço médio do litro", brl(litros > 0 ? custo/litros : 0)),
    kpi("Consumo da máquina", num(horas > 0 ? litros/horas : 0, 1) + " L/h", num(horas,0) + " h no horímetro"),
    kpi("Custo de diesel por hora", brl(horas > 0 ? custo/horas : 0), "", "amarelo"),
  ].join("");

  desenharGrafico("graf-diesel", {
    type: "line",
    data: {
      labels: pontos.map(p => p.x),
      datasets: [{ label:"R$/L", data: pontos.map(p => p.y),
        borderColor:"#F5B301", backgroundColor:"#F5B301", borderWidth:2, pointRadius:2.5, tension:.1 }]
    },
    options: opcoesGrafico({ legenda:false, decimais:2 })
  });

  $("die-corpo").innerHTML = dados.die.slice().reverse().map(d => `<tr>
    <td class="td-data">${fData(d.data)}</td>
    <td class="num td-mudo">${d.hora_inicial != null ? num(d.hora_inicial) + " → " + num(d.hora_final) : "s/ inf."}</td>
    <td class="num">${d.horas ? num(d.horas) : "—"}</td>
    <td class="num">${d.litros ? num(d.litros,0) : "—"}</td>
    <td class="num td-mudo">${d.valor_unit ? brl(d.valor_unit) : "—"}</td>
    <td class="num neg">${d.valor_total ? brl(d.valor_total) : "—"}</td>
    <td><button class="btn-editar" onclick="abrirModalDiesel(${d.id})" title="Editar">✎</button></td>
  </tr>`).join("") ||
  '<tr><td colspan="7" class="vazio">Nenhum abastecimento registrado.</td></tr>';
}

function abrirModalDiesel(id) {
  const d = id ? dados.die.find(x => x.id === id) : null;
  abrirModal({
    titulo: d ? "Editar abastecimento" : "Novo abastecimento",
    tabela: "diesel", id,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: d?.data || hoje() },
      { nome:"litros", rotulo:"Litros", tipo:"numero", valor: d?.litros ?? "" },
      { nome:"valor_unit", rotulo:"Preço do litro (R$)", tipo:"numero", valor: d?.valor_unit ?? "" },
      { nome:"hora_inicial", rotulo:"Horímetro inicial", tipo:"numero", valor: d?.hora_inicial ?? "" },
      { nome:"hora_final", rotulo:"Horímetro final", tipo:"numero", valor: d?.hora_final ?? "" },
    ],
    montar(f) {
      const litros = Number(f.litros) || 0;
      const vu = Number(f.valor_unit) || 0;
      if (!litros && !vu) throw "Informe pelo menos os litros e o preço.";
      const hi = f.hora_inicial === "" ? null : Number(f.hora_inicial);
      const hf = f.hora_final === "" ? null : Number(f.hora_final);
      return {
        data: f.data, litros, valor_unit: vu, valor_total: litros * vu,
        hora_inicial: hi, hora_final: hf,
        horas: (hi != null && hf != null) ? Math.max(0, hf - hi) : null,
      };
    }
  });
}

/* ═══════════════ AGENDA ═══════════════ */
function renderAgenda() {
  const meses = [...new Set(dados.age.map(a => a.mes))].sort((a,b) => a-b);
  const porItem = {};
  for (const a of dados.age) {
    const chave = a.item + "§" + a.dia;
    if (!porItem[chave]) porItem[chave] = { item: a.item, dia: a.dia, valores: {}, ids: {} };
    porItem[chave].valores[a.mes] = (porItem[chave].valores[a.mes] || 0) + a.valor;
    porItem[chave].ids[a.mes] = a.id;
  }
  const itens = Object.values(porItem)
    .map(i => ({ ...i, total: Object.values(i.valores).reduce((s,v) => s+v, 0) }))
    .sort((a,b) => b.total - a.total);

  const totaisMes = meses.map(m => itens.reduce((s,i) => s + (i.valores[m] || 0), 0));
  const totalGeral = totaisMes.reduce((s,v) => s+v, 0);
  $("age-total-nota").textContent = "total previsto: " + brl0(totalGeral);

  desenharGrafico("graf-agenda", {
    type: "bar",
    data: {
      labels: meses.map(m => MESES[m-1]),
      datasets: [{ label:"Compromissos", data: totaisMes, backgroundColor:"#F5B301", borderRadius:3, maxBarThickness:40 }]
    },
    options: opcoesGrafico({ legenda:false, moeda:true })
  });

  $("age-cabeca").innerHTML = `<tr>
    <th class="col-fixa">Compromisso</th><th class="num">Dia</th>
    ${meses.map(m => `<th class="num">${MESES[m-1]}</th>`).join("")}
    <th class="num">Total</th></tr>`;

  $("age-corpo").innerHTML = itens.map(i => `
    <tr class="linha-clicavel" data-item="${escHtml(i.item)}" data-dia="${escHtml(i.dia)}">
      <td class="col-fixa td-desc">${escHtml(i.item)}</td>
      <td class="num td-mudo">${escHtml(i.dia) || "—"}</td>
      ${meses.map(m => `<td class="num ${i.valores[m] ? "" : "td-zero"}">${i.valores[m] ? num(i.valores[m],0) : "·"}</td>`).join("")}
      <td class="num td-total">${brl0(i.total)}</td>
    </tr>`).join("") +
    `<tr class="linha-total">
      <td class="col-fixa">Total do mês</td><td></td>
      ${totaisMes.map(t => `<td class="num">${num(t,0)}</td>`).join("")}
      <td class="num td-total">${brl0(totalGeral)}</td>
    </tr>`;
}

// clicar num compromisso: escolhe o mês a editar via modal
function abrirModalAgendaItem(item, dia) {
  const linhas = dados.age.filter(a => a.item === item && a.dia === dia);
  const opcoes = linhas.map(a => `${a.id}|${MESES[a.mes-1]} — ${brl0(a.valor)}`);
  abrirModal({
    titulo: "Compromisso: " + item,
    tabela: "_escolha_agenda",
    campos: [
      { nome:"_id", rotulo:"Escolha o mês para editar", tipo:"select", largo:true, opcoes: opcoes, valor: String(linhas[0].id) },
    ],
    montar(f) { return { _id: Number(f._id) }; },
    aoSalvar(reg) { fecharModal(); abrirModalAgenda(reg._id); }
  });
}

function abrirModalAgenda(id) {
  const a = id ? dados.age.find(x => x.id === id) : null;
  abrirModal({
    titulo: a ? "Editar compromisso" : "Novo compromisso",
    tabela: "agenda", id,
    campos: [
      { nome:"item", rotulo:"Compromisso", tipo:"texto", largo:true, valor: a?.item || "" },
      { nome:"dia", rotulo:"Dia do vencimento", tipo:"texto", valor: a?.dia || "" },
      { nome:"mes", rotulo:"Mês", tipo:"select",
        opcoes: MESES.map((m,i) => `${i+1}|${m}`), valor: String(a?.mes || (new Date().getMonth()+1)) },
      { nome:"valor", rotulo:"Valor (R$)", tipo:"numero", valor: a?.valor ?? "" },
    ],
    montar(f) {
      if (!f.item.trim()) throw "Informe o nome do compromisso.";
      const v = Number(f.valor);
      if (!v || v <= 0) throw "Informe um valor maior que zero.";
      return { item: f.item.trim(), dia: f.dia.trim(), mes: Number(f.mes), valor: v };
    }
  });
}

/* ═══════════════ MODAL GENÉRICO + CRUD ═══════════════ */
let modalCtx = null;

function abrirModal(ctx) {
  modalCtx = ctx;
  $("modal-titulo").textContent = ctx.titulo;
  $("modal-erro").classList.add("oculto");

  $("modal-campos").innerHTML = ctx.campos.map(c => {
    const largo = c.largo ? "form-larga" : "";
    if (c.tipo === "select") {
      const ops = c.opcoes.map(o => {
        const [val, rot] = String(o).includes("|") ? o.split("|") : [o, o];
        return `<option value="${escHtml(val)}" ${String(c.valor) === String(val) ? "selected" : ""}>${escHtml(rot)}</option>`;
      }).join("");
      return `<label class="${largo}">${c.rotulo}<select data-campo="${c.nome}">${ops}</select></label>`;
    }
    const tipo = c.tipo === "date" ? "date" : c.tipo === "numero" ? "number" : "text";
    const extra = c.tipo === "numero" ? 'step="any" inputmode="decimal"' : "";
    const listaId = c.lista ? `lista-${c.nome}` : "";
    const listaHtml = c.lista
      ? `<datalist id="${listaId}">${c.lista.map(v => `<option value="${escHtml(v)}">`).join("")}</datalist>` : "";
    return `<label class="${largo}">${c.rotulo}
      <input type="${tipo}" ${extra} data-campo="${c.nome}" value="${escHtml(c.valor)}" ${c.lista ? `list="${listaId}"` : ""}>
      ${listaHtml}</label>`;
  }).join("");

  const btnExcluir = $("modal-excluir");
  btnExcluir.classList.toggle("oculto", !ctx.id);
  btnExcluir.onclick = () => excluirRegistro();
  $("modal-salvar").onclick = () => salvarRegistro();
  $("modal-fundo").classList.remove("oculto");
}

function fecharModal() {
  $("modal-fundo").classList.add("oculto");
  modalCtx = null;
}

function lerFormulario() {
  const f = {};
  document.querySelectorAll("#modal-campos [data-campo]").forEach(el => f[el.dataset.campo] = el.value);
  return f;
}

async function salvarRegistro() {
  if (!modalCtx) return;
  const btn = $("modal-salvar"), erro = $("modal-erro");
  erro.classList.add("oculto");
  let reg;
  try { reg = modalCtx.montar(lerFormulario()); }
  catch (msg) { erro.textContent = msg; erro.classList.remove("oculto"); return; }

  if (modalCtx.aoSalvar) { modalCtx.aoSalvar(reg); return; }

  btn.disabled = true; btn.textContent = "Salvando…";
  const q = modalCtx.id
    ? sb.from(modalCtx.tabela).update(reg).eq("id", modalCtx.id)
    : sb.from(modalCtx.tabela).insert(reg);
  const { error } = await q;
  btn.disabled = false; btn.textContent = "Salvar";
  if (error) {
    erro.textContent = "Não foi possível salvar: " + error.message;
    erro.classList.remove("oculto");
    return;
  }
  fecharModal();
  toast("Registro salvo.");
  await carregarTudo();
}

async function excluirRegistro() {
  if (!modalCtx || !modalCtx.id) return;
  if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
  const { error } = await sb.from(modalCtx.tabela).delete().eq("id", modalCtx.id);
  if (error) {
    $("modal-erro").textContent = "Não foi possível excluir: " + error.message;
    $("modal-erro").classList.remove("oculto");
    return;
  }
  fecharModal();
  toast("Registro excluído.");
  await carregarTudo();
}

/* ═══════════════ GRÁFICOS (Chart.js) ═══════════════ */
function desenharGrafico(idCanvas, cfg) {
  if (typeof Chart === "undefined") {
    console.error("Chart.js não carregou — o gráfico '" + idCanvas + "' não pôde ser desenhado.");
    return;
  }
  if (graficos[idCanvas]) graficos[idCanvas].destroy();
  graficos[idCanvas] = new Chart($(idCanvas), cfg);
}

function opcoesGrafico({ legenda = true, moeda = false, decimais = 0 } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: legenda, labels: { color: "#8B919C", font: { family: "Inter", size: 12 } } },
      tooltip: {
        backgroundColor: "#1E2128", borderColor: "#2C3038", borderWidth: 1,
        titleColor: "#E8EAED", bodyColor: "#E8EAED",
        callbacks: {
          label: (c) => `${c.dataset.label}: ` +
            (moeda ? brl0(c.parsed.y) : c.parsed.y.toLocaleString("pt-BR", { maximumFractionDigits: decimais || 2 })),
        }
      }
    },
    scales: {
      x: { ticks: { color: "#8B919C", font: { family: "Inter", size: 11 } }, grid: { display: false } },
      y: {
        ticks: {
          color: "#8B919C", font: { family: "JetBrains Mono", size: 11 },
          callback: (v) => moeda ? (Math.abs(v) >= 1000 ? (v/1000).toFixed(0) + "k" : v) : v.toFixed(decimais),
        },
        grid: { color: "#262A32" },
      }
    }
  };
}
