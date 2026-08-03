/* ═══════════════════════════════════════════════════════
   GERENCIADOR FINANCEIRO — TA TRANSPORTE (Pá Carregadeira)
   HTML + CSS + JS puro · Supabase · Chart.js — sem build
   ═══════════════════════════════════════════════════════ */

"use strict";

/* ── Estado global ─────────────────────────────────────── */
let sb = null;                 // cliente Supabase
const dados = {
  saldoInicial: 0, lanc: [], rec: [], die: [], age: [], man: [],
  equipamentos: [], centrosCusto: [], clientes: [], fornecedores: [],
  gruposDespesa: [], contasBancarias: [], operadores: [], obras: [], feriados: [],
};
let filtroExt = { modo: "mes", mes: "todos", semana: "", dia: "", de: "", ate: "", grupo: "todos", busca: "" };
let filtroCliente = "todos";
let filtroPainel = { periodo: "tudo", natureza: "todos", tipoFluxo: "bar", agrupar: "grupo", visual: "lista" };
let filtroManutencao = { tipo: "todos", status: "todos" };
const graficos = {};           // instâncias Chart.js

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CORES_GRUPO = {
  "Combustível":"#F5B301","Financiamento":"#F0564A","Investimento":"#7A8CF0",
  "Manutenção":"#FF8C42","Pessoal":"#4EC9D4","Seguro Frota":"#C77DFF",
  "Tarifas":"#8B919C","Taxas fixas":"#6B7280","Outras despesas":"#A3A8B4",
  "Recebimentos":"#3ECF8E"
};
const CORES_NATUREZA = { "Custo fixo":"#7A8CF0", "Custo variável":"#F5B301", "Investimento":"#C77DFF" };
const ROTULO_NATUREZA = { Fixo:"Custo fixo", Variavel:"Custo variável", Investimento:"Investimento" };
const PALETA_CENTROS = ["#3ECF8E","#7A8CF0","#F5B301","#FF8C42","#4EC9D4","#C77DFF","#F0564A","#8B919C"];

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

/* ── Máscara monetária (campos tipo "moeda": R$ 0,00) ─────
   Formata sempre a partir dos dígitos digitados — "." e ","
   (e qualquer outro caractere que não seja número) são simplesmente
   ignorados, então colar "1.234,56" ou "1234.56" também funciona,
   o resultado final é sempre "1.234,56". */
function moedaMascara(v) {
  if (v === "" || v == null) return "";
  const negativo = Number(v) < 0;
  const digitos = Math.round(Math.abs(Number(v) || 0) * 100).toString();
  return (negativo ? "-" : "") + formatarDigitosMoeda(digitos);
}
function formatarDigitosMoeda(digitos) {
  digitos = digitos.replace(/^0+(?=\d)/, "");
  while (digitos.length < 3) digitos = "0" + digitos;
  const centavos = digitos.slice(-2);
  const inteiro = digitos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return inteiro + "," + centavos;
}
function ligarMascaraMoeda(input) {
  const permiteNegativo = input.dataset.negativo === "1";
  input.addEventListener("input", () => {
    const negativo = permiteNegativo && input.value.includes("-");
    const digitos = input.value.replace(/\D/g, "") || "0";
    input.value = (negativo ? "-" : "") + formatarDigitosMoeda(digitos);
  });
}
// converte "1.234,56" (ou "-1.234,56") de volta para número
function numDeMoeda(str) {
  if (str == null || str === "") return 0;
  const limpo = String(str).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

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

// Opções de equipamento para os campos "select" dos modais. Quando estamos
// vendo um equipamento específico, o campo já nasce travado nele; no modo
// "Total do negócio" o usuário escolhe. incluirGeral permite despesas/
// compromissos que não são de uma máquina específica (ex.: contabilidade).
function opcoesEquipamento(incluirGeral) {
  const opts = dados.equipamentos.filter(e => e.ativo).map(e => `${e.id}|${e.nome}`);
  if (incluirGeral) opts.push("|Geral (sem máquina específica)");
  return opts;
}
function equipamentoPadrao(valorAtual, incluirGeral) {
  if (valorAtual != null) return String(valorAtual);
  if (contexto.equipamentoId != null) return String(contexto.equipamentoId);
  if (incluirGeral) return "";
  const primeiro = dados.equipamentos.find(e => e.ativo);
  return primeiro ? String(primeiro.id) : "";
}
function nomeEquipamento(id) {
  const e = dados.equipamentos.find(x => x.id === id);
  return e ? e.nome : "";
}

// Mesma lógica do equipamento, mas para centro de custo (cartão de crédito,
// financiamento, conta corrente etc.) — lista vem do cadastro, gerenciável
// na aba Administração.
function opcoesCentroCusto(incluirNenhum) {
  const ativos = dados.centrosCusto.filter(c => c.ativo);
  const opts = ativos.map(c => `${c.id}|${c.nome}`);
  if (incluirNenhum) opts.push("|Não classificado");
  return opts;
}
function centroCustoPadrao(valorAtual) {
  if (valorAtual != null) return String(valorAtual);
  const primeiro = dados.centrosCusto.find(c => c.ativo);
  return primeiro ? String(primeiro.id) : "";
}
function nomeCentroCusto(id) {
  const c = dados.centrosCusto.find(x => x.id === id);
  return c ? c.nome : "";
}
function corCentroCusto(id) {
  const idx = dados.centrosCusto.findIndex(x => x.id === id);
  return idx >= 0 ? PALETA_CENTROS[idx % PALETA_CENTROS.length] : "#8B919C";
}

// Grupos de despesa e contas bancárias agora são cadastros (aba
// Administração) em vez de listas fixas no código.
function opcoesGrupoDespesa() {
  return dados.gruposDespesa.filter(g => g.ativo).map(g => g.nome);
}
function opcoesContaBancaria() {
  return dados.contasBancarias.filter(c => c.ativo).map(c => c.nome);
}
// Autocomplete (datalist) a partir de um cadastro — continua sendo texto
// livre no campo, então um valor histórico que não está mais ativo no
// cadastro não quebra nada.
function nomesAtivos(lista) {
  return lista.filter(x => x.ativo).map(x => x.nome);
}

/* ── Inicialização ─────────────────────────────────────── */
let contexto = { equipamentoId: null, nome: null }; // null = "Total do negócio"
let appIniciado = false;

document.addEventListener("DOMContentLoaded", async () => {
  if (!SUPABASE_URL || SUPABASE_URL.includes("COLE_AQUI")) {
    $("tela-config").classList.remove("oculto");
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await sb.auth.getSession();
  if (session) mostrarSeletorEquipamento(); else mostrarLogin();

  $("form-login").addEventListener("submit", fazerLogin);
  $("btn-sair").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
  $("equip-sair").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.reload();
  });
  $("btn-trocar-equip").addEventListener("click", () => {
    $("app").classList.add("oculto");
    mostrarSeletorEquipamento();
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
  mostrarSeletorEquipamento();
}

/* ── Seleção de equipamento (primeira tela após o login) ─── */
async function mostrarSeletorEquipamento() {
  $("tela-equipamento").classList.remove("oculto");
  $("equip-add-form").classList.add("oculto");
  $("equip-cartoes").innerHTML = '<div class="vazio">Carregando…</div>';

  const { data, error } = await sb.from("equipamentos").select("*").eq("ativo", true).order("nome");
  if (error) {
    $("equip-cartoes").innerHTML = '<div class="vazio">Não foi possível carregar os equipamentos. (' + escHtml(error.message) + ')</div>';
    return;
  }
  dados.equipamentos = data || [];

  const cartoes = dados.equipamentos.map(e => `
    <button type="button" class="equip-cartao" data-id="${e.id}" data-nome="${escHtml(e.nome)}">
      <div class="equip-cartao-icone">${escHtml(e.nome.slice(0,2).toUpperCase())}</div>
      <div class="equip-cartao-nome">${escHtml(e.nome)}</div>
    </button>`).join("");
  const cartaoTotal = `
    <button type="button" class="equip-cartao equip-cartao-total" data-id="" data-nome="Total do negócio">
      <div class="equip-cartao-icone">∑</div>
      <div class="equip-cartao-nome">Total do negócio</div>
    </button>`;
  $("equip-cartoes").innerHTML = cartoes + cartaoTotal;

  $("equip-cartoes").querySelectorAll(".equip-cartao").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id ? Number(btn.dataset.id) : null;
      escolherContexto(id, btn.dataset.nome);
    });
  });

  if (!$("equip-add-abrir")._ligado) {
    $("equip-add-abrir")._ligado = true;
    $("equip-add-abrir").addEventListener("click", () => {
      $("equip-add-form").classList.remove("oculto");
      $("equip-add-nome").focus();
    });
    $("equip-add-cancelar").addEventListener("click", () => $("equip-add-form").classList.add("oculto"));
    $("equip-add-salvar").addEventListener("click", criarEquipamento);
  }
}

async function criarEquipamento() {
  const nome = $("equip-add-nome").value.trim();
  if (!nome) { toast("Informe o nome do equipamento."); return; }
  const { error } = await sb.from("equipamentos").insert({ nome });
  if (error) { toast("Não foi possível criar: " + error.message); return; }
  $("equip-add-nome").value = "";
  await mostrarSeletorEquipamento();
}

function escolherContexto(equipamentoId, nome) {
  contexto = { equipamentoId, nome };
  $("tela-equipamento").classList.add("oculto");
  $("contexto-nome").textContent = nome;
  if (!appIniciado) { iniciarApp(); appIniciado = true; }
  else { $("app").classList.remove("oculto"); carregarTudo(); }
}

async function iniciarApp() {
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
  $("man-novo").addEventListener("click", () => abrirModalManutencao(null));
  $("admin-novo-feriado").addEventListener("click", () => abrirModalFeriado(null));

  // filtros do extrato
  ligarSegmentado("ext-modo-periodo", (v) => {
    filtroExt.modo = v;
    $("ext-filtro-mes").classList.toggle("oculto", v !== "mes");
    $("ext-filtro-semana").classList.toggle("oculto", v !== "semana");
    $("ext-filtro-dia").classList.toggle("oculto", v !== "dia");
    $("ext-filtro-periodo-grupo").classList.toggle("oculto", v !== "periodo");
    renderExtrato();
  });
  $("ext-filtro-mes").addEventListener("change", e => { filtroExt.mes = e.target.value; renderExtrato(); });
  $("ext-filtro-semana").addEventListener("change", e => { filtroExt.semana = e.target.value; renderExtrato(); });
  $("ext-filtro-dia").addEventListener("change", e => { filtroExt.dia = e.target.value; renderExtrato(); });
  $("ext-filtro-de").addEventListener("change", e => { filtroExt.de = e.target.value; renderExtrato(); });
  $("ext-filtro-ate").addEventListener("change", e => { filtroExt.ate = e.target.value; renderExtrato(); });
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

  // filtros de manutenção
  $("man-filtro-tipo").addEventListener("change", e => { filtroManutencao.tipo = e.target.value; renderManutencao(); });
  ligarSegmentado("man-filtro-status", (v) => { filtroManutencao.status = v; renderManutencao(); });

  // ano da agenda
  $("age-filtro-ano").addEventListener("change", e => { anoAgenda = Number(e.target.value); renderAgenda(); });

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
  $("carregando").textContent = "Carregando dados do banco…";
  $("carregando").classList.remove("oculto");
  $("aba-painel").classList.add("oculto");
  try {
    // no modo "Total do negócio" (contexto.equipamentoId === null) não filtra
    // nada — traz tudo, inclusive despesas gerais sem equipamento definido.
    const comEquip = (q) => contexto.equipamentoId != null ? q.eq("equipamento_id", contexto.equipamentoId) : q;

    const [cfg, lanc, rec, die, age, man, equipTodos, centros] = await Promise.all([
      sb.from("config").select("*"),
      comEquip(sb.from("lancamentos").select("*")).order("data").order("id"),
      comEquip(sb.from("recebimentos").select("*")).order("data").order("id"),
      comEquip(sb.from("diesel").select("*")).order("data").order("id"),
      comEquip(sb.from("agenda").select("*")).order("item").order("mes"),
      comEquip(sb.from("manutencoes").select("*")).order("data", { ascending: false }),
      sb.from("equipamentos").select("*").order("nome"),
      sb.from("centros_custo").select("*").order("nome"),
    ]);
    const erro = cfg.error || lanc.error || rec.error || die.error || age.error || man.error || equipTodos.error || centros.error;
    if (erro) throw erro;

    const si = (cfg.data || []).find(c => c.chave === "saldo_inicial");
    dados.saldoInicial = si ? Number(si.valor) : 0;
    dados.lanc = (lanc.data || []).map(o => normNum(o, "lancamentos"));
    dados.rec  = (rec.data  || []).map(o => normNum(o, "recebimentos"));
    dados.die  = (die.data  || []).map(o => normNum(o, "diesel"));
    dados.age  = (age.data  || []).map(o => normNum(o, "agenda"));
    dados.man  = (man.data  || []).map(o => normNum(o, "manutencoes"));
    dados.equipamentos = equipTodos.data || [];
    dados.centrosCusto = centros.data || [];

    // Cadastros mais novos (clientes, fornecedores, grupos, contas,
    // operadores, obras, feriados): se a migração correcoes_v10.sql ainda
    // não foi rodada no Supabase, essas tabelas não existem — mas isso não
    // pode derrubar o app inteiro, então cada uma é buscada separadamente
    // e, se falhar, só fica vazia (com um aviso no console).
    const cadastrosOpcionais = [
      ["clientes", "clientes"],
      ["fornecedores", "fornecedores"],
      ["gruposDespesa", "grupos_despesa"],
      ["contasBancarias", "contas_bancarias"],
      ["operadores", "operadores"],
      ["obras", "obras"],
      ["feriados", "feriados"],
    ];
    await Promise.all(cadastrosOpcionais.map(async ([chave, tabela]) => {
      try {
        const { data, error } = await sb.from(tabela).select("*").order(tabela === "feriados" ? "data" : "nome");
        if (error) throw error;
        dados[chave] = data || [];
      } catch (e) {
        dados[chave] = [];
        console.warn(`Tabela "${tabela}" indisponível (rode correcoes_v10.sql no Supabase):`, e.message || e);
      }
    }));

    $("carregando").classList.add("oculto");
    $("aba-painel").classList.remove("oculto");
    renderTudo();
  } catch (e) {
    $("carregando").classList.remove("oculto");
    $("carregando").textContent =
      "Não foi possível carregar os dados. Confira se as migrações SQL foram executadas no Supabase e se a URL/anon key do config.js estão corretas. (" + (e.message || e) + ")";
  }
}

// Supabase devolve numeric como string — converte tudo que for número,
// exceto os campos que são texto por natureza (mesmo quando só têm dígitos,
// como o "dia" do vencimento na agenda — "05" precisa continuar string,
// senão a comparação com o dataset do HTML, que é sempre string, falha).
const CAMPOS_TEXTO = {
  lancamentos:  new Set(["data", "banco", "grupo", "subgrupo", "descricao"]),
  recebimentos: new Set(["data", "cliente", "forma", "operador", "obra"]),
  diesel:       new Set(["data"]),
  agenda:       new Set(["item", "dia"]),
  manutencoes:  new Set(["data", "descricao", "pecas", "fornecedor", "vencimento", "proxima_data"]),
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
  rodarSemTravar(renderManutencao, "Manutenção");
  rodarSemTravar(renderAgenda, "Agenda");
  rodarSemTravar(renderAdministracao, "Administração");
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
  const modoAgrupar = filtroPainel.agrupar; // "grupo" | "natureza" | "centro"
  const bucket = {};
  for (const l of periodoLanc) {
    if (!l.saida || l.grupo === "Recebimentos") continue;
    if (filtroPainel.natureza !== "todos" && l.natureza !== filtroPainel.natureza) continue;
    const chave = modoAgrupar === "natureza" ? (ROTULO_NATUREZA[l.natureza] || "Custo variável")
      : modoAgrupar === "centro" ? (nomeCentroCusto(l.centro_custo_id) || "Não classificado")
      : l.grupo;
    bucket[chave] = (bucket[chave] || 0) + l.saida;
  }
  const lista = Object.entries(bucket).sort((a,b) => b[1]-a[1]);
  const coresCentro = {};
  dados.centrosCusto.forEach(c => coresCentro[c.nome] = corCentroCusto(c.id));
  const cores = modoAgrupar === "natureza" ? CORES_NATUREZA : modoAgrupar === "centro" ? coresCentro : CORES_GRUPO;

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
// Converte uma semana no formato do <input type="week"> ("2026-W05") no
// intervalo [segunda, domingo] em texto ISO — padrão ISO 8601 (a semana 1
// é a que contém a primeira quinta-feira do ano).
function semanaParaIntervalo(semanaISO) {
  const [anoStr, wStr] = semanaISO.split("-W");
  const ano = Number(anoStr), semana = Number(wStr);
  const jan4 = new Date(ano, 0, 4);
  const diaSemanaJan4 = (jan4.getDay() + 6) % 7; // 0 = segunda
  const segundaSemana1 = new Date(jan4);
  segundaSemana1.setDate(jan4.getDate() - diaSemanaJan4);
  const segunda = new Date(segundaSemana1);
  segunda.setDate(segundaSemana1.getDate() + (semana - 1) * 7);
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  return [isoLocal(segunda), isoLocal(domingo)];
}

// Checagem de período única, usada pelo Extrato em tela e pela exportação
// CSV — assim os dois nunca ficam dessincronizados.
function dentroDoPeriodo(dataStr) {
  switch (filtroExt.modo) {
    case "mes":
      return filtroExt.mes === "todos" || dataStr.slice(0,7) === filtroExt.mes;
    case "dia":
      return !filtroExt.dia || dataStr === filtroExt.dia;
    case "semana": {
      if (!filtroExt.semana) return true;
      const [ini, fim] = semanaParaIntervalo(filtroExt.semana);
      return dataStr >= ini && dataStr <= fim;
    }
    case "periodo":
      if (filtroExt.de && dataStr < filtroExt.de) return false;
      if (filtroExt.ate && dataStr > filtroExt.ate) return false;
      return true;
    default:
      return true;
  }
}

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
    dentroDoPeriodo(l.data) &&
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
    const subTxt = [natTxt, nomeCentroCusto(l.centro_custo_id)].filter(Boolean).join(" · ");
    return `<tr>
      <td class="td-data">${fData(l.data)}</td>
      <td>
        <span class="chip" style="border-color:${CORES_GRUPO[l.grupo]||"#3A3F48"};color:${CORES_GRUPO[l.grupo]||"#A3A8B4"}">${escHtml(l.grupo)}</span>
        ${subTxt ? `<div class="td-natureza">${escHtml(subTxt)}</div>` : ""}
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
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(true), valor: equipamentoPadrao(l?.equipamento_id, true) },
      { nome:"grupo", rotulo:"Grupo", tipo:"select", opcoes: opcoesGrupoDespesa().concat("Recebimentos"), valor: l?.grupo || "Combustível" },
      { nome:"natureza", rotulo:"Natureza (só p/ saída)", tipo:"select",
        opcoes:["Variavel|Custo variável","Fixo|Custo fixo","Investimento|Investimento"],
        valor: (l?.natureza && l.natureza !== "Receita") ? l.natureza : (l?.grupo === "Investimento" ? "Investimento" : "Variavel") },
      { nome:"centro_custo_id", rotulo:"Centro de custo", tipo:"select", opcoes: opcoesCentroCusto(true), valor: centroCustoPadrao(l?.centro_custo_id) },
      { nome:"banco", rotulo:"Conta", tipo:"select", opcoes: opcoesContaBancaria(), valor: l?.banco || opcoesContaBancaria()[0] || "" },
      { nome:"_valor", rotulo:"Valor (R$)", tipo:"moeda", valor: l ? (l.entrada > 0 ? l.entrada : l.saida) : "" },
      { nome:"descricao", rotulo:"Descrição", tipo:"texto", largo:true, valor: l?.descricao || "" },
    ],
    montar(f) {
      const v = numDeMoeda(f._valor);
      if (!v || v <= 0) throw "Informe um valor maior que zero.";
      return {
        data: f.data,
        banco: f.banco,
        equipamento_id: f.equipamento_id ? Number(f.equipamento_id) : null,
        grupo: f._tipo === "entrada" ? "Recebimentos" : f.grupo,
        subgrupo: "",
        entrada: f._tipo === "entrada" ? v : 0,
        saida:   f._tipo === "saida"   ? v : 0,
        descricao: f.descricao.trim(),
        natureza: f._tipo === "entrada" ? "Receita" : f.natureza,
        centro_custo_id: f.centro_custo_id ? Number(f.centro_custo_id) : null,
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
  abrirModal({
    titulo: r ? "Editar registro" : "Novo registro",
    tabela: "recebimentos", id,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: r?.data || hoje() },
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(false), valor: equipamentoPadrao(r?.equipamento_id, false) },
      { nome:"cliente", rotulo:"Cliente", tipo:"texto", valor: r?.cliente || "", lista: nomesAtivos(dados.clientes),
        aoMudar(nome) {
          const c = dados.clientes.find(x => x.nome === nome);
          if (c && c.valor_hora_padrao) {
            const campoVh = document.querySelector('#modal-campos [data-campo="valor_hora"]');
            if (campoVh) campoVh.value = moedaMascara(c.valor_hora_padrao);
          }
        } },
      { nome:"operador", rotulo:"Operador", tipo:"texto", valor: r?.operador || "", lista: nomesAtivos(dados.operadores) },
      { nome:"obra", rotulo:"Obra / contrato", tipo:"texto", valor: r?.obra || "", lista: nomesAtivos(dados.obras) },
      { nome:"hora_inicial", rotulo:"Horímetro inicial", tipo:"numero", valor: r?.hora_inicial ?? "" },
      { nome:"hora_final", rotulo:"Horímetro final", tipo:"numero", valor: r?.hora_final ?? "" },
      { nome:"valor_hora", rotulo:"Valor da hora (R$)", tipo:"moeda", valor: r?.valor_hora ?? 350 },
      { nome:"valor_pago", rotulo:"Valor pago (R$)", tipo:"moeda", valor: r?.valor_pago ?? 0 },
      { nome:"forma", rotulo:"Forma de pagamento", tipo:"select", largo:true,
        opcoes:["|—","Bradesco- Empresa","Caixa - Dinheiro","Pix","Cheque"], valor: r?.forma || "" },
    ],
    montar(f) {
      if (!f.cliente.trim()) throw "Informe o cliente.";
      if (!f.equipamento_id) throw "Selecione o equipamento.";
      const hi = f.hora_inicial === "" ? null : Number(f.hora_inicial);
      const hf = f.hora_final === "" ? null : Number(f.hora_final);
      const horas = (hi != null && hf != null) ? Math.max(0, hf - hi) : 0;
      const vh = numDeMoeda(f.valor_hora);
      return {
        data: f.data, equipamento_id: Number(f.equipamento_id), cliente: f.cliente.trim(),
        operador: f.operador.trim(), obra: f.obra.trim(),
        hora_inicial: hi, hora_final: hf, horas,
        valor_hora: vh, valor_total: horas * vh,
        valor_pago: numDeMoeda(f.valor_pago),
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
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(false), valor: equipamentoPadrao(d?.equipamento_id, false) },
      { nome:"local", rotulo:"Local / fornecedor", tipo:"texto", largo:true, valor: d?.local || "", lista: nomesAtivos(dados.fornecedores) },
      { nome:"litros", rotulo:"Litros", tipo:"numero", valor: d?.litros ?? "" },
      { nome:"valor_unit", rotulo:"Preço do litro (R$)", tipo:"moeda", valor: d?.valor_unit ?? "" },
      { nome:"hora_inicial", rotulo:"Horímetro inicial", tipo:"numero", valor: d?.hora_inicial ?? "" },
      { nome:"hora_final", rotulo:"Horímetro final", tipo:"numero", valor: d?.hora_final ?? "" },
      { nome:"status", rotulo:"Situação", tipo:"select", opcoes:["pago|Pago à vista","pendente|A pagar (fiado)"], valor: d?.status || "pago" },
      { nome:"vencimento", rotulo:"Vencimento (se a pagar)", tipo:"date", valor: d?.vencimento || "" },
      { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Variavel|Custo variável","Fixo|Custo fixo"], valor: d?.natureza || "Variavel" },
      { nome:"centro_custo_id", rotulo:"Centro de custo", tipo:"select", opcoes: opcoesCentroCusto(true), valor: centroCustoPadrao(d?.centro_custo_id) },
    ],
    montar(f) {
      const litros = Number(f.litros) || 0;
      const vu = numDeMoeda(f.valor_unit);
      if (!litros && !vu) throw "Informe pelo menos os litros e o preço.";
      if (!f.equipamento_id) throw "Selecione o equipamento.";
      if (f.status === "pendente" && !f.vencimento) throw "Informe o vencimento para abastecimentos a pagar.";
      const hi = f.hora_inicial === "" ? null : Number(f.hora_inicial);
      const hf = f.hora_final === "" ? null : Number(f.hora_final);
      return {
        data: f.data, equipamento_id: Number(f.equipamento_id), local: f.local.trim(), litros, valor_unit: vu, valor_total: litros * vu,
        hora_inicial: hi, hora_final: hf,
        horas: (hi != null && hf != null) ? Math.max(0, hf - hi) : null,
        status: f.status, vencimento: f.status === "pendente" ? f.vencimento : null,
        natureza: f.natureza, centro_custo_id: f.centro_custo_id ? Number(f.centro_custo_id) : null,
      };
    },
    async aposSalvar(salvo) {
      // só vira saída de caixa quando estiver PAGO — se está "a pagar",
      // o dinheiro ainda não saiu, então não deve mexer no extrato/saldo.
      await sincronizarLancamento({
        origemId: salvo.id, tabelaOrigem: "diesel", lancamentoId: d?.lancamento_id ?? salvo.lancamento_id,
        valor: salvo.status === "pago" ? salvo.valor_total : 0, tipo: "saida", data: salvo.data,
        grupo: "Combustível", descricao: "Abastecimento" + (salvo.local ? " - " + salvo.local : ""),
        natureza: salvo.natureza, centroCustoId: salvo.centro_custo_id,
      });
    },
    async aoExcluir() { await removerLancamentoVinculado(d?.lancamento_id); },
  });
}

/* ═══════════════ MANUTENÇÃO ═══════════════ */
const ROTULO_TIPO_MAN = { preventiva:"Preventiva", preditiva:"Preditiva", corretiva:"Corretiva" };
const COR_TIPO_MAN = { preventiva:"#3ECF8E", preditiva:"#7A8CF0", corretiva:"#F0564A" };

function renderManutencao() {
  const hj = hoje();
  let custoPecas = 0, custoTotal = 0, qtdPecas = 0;
  const proximas = [];
  for (const m of dados.man) {
    if (m.realizada) { custoPecas += m.valor_pecas; custoTotal += m.valor_total; if (m.pecas) qtdPecas++; }
    else proximas.push(m);
  }
  let aPagar = 0, vencido = 0;
  for (const m of dados.man) {
    if (m.realizada && m.status_pagamento === "pendente") {
      aPagar += m.valor_total;
      if (m.vencimento && m.vencimento < hj) vencido += m.valor_total;
    }
  }
  proximas.sort((a,b) => (a.proxima_data || a.data).localeCompare(b.proxima_data || b.data));

  $("kpis-manutencao").innerHTML = [
    kpi("Gasto com manutenção", brl0(custoTotal), qtdPecas + " com troca de peça"),
    kpi("Só peças", brl0(custoPecas), ""),
    kpi("Manutenção a pagar", brl0(aPagar), vencido > 0 ? brl0(vencido) + " vencido" : "em dia", aPagar > 0 ? "neg" : "pos"),
    kpi("Próximas agendadas", String(proximas.length), proximas[0] ? "mais próxima: " + fData(proximas[0].proxima_data || proximas[0].data) : "", "amarelo"),
  ].join("");

  $("man-proximas").innerHTML = proximas.length
    ? proximas.map(m => `
      <div class="man-proxima-linha">
        <span class="chip" style="border-color:${COR_TIPO_MAN[m.tipo]};color:${COR_TIPO_MAN[m.tipo]}">${ROTULO_TIPO_MAN[m.tipo]}</span>
        <span class="man-proxima-desc">${escHtml(m.descricao || "—")}${contexto.equipamentoId == null ? " · " + escHtml(nomeEquipamento(m.equipamento_id)) : ""}</span>
        <span class="man-proxima-data">${fData(m.proxima_data || m.data)}${m.proxima_horimetro ? " · " + num(m.proxima_horimetro,0) + "h" : ""}</span>
        <button class="btn-editar" onclick="abrirModalManutencao(${m.id})" title="Editar">✎</button>
      </div>`).join("")
    : '<div class="vazio">Nenhuma manutenção agendada.</div>';

  const filtrado = dados.man.filter(m =>
    (filtroManutencao.tipo === "todos" || m.tipo === filtroManutencao.tipo) &&
    (filtroManutencao.status === "todos" || (filtroManutencao.status === "realizadas" ? m.realizada : !m.realizada))
  );

  $("man-corpo").innerHTML = filtrado.map(m => {
    const venceu = m.status_pagamento === "pendente" && m.vencimento && m.vencimento < hj;
    const statusHtml = !m.realizada
      ? `<span class="chip chip-status chip-pendente">Agendada</span>`
      : (m.status_pagamento === "pendente"
        ? `<span class="chip chip-status ${venceu ? "chip-vencido" : "chip-pendente"}">${venceu ? "Vencido" : "A pagar"}</span>`
        : `<span class="chip chip-status chip-pago">Pago</span>`);
    const proxTxt = m.proxima_data ? fData(m.proxima_data) : (m.proxima_horimetro ? num(m.proxima_horimetro,0) + " h" : "—");
    return `<tr>
      <td class="td-data">${fData(m.data)}</td>
      <td class="td-mudo">${contexto.equipamentoId == null ? escHtml(nomeEquipamento(m.equipamento_id)) : "—"}</td>
      <td><span class="chip" style="border-color:${COR_TIPO_MAN[m.tipo]};color:${COR_TIPO_MAN[m.tipo]}">${ROTULO_TIPO_MAN[m.tipo]}</span></td>
      <td class="num">${m.horimetro ? num(m.horimetro,0) : "—"}</td>
      <td class="td-desc">${escHtml(m.descricao || "—")}${m.pecas ? `<div class="td-natureza">peças: ${escHtml(m.pecas)}</div>` : ""}</td>
      <td class="td-mudo">${escHtml(m.fornecedor) || "—"}</td>
      <td class="num neg">${m.valor_total ? brl(m.valor_total) : "—"}</td>
      <td>${statusHtml}</td>
      <td class="td-mudo">${proxTxt}</td>
      <td><button class="btn-editar" onclick="abrirModalManutencao(${m.id})" title="Editar">✎</button></td>
    </tr>`;
  }).join("") ||
  '<tr><td colspan="10" class="vazio">Nenhuma manutenção registrada para este filtro.</td></tr>';
}

function abrirModalManutencao(id) {
  const m = id ? dados.man.find(x => x.id === id) : null;
  abrirModal({
    titulo: m ? "Editar manutenção" : "Nova manutenção",
    tabela: "manutencoes", id,
    campos: [
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(false), valor: equipamentoPadrao(m?.equipamento_id, false) },
      { nome:"tipo", rotulo:"Tipo", tipo:"select", opcoes:["preventiva|Preventiva","preditiva|Preditiva","corretiva|Corretiva"], valor: m?.tipo || "preventiva" },
      { nome:"data", rotulo:"Data (realizada ou prevista)", tipo:"date", valor: m?.data || hoje() },
      { nome:"realizada", rotulo:"Já foi realizada", tipo:"checkbox", valor: m?.realizada ?? true },
      { nome:"horimetro", rotulo:"Horímetro", tipo:"numero", valor: m?.horimetro ?? "" },
      { nome:"descricao", rotulo:"Serviço realizado", tipo:"texto", largo:true, valor: m?.descricao || "" },
      { nome:"pecas", rotulo:"Peças trocadas/compradas", tipo:"texto", largo:true, valor: m?.pecas || "" },
      { nome:"fornecedor", rotulo:"Oficina / fornecedor", tipo:"texto", valor: m?.fornecedor || "", lista: nomesAtivos(dados.fornecedores) },
      { nome:"valor_pecas", rotulo:"Valor peças (R$)", tipo:"moeda", valor: m?.valor_pecas ?? "" },
      { nome:"valor_mao_obra", rotulo:"Valor mão de obra (R$)", tipo:"moeda", valor: m?.valor_mao_obra ?? "" },
      { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Variavel|Custo variável","Fixo|Custo fixo"], valor: m?.natureza || "Variavel" },
      { nome:"centro_custo_id", rotulo:"Centro de custo", tipo:"select", opcoes: opcoesCentroCusto(true), valor: centroCustoPadrao(m?.centro_custo_id) },
      { nome:"status_pagamento", rotulo:"Situação do pagamento", tipo:"select", opcoes:["pago|Pago à vista","pendente|A pagar"], valor: m?.status_pagamento || "pago" },
      { nome:"vencimento", rotulo:"Vencimento (se a pagar)", tipo:"date", valor: m?.vencimento || "" },
      { nome:"proxima_data", rotulo:"Próxima revisão (data)", tipo:"date", valor: m?.proxima_data || "" },
      { nome:"proxima_horimetro", rotulo:"Próxima revisão (horímetro)", tipo:"numero", valor: m?.proxima_horimetro ?? "" },
    ],
    montar(f) {
      if (!f.equipamento_id) throw "Selecione o equipamento.";
      if (!f.descricao.trim() && !f.pecas.trim()) throw "Descreva o serviço ou as peças.";
      if (f.status_pagamento === "pendente" && !f.vencimento) throw "Informe o vencimento para manutenções a pagar.";
      const vp = numDeMoeda(f.valor_pecas);
      const vm = numDeMoeda(f.valor_mao_obra);
      return {
        equipamento_id: Number(f.equipamento_id), tipo: f.tipo, data: f.data, realizada: !!f.realizada,
        horimetro: f.horimetro === "" ? null : Number(f.horimetro),
        descricao: f.descricao.trim(), pecas: f.pecas.trim(), fornecedor: f.fornecedor.trim(),
        valor_pecas: vp, valor_mao_obra: vm, valor_total: vp + vm,
        natureza: f.natureza, centro_custo_id: f.centro_custo_id ? Number(f.centro_custo_id) : null,
        status_pagamento: f.realizada ? f.status_pagamento : "pendente",
        vencimento: f.status_pagamento === "pendente" ? f.vencimento : null,
        proxima_data: f.proxima_data || null,
        proxima_horimetro: f.proxima_horimetro === "" ? null : Number(f.proxima_horimetro),
      };
    },
    async aposSalvar(salvo) {
      // só entra no extrato se já foi realizada E paga; senão fica só como
      // registro (agendada) ou conta a pagar, sem mexer no caixa ainda.
      await sincronizarLancamento({
        origemId: salvo.id, tabelaOrigem: "manutencoes", lancamentoId: m?.lancamento_id ?? salvo.lancamento_id,
        valor: (salvo.realizada && salvo.status_pagamento === "pago") ? salvo.valor_total : 0,
        tipo: "saida", data: salvo.data, grupo: "Manutenção",
        descricao: "Manutenção" + (salvo.fornecedor ? " - " + salvo.fornecedor : ""),
        natureza: salvo.natureza, centroCustoId: salvo.centro_custo_id,
      });
    },
    async aoExcluir() { await removerLancamentoVinculado(m?.lancamento_id); },
  });
}

/* ═══════════════ ADMINISTRAÇÃO ═══════════════ */
// Cada entrada aqui vira um cartão na aba Administração, com listagem e
// "+ Novo" — evita repetir a mesma função 8 vezes.
const CADASTROS_ADMIN = [
  { chave:"equipamentos",   tabela:"equipamentos",     titulo:"Equipamentos",
    nota:"aparecem no seletor de equipamento e nos formulários. Desative em vez de excluir se já tiver lançamentos vinculados.",
    abrir:"abrirModalEquipamentoAdmin" },
  { chave:"centrosCusto",   tabela:"centros_custo",    titulo:"Centros de custo",
    nota:"cartões de crédito, financiamentos, contas — o que financia cada gasto. Desative em vez de excluir se já tiver lançamentos.",
    abrir:"abrirModalCentroCusto" },
  { chave:"clientes",       tabela:"clientes",         titulo:"Clientes",
    nota:"telefone e valor de hora padrão preenchem sozinhos ao escolher o cliente em Recebimentos.",
    abrir:"abrirModalCliente" },
  { chave:"fornecedores",   tabela:"fornecedores",     titulo:"Fornecedores / Oficinas",
    nota:"postos de combustível, oficinas — sugestão automática no Diesel e na Manutenção.",
    abrir:"abrirModalFornecedor" },
  { chave:"gruposDespesa",  tabela:"grupos_despesa",   titulo:"Grupos de despesa",
    nota:"categorias usadas no Extrato e na Agenda.",
    abrir:"abrirModalGrupoDespesa" },
  { chave:"contasBancarias",tabela:"contas_bancarias", titulo:"Contas bancárias",
    nota:"contas usadas no Extrato.",
    abrir:"abrirModalContaBancaria" },
  { chave:"operadores",     tabela:"operadores",       titulo:"Operadores",
    nota:"quem opera a máquina — sugestão automática em Recebimentos.",
    abrir:"abrirModalOperador" },
  { chave:"obras",          tabela:"obras",            titulo:"Obras / Contratos",
    nota:"pra separar rentabilidade por obra, além do cliente — sugestão automática em Recebimentos.",
    abrir:"abrirModalObra" },
];

function renderAdministracao() {
  $("admin-cadastros").innerHTML = CADASTROS_ADMIN.map(c => {
    const lista = dados[c.chave] || [];
    const linhas = lista.length
      ? lista.map(item => `
        <div class="admin-linha">
          <span class="admin-linha-nome">${escHtml(item.nome)}</span>
          ${item.ativo === false ? `<span class="chip chip-status chip-pendente">Inativo</span>` : ""}
          <button class="btn-editar" onclick="${c.abrir}(${item.id})" title="Editar">✎</button>
        </div>`).join("")
      : '<div class="vazio">Nenhum registro cadastrado.</div>';
    return `<div class="cartao">
      <div class="cartao-cabeca">
        <h2 class="titulo-risco"><span>${c.titulo}</span></h2>
        <button class="btn-primario" onclick="${c.abrir}(null)">+ Novo</button>
      </div>
      <p class="cartao-nota">${c.nota}</p>
      <div>${linhas}</div>
    </div>`;
  }).join("");

  // feriados: campos diferentes (data + descrição), sem toggle de ativo
  const fer = dados.feriados.slice().sort((a,b) => a.data.localeCompare(b.data));
  $("admin-feriados").innerHTML = fer.length
    ? fer.map(f => `
      <div class="admin-linha">
        <span class="admin-linha-nome">${fData(f.data)} — ${escHtml(f.descricao || "Feriado")}</span>
        <button class="btn-editar" onclick="abrirModalFeriado(${f.id})" title="Editar">✎</button>
      </div>`).join("")
    : '<div class="vazio">Nenhum feriado cadastrado.</div>';
}

// Fábrica: cria a função abrirModalXxx(id) para um cadastro simples
// (nome + campos extras opcionais + ativo). Evita repetir o boilerplate.
function criarModalCadastro(tabela, chaveDados, tituloSingular, camposExtra = []) {
  return function (id) {
    const item = id ? dados[chaveDados].find(x => x.id === id) : null;
    abrirModal({
      titulo: item ? "Editar " + tituloSingular : "Novo " + tituloSingular,
      tabela, id,
      campos: [
        { nome:"nome", rotulo:"Nome", tipo:"texto", largo:true, valor: item?.nome || "" },
        ...camposExtra.map(c => ({ ...c, valor: item ? (item[c.nome] ?? "") : "" })),
        { nome:"ativo", rotulo:"Ativo", tipo:"checkbox", valor: item?.ativo ?? true },
      ],
      montar(f) {
        if (!f.nome.trim()) throw "Informe o nome.";
        const extra = {};
        camposExtra.forEach(c => {
          extra[c.nome] = c.tipo === "moeda" ? (f[c.nome] ? numDeMoeda(f[c.nome]) : null) : String(f[c.nome] || "").trim();
        });
        return { nome: f.nome.trim(), ...extra, ativo: !!f.ativo };
      }
    });
  };
}

const abrirModalEquipamentoAdmin = criarModalCadastro("equipamentos", "equipamentos", "equipamento");
const abrirModalCentroCusto      = criarModalCadastro("centros_custo", "centrosCusto", "centro de custo");
const abrirModalFornecedor       = criarModalCadastro("fornecedores", "fornecedores", "fornecedor");
const abrirModalGrupoDespesa     = criarModalCadastro("grupos_despesa", "gruposDespesa", "grupo de despesa");
const abrirModalContaBancaria    = criarModalCadastro("contas_bancarias", "contasBancarias", "conta bancária");
const abrirModalOperador         = criarModalCadastro("operadores", "operadores", "operador");
const abrirModalObra             = criarModalCadastro("obras", "obras", "obra/contrato");
const abrirModalCliente          = criarModalCadastro("clientes", "clientes", "cliente", [
  { nome:"telefone", rotulo:"Telefone", tipo:"texto" },
  { nome:"valor_hora_padrao", rotulo:"Valor de hora padrão (R$)", tipo:"moeda" },
]);

function abrirModalFeriado(id) {
  const f0 = id ? dados.feriados.find(x => x.id === id) : null;
  abrirModal({
    titulo: f0 ? "Editar feriado" : "Novo feriado",
    tabela: "feriados", id,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: f0?.data || hoje() },
      { nome:"descricao", rotulo:"Descrição", tipo:"texto", largo:true, valor: f0?.descricao || "" },
    ],
    montar(f) {
      if (!f.data) throw "Informe a data.";
      return { data: f.data, descricao: f.descricao.trim() };
    }
  });
}

/* ═══════════════ AGENDA ═══════════════ */
const NOME_DIA_SEMANA = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
let anoAgenda = Number(hoje().slice(0,4));

function ultimoDiaMes(ano, mes) { return new Date(ano, mes, 0).getDate(); }

// Calcula a data real de um vencimento (ano/mês/dia-texto), ajustando o dia
// se o mês não tiver tantos dias (ex.: "31" em abril vira dia 30).
// Retorna null se "dia" não for um número (campo ficou vazio ou é texto livre).
function calcularDataAgenda(ano, mes, diaTxt) {
  const diaNum = parseInt(diaTxt, 10);
  if (isNaN(diaNum) || diaNum <= 0) return null;
  const diaClamp = Math.min(diaNum, ultimoDiaMes(ano, mes));
  return new Date(ano, mes - 1, diaClamp);
}
function ehDiaUtil(data) {
  const d = data.getDay();
  if (d === 0 || d === 6) return false;
  return !dados.feriados.some(f => f.data === isoLocal(data));
}
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

// Gera as ocorrências de um compromisso replicado por N meses seguidos
// (qtdExtra = quantos meses ALÉM do inicial, ex.: 11 pra fechar 12 meses).
function gerarOcorrenciasAgenda(ano, mesIni, diaTxt, qtdExtra) {
  const ocorrencias = [];
  for (let i = 0; i <= qtdExtra; i++) {
    const idx = mesIni - 1 + i;
    const anoI = ano + Math.floor(idx / 12);
    const mesI = (idx % 12) + 1;
    ocorrencias.push({ ano: anoI, mes: mesI, data: calcularDataAgenda(anoI, mesI, diaTxt) });
  }
  return ocorrencias;
}

function prepararFiltroAgendaAno() {
  const anos = new Set(dados.age.map(a => a.ano));
  anos.add(anoAgenda); anos.add(Number(hoje().slice(0,4)));
  const lista = [...anos].sort((a,b) => a-b);
  const sel = $("age-filtro-ano");
  const atual = sel.value || String(anoAgenda);
  sel.innerHTML = lista.map(a => `<option value="${a}">${a}</option>`).join("");
  sel.value = lista.includes(Number(atual)) ? atual : String(anoAgenda);
  anoAgenda = Number(sel.value);
}

function renderAgenda() {
  prepararFiltroAgendaAno();
  const doAno = dados.age.filter(a => a.ano === anoAgenda);
  const meses = [...new Set(doAno.map(a => a.mes))].sort((a,b) => a-b);
  const porItem = {};
  for (const a of doAno) {
    const chave = a.item + "§" + a.dia;
    if (!porItem[chave]) porItem[chave] = { item: a.item, dia: a.dia, valores: {}, ids: {}, pagos: {} };
    porItem[chave].valores[a.mes] = (porItem[chave].valores[a.mes] || 0) + a.valor;
    porItem[chave].ids[a.mes] = a.id;
    porItem[chave].pagos[a.mes] = a.status_pagamento === "pago";
  }
  const itens = Object.values(porItem)
    .map(i => ({ ...i, total: Object.values(i.valores).reduce((s,v) => s+v, 0) }))
    .sort((a,b) => b.total - a.total);

  const totaisMes = meses.map(m => itens.reduce((s,i) => s + (i.valores[m] || 0), 0));
  const totalGeral = totaisMes.reduce((s,v) => s+v, 0);
  $("age-total-nota").textContent = anoAgenda + " · total previsto: " + brl0(totalGeral);

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
    (itens.length ? `<tr class="linha-total">
      <td class="col-fixa">Total do mês</td><td></td>
      ${totaisMes.map(t => `<td class="num">${num(t,0)}</td>`).join("")}
      <td class="num td-total">${brl0(totalGeral)}</td>
    </tr>` : `<tr><td colspan="${meses.length+3}" class="vazio">Nenhum compromisso em ${anoAgenda}.</td></tr>`);
}

// clicar num compromisso: escolhe o mês a editar via modal
function abrirModalAgendaItem(item, dia) {
  const linhas = dados.age.filter(a => a.item === item && a.dia === dia && a.ano === anoAgenda);
  if (!linhas.length) return;
  // só uma ocorrência: já vai direto pro seletor BAIXAR/EDITAR
  if (linhas.length === 1) { abrirModalEscolhaAcaoAgenda(linhas[0].id); return; }
  const opcoes = linhas.map(a => `${a.id}|${MESES[a.mes-1]} — ${brl0(a.valor)}`);
  abrirModal({
    titulo: "Compromisso: " + item,
    tabela: "_escolha_agenda",
    rotuloSalvar: "Continuar",
    campos: [
      { nome:"_id", rotulo:"Escolha o mês", tipo:"select", largo:true, opcoes: opcoes, valor: String(linhas[0].id) },
    ],
    montar(f) { return { _id: Number(f._id) }; },
    aoSalvar(reg) { fecharModal(); abrirModalEscolhaAcaoAgenda(reg._id); }
  });
}

// Seletor BAIXAR / EDITAR — aparece antes de abrir o formulário completo,
// já que na maioria das vezes o que se quer fazer é só dar baixa.
function abrirModalEscolhaAcaoAgenda(id) {
  const a = dados.age.find(x => x.id === id);
  if (!a) return;
  const jaPago = a.status_pagamento === "pago";
  abrirModal({
    titulo: a.item,
    tabela: "_acao_agenda",
    rotuloSalvar: "Continuar",
    campos: [
      { nome:"_acao", rotulo:"O que deseja fazer?", tipo:"select", largo:true,
        opcoes: [
          jaPago ? "baixar|Estornar baixa (voltar para em aberto)" : "baixar|Dar baixa (marcar como pago)",
          "editar|Editar dados do compromisso",
        ],
        valor: "baixar" },
    ],
    montar(f) { return { _acao: f._acao }; },
    aoSalvar(reg) {
      fecharModal();
      if (reg._acao === "baixar") abrirModalBaixaAgenda(id); else abrirModalAgenda(id);
    }
  });
}

// Mini formulário só pra dar baixa (ou estornar) — sem precisar abrir o
// formulário completo de edição.
function abrirModalBaixaAgenda(id) {
  const a = dados.age.find(x => x.id === id);
  if (!a) return;
  const jaPago = a.status_pagamento === "pago";
  abrirModal({
    titulo: (jaPago ? "Estornar baixa: " : "Dar baixa: ") + a.item,
    tabela: "_baixa_agenda",
    rotuloSalvar: jaPago ? "Estornar baixa" : "Confirmar baixa",
    campos: jaPago ? [] : [
      { nome:"data_pagamento", rotulo:"Data do pagamento", tipo:"date", valor: hoje() },
    ],
    montar(f) {
      const base = {
        item: a.item, equipamento_id: a.equipamento_id, grupo: a.grupo, ano: a.ano, dia: a.dia, mes: a.mes,
        valor: a.valor, natureza: a.natureza, centro_custo_id: a.centro_custo_id,
      };
      return jaPago
        ? { ...base, status_pagamento: "pendente", data_pagamento: null }
        : { ...base, status_pagamento: "pago", data_pagamento: f.data_pagamento || hoje() };
    },
    async aoSalvar(reg) {
      await salvarAgendaFinal(id, [reg], a.lancamento_id);
    }
  });
}

function abrirModalAgenda(id) {
  const a = id ? dados.age.find(x => x.id === id) : null;
  const campos = [
    { nome:"item", rotulo:"Compromisso", tipo:"texto", largo:true, valor: a?.item || "" },
    { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(true), valor: equipamentoPadrao(a?.equipamento_id, true) },
    { nome:"grupo", rotulo:"Grupo (no extrato, quando der baixa)", tipo:"select", opcoes: opcoesGrupoDespesa(), valor: a?.grupo || "Outras despesas" },
    { nome:"ano", rotulo:"Ano", tipo:"numero", valor: a?.ano || anoAgenda },
    { nome:"dia", rotulo:"Dia do vencimento", tipo:"texto", valor: a?.dia || "" },
    { nome:"mes", rotulo:"Mês", tipo:"select",
      opcoes: MESES.map((m,i) => `${i+1}|${m}`), valor: String(a?.mes || (new Date().getMonth()+1)) },
    { nome:"valor", rotulo:"Valor (R$) — use negativo para estorno", tipo:"moeda", negativo: true, valor: a?.valor ?? "" },
    { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Fixo|Custo fixo","Variavel|Custo variável","Investimento|Investimento"], valor: a?.natureza || "Fixo" },
    { nome:"centro_custo_id", rotulo:"Centro de custo", tipo:"select", opcoes: opcoesCentroCusto(true), valor: centroCustoPadrao(a?.centro_custo_id) },
    { nome:"status_pagamento", rotulo:"Situação", tipo:"select", opcoes:["pendente|Em aberto","pago|Dar baixa (pago)"], valor: a?.status_pagamento || "pendente" },
    { nome:"data_pagamento", rotulo:"Data do pagamento (se deu baixa)", tipo:"date", valor: a?.data_pagamento || hoje() },
  ];
  if (!id) {
    campos.push({ nome:"replicarMeses", rotulo:"Repetir por mais quantos meses (0 = só este)", tipo:"numero", valor: 0 });
  }

  abrirModal({
    titulo: a ? "Editar compromisso" : "Novo compromisso",
    tabela: "agenda", id,
    campos,
    montar(f) {
      if (!f.item.trim()) throw "Informe o nome do compromisso.";
      const v = numDeMoeda(f.valor);
      if (!v) throw "Informe um valor diferente de zero.";
      const anoNum = Number(f.ano);
      if (!anoNum || anoNum < 2000) throw "Informe um ano válido.";
      if (f.status_pagamento === "pago" && !f.data_pagamento) throw "Informe a data do pagamento.";
      return {
        item: f.item.trim(), equipamento_id: f.equipamento_id ? Number(f.equipamento_id) : null,
        grupo: f.grupo, ano: anoNum, dia: f.dia.trim(), mes: Number(f.mes), valor: v,
        natureza: f.natureza, centro_custo_id: f.centro_custo_id ? Number(f.centro_custo_id) : null,
        status_pagamento: f.status_pagamento, data_pagamento: f.status_pagamento === "pago" ? f.data_pagamento : null,
        _replicarMeses: id ? 0 : (Number(f.replicarMeses) || 0),
      };
    },
    async aoSalvar(reg) {
      const qtdExtra = reg._replicarMeses;
      delete reg._replicarMeses;

      // vários meses à frente: abre uma etapa pra conferir/ajustar cada
      // vencimento antes de criar (dias em fim de semana já vêm sugeridos
      // com o próximo dia útil, mas dá pra editar qualquer um).
      if (!id && qtdExtra > 0) {
        fecharModal();
        abrirModalConferirVencimentos(reg, qtdExtra);
        return;
      }

      // ocorrência única (nova ou edição): ajusta automaticamente se cair
      // em dia não útil, perguntando antes.
      const dataCalc = calcularDataAgenda(reg.ano, reg.mes, reg.dia);
      if (dataCalc && !ehDiaUtil(dataCalc)) {
        const ajustada = proximoDiaUtil(dataCalc);
        const mesmoMes = ajustada.getMonth() + 1 === reg.mes && ajustada.getFullYear() === reg.ano;
        const ajustar = confirm(
          `O vencimento (${fData(isoLocal(dataCalc))}, ${NOME_DIA_SEMANA[dataCalc.getDay()]}) cai em dia não útil.\n\n` +
          (mesmoMes
            ? `Clique OK para ajustar automaticamente para o próximo dia útil (${fData(isoLocal(ajustada))}, ${NOME_DIA_SEMANA[ajustada.getDay()]}), ou Cancelar para manter a data original.`
            : `O próximo dia útil (${fData(isoLocal(ajustada))}) já cai no mês seguinte, então não dá pra ajustar automaticamente sem mudar o mês. Clique OK para manter mesmo assim, ou Cancelar para editar.`)
        );
        if (!ajustar && mesmoMes) return;
        if (ajustar && mesmoMes) reg.dia = String(ajustada.getDate());
      }

      await salvarAgendaFinal(id, [reg], a?.lancamento_id ?? null);
    },
    async aoExcluir() { await removerLancamentoVinculado(a?.lancamento_id); },
  });
}

// próximo dia útil a partir de uma data (avança até sair de sábado/domingo)
function proximoDiaUtil(data) {
  const d = new Date(data);
  while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
  return d;
}

// Etapa de conferência: um campo de dia por mês, já sugerindo o próximo dia
// útil quando a data cai em fim de semana, mas editável antes de confirmar.
function abrirModalConferirVencimentos(reg, qtdExtra) {
  const ocorrencias = gerarOcorrenciasAgenda(reg.ano, reg.mes, reg.dia, qtdExtra).map(o => {
    let diaFinal = reg.dia, ajustado = false;
    if (o.data && !ehDiaUtil(o.data)) {
      const adj = proximoDiaUtil(o.data);
      if (adj.getMonth() + 1 === o.mes && adj.getFullYear() === o.ano) {
        diaFinal = String(adj.getDate());
        ajustado = true;
      }
    }
    return { ...o, diaFinal, ajustado };
  });

  abrirModal({
    titulo: `Confira os vencimentos (${ocorrencias.length} meses)`,
    tabela: "_confirma_agenda",
    rotuloSalvar: "Criar compromissos",
    campos: ocorrencias.map((o, i) => ({
      nome: "dia_" + i,
      rotulo: `${MESES[o.mes-1]}/${o.ano}` + (o.ajustado ? " — ajustado p/ dia útil" : ""),
      tipo: "texto",
      valor: o.diaFinal,
    })),
    montar(f) {
      return ocorrencias.map((o, i) => ({
        ...reg, ano: o.ano, mes: o.mes,
        dia: String(f["dia_" + i] ?? "").trim() || o.diaFinal,
        status_pagamento: i === 0 ? reg.status_pagamento : "pendente",
        data_pagamento: i === 0 ? reg.data_pagamento : null,
      }));
    },
    async aoSalvar(linhas) {
      // se o usuário editou algum dia manualmente pra um que ainda cai em
      // fim de semana, avisa antes de gravar (mas não bloqueia).
      const problemas = linhas.filter(l => {
        const d = calcularDataAgenda(l.ano, l.mes, l.dia);
        return d && !ehDiaUtil(d);
      });
      if (problemas.length) {
        const lista = problemas.map(l => `${MESES[l.mes-1]}/${l.ano} (dia ${l.dia})`).join(", ");
        if (!confirm(`Ainda há vencimento em dia não útil em: ${lista}.\n\nCriar assim mesmo?`)) return;
      }
      await salvarAgendaFinal(null, linhas);
    }
  });
}

async function salvarAgendaFinal(id, linhas, lancamentoIdExistente = null) {
  const btn = $("modal-salvar");
  btn.disabled = true; btn.textContent = "Salvando…";
  let salvos, error;
  if (id) {
    ({ data: salvos, error } = await sb.from("agenda").update(linhas[0]).eq("id", id).select());
  } else {
    ({ data: salvos, error } = await sb.from("agenda").insert(linhas).select());
  }
  btn.disabled = false; btn.textContent = id ? "Editar" : "Salvar";
  if (error) {
    $("modal-erro").textContent = "Não foi possível salvar: " + error.message;
    $("modal-erro").classList.remove("oculto");
    return;
  }

  // dar baixa gera (ou atualiza) a movimentação no extrato; voltar pra
  // "em aberto" remove a movimentação, exatamente como no Diesel/Manutenção.
  for (const s of salvos || []) {
    const linkAtual = id ? lancamentoIdExistente : null;
    const tipo = s.valor >= 0 ? "saida" : "entrada";
    const dataVencimento = calcularDataAgenda(s.ano, s.mes, s.dia);
    const dataLancamento = s.data_pagamento || (dataVencimento ? isoLocal(dataVencimento) : hoje());
    try {
      await sincronizarLancamento({
        origemId: s.id, tabelaOrigem: "agenda", lancamentoId: linkAtual,
        valor: s.status_pagamento === "pago" ? Math.abs(s.valor) : 0, tipo,
        data: dataLancamento,
        grupo: s.grupo || "Outras despesas", descricao: s.item,
        natureza: s.natureza, centroCustoId: s.centro_custo_id,
      });
    } catch (e) { console.error("Falha ao sincronizar baixa da agenda:", e); }
  }

  fecharModal();
  toast(salvos && salvos.length > 1 ? salvos.length + " compromissos criados." : "Registro salvo.");
  await carregarTudo();
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
    if (c.tipo === "moeda") {
      return `<label class="${largo}">${c.rotulo}
        <input type="text" inputmode="decimal" data-campo="${c.nome}" data-moeda="1" data-negativo="${c.negativo ? 1 : 0}" value="${escHtml(moedaMascara(c.valor))}">
      </label>`;
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

  // aplica a máscara monetária nos campos "moeda" (formata a cada tecla e
  // absorve ponto/vírgula digitados — quem manda é o dígito, não o separador)
  document.querySelectorAll('#modal-campos [data-moeda]').forEach(ligarMascaraMoeda);

  // hooks de campo (ex.: autopreencher valor de hora ao escolher o cliente)
  ctx.campos.forEach(c => {
    if (!c.aoMudar) return;
    const el = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    if (el) el.addEventListener("input", () => c.aoMudar(el.value));
  });

  const btnExcluir = $("modal-excluir");
  btnExcluir.classList.toggle("oculto", !ctx.id);
  btnExcluir.onclick = () => excluirRegistro();
  $("modal-salvar").textContent = ctx.rotuloSalvar || (ctx.id ? "Editar" : "Salvar");
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

  if (modalCtx.aoSalvar) { await modalCtx.aoSalvar(reg); return; }

  btn.disabled = true; btn.textContent = "Salvando…";
  const q = modalCtx.id
    ? sb.from(modalCtx.tabela).update(reg).eq("id", modalCtx.id).select().single()
    : sb.from(modalCtx.tabela).insert(reg).select().single();
  const { data: salvo, error } = await q;
  if (error) {
    btn.disabled = false; btn.textContent = modalCtx.id ? "Editar" : "Salvar";
    erro.textContent = "Não foi possível salvar: " + error.message;
    erro.classList.remove("oculto");
    return;
  }

  if (modalCtx.aposSalvar) {
    try { await modalCtx.aposSalvar(salvo); }
    catch (e) { console.error("Falha ao sincronizar com o extrato:", e); }
  }

  const eraEdicao = !!modalCtx.id;
  btn.disabled = false; btn.textContent = eraEdicao ? "Editar" : "Salvar";
  fecharModal();
  toast(eraEdicao ? "Registro atualizado." : "Registro criado.");
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
async function sincronizarLancamento({ origemId, tabelaOrigem, lancamentoId, valor, tipo, data, grupo, descricao, natureza = "Variavel", centroCustoId = null, banco = "Bradesco" }) {
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
    centro_custo_id: centroCustoId,
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
    dentroDoPeriodo(l.data) &&
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
