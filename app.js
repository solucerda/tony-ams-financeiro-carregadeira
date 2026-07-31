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
let filtroPainel = { periodo: "tudo", natureza: "todos", tipoFluxo: "bar", agrupar: "grupo", visual: "lista" };
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
const CORES_NATUREZA = { "Custo fixo":"#7A8CF0", "Custo variável":"#F5B301", "Investimento":"#C77DFF" };
const ROTULO_NATUREZA = { Fixo:"Custo fixo", Variavel:"Custo variável", Investimento:"Investimento" };

/* ── Utilidades ────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const brl  = (v) => (v ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const brl0 = (v) => (v ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });
const num  = (v, d=1) => (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits:d });
const mesLabel = (ym) => { const [a,m] = ym.split("-"); return `${MESES[+m-1]}/${a.slice(2)}`; };
const fData = (iso) => { const [a,m,d] = iso.split("-"); return `${d}/${m}/${a.slice(2)}`; };
const hoje = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("oculto");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("oculto"), 3200);
}

// Liga um grupo de botões "segmentado" (ex.: Barras / Linhas): ao clicar,
// marca o botão como ativo e chama aoMudar(valor).
function ligarSegmentado(idContainer, aoMudar) {
  $(idContainer).addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-valor]");
    if (!btn) return;
    $(idContainer).querySelectorAll("button").forEach(b => b.classList.toggle("ativo", b === btn));
    aoMudar(btn.dataset.valor);
  });
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
  $("ext-exportar").addEventListener("click", exportarExtratoCSV);
  $("rec-exportar").addEventListener("click", exportarRecebimentosCSV);

  // filtros e alternadores do painel
  $("pnl-periodo").addEventListener("change", e => { filtroPainel.periodo = e.target.value; renderPainel(); });
  $("pnl-natureza").addEventListener("change", e => { filtroPainel.natureza = e.target.value; renderPainel(); });
  ligarSegmentado("pnl-tipo-fluxo", (v) => { filtroPainel.tipoFluxo = v; renderPainel(); });
  ligarSegmentado("pnl-agrupar", (v) => { filtroPainel.agrupar = v; renderPainel(); });
  ligarSegmentado("pnl-visual", (v) => { filtroPainel.visual = v; renderPainel(); });

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
    dados.lanc = (lanc.data || []).map(o => normNum(o, "lancamentos"));
    dados.rec  = (rec.data  || []).map(o => normNum(o, "recebimentos"));
    dados.die  = (die.data  || []).map(o => normNum(o, "diesel"));
    dados.age  = (age.data  || []).map(o => normNum(o, "agenda"));

    $("carregando").classList.add("oculto");
    $("aba-painel").classList.remove("oculto");
    renderTudo();
  } catch (e) {
    $("carregando").textContent =
      "Não foi possível carregar os dados. Confira se o script schema.sql foi executado no Supabase e se a URL/anon key do config.js estão corretas. (" + (e.message || e) + ")";
  }
}

// Supabase devolve numeric como string — converte tudo que for número,
// exceto os campos que são texto por natureza (mesmo quando só têm dígitos,
// como o "dia" do vencimento na agenda — "05" precisa continuar string,
// senão a comparação com o dataset do HTML, que é sempre string, falha).
const CAMPOS_TEXTO = {
  lancamentos:  new Set(["data", "banco", "grupo", "subgrupo", "descricao"]),
  recebimentos: new Set(["data", "cliente", "forma"]),
  diesel:       new Set(["data"]),
  agenda:       new Set(["item", "dia"]),
};

function normNum(obj, tabela) {
  const pular = CAMPOS_TEXTO[tabela] || new Set();
  const o = { ...obj };
  for (const k in o) {
    if (pular.has(k)) continue;
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

// Usa os meses do Extrato como referência da linha do tempo (é o dado mais
// completo) e aplica a mesma janela a qualquer lista que tenha campo "data".
function noPeriodo(lista) {
  if (filtroPainel.periodo === "tudo") return lista;
  const mesesTodos = [...new Set(dados.lanc.map(l => l.data.slice(0,7)))].sort();
  if (!mesesTodos.length) return lista;
  const n = { mes_atual:1, "3m":3, "6m":6, "12m":12 }[filtroPainel.periodo] || mesesTodos.length;
  const janela = new Set(mesesTodos.slice(-n));
  return lista.filter(x => janela.has(x.data.slice(0,7)));
}

function renderPainel() {
  const periodoLanc = noPeriodo(dados.lanc);
  const periodoRec  = noPeriodo(dados.rec);
  const periodoDie  = noPeriodo(dados.die);

  // KPIs — "Saldo em caixa" e "Em aberto a receber" são o estado atual do
  // negócio (não mudam com o filtro de período); os demais refletem só a
  // janela selecionada, pra comparar meses/trimestres entre si.
  let ent = 0, sai = 0, saiOperacional = 0;
  for (const l of periodoLanc) {
    ent += l.entrada;
    sai += l.saida;
    if (l.natureza !== "Investimento") saiOperacional += l.saida;
  }
  let horas = 0, faturado = 0;
  for (const r of periodoRec) { horas += r.horas; faturado += r.valor_total; }
  let faturadoTotal = 0, recebidoTotal = 0;
  for (const r of dados.rec) { faturadoTotal += r.valor_total; recebidoTotal += r.valor_pago; }
  const emAberto = faturadoTotal - recebidoTotal;
  let litros = 0, custoDie = 0, horasMaq = 0;
  for (const d of periodoDie) {
    litros += d.litros; custoDie += d.valor_total;
    if (d.horas) horasMaq += d.horas;
  }
  const custoHora = horasMaq > 0 ? custoDie / horasMaq : 0;
  const s = saldoAtual();
  const res = ent - sai;
  // resultado operacional: exclui saídas classificadas como "Investimento"
  // (compra de equipamento, consórcio, capitalização) — mostra se a operação
  // do dia a dia é lucrativa, separado de aportes de capital.
  const resOperacional = ent - saiOperacional;

  $("kpis-painel").innerHTML = [
    kpi("Saldo em caixa", brl(s), "bancos + dinheiro · total", s >= 0 ? "pos" : "neg"),
    kpi("Entradas", brl0(ent), "", "pos"),
    kpi("Saídas", brl0(sai), "", "neg"),
    kpi("Resultado", brl0(res), "entradas − saídas", res >= 0 ? "pos" : "neg"),
    kpi("Resultado operacional", brl0(resOperacional), "sem Investimento", resOperacional >= 0 ? "pos" : "neg"),
    kpi("Em aberto a receber", brl0(emAberto), "faturado − recebido · total", emAberto > 0.5 ? "neg" : "pos"),
    kpi("Horas faturadas", num(horas) + " h", brl0(faturado) + " gerados"),
    kpi("Diesel por hora", brl(custoHora), num(litros,0) + " L · " + brl0(custoDie)),
  ].join("");

  // Fluxo mensal — respeita o período; barras ou linhas conforme o alternador
  const porMes = {};
  for (const l of periodoLanc) {
    const ym = l.data.slice(0,7);
    if (!porMes[ym]) porMes[ym] = { entradas:0, saidas:0 };
    porMes[ym].entradas += l.entrada;
    porMes[ym].saidas   += l.saida;
  }
  const yms = Object.keys(porMes).sort();
  // saldo acumulado sempre considera o histórico completo (é o saldo real),
  // mesmo quando o gráfico mostra só uma janela de meses
  let acc = dados.saldoInicial;
  const saldoPorMes = {};
  for (const l of dados.lanc.slice().sort((a,b) => a.data.localeCompare(b.data))) {
    const ym = l.data.slice(0,7);
    acc += l.entrada - l.saida;
    saldoPorMes[ym] = acc;
  }
  const tipo = filtroPainel.tipoFluxo; // "bar" | "line"

  desenharGrafico("graf-fluxo", {
    type: "bar",
    data: {
      labels: yms.map(mesLabel),
      datasets: [
        { label:"Entradas", type: tipo, data: yms.map(y => porMes[y].entradas), backgroundColor:"#3ECF8E", borderColor:"#3ECF8E", borderRadius:3, maxBarThickness:34, tension:.2, fill:false },
        { label:"Saídas",   type: tipo, data: yms.map(y => porMes[y].saidas),   backgroundColor:"#F0564A", borderColor:"#F0564A", borderRadius:3, maxBarThickness:34, tension:.2, fill:false },
        { label:"Saldo", type:"line", data: yms.map(y => saldoPorMes[y]), borderColor:"#F5B301", backgroundColor:"#F5B301",
          borderWidth:2.5, pointRadius:3, tension:.15 },
      ]
    },
    options: opcoesGrafico({ moeda:true })
  });

  renderComposicao(periodoLanc);
}

// "Para onde vai o dinheiro" — agrupa por grupo ou por natureza (custo fixo/
// variável/investimento), com filtro de natureza aplicado, e mostra como
// lista de barras (CSS) ou gráfico de pizza (Chart.js), conforme escolhido.
function renderComposicao(periodoLanc) {
  const porNatureza = filtroPainel.agrupar === "natureza";
  const bucket = {};
  for (const l of periodoLanc) {
    if (!l.saida || l.grupo === "Recebimentos") continue;
    if (filtroPainel.natureza !== "todos" && l.natureza !== filtroPainel.natureza) continue;
    const chave = porNatureza ? (ROTULO_NATUREZA[l.natureza] || "Custo variável") : l.grupo;
    bucket[chave] = (bucket[chave] || 0) + l.saida;
  }
  const lista = Object.entries(bucket).sort((a,b) => b[1]-a[1]);
  const cores = porNatureza ? CORES_NATUREZA : CORES_GRUPO;

  const mostrarPizza = filtroPainel.visual === "pizza" && lista.length > 0;
  $("grupos-painel").classList.toggle("oculto", mostrarPizza);
  $("composicao-grafico-caixa").classList.toggle("oculto", !mostrarPizza);

  if (!mostrarPizza) {
    const max = lista.length ? lista[0][1] : 1;
    $("grupos-painel").innerHTML = lista.map(([g,v]) => `
      <div class="grupo-linha">
        <span class="grupo-nome">${escHtml(g)}</span>
        <div class="grupo-barra-fundo">
          <div class="grupo-barra" style="width:${(v/max*100).toFixed(1)}%;background:${cores[g]||"#8B919C"}"></div>
        </div>
        <span class="grupo-valor">${brl0(v)}</span>
      </div>`).join("") || '<div class="vazio">Sem saídas para este filtro.</div>';
    return;
  }

  desenharGrafico("graf-composicao", {
    type: "doughnut",
    data: {
      labels: lista.map(([g]) => g),
      datasets: [{ data: lista.map(([,v]) => v), backgroundColor: lista.map(([g]) => cores[g] || "#8B919C"), borderColor:"#1E2128", borderWidth:2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:"right", labels: { color:"#8B919C", font:{ family:"Inter", size:11 }, boxWidth:12 } },
        tooltip: {
          backgroundColor:"#1E2128", borderColor:"#2C3038", borderWidth:1, titleColor:"#E8EAED", bodyColor:"#E8EAED",
          callbacks: { label: (c) => `${c.label}: ${brl0(c.parsed)}` }
        }
      }
    }
  });
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
    const natTxt = l.natureza && l.natureza !== "Receita" ? ROTULO_NATUREZA[l.natureza] || l.natureza : "";
    return `<tr>
      <td class="td-data">${fData(l.data)}</td>
      <td>
        <span class="chip" style="border-color:${CORES_GRUPO[l.grupo]||"#3A3F48"};color:${CORES_GRUPO[l.grupo]||"#A3A8B4"}">${escHtml(l.grupo)}</span>
        ${natTxt ? `<div class="td-natureza">${escHtml(natTxt)}</div>` : ""}
      </td>
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
      { nome:"natureza", rotulo:"Natureza (só p/ saída)", tipo:"select",
        opcoes:["Variavel|Custo variável","Fixo|Custo fixo","Investimento|Investimento"],
        valor: (l?.natureza && l.natureza !== "Receita") ? l.natureza : (l?.grupo === "Investimento" ? "Investimento" : "Variavel") },
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
        natureza: f._tipo === "entrada" ? "Receita" : f.natureza,
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
    },
    async aposSalvar(salvo) {
      await sincronizarLancamento({
        origemId: salvo.id, tabelaOrigem: "recebimentos", lancamentoId: r?.lancamento_id ?? salvo.lancamento_id,
        valor: salvo.valor_pago, tipo: "entrada", data: salvo.data,
        grupo: "Recebimentos", descricao: "Recebimento - " + salvo.cliente,
      });
    },
    async aoExcluir() { await removerLancamentoVinculado(r?.lancamento_id); },
  });
}

/* ═══════════════ DIESEL ═══════════════ */
function renderDiesel() {
  let litros = 0, custo = 0, horas = 0, aPagar = 0, vencido = 0;
  const pontos = [];
  const hj = hoje();
  for (const d of dados.die) {
    litros += d.litros; custo += d.valor_total;
    if (d.horas) horas += d.horas;
    if (d.valor_unit > 0 && d.litros > 0) pontos.push({ x: fData(d.data), y: d.valor_unit });
    if (d.status === "pendente") {
      aPagar += d.valor_total;
      if (d.vencimento && d.vencimento < hj) vencido += d.valor_total;
    }
  }
  $("kpis-diesel").innerHTML = [
    kpi("Diesel consumido", num(litros,0) + " L", brl0(custo) + " no período"),
    kpi("Preço médio do litro", brl(litros > 0 ? custo/litros : 0)),
    kpi("Consumo da máquina", num(horas > 0 ? litros/horas : 0, 1) + " L/h", num(horas,0) + " h no horímetro"),
    kpi("Custo de diesel por hora", brl(horas > 0 ? custo/horas : 0), "", "amarelo"),
    kpi("Diesel a pagar", brl0(aPagar), vencido > 0 ? brl0(vencido) + " vencido" : "em dia", aPagar > 0 ? "neg" : "pos"),
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

  $("die-corpo").innerHTML = dados.die.slice().reverse().map(d => {
    const venceu = d.status === "pendente" && d.vencimento && d.vencimento < hj;
    const statusHtml = d.status === "pendente"
      ? `<span class="chip chip-status ${venceu ? "chip-vencido" : "chip-pendente"}">${venceu ? "Vencido" : "A pagar"}</span>`
      : `<span class="chip chip-status chip-pago">Pago</span>`;
    return `<tr>
    <td class="td-data">${fData(d.data)}</td>
    <td class="td-desc">${escHtml(d.local) || "—"}</td>
    <td class="num td-mudo">${d.hora_inicial != null ? num(d.hora_inicial) + " → " + num(d.hora_final) : "s/ inf."}</td>
    <td class="num">${d.horas ? num(d.horas) : "—"}</td>
    <td class="num">${d.litros ? num(d.litros,0) : "—"}</td>
    <td class="num td-mudo">${d.valor_unit ? brl(d.valor_unit) : "—"}</td>
    <td class="num neg">${d.valor_total ? brl(d.valor_total) : "—"}</td>
    <td>${statusHtml}${d.status === "pendente" && d.vencimento ? `<div class="td-vencimento">vence ${fData(d.vencimento)}</div>` : ""}</td>
    <td><button class="btn-editar" onclick="abrirModalDiesel(${d.id})" title="Editar">✎</button></td>
  </tr>`;
  }).join("") ||
  '<tr><td colspan="9" class="vazio">Nenhum abastecimento registrado.</td></tr>';
}

function abrirModalDiesel(id) {
  const d = id ? dados.die.find(x => x.id === id) : null;
  abrirModal({
    titulo: d ? "Editar abastecimento" : "Novo abastecimento",
    tabela: "diesel", id,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: d?.data || hoje() },
      { nome:"local", rotulo:"Local / fornecedor", tipo:"texto", largo:true, valor: d?.local || "" },
      { nome:"litros", rotulo:"Litros", tipo:"numero", valor: d?.litros ?? "" },
      { nome:"valor_unit", rotulo:"Preço do litro (R$)", tipo:"numero", valor: d?.valor_unit ?? "" },
      { nome:"hora_inicial", rotulo:"Horímetro inicial", tipo:"numero", valor: d?.hora_inicial ?? "" },
      { nome:"hora_final", rotulo:"Horímetro final", tipo:"numero", valor: d?.hora_final ?? "" },
      { nome:"status", rotulo:"Situação", tipo:"select", opcoes:["pago|Pago à vista","pendente|A pagar (fiado)"], valor: d?.status || "pago" },
      { nome:"vencimento", rotulo:"Vencimento (se a pagar)", tipo:"date", valor: d?.vencimento || "" },
      { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Variavel|Custo variável","Fixo|Custo fixo"], valor: d?.natureza || "Variavel" },
    ],
    montar(f) {
      const litros = Number(f.litros) || 0;
      const vu = Number(f.valor_unit) || 0;
      if (!litros && !vu) throw "Informe pelo menos os litros e o preço.";
      if (f.status === "pendente" && !f.vencimento) throw "Informe o vencimento para abastecimentos a pagar.";
      const hi = f.hora_inicial === "" ? null : Number(f.hora_inicial);
      const hf = f.hora_final === "" ? null : Number(f.hora_final);
      return {
        data: f.data, local: f.local.trim(), litros, valor_unit: vu, valor_total: litros * vu,
        hora_inicial: hi, hora_final: hf,
        horas: (hi != null && hf != null) ? Math.max(0, hf - hi) : null,
        status: f.status, vencimento: f.status === "pendente" ? f.vencimento : null,
        natureza: f.natureza,
      };
    },
    async aposSalvar(salvo) {
      // só vira saída de caixa quando estiver PAGO — se está "a pagar",
      // o dinheiro ainda não saiu, então não deve mexer no extrato/saldo.
      await sincronizarLancamento({
        origemId: salvo.id, tabelaOrigem: "diesel", lancamentoId: d?.lancamento_id ?? salvo.lancamento_id,
        valor: salvo.status === "pago" ? salvo.valor_total : 0, tipo: "saida", data: salvo.data,
        grupo: "Combustível", descricao: "Abastecimento" + (salvo.local ? " - " + salvo.local : ""),
        natureza: salvo.natureza,
      });
    },
    async aoExcluir() { await removerLancamentoVinculado(d?.lancamento_id); },
  });
}

/* ═══════════════ AGENDA ═══════════════ */
function renderAgenda() {
  const meses = [...new Set(dados.age.map(a => a.mes))].sort((a,b) => a-b);
  const porItem = {};
  for (const a of dados.age) {
    const chave = a.item + "§" + a.dia;
    if (!porItem[chave]) porItem[chave] = { item: a.item, dia: a.dia, valores: {}, ids: {}, pagos: {} };
    porItem[chave].valores[a.mes] = (porItem[chave].valores[a.mes] || 0) + a.valor;
    porItem[chave].ids[a.mes] = a.id;
    porItem[chave].pagos[a.mes] = !!a.pago;
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
      ${meses.map(m => `<td class="num ${i.valores[m] ? (i.pagos[m] ? "pago" : "") : "td-zero"}">${i.valores[m] ? num(i.valores[m],0) : "·"}</td>`).join("")}
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
      { nome:"valor", rotulo:"Valor (R$) — use negativo para estorno", tipo:"numero", valor: a?.valor ?? "" },
      { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Fixo|Custo fixo","Variavel|Custo variável","Investimento|Investimento"], valor: a?.natureza || "Fixo" },
      { nome:"pago", rotulo:"Já foi pago", tipo:"checkbox", valor: a?.pago ?? false },
    ],
    montar(f) {
      if (!f.item.trim()) throw "Informe o nome do compromisso.";
      const v = Number(f.valor);
      if (!v) throw "Informe um valor diferente de zero.";
      return { item: f.item.trim(), dia: f.dia.trim(), mes: Number(f.mes), valor: v, pago: !!f.pago, natureza: f.natureza };
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
    if (c.tipo === "checkbox") {
      return `<label class="campo-checkbox ${largo}">
        <input type="checkbox" data-campo="${c.nome}" ${c.valor ? "checked" : ""}> ${c.rotulo}</label>`;
    }
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
  document.querySelectorAll("#modal-campos [data-campo]").forEach(el => {
    f[el.dataset.campo] = el.type === "checkbox" ? el.checked : el.value;
  });
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
    ? sb.from(modalCtx.tabela).update(reg).eq("id", modalCtx.id).select().single()
    : sb.from(modalCtx.tabela).insert(reg).select().single();
  const { data: salvo, error } = await q;
  if (error) {
    btn.disabled = false; btn.textContent = "Salvar";
    erro.textContent = "Não foi possível salvar: " + error.message;
    erro.classList.remove("oculto");
    return;
  }

  if (modalCtx.aposSalvar) {
    try { await modalCtx.aposSalvar(salvo); }
    catch (e) { console.error("Falha ao sincronizar com o extrato:", e); }
  }

  btn.disabled = false; btn.textContent = "Salvar";
  fecharModal();
  toast("Registro salvo.");
  await carregarTudo();
}

async function excluirRegistro() {
  if (!modalCtx || !modalCtx.id) return;
  if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;

  if (modalCtx.aoExcluir) {
    try { await modalCtx.aoExcluir(); }
    catch (e) { console.error("Falha ao remover lançamento vinculado:", e); }
  }

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

/* ═══════════ SINCRONIZAÇÃO AUTOMÁTICA COM O EXTRATO ═══════════
   Recebimentos (valor pago) e Diesel (valor total) geram/atualizam
   um lançamento correspondente no extrato, evitando digitar duas
   vezes e os números divergirem entre as abas. */
async function sincronizarLancamento({ origemId, tabelaOrigem, lancamentoId, valor, tipo, data, grupo, descricao, natureza = "Variavel", banco = "Bradesco" }) {
  // sem valor: se existia um lançamento vinculado, remove
  if (!valor || valor <= 0) {
    if (lancamentoId) {
      await sb.from("lancamentos").delete().eq("id", lancamentoId);
      await sb.from(tabelaOrigem).update({ lancamento_id: null }).eq("id", origemId);
    }
    return;
  }
  const campos = {
    data, banco, grupo, subgrupo: "",
    entrada: tipo === "entrada" ? valor : 0,
    saida:   tipo === "saida"   ? valor : 0,
    descricao,
    natureza: tipo === "entrada" ? "Receita" : natureza,
  };
  if (lancamentoId) {
    await sb.from("lancamentos").update(campos).eq("id", lancamentoId);
  } else {
    const { data: novo, error } = await sb.from("lancamentos").insert(campos).select().single();
    if (!error && novo) {
      await sb.from(tabelaOrigem).update({ lancamento_id: novo.id }).eq("id", origemId);
    }
  }
}

async function removerLancamentoVinculado(lancamentoId) {
  if (!lancamentoId) return;
  await sb.from("lancamentos").delete().eq("id", lancamentoId);
}

/* ═══════════════ EXPORTAÇÃO CSV ═══════════════ */
function baixarCSV(nomeArquivo, cabecalho, linhas) {
  const escCsv = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const conteudo = [cabecalho, ...linhas].map(l => l.map(escCsv).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportarExtratoCSV() {
  let acc = dados.saldoInicial;
  const comSaldo = dados.lanc.map(l => ({ ...l, saldo: (acc += l.entrada - l.saida) }));
  const q = filtroExt.busca.trim().toLowerCase();
  const filtrado = comSaldo.filter(l =>
    (filtroExt.mes === "todos" || l.data.slice(0,7) === filtroExt.mes) &&
    (filtroExt.grupo === "todos" || l.grupo === filtroExt.grupo) &&
    (!q || (l.descricao + " " + l.subgrupo + " " + l.grupo).toLowerCase().includes(q))
  );
  const linhas = filtrado.map(l => [
    l.data, l.grupo, l.subgrupo, l.descricao, l.banco,
    (l.entrada || 0).toFixed(2).replace(".", ","),
    (l.saida || 0).toFixed(2).replace(".", ","),
    l.saldo.toFixed(2).replace(".", ","),
  ]);
  baixarCSV("extrato.csv", ["Data","Grupo","Subgrupo","Descrição","Conta","Entrada","Saída","Saldo"], linhas);
}

function exportarRecebimentosCSV() {
  const filtrado = dados.rec.filter(r => filtroCliente === "todos" || r.cliente === filtroCliente);
  const linhas = filtrado.map(r => [
    r.data, r.cliente, r.hora_inicial ?? "", r.hora_final ?? "",
    (r.horas || 0).toFixed(2).replace(".", ","),
    (r.valor_hora || 0).toFixed(2).replace(".", ","),
    (r.valor_total || 0).toFixed(2).replace(".", ","),
    (r.valor_pago || 0).toFixed(2).replace(".", ","),
    r.forma || "",
  ]);
  baixarCSV("recebimentos.csv",
    ["Data","Cliente","Horímetro inicial","Horímetro final","Horas","R$/h","Faturado","Pago","Forma"], linhas);
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
