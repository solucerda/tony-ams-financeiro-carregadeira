/* ═══════════════════════════════════════════════════════
   GERENCIADOR FINANCEIRO — TA TRANSPORTE (Pá Carregadeira)
   HTML + CSS + JS puro · Supabase · Chart.js — sem build
   ═══════════════════════════════════════════════════════ */

"use strict";

/* ── Estado global ─────────────────────────────────────── */
let sb = null;                 // cliente Supabase
const dados = {
  saldoInicial: 0, saldoConfig: 0, legadoPorBanco: {}, lanc: [], rec: [], die: [], age: [], man: [],
  dieExtra: [],
  servicos: [], lancServ: [], recServ: [], temServicos: false,
  equipamentos: [], centrosCusto: [], clientes: [], fornecedores: [],
  gruposDespesa: [], contasBancarias: [], operadores: [], obras: [], feriados: [], tiposRecebimento: [], perfis: [],
  perfisEquipamentos: [], logAtividade: [],
};
let filtroExt = { periodo: { chave: "tudo" }, grupo: "todos", busca: "" };
let filtroRecPeriodo = { chave: "tudo" };
let filtroManPeriodo = { chave: "tudo" };
let filtroContasPeriodo = { chave: "tudo" };
let filtroReceberPeriodo = { chave: "tudo" };
let filtroServicosPeriodo = { chave: "tudo" };
let filtroCliente = "todos";
let filtroPainel = { periodo: { chave: "mes" }, natureza: "todos", tipoFluxo: "bar", agrupar: "grupo", visual: "lista" };
let filtroManutencao = { tipo: "todos", status: "todos" };
// Base de dados em uso: "nova" (padrão, operação daqui pra frente), "antiga"
// (legado: o que foi lançado antes da arrumação) ou "tudo". Fica lembrada
// neste navegador. Tabelas com a coluna `legado`: lancamentos, recebimentos,
// diesel, agenda, manutencoes.
let modoBase = "nova";
try { const v = localStorage.getItem("modoBase"); if (v === "antiga" || v === "tudo") modoBase = v; } catch (e) { /* sem storage */ }
const TABELAS_COM_BASE = new Set(["lancamentos", "recebimentos", "diesel", "agenda", "manutencoes", "servicos"]);
const porBase = (q) => modoBase === "tudo" ? q : q.eq("legado", modoBase === "antiga");
// registro novo nasce na base que está na tela (assim o que você lança sempre aparece)
const marcarBase = (obj) => Array.isArray(obj) ? obj.map(marcarBase) : { ...obj, legado: modoBase === "antiga" };

let filtroDiesel = { combustivel: "todos", periodo: { chave: "tudo" } };
const graficos = {};           // instâncias Chart.js

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CORES_GRUPO = {
  "Combustível":"#F5B301","Financiamento":"#F0564A","Investimento":"#7A8CF0",
  "Manutenção":"#FF8C42","Pessoal":"#4EC9D4","Seguro Frota":"#C77DFF",
  "Tarifas":"#8B919C","Taxas fixas":"#6B7280","Outras despesas":"#A3A8B4",
  "Recebimentos":"#3ECF8E","Ajuste de saldo":"#8B919C"
};
const CORES_NATUREZA = { "Custo fixo":"#7A8CF0", "Custo variável":"#F5B301", "Investimento":"#C77DFF" };
const ROTULO_NATUREZA = { Fixo:"Custo fixo", Variavel:"Custo variável", Investimento:"Investimento" };
const PALETA_CENTROS = ["#3ECF8E","#7A8CF0","#F5B301","#FF8C42","#4EC9D4","#C77DFF","#F0564A","#8B919C"];

/* ── Utilidades ────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const telaCombina = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
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

function toast(msg, tipo) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("toast-erro", tipo === "erro");
  t.classList.remove("oculto");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("oculto"), tipo === "erro" ? 6000 : 3200);
}

/* ── Erros: nunca "não acontece nada" ─────────────────────
   Quando algo impede de salvar, o campo culpado pisca e a tela rola até
   ele; e um aviso aparece por cima de tudo dizendo o porquê. */
function erroCampo(campo, msg) { return { campo, msg }; }
function alertaErro(msg, titulo) {
  let el = $("alerta-erro");
  if (!el) {
    el = document.createElement("div");
    el.id = "alerta-erro";
    el.className = "alerta-fundo oculto";
    el.innerHTML = `<div class="alerta-caixa" role="alertdialog" aria-modal="true" aria-labelledby="alerta-titulo">
      <div class="alerta-icone">${icone("alerta")}</div>
      <h3 id="alerta-titulo"></h3><p id="alerta-msg"></p>
      <button type="button" class="btn-primario btn-largo" id="alerta-ok">Entendi</button></div>`;
    document.body.appendChild(el);
    const fechar = () => el.classList.add("oculto");
    el.querySelector("#alerta-ok").addEventListener("click", fechar);
    el.addEventListener("click", (ev) => { if (ev.target === el) fechar(); });
    document.addEventListener("keydown", (ev) => { if (!el.classList.contains("oculto") && (ev.key === "Escape" || ev.key === "Enter")) { ev.preventDefault(); ev.stopPropagation(); fechar(); } }, true);
  }
  el.querySelector("#alerta-titulo").textContent = titulo || "Não deu para salvar";
  el.querySelector("#alerta-msg").textContent = msg;
  el.classList.remove("oculto");
  setTimeout(() => el.querySelector("#alerta-ok").focus(), 30);
}
// erro dentro de um formulário: destaca o campo (se houver) + aviso na tela
function mostrarErroForm(erro, campo) {
  const msg = typeof erro === "string" ? erro : (erro && (erro.msg || erro.message)) || String(erro);
  campo = campo || (erro && erro.campo);
  const box = $("modal-erro");
  box.textContent = msg;
  box.classList.remove("oculto");
  const el = campo ? document.querySelector(`#modal-campos [data-campo="${campo}"]`) : null;
  const rot = el && !escondidoNoForm(el) ? el.closest("label") : null;
  if (rot) {
    let m = rot.querySelector(".msg-obrigatorio");
    if (!m) { m = document.createElement("span"); m.className = "msg-obrigatorio"; rot.appendChild(m); }
    m.textContent = msg;
    m.classList.remove("oculto");
    rot.classList.remove("campo-invalido"); void rot.offsetWidth; rot.classList.add("campo-invalido");
    if (el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    toast(msg, "erro");
  } else {
    alertaErro(msg);
  }
}
// mensagem amigável para falhas do banco/rede
function erroBanco(e) {
  const m = String((e && e.message) || e || "");
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sem conexão com a internet. Confira o sinal e tente de novo.";
  if (/row-level security|permission denied|violates row-level/i.test(m)) return "Seu usuário não tem permissão para isso. Peça para um administrador liberar.";
  if (/duplicate key/i.test(m)) return "Já existe um registro igual a este.";
  if (/violates foreign key/i.test(m)) return "Este registro está ligado a outros e não pode ser alterado assim.";
  return "O servidor recusou: " + m;
}

// Ícone SVG a partir do sprite definido no <body> do index.html (estilo
// Lucide: traço 2px, sem preenchimento, cor herdada via currentColor).
// Helper central pra não repetir o markup do <use> em cada render().
// O viewBox/width/height ficam aqui, no <svg> que de fato aparece na
// página — sem isso alguns navegadores não sabem escalar o <use> e
// renderizam o ícone no tamanho intrínseco (gigante) em vez do da CSS.
function icone(nome, classeExtra) {
  return `<svg class="icone ${classeExtra || ""}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><use href="#icone-${nome}"></use></svg>`;
}

// Guarda de permissão para cliques em linha/cartão inteiro (Extrato,
// Recebimentos, Abastecimento, Manutenção): no papel "leitura" mostra o
// mesmo aviso já usado na Agenda em vez de abrir o formulário de edição.
function aoClicarLinha(fn) {
  if (meuPapel === "leitura") { toast("Seu acesso é somente leitura."); return; }
  fn();
}

// Handler de teclado para linhas/cartões clicáveis (role="button"): Enter e
// Espaço disparam o mesmo clique, mantendo a navegação por teclado.
function teclaLinha(ev) {
  if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); }
}

// (o antigo FAB por aba deu lugar ao botão + central, que abre "Novo registro")
function atualizarFab() { /* mantido por compatibilidade */ }

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
function opcoesEquipamentoPorTipo(tipo) {
  return dados.equipamentos.filter(e => e.ativo && (e.tipo || "Maquina") === tipo).map(e => `${e.id}|${e.nome}`);
}
function equipamentoPadrao(valorAtual, incluirGeral) {
  if (valorAtual != null) return String(valorAtual);
  if (contexto.equipamentoId != null) return String(contexto.equipamentoId);
  if (incluirGeral) return "";
  const primeiro = dados.equipamentos.find(e => e.ativo);
  return primeiro ? String(primeiro.id) : "";
}
// Avatar: usa a foto cadastrada, ou gera um círculo colorido com as
// iniciais do nome (cor consistente pro mesmo nome, sempre).
const PALETA_AVATAR = ["#F5B301","#3ECF8E","#7A8CF0","#FF8C42","#4EC9D4","#C77DFF","#F0564A"];
function corAvatar(texto) {
  let h = 0;
  for (const c of String(texto || "")) h = (h * 31 + c.charCodeAt(0)) % PALETA_AVATAR.length;
  return PALETA_AVATAR[Math.abs(h)];
}
function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes[1]?.[0] || "")).toUpperCase();
}
function avatarHtml(nome, url) {
  const cor = corAvatar(nome);
  if (url) {
    return `<span class="avatar-fallback" style="background:${cor}"><img src="${escHtml(url)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${iniciais(nome)}'"></span>`;
  }
  return `<span class="avatar-fallback" style="background:${cor}">${iniciais(nome)}</span>`;
}

// Equipamento com resultado próprio aparece como opção de painel; os outros
// (ex.: carro de apoio) só somam custo no total do negócio.
function controlaResultado(e) {
  if (!e) return false;
  return e.controla_resultado ?? ((e.tipo || "Maquina") !== "Veiculo");
}
function nomeEquipamento(id) {
  const e = dados.equipamentos.find(x => x.id === id);
  return e ? e.nome : "";
}
function tipoEquipamento(id) {
  const e = dados.equipamentos.find(x => x.id === id);
  return e ? (e.tipo || "Maquina") : "Maquina";
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
// novo registro começa "Não classificado" (antes vinha marcado o primeiro
// centro da lista, ex.: "Cartão de crédito", sem ninguém ter escolhido)
function centroCustoPadrao(valorAtual) {
  return valorAtual != null ? String(valorAtual) : "";
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
function opcoesTipoRecebimento(incluirNenhum) {
  const opts = dados.tiposRecebimento.filter(t => t.ativo).map(t => `${t.id}|${t.nome}`);
  if (incluirNenhum) opts.push("|Não classificado");
  return opts;
}
function nomeTipoRecebimento(id) {
  const t = dados.tiposRecebimento.find(x => x.id === id);
  return t ? t.nome : "";
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
let meuUserId = null;
let meuPapel = "leitura"; // padrão seguro até carregar de verdade
let primeiraCarga = true;
let meusModulos = { extrato:true, recebimentos:true, diesel:true, manutencao:true, agenda:true };
let vejoFinanceiro = true;
let modoAgenda = "lista"; // Contas: "lista" (por vencimento) ou "ano" (matriz)

// Nome da empresa (config.empresa_nome) — deixa o sistema pronto para outros clientes.
function aplicarMarca(nome) {
  const n = (nome && String(nome).trim()) || "TA Transporte";
  document.querySelectorAll("[data-empresa-nome]").forEach(el => { el.textContent = n; });
  document.title = n + " — Gestão de Frota";
}
// Conta usada nos lançamentos automáticos (abastecimento, manutenção, serviços, contas).
// Antes era sempre "Bradesco", o que bagunçava o saldo por conta.
function contaDoLancamento(id) {
  const l = id ? dados.lanc.find(x => x.id === id) : null;
  return l && opcoesContaBancaria().includes(l.banco) ? l.banco : contaPadrao();
}
function contaPadrao() {
  const ativas = opcoesContaBancaria();
  if (dados.contaPadrao && ativas.includes(dados.contaPadrao)) return dados.contaPadrao;
  return ativas[0] || "Bradesco";
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!SUPABASE_URL || SUPABASE_URL.includes("COLE_AQUI")) {
    $("tela-config").classList.remove("oculto");
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await sb.auth.getSession();
  if (session) { meuUserId = session.user.id; iniciarSessao(); } else mostrarLogin();

  $("form-login").addEventListener("submit", fazerLogin);
  $("btn-sair").addEventListener("click", sair);
  $("chip-contexto").addEventListener("click", abrirSeletorEquipamento);
  $("faixa-base-voltar").addEventListener("click", () => trocarBase("nova"));
  atualizarFaixaBase();
  $("usuario-botao").addEventListener("click", (ev) => {
    ev.stopPropagation();
    $("usuario-dropdown").classList.toggle("oculto");
  });
  document.addEventListener("click", () => $("usuario-dropdown").classList.add("oculto"));
  $("btn-meu-perfil").addEventListener("click", () => {
    $("usuario-dropdown").classList.add("oculto");
    abrirModalMeuPerfil();
  });
});

async function sair() {
  try { await sb.auth.signOut(); } catch (e) { /* offline: limpa assim mesmo */ }
  try { localStorage.removeItem("contexto"); } catch (e) { /* sem storage */ }
  location.reload();
}

// Base de dados: operação nova / base antiga / tudo (fica em "Mais" → só gestor).
function atualizarFaixaBase() {
  $("faixa-base").classList.toggle("oculto", modoBase === "nova");
  $("faixa-base-texto").textContent = modoBase === "antiga"
    ? "Você está vendo a BASE ANTIGA (legado). O que for lançado aqui também fica na base antiga."
    : "Você está vendo TUDO: operação nova + base antiga misturadas.";
}
function trocarBase(v) {
  modoBase = v;
  try { localStorage.setItem("modoBase", v); } catch (e) { /* sem storage */ }
  atualizarFaixaBase();
  carregarTudo();
}

function mostrarLogin() {
  $("tela-login").classList.remove("oculto");
}

async function fazerLogin(ev) {
  ev.preventDefault();
  const btn = $("login-btn"), erro = $("login-erro");
  btn.disabled = true; btn.textContent = "Entrando…";
  erro.classList.add("oculto");
  const { data, error } = await sb.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-senha").value
  });
  btn.disabled = false; btn.textContent = "Entrar";
  if (error) {
    erro.textContent = "E-mail ou senha incorretos. Confira e tente de novo.";
    erro.classList.remove("oculto");
    return;
  }
  meuUserId = data.user.id;
  $("tela-login").classList.add("oculto");
  iniciarSessao();
}

/* ── Equipamento em foco (contexto) ───────────────────────
   Antes era uma tela obrigatória a cada entrada. Agora o app abre direto no
   último contexto usado (ou "Total do negócio") e o chip do topo troca na
   hora, numa folha rápida. */
let equipamentosPermitidos = null; // null = sem restrição

async function carregarPermissoesEquipamento() {
  const { data, error } = await sb.from("equipamentos").select("*").eq("ativo", true).order("nome");
  if (error) throw error;
  equipamentosPermitidos = null;
  try {
    const { data: perfilData } = await sb.from("perfis").select("*").eq("id", meuUserId).single();
    if (perfilData) meuPapel = perfilData.ativo === false ? "leitura" : perfilData.papel;
    if (meuPapel !== "admin") {
      const { data: restr } = await sb.from("perfis_equipamentos").select("equipamento_id").eq("perfil_id", meuUserId);
      if (restr && restr.length) equipamentosPermitidos = new Set(restr.map(r => r.equipamento_id));
    }
  } catch (e) { /* migração v19/v20 ainda não rodada — libera tudo */ }
  dados.equipamentos = (data || []).filter(e => !equipamentosPermitidos || equipamentosPermitidos.has(e.id));
}

async function iniciarSessao() {
  $("tela-login").classList.add("oculto");
  try {
    await carregarPermissoesEquipamento();
  } catch (e) {
    $("app").classList.remove("oculto");
    $("carregando").textContent = "Não foi possível conectar ao banco. Confira sua internet e tente de novo. (" + (e.message || e) + ")";
    return;
  }
  // último contexto usado, se ainda for permitido; quem só tem 1 máquina liberada entra direto nela
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem("contexto") || "null"); } catch (e) { /* sem storage */ }
  const valido = salvo && (salvo.equipamentoId == null || dados.equipamentos.some(e => e.id === salvo.equipamentoId && controlaResultado(e)));
  if (valido) escolherContexto(salvo.equipamentoId, salvo.equipamentoId == null ? "Total do negócio" : nomeEquipamento(salvo.equipamentoId));
  else if (equipamentosPermitidos && dados.equipamentos.length === 1) escolherContexto(dados.equipamentos[0].id, dados.equipamentos[0].nome);
  else escolherContexto(null, "Total do negócio");
}

// Folha rápida para trocar o equipamento em foco.
function abrirSeletorEquipamento() {
  const item = (id, nome, sub, img) => `
    <button type="button" class="seletor-item ${contexto.equipamentoId === id ? "ativo" : ""}" data-equip="${id ?? ""}">
      <span class="seletor-icone">${img || icone(id == null ? "painel" : "tractor")}</span>
      <span class="seletor-texto"><b>${escHtml(nome)}</b><small>${escHtml(sub)}</small></span>
      ${contexto.equipamentoId === id ? icone("check", "icone-sm seletor-check") : ""}
    </button>`;
  const ativos = dados.equipamentos.filter(e => e.ativo !== false && controlaResultado(e));
  const html = `<div class="seletor-lista">
    ${item(null, "Total do negócio", "tudo somado: todas as máquinas e despesas gerais")}
    ${ativos.map(e => item(e.id, e.nome, (e.tipo || "Maquina") === "Veiculo" ? "veículo de apoio" : "máquina",
      e.imagem_url ? `<img src="${escHtml(e.imagem_url)}" alt="" onerror="this.remove()">` : "")).join("")}
  </div>
  ${meuPapel === "admin" ? `<button type="button" class="btn-link seletor-gerenciar" onclick="fecharModal(); irPara('administracao'); mudarSecaoAdmin('equipamentos')">Gerenciar equipamentos</button>` : ""}`;
  abrirModal({ titulo: "Ver dados de…", tabela: "_seletor_equip", corpoCustom: html, semSalvar: true, folha: true });
  document.querySelectorAll("#modal-campos [data-equip]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.equip ? Number(b.dataset.equip) : null;
    fecharModal();
    if (id !== contexto.equipamentoId) escolherContexto(id, id == null ? "Total do negócio" : nomeEquipamento(id));
  }));
}

function escolherContexto(equipamentoId, nome) {
  contexto = { equipamentoId, nome };
  try { localStorage.setItem("contexto", JSON.stringify({ equipamentoId })); } catch (e) { /* sem storage */ }
  $("contexto-nome").textContent = nome;
  const equip = equipamentoId != null ? dados.equipamentos.find(e => e.id === equipamentoId) : null;
  $("equip-icone").innerHTML = equip?.imagem_url
    ? `<img src="${escHtml(equip.imagem_url)}" alt="" onerror="this.remove()">`
    : icone(equipamentoId == null ? "painel" : "tractor", "icone-sm");
  if (!appIniciado) { appIniciado = true; iniciarApp(); }
  else carregarTudo();
}

async function iniciarApp() {
  $("app").classList.remove("oculto");

  iniciarNavegacao(); // shell.js: barra inferior, lateral, rotas e botão +

  // botões "novo"
  $("ext-novo").addEventListener("click", () => abrirModalLancamento(null));
  $("rec-novo").addEventListener("click", () => abrirModalRecebimento(null));
  $("die-novo").addEventListener("click", () => abrirModalDiesel(null));
  $("age-novo").addEventListener("click", () => abrirModalAgenda(null, "pagar"));
  $("man-novo").addEventListener("click", () => abrirModalManutencao(null));

  // filtros de período (um botão que abre as opções — periodo.js)
  registrarPeriodo("painel", () => filtroPainel.periodo, (p) => { filtroPainel.periodo = p; renderPainel(); });
  registrarPeriodo("extrato", () => filtroExt.periodo, (p) => { filtroExt.periodo = p; renderExtrato(); });
  registrarPeriodo("diesel", () => filtroDiesel.periodo, (p) => { filtroDiesel.periodo = p; renderDiesel(); });
  registrarPeriodo("horas", () => filtroRecPeriodo, (p) => { filtroRecPeriodo = p; renderRecebimentos(); });
  registrarPeriodo("manutencao", () => filtroManPeriodo, (p) => { filtroManPeriodo = p; renderManutencao(); });
  registrarPeriodo("pagar", () => filtroContasPeriodo, (p) => { filtroContasPeriodo = p; renderContasLista(); });
  registrarPeriodo("receber", () => filtroReceberPeriodo, (p) => { filtroReceberPeriodo = p; renderReceber(); });
  registrarPeriodo("servicos", () => filtroServicosPeriodo, (p) => { filtroServicosPeriodo = p; renderServicos(); });
  $("age-ano-btn").addEventListener("click", abrirSeletorAnoAgenda);
  $("rcb-novo").addEventListener("click", () => abrirModalAgenda(null, "receber"));
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ver-mais]");
    if (!b) return;
    ev.stopPropagation();
    const id = b.dataset.verMais;
    if (listasAbertas.has(id)) listasAbertas.delete(id); else listasAbertas.add(id);
    const resto = document.querySelectorAll(`[data-resto="${id}"]`);
    resto.forEach(r => r.classList.toggle("oculto", !listasAbertas.has(id)));
    b.textContent = listasAbertas.has(id) ? "Ver menos" : b.dataset.rotulo;
  });
  $("ext-filtro-grupo").addEventListener("change", e => { filtroExt.grupo = e.target.value; renderExtrato(); });
  $("ext-busca").addEventListener("input", e => { filtroExt.busca = e.target.value; renderExtrato(); });
  $("ext-exportar").addEventListener("click", exportarExtratoCSV);
  $("rec-exportar").addEventListener("click", exportarRecebimentosCSV);

  // alternadores do painel
  $("ext-btn-filtros").addEventListener("click", () => {
    const aberto = $("ext-filtros-extra").classList.toggle("aberto");
    $("ext-btn-filtros").setAttribute("aria-expanded", aberto ? "true" : "false");
  });
  ligarSegmentado("age-modo", (v) => { modoAgenda = v; renderAgenda(); });
  ligarSegmentado("srv-filtro", (v) => { filtroServicos = v; renderServicos(); });
  $("srv-novo").addEventListener("click", () => abrirModalServico(null));
  $("topo-saldo").addEventListener("click", () => irPara("extrato"));
  $("pnl-natureza").addEventListener("change", e => { filtroPainel.natureza = e.target.value; renderPainel(); });
  ligarSegmentado("pnl-tipo-fluxo", (v) => { filtroPainel.tipoFluxo = v; renderPainel(); });
  ligarSegmentado("pnl-agrupar", (v) => { filtroPainel.agrupar = v; renderPainel(); });
  ligarSegmentado("pnl-visual", (v) => { filtroPainel.visual = v; renderPainel(); });

  // filtros de manutenção
  // filtros do abastecimento
  $("die-filtro-combustivel").addEventListener("change", e => { filtroDiesel.combustivel = e.target.value; renderDiesel(); });
  $("man-filtro-tipo").addEventListener("change", e => { filtroManutencao.tipo = e.target.value; renderManutencao(); });
  ligarSegmentado("man-filtro-status", (v) => { filtroManutencao.status = v; renderManutencao(); });



  // cliques delegados (cartões de cliente e linhas da agenda)
  $("rec-clientes").addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-cliente]");
    if (card) filtrarCliente(card.dataset.cliente);
  });
  $("age-corpo").addEventListener("click", (ev) => {
    if (ev.target.closest(".linha-total")) return;
    // célula de um mês específico: pula direto pra ela (ver abrirCelulaAgendaMes).
    // qualquer outro clique na linha (nome do compromisso, coluna "Dia", Total)
    // mantém o comportamento de sempre — abre a visão com todos os meses.
    const celMes = ev.target.closest("[data-mes]");
    if (celMes) {
      const tr = celMes.closest("[data-item]");
      if (tr) abrirCelulaAgendaMes(tr.dataset.item, tr.dataset.dia, tr.dataset.agregado === "1", Number(celMes.dataset.mes));
      return;
    }
    const tr = ev.target.closest("[data-item]");
    if (tr) abrirModalAgendaItem(tr.dataset.item, tr.dataset.dia, tr.dataset.agregado === "1");
  });

  // modal
  $("modal-fechar").addEventListener("click", () => fecharModal());
  $("modal-cancelar").addEventListener("click", () => {
    if (modalCtx && modalCtx.aoCancelarClique) { modalCtx.aoCancelarClique(); return; }
    fecharModal();
  });
  $("modal-fundo").addEventListener("click", (ev) => { if (ev.target === $("modal-fundo")) fecharModal(); });

  // ── Teclado no modal: Esc fecha, Enter num campo de texto/número/data/
  // moeda salva, Tab/Shift+Tab ficam presos dentro do modal (focus trap).
  // Um listener só, sempre ativo — checa a cada tecla se o modal está
  // aberto, então funciona igual pro modal que estiver na tela no momento,
  // inclusive nos encadeados da Agenda (cada abrirModal() troca o conteúdo
  // e o listener passa a valer pro conteúdo novo, sem nada extra a fazer).
  document.addEventListener("keydown", (ev) => {
    if ($("modal-fundo").classList.contains("oculto")) return;

    if (ev.key === "Escape") { ev.preventDefault(); fecharModal(); return; }

    if (ev.key === "Enter") {
      const ativo = document.activeElement;
      const emCampoDeTexto = ativo && ativo.matches('#modal-campos input:not([type="checkbox"])');
      if (emCampoDeTexto) {
        ev.preventDefault();
        const btnSalvar = $("modal-salvar");
        if (!btnSalvar.classList.contains("oculto") && !btnSalvar.disabled) btnSalvar.click();
      }
      // Enter em <select> ou em botão (ex.: "Baixar"/"Editar" da Agenda,
      // itens de "detalhe-lista") segue o comportamento nativo — não intercepta.
      return;
    }

    if (ev.key === "Tab") {
      const focaveis = Array.from($("modal-fundo").querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetParent !== null && !el.classList.contains("oculto"));
      if (!focaveis.length) return;
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    }
  });

  await carregarTudo();
}

/* ── Carga de dados ────────────────────────────────────── */
async function carregarTudo() {
  if (primeiraCarga) {
    $("carregando").textContent = "Carregando dados…";
    $("carregando").classList.remove("oculto");
  }
  document.body.classList.add("sincronizando");
  try {
    // no modo "Total do negócio" (contexto.equipamentoId === null) não filtra
    // nada — traz tudo, inclusive despesas gerais sem equipamento definido.
    const comEquip = (q) => contexto.equipamentoId != null ? q.eq("equipamento_id", contexto.equipamentoId) : q;

    const [cfg, lanc, rec, die, age, man, equipTodos, centros] = await Promise.all([
      sb.from("config").select("*"),
      porBase(comEquip(sb.from("lancamentos").select("*"))).order("data").order("id"),
      porBase(comEquip(sb.from("recebimentos").select("*"))).order("data").order("id"),
      porBase(comEquip(sb.from("diesel").select("*"))).order("data").order("id"),
      porBase(comEquip(sb.from("agenda").select("*"))).order("item").order("mes"),
      porBase(comEquip(sb.from("manutencoes").select("*"))).order("data", { ascending: false }),
      sb.from("equipamentos").select("*").order("nome"),
      sb.from("centros_custo").select("*").order("nome"),
    ]);
    const erro = cfg.error || lanc.error || rec.error || die.error || age.error || man.error || equipTodos.error || centros.error;
    if (erro) throw erro;

    const cfgVal = (k) => { const c = (cfg.data || []).find(x => x.chave === k); return c ? c.valor : null; };
    aplicarMarca(cfgVal("empresa_nome"));
    dados.contaPadrao = cfgVal("conta_padrao") || "";
    const si = (cfg.data || []).find(c => c.chave === "saldo_inicial");
    dados.saldoInicial = si ? Number(si.valor) : 0;
    dados.saldoConfig = dados.saldoInicial;
    dados.legadoPorBanco = {};
    // Na operação nova o caixa não recomeça do zero: o resultado da base
    // antiga entra como saldo de abertura.
    if (modoBase === "nova") {
      const { data: leg, error: erroLeg } = await comEquip(sb.from("lancamentos").select("entrada,saida,status,banco")).eq("legado", true);
      if (erroLeg) throw erroLeg;
      for (const l of (leg || []).filter(ehRealizado)) {
        const v = (Number(l.entrada) || 0) - (Number(l.saida) || 0);
        dados.saldoInicial += v;
        dados.legadoPorBanco[l.banco] = (dados.legadoPorBanco[l.banco] || 0) + v;
      }
    }
    dados.lanc = (lanc.data || []).map(o => normNum(o, "lancamentos"));
    dados.rec  = (rec.data  || []).map(o => normNum(o, "recebimentos"));
    dados.die  = (die.data  || []).map(o => normNum(o, "diesel"));
    // O carro de apoio é OUTRO equipamento (o Veículo). Vendo só a máquina, o
    // lançamento da gasolina nunca vinha — e o painel, o filtro e o total da
    // nota ficavam sem ele. Busca à parte os "pares" dos abastecimentos
    // carregados; ficam em dieExtra, só pra exibição (não entram nos
    // totais do painel nem do Extrato da máquina).
    dados.dieExtra = [];
    if (contexto.equipamentoId != null && dados.die.length) {
      try {
        const aqui = new Set(dados.die.map(x => x.id));
        const faltam = [...new Set(dados.die.map(x => x.grupo_abastecimento_id).filter(g => g && !aqui.has(g)))];
        const cond = [];
        if (faltam.length) cond.push(`id.in.(${faltam.join(",")})`);
        cond.push(`grupo_abastecimento_id.in.(${[...aqui].join(",")})`);
        const { data: extra, error: erroExtra } = await sb.from("diesel").select("*").or(cond.join(",")).order("data").order("id");
        if (erroExtra) throw erroExtra;
        dados.dieExtra = (extra || []).filter(x => !aqui.has(x.id)).map(o => normNum(o, "diesel"));
      } catch (e) { console.error("Falha ao buscar os pares do carro de apoio:", e); }
    }
    await carregarServicos();
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
      ["tiposRecebimento", "tipos_recebimento"],
      ["perfis", "perfis"],
      ["perfisEquipamentos", "perfis_equipamentos"],
    ];
    const ORDEM_TABELA = { feriados: "data", perfis_equipamentos: "perfil_id" };
    await Promise.all(cadastrosOpcionais.map(async ([chave, tabela]) => {
      try {
        const { data, error } = await sb.from(tabela).select("*").order(ORDEM_TABELA[tabela] || "nome");
        if (error) throw error;
        dados[chave] = data || [];
      } catch (e) {
        dados[chave] = [];
        console.warn(`Tabela "${tabela}" indisponível (rode correcoes_v10.sql no Supabase):`, e.message || e);
      }
    }));

    // auditoria: log das últimas 100 alterações (só admin enxerga, por RLS
    // — pra qualquer outro papel isso simplesmente volta vazio, sem erro)
    try {
      const { data, error } = await sb.from("log_atividade").select("*").order("criado_em", { ascending: false }).limit(300);
      if (error) throw error;
      dados.logAtividade = data || [];
    } catch (e) {
      dados.logAtividade = [];
      console.warn("Log de atividade indisponível (rode correcoes_v20.sql):", e.message || e);
    }

    // meu nível de acesso — se a migração v19 ainda não rodou, dados.perfis
    // fica vazio e todo mundo continua com acesso total (comportamento de
    // antes), sem travar ninguém.
    let meuPerfil = null;
    if (dados.perfis.length) {
      meuPerfil = dados.perfis.find(p => p.id === meuUserId);
      meuPapel = meuPerfil && meuPerfil.ativo !== false ? meuPerfil.papel : "leitura";
    } else {
      meuPapel = "admin";
    }
    const podeEscrever = meuPapel === "admin" || meuPapel === "operacional";
    document.body.classList.toggle("somente-leitura", !podeEscrever);
    document.body.classList.toggle("nao-admin", meuPapel !== "admin");
    const badge = $("meu-papel-badge");
    if (badge) badge.textContent = { admin:"Administrador", operacional:"Operacional", leitura:"Leitura" }[meuPapel] || "";
    const nomeExibicao = meuPerfil?.nome || "Usuário";
    $("usuario-nome-topo").textContent = nomeExibicao;
    $("usuario-avatar").outerHTML = avatarHtml(nomeExibicao, meuPerfil?.avatar_url).replace('class="avatar-fallback"', 'class="avatar-fallback" id="usuario-avatar"');

    // módulos liberados e visibilidade financeira — admin sempre vê tudo,
    // independente do que estiver configurado (evita se trancar sozinho)
    const modulosPadrao = { extrato:true, recebimentos:true, diesel:true, manutencao:true, agenda:true };
    meusModulos = meuPapel === "admin" ? modulosPadrao : { ...modulosPadrao, ...(meuPerfil?.modulos || {}) };
    vejoFinanceiro = meuPapel === "admin" || (meuPerfil?.ve_financeiro ?? true);
    document.body.classList.toggle("sem-financeiro", !vejoFinanceiro);
    aplicarPermissoesNavegacao(); // shell.js: monta a navegação só com o que a pessoa pode ver
    primeiraCarga = false;

    $("carregando").classList.add("oculto");
    renderTudo();
    document.body.classList.remove("sincronizando");
  } catch (e) {
    document.body.classList.remove("sincronizando");
    $("carregando").classList.remove("oculto");
    $("carregando").textContent = "Não foi possível carregar os dados. " + erroBanco(e);
    if (!primeiraCarga) alertaErro(erroBanco(e), "Não deu para atualizar os dados");
  }
}

// Supabase devolve numeric como string — converte tudo que for número,
// exceto os campos que são texto por natureza (mesmo quando só têm dígitos,
// como o "dia" do vencimento na agenda — "05" precisa continuar string,
// senão a comparação com o dataset do HTML, que é sempre string, falha).
const CAMPOS_TEXTO = {
  lancamentos:  new Set(["data", "banco", "grupo", "subgrupo", "descricao"]),
  recebimentos: new Set(["data", "cliente", "operador", "obra"]),
  diesel:       new Set(["data"]),
  agenda:       new Set(["item", "dia"]),
  manutencoes:  new Set(["data", "descricao", "pecas", "fornecedor", "vencimento", "proxima_data"]),
  servicos:     new Set(["nome", "cliente", "data_inicio", "data_fim", "cobranca", "status", "observacao"]),
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
  rodarSemTravar(renderServicos, "Serviços");
  rodarSemTravar(renderAgenda, "Agenda");
  rodarSemTravar(renderAdministracao, "Configurações");
  rodarSemTravar(renderInicio, "Início");
  rodarSemTravar(pintarBotoesPeriodo, "Filtros");
  rodarSemTravar(aplicarDicas, "Dicas");
  rodarSemTravar(renderMais, "Mais");
}

// Executa uma função de renderização isoladamente: se uma aba falhar
// (ex.: um gráfico), as demais abas continuam sendo exibidas normalmente.
function rodarSemTravar(fn, nome) {
  try { fn(); }
  catch (e) {
    console.error("Falha ao renderizar " + nome + ":", e);
    toast("Não foi possível mostrar '" + nome + "'. Atualize a página; se continuar, avise o suporte.", "erro");
  }
}

/* ── Cálculos ──────────────────────────────────────────── */
// pendente = compromisso previsto, dinheiro ainda não mudou de mão —
// não pode contar no saldo em caixa nem nos totais de fluxo realizado.
const ehRealizado = (l) => l.status !== "pendente";
// Ajuste de saldo: lançamento que acerta o app com o saldo real da conta. Entra
// no saldo e no extrato, mas não conta como receita nem despesa nos painéis.
const GRUPO_AJUSTE = "Ajuste de saldo";
const ehAjusteSaldo = (l) => l.grupo === GRUPO_AJUSTE;

function saldoAtual() {
  return dados.lanc.filter(ehRealizado).reduce((s, l) => s + l.entrada - l.saida, dados.saldoInicial);
}

function renderSaldoTopo() {
  $("topo-saldo").classList.toggle("oculto", contexto.equipamentoId != null || !vejoFinanceiro);
  const s = saldoAtual();
  const el = $("saldo-topo");
  el.textContent = brl(s);
  el.className = "topo-saldo-valor " + (s >= 0 ? "pos" : "neg");
}

/* ═══════════════ PAINEL ═══════════════ */

function noPeriodo(lista) { return lista.filter(x => dentroDe(x.data, filtroPainel.periodo)); }

/* ── Listas encolhidas: começam com 1 item e "Ver mais" ── */
const listasAbertas = new Set();
function listaComVerMais(id, itens, inicial = 1) {
  if (itens.length <= inicial) return itens.join("");
  const aberta = listasAbertas.has(id);
  const rot = `Ver mais (${itens.length - inicial})`;
  return itens.slice(0, inicial).join("")
    + `<div class="ver-mais-resto ${aberta ? "" : "oculto"}" data-resto="${id}">${itens.slice(inicial).join("")}</div>`
    + `<button type="button" class="btn-ver-mais" data-ver-mais="${id}" data-rotulo="${rot}">${aberta ? "Ver menos" : rot}</button>`;
}
// mesma ideia para tabelas (linhas <tr>)
function linhasComVerMais(id, linhas, inicial, colunas) {
  if (linhas.length <= inicial) return linhas.join("");
  const aberta = listasAbertas.has(id);
  const rot = `Ver mais (${linhas.length - inicial})`;
  return linhas.slice(0, inicial).join("")
    + linhas.slice(inicial).map(l => l.replace(/^\s*<tr /, `<tr data-resto="${id}" class="${aberta ? "" : "oculto"} `)).join("")
    + `<tr class="linha-ver-mais"><td colspan="${colunas}"><button type="button" class="btn-ver-mais" data-ver-mais="${id}" data-rotulo="${rot}">${aberta ? "Ver menos" : rot}</button></td></tr>`;
}

function renderPainel() {
  const periodoLanc = noPeriodo(dados.lanc).filter(ehRealizado).filter(l => !ehAjusteSaldo(l));
  const periodoRec  = noPeriodo(dados.rec);
  const periodoDie  = noPeriodo(dados.die);

  // KPIs — "Saldo em caixa", "Em aberto a receber" e "Contas a pagar" são o
  // estado atual do negócio (não mudam com o filtro de período); os demais
  // refletem só a janela selecionada, pra comparar meses/trimestres.
  // Só entram aqui movimentações REALIZADAS — pendentes (a pagar/receber)
  // não são fluxo de caixa de fato ainda, têm sua própria KPI abaixo.
  let ent = 0, sai = 0, saiOperacional = 0;
  for (const l of periodoLanc) {
    ent += l.entrada;
    sai += l.saida;
    if (l.natureza !== "Investimento") saiOperacional += l.saida;
  }
  let horas = 0, faturado = 0;
  for (const r of periodoRec) { horas += r.horas; faturado += r.valor_total; }
  // a receber = contas a receber em aberto (horas avulsas, serviços concluídos,
  // contas manuais) + o que os serviços em andamento já acumularam
  const contasReceber = contasEmAberto().filter(a => a.valor < 0).reduce((t, a) => t + Math.abs(a.valor), 0);
  const servAndamento = (dados.servicos || []).filter(sv => sv.status === "andamento" && (contexto.equipamentoId == null || sv.equipamento_id == null || sv.equipamento_id === contexto.equipamentoId))
    .reduce((t, sv) => t + resumoServico(sv).aReceber, 0);
  const emAberto = contasReceber + servAndamento;
  const aPagar = contasEmAberto().filter(a => a.valor > 0).reduce((t, a) => t + a.valor, 0);
  // combustível por hora trabalhada: mesma conta "tanque a tanque" do painel
  // de abastecimento (antes usava um campo diesel.horas que nunca era
  // preenchido — o KPI ficava sempre em R$ 0,00)
  let litros = 0, custoDie = 0;
  for (const d of periodoDie) { litros += d.litros; custoDie += d.valor_total; }
  const datasPer = periodoDie.map(d => d.data).sort();
  const perP = intervaloDe(filtroPainel.periodo);
  const efic = calcularEficiencia(perP.de, perP.ate);
  const custoHora = efic.horas > 0 ? efic.custo / efic.horas : 0;
  const lh = efic.horas > 0 ? efic.litros / efic.horas : 0;
  const s = saldoAtual();
  const res = ent - sai;
  // resultado operacional: exclui saídas classificadas como "Investimento"
  // (compra de equipamento, consórcio, capitalização) — mostra se a operação
  // do dia a dia é lucrativa, separado de aportes de capital.
  const resOperacional = ent - saiOperacional;

  // Posição atual do negócio — sempre totais, não reagem ao filtro de
  // período. Ficam numa grade separada, acima dos filtros, pra não dar a
  // entender que também são do período selecionado.
  const total = contexto.equipamentoId == null;
  $("kpis-posicao").innerHTML = `
    <button type="button" class="hero-saldo hero-resultado" onclick="irPara('extrato')">
      <span class="hero-rotulo">${total ? "Resultado" : "Resultado da máquina"} · ${escHtml(rotuloPeriodo(filtroPainel.periodo).toLowerCase())}</span>
      <span class="hero-valor ${res >= 0 ? "pos" : "neg"}">${brl(res)}</span>
      <span class="hero-linha"><span class="pos">${icone("entrada", "icone-sm")} ${brl0(ent)}</span><span class="neg">${icone("saida", "icone-sm")} ${brl0(sai)}</span></span>
    </button>
    <button type="button" class="hero-mini" onclick="irPara('receber')">
      <span class="hero-rotulo">${icone("entrada", "icone-sm")} A receber</span>
      <span class="hero-mini-valor ${emAberto > 0.5 ? "pos" : ""}">${brl0(emAberto)}</span>
    </button>
    <button type="button" class="hero-mini" onclick="irPara('agenda')">
      <span class="hero-rotulo">${icone("saida", "icone-sm")} A pagar</span>
      <span class="hero-mini-valor ${aPagar > 0.5 ? "neg" : ""}">${brl0(aPagar)}</span>
    </button>
    ${total && vejoFinanceiro ? `<button type="button" class="hero-mini hero-caixa" onclick="irPara('extrato')">
      <span class="hero-rotulo">${icone("banco", "icone-sm")} Saldo em caixa</span>
      <span class="hero-mini-valor ${s >= 0 ? "" : "neg"}">${brl(s)}</span>
    </button>` : ""}`;
  renderVencimentosPainel();

  // No período selecionado — reagem aos filtros de período/natureza acima.
  $("kpis-painel").innerHTML = [
    kpi("Resultado operacional", brl0(resOperacional), "sem Investimento", resOperacional >= 0 ? "pos" : "neg"),
    kpi("Horas faturadas", num(horas) + " h", brl0(faturado) + " gerados"),
    kpi("Combustível por hora", efic.horas > 0 ? brl(custoHora) : "—", efic.horas > 0 ? num(lh, 1) + " L/h · " + num(litros, 0) + " L no período" : "precisa de 2 abastecimentos e horas lançadas"),
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
  for (const l of dados.lanc.filter(ehRealizado).slice().sort((a,b) => a.data.localeCompare(b.data))) {
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
      : l.grupo;
    bucket[chave] = (bucket[chave] || 0) + l.saida;
  }
  const lista = Object.entries(bucket).sort((a,b) => b[1]-a[1]);
  const coresCentro = {};
  dados.centrosCusto.forEach(c => coresCentro[c.nome] = corCentroCusto(c.id));
  const cores = modoAgrupar === "natureza" ? CORES_NATUREZA : CORES_GRUPO;

  const mostrarPizza = filtroPainel.visual === "pizza" && lista.length > 0;
  $("grupos-painel").classList.toggle("oculto", mostrarPizza);
  $("composicao-grafico-caixa").classList.toggle("oculto", !mostrarPizza);

  if (!mostrarPizza) {
    const max = lista.length ? lista[0][1] : 1;
    $("grupos-painel").innerHTML = listaComVerMais("composicao", lista.map(([g,v]) => `
      <div class="grupo-linha">
        <span class="grupo-nome">${escHtml(g)}</span>
        <div class="grupo-barra-fundo">
          <div class="grupo-barra" style="width:${(v/max*100).toFixed(1)}%;background:${cores[g]||"#8B919C"}"></div>
        </div>
        <span class="grupo-valor">${brl0(v)}</span>
      </div>`), 1) || '<div class="vazio">Sem saídas neste período.</div>';
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

// Subtítulos e notas explicativas ficam escondidos: aparecem ao passar o mouse
// ou tocar no (i) ao lado do título, para não poluir a tela.
function aplicarDicas(raiz) {
  (raiz || document).querySelectorAll(".titulo-risco").forEach(t => {
    if (t.querySelector(".btn-dica")) return;
    let nota = t.nextElementSibling;
    if (!nota && t.parentElement.classList.contains("cartao-cabeca")) nota = t.parentElement.nextElementSibling;
    if (t.parentElement.classList.contains("cartao-cabeca") && (!nota || !nota.classList.contains("cartao-nota"))) nota = t.parentElement.nextElementSibling;
    if (!nota || !nota.classList.contains("cartao-nota") || !nota.textContent.trim()) return;
    nota.classList.add("nota-dica");
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn-dica"; b.setAttribute("aria-label", "O que é isto?"); b.title = nota.textContent.trim();
    b.textContent = "i";
    b.addEventListener("click", (ev) => { ev.stopPropagation(); nota.classList.toggle("mostrar"); });
    t.querySelector("span")?.after(b);
  });
}
document.addEventListener("click", (ev) => {
  const k = ev.target.closest(".kpi");
  if (k && k.querySelector(".kpi-sub")) k.classList.toggle("mostrar-sub");
});

function kpi(rotulo, valor, sub, cls, grande) {
  return `<div class="kpi ${grande ? "kpi-grande" : ""}">
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
function dentroDoPeriodo(dataStr) { return dentroDe(dataStr, filtroExt.periodo); }

function prepararFiltrosExtrato() {
  const grupos = [...new Set(dados.lanc.map(l => l.grupo))].sort();
  $("ext-filtro-grupo").innerHTML =
    '<option value="todos">Todos os grupos</option>' +
    grupos.map(g => `<option ${g===filtroExt.grupo?"selected":""}>${escHtml(g)}</option>`).join("");
}

/* ── Saldo por conta e ajuste de saldo ────────────────── */
const ID_SALDO_INICIAL = "__saldo_inicial__";

// Saldo de cada conta = lançamentos realizados dela (+ o resultado da base
// antiga, quando ela está oculta). O "saldo inicial" do sistema não pertence
// a nenhuma conta, então aparece numa linha à parte — a soma de tudo é o
// mesmo "Saldo em caixa" do topo.
function saldosPorConta() {
  const mapa = new Map();
  dados.contasBancarias.filter(c => c.ativo).forEach(c => mapa.set(c.nome, 0));
  for (const [banco, v] of Object.entries(dados.legadoPorBanco)) mapa.set(banco, (mapa.get(banco) || 0) + v);
  for (const l of dados.lanc.filter(ehRealizado)) mapa.set(l.banco, (mapa.get(l.banco) || 0) + l.entrada - l.saida);
  const linhas = [...mapa.entries()].map(([nome, saldo]) => ({ id: nome, nome, saldo }));
  if (Math.abs(dados.saldoConfig) > 0.004) linhas.push({ id: ID_SALDO_INICIAL, nome: "Saldo inicial (sem conta)", saldo: dados.saldoConfig, semConta: true });
  return linhas;
}

function renderSaldosContas() {
  const el = $("ext-contas");
  if (!el) return;
  if (contexto.equipamentoId != null) {
    el.innerHTML = `<p class="cartao-nota">Para ver e ajustar o saldo das contas, mude para <strong>Total do negócio</strong> (os saldos dependem de todos os lançamentos).</p>`;
    return;
  }
  const linhas = saldosPorConta();
  const total = linhas.reduce((t, x) => t + x.saldo, 0);
  const linhasConta = linhas.map(x => `
      <div class="conta-linha">
        <span class="conta-nome">${escHtml(x.nome)}</span>
        <span class="conta-saldo ${x.saldo >= 0 ? "pos" : "neg"}">${brl(x.saldo)}</span>
        <button type="button" class="btn-link" data-ajustar-conta="${escHtml(x.id)}">Ajustar</button>
      </div>`);
  el.innerHTML = `
    <div class="contas-cabecalho"><span>${icone("banco", "icone-sm")} Saldo por conta</span><strong class="${total >= 0 ? "pos" : "neg"}">${brl(total)}</strong></div>
    <div class="contas-lista">${linhasConta.length ? listaComVerMais("saldo-contas", linhasConta, 1) : '<p class="cartao-nota">Nenhuma conta cadastrada ainda.</p>'}</div>`;
  el.querySelectorAll("[data-ajustar-conta]").forEach(b => b.addEventListener("click", () => abrirModalAjusteSaldo(b.dataset.ajustarConta)));
}

// Acerta o saldo de uma conta com o que está no banco, quando você quiser.
// Cria um lançamento "Ajuste de saldo" com a diferença (fica no histórico, dá
// pra ver e excluir). O "saldo inicial" não tem lançamento: o valor é trocado.
function abrirModalAjusteSaldo(idConta) {
  const linha = saldosPorConta().find(x => x.id === idConta);
  if (!linha) return;
  const atual = linha.saldo;
  const diferenca = (f) => { const novo = numDeMoeda(f); return Math.round((novo - atual) * 100) / 100; };
  const campo = (n) => document.querySelector(`#modal-campos [data-campo="${n}"]`);
  const atualizarDif = () => {
    const raw = campo("novo_saldo").value;
    const d = diferenca(raw);
    campo("dif_calc").value = String(raw).trim() === "" ? "—" : d === 0 ? "Sem diferença" : (d > 0 ? "+ " : "− ") + brl(Math.abs(d));
  };
  abrirModal({
    titulo: "Ajustar saldo — " + linha.nome,
    tabela: "_ajuste_saldo",
    campos: [
      { nome:"atual_calc", rotulo:"Saldo no app agora", tipo:"calculado", valor: brl(atual) },
      { nome:"novo_saldo", rotulo:"Saldo real da conta (R$)", tipo:"moeda", largo:true, valor:"", obrigatorio:true, aoMudar: atualizarDif },
      { nome:"dif_calc", rotulo:"Diferença a lançar", tipo:"calculado", valor:"—" },
      ...(linha.semConta ? [] : [
        { nome:"data", rotulo:"Data do ajuste", tipo:"date", valor: hoje(), obrigatorio:true },
        { nome:"obs", rotulo:"Observação (opcional)", tipo:"texto", largo:true, valor:"" },
      ]),
    ],
    montar(f) {
      if (String(f.novo_saldo).trim() === "") throw erroCampo("novo_saldo", "Informe o saldo real da conta.");
      const novo = numDeMoeda(f.novo_saldo);
      if (diferenca(f.novo_saldo) === 0) throw erroCampo("novo_saldo", "O saldo informado é igual ao do app: não há o que ajustar.");
      return { novo, data: f.data, obs: (f.obs || "").trim() };
    },
    async aoSalvar(r) {
      const erro = $("modal-erro");
      try {
        if (linha.semConta) {
          // valor do config acompanha a mudança desejada no total
          const { error } = await sb.from("config").upsert({ chave: "saldo_inicial", valor: r.novo });
          if (error) throw error;
        } else {
          const dif = Math.round((r.novo - atual) * 100) / 100;
          const { error } = await sb.from("lancamentos").insert(marcarBase({
            data: r.data, banco: linha.nome, grupo: GRUPO_AJUSTE, subgrupo: "",
            entrada: dif > 0 ? dif : 0, saida: dif < 0 ? -dif : 0,
            descricao: `Ajuste de saldo — ${linha.nome}: de ${brl(atual)} para ${brl(r.novo)}${r.obs ? " · " + r.obs : ""}`,
            natureza: dif > 0 ? "Receita" : "Variavel", status: "pago",
            equipamento_id: null, centro_custo_id: null,
          }));
          if (error) throw error;
        }
      } catch (e) {
        mostrarErroForm(erroBanco(e));
        return;
      }
      fecharModal();
      toast(`Saldo de ${linha.nome} ajustado para ${brl(r.novo)}.`);
      await carregarTudo();
    },
  });
}

function renderExtrato() {
  renderSaldosContas();
  // saldo corrido na ordem cronológica — pendentes não entram na conta
  // (o dinheiro ainda não saiu/entrou), mas continuam aparecendo na lista.
  let acc = dados.saldoInicial;
  const comSaldo = dados.lanc.map(l => {
    if (ehRealizado(l)) acc += l.entrada - l.saida;
    return { ...l, saldo: acc };
  });

  const q = filtroExt.busca.trim().toLowerCase();
  const filtrado = comSaldo.filter(l =>
    dentroDoPeriodo(l.data) &&
    (filtroExt.grupo === "todos" || l.grupo === filtroExt.grupo) &&
    (!q || (l.descricao + " " + l.subgrupo + " " + l.grupo).toLowerCase().includes(q))
  ).reverse();

  let ent = 0, sai = 0, pendEnt = 0, pendSai = 0;
  for (const l of filtrado) {
    if (ehAjusteSaldo(l)) continue; // ajuste de saldo não é receita nem despesa
    if (ehRealizado(l)) { ent += l.entrada; sai += l.saida; }
    else { pendEnt += l.entrada; pendSai += l.saida; }
  }
  $("ext-resumo").innerHTML =
    `<span>${filtrado.length} lançamentos</span>
     <span class="pos">Entradas ${brl0(ent)}</span>
     <span class="neg">Saídas ${brl0(sai)}</span>
     <span>Líquido ${brl0(ent - sai)}</span>
     ${(pendEnt || pendSai) ? `<span class="pendente-resumo">Pendente: ${pendSai ? brl0(pendSai) + " a pagar" : ""}${pendEnt && pendSai ? " · " : ""}${pendEnt ? brl0(pendEnt) + " a receber" : ""}</span>` : ""}`;

// Se este lançamento foi criado automaticamente pelo Diesel, Manutenção,
// Agenda ou Recebimentos, devolve de onde veio — editar tem que ser feito
// na origem, senão a próxima sincronização sobrescreve a mudança.
function origemDoLancamento(id) {
  const d = dados.die.find(x => x.lancamento_id === id);
  if (d) return { tabela: "Abastecimento", fn: "abrirModalDiesel", id: d.id };
  const m = dados.man.find(x => x.lancamento_id === id);
  if (m) return { tabela: "Manutenção", fn: "abrirModalManutencao", id: m.id };
  const a = dados.age.find(x => x.lancamento_id === id);
  if (a) return { tabela: "Contas", fn: "abrirModalAgenda", id: a.id };
  const r = dados.rec.find(x => x.lancamento_id === id || x.lancamento_pendente_id === id);
  if (r) return { tabela: "Horas", fn: "abrirModalRecebimento", id: r.id };
  return null;
}

  const linhasExt = filtrado.map(l => {
    const valor = l.entrada > 0 ? l.entrada : -l.saida;
    const natTxt = l.natureza && l.natureza !== "Receita" ? ROTULO_NATUREZA[l.natureza] || l.natureza : "";
    const sv = l.servico_id ? dados.servicos.find(x => x.id === l.servico_id) : null;
    const subTxt = [sv ? "Serviço: " + sv.nome : "", natTxt].filter(Boolean).join(" · ");
    const pendente = l.status === "pendente";
    const origem = origemDoLancamento(l.id);
    // linha/cartão inteiro é clicável — edição de sincronizados redireciona
    // para a origem, como o ícone de link externo já indicava antes; o resto abre o próprio
    // lançamento. O ícone que sobra é só indicativo, sem ação própria.
    const acao = origem
      ? `aoClicarLinha(() => ${origem.fn}(${origem.id}))`
      : `aoClicarLinha(() => abrirModalLancamento(${l.id}))`;
    const tituloAcao = origem ? `Editar pelo ${origem.tabela}` : "Editar lançamento";
    const indicador = origem
      ? `<span class="indicador-acao indicador-link" title="${tituloAcao}">${icone("external-link", "icone-sm")}</span>`
      : `<span class="indicador-acao" title="${tituloAcao}">${icone("chevron-right", "icone-sm")}</span>`;
    return `<tr class="linha-clicavel" role="button" tabindex="0" title="${tituloAcao}"
      onclick="${acao}" onkeydown="teclaLinha(event)">
      <td class="td-data">${fData(l.data)}</td>
      <td>
        <span class="chip" style="border-color:${CORES_GRUPO[l.grupo]||"#3A3F48"};color:${CORES_GRUPO[l.grupo]||"#A3A8B4"}">${escHtml(l.grupo)}</span>
        ${pendente ? `<span class="chip chip-status chip-pendente">${l.saida > 0 ? "A pagar" : "A receber"}</span>` : ""}
        ${subTxt ? `<div class="td-natureza">${escHtml(subTxt)}${origem ? " · via " + origem.tabela : ""}</div>` : (origem ? `<div class="td-natureza">via ${origem.tabela}</div>` : "")}
      </td>
      <td class="td-desc">${escHtml(l.descricao || l.subgrupo || "—")}</td>
      <td class="td-mudo">${escHtml(l.banco)}</td>
      <td class="num ${pendente ? "" : (valor >= 0 ? "pos" : "neg")} ${pendente ? "td-mudo" : ""}">${brl(valor)}</td>
      <td class="num td-saldo ${l.saldo < 0 ? "neg" : ""}">${brl0(l.saldo)}</td>
      <td class="td-acao">${indicador}</td>
    </tr>`;
  });
  $("ext-corpo").innerHTML = (linhasExt.length ? linhasComVerMais("extrato", linhasExt, 30, 7) : "") ||
  '<tr><td colspan="7" class="vazio">Nenhum lançamento neste período. Troque o período acima.</td></tr>';
}

function abrirModalLancamento(id, tipoNovo) {
  const l = id ? dados.lanc.find(x => x.id === id) : null;
  const tipo = l ? (l.entrada > 0 ? "entrada" : "saida") : (tipoNovo || "saida");
  const ehReceita = (f) => (f._tipo || tipo) === "entrada";
  const grupos = opcoesGrupoDespesa();
  const grupoInicial = l && l.grupo !== "Recebimentos" ? l.grupo : (grupos.includes("Outras despesas") ? "Outras despesas" : grupos[0] || "Outras despesas");
  const nomeTipo = tipo === "entrada" ? "receita" : "despesa";
  abrirModal({
    titulo: l ? "Editar " + nomeTipo : tipoNovo ? "Nova " + nomeTipo : "Novo lançamento",
    tabela: "lancamentos", id,
    campos: [
      // tipo só aparece quando não foi escolhido antes (botão Receita/Despesa já define)
      { nome:"_tipo", rotulo:"É uma…", tipo:"select", opcoes:["saida|Despesa (saiu dinheiro)","entrada|Receita (entrou dinheiro)"], valor: tipo, largo:true, oculto: !!tipoNovo },
      { nome:"_valor", rotulo:"Valor (R$)", tipo:"moeda", valor: l ? (l.entrada > 0 ? l.entrada : l.saida) : "", obrigatorio:true },
      { nome:"data", rotulo:"Data", tipo:"date", valor: l?.data || hoje(), obrigatorio:true },
      { nome:"descricao", rotulo:"Descrição", tipo:"texto", largo:true, valor: l?.descricao || "" },
      { nome:"grupo", rotulo:"Categoria", tipo:"select", opcoes: grupos.includes(grupoInicial) ? grupos : grupos.concat(grupoInicial), valor: grupoInicial, visivelSe: f => !ehReceita(f) },
      { nome:"natureza", rotulo:"Tipo de custo", tipo:"select",
        opcoes:["Variavel|Custo variável","Fixo|Custo fixo","Investimento|Investimento"],
        valor: (l?.natureza && l.natureza !== "Receita") ? l.natureza : "Variavel", visivelSe: f => !ehReceita(f) },
      { nome:"status_saida", rotulo:"Situação", tipo:"select", opcoes:["pago|Já foi pago","pendente|Ainda vou pagar"], valor: l?.status || "pago", visivelSe: f => !ehReceita(f) },
      { nome:"status_entrada", rotulo:"Situação", tipo:"select", opcoes:["pago|Já recebi","pendente|Ainda vou receber"], valor: l?.status || "pago", visivelSe: f => ehReceita(f) },
      { nome:"banco", rotulo:"Conta", tipo:"select", opcoes: opcoesContaBancaria(), valor: l?.banco || contaPadrao() },
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(true), valor: equipamentoPadrao(l?.equipamento_id, true) },
      ...campoServico(l?.servico_id),
    ],
    async aposSalvar(salvo) {
      if (salvo.servico_id) await sincronizarRecebivelServico(salvo.servico_id);
      if (l?.servico_id && l.servico_id !== salvo.servico_id) await sincronizarRecebivelServico(l.servico_id);
    },
    montar(f) {
      const v = numDeMoeda(f._valor);
      if (!v || v <= 0) throw erroCampo("_valor", "Informe um valor maior que zero.");
      const ent = ehReceita(f);
      return {
        data: f.data,
        banco: f.banco,
        status: ent ? f.status_entrada : f.status_saida,
        equipamento_id: f.equipamento_id ? Number(f.equipamento_id) : null,
        grupo: ent ? "Recebimentos" : f.grupo,
        subgrupo: "",
        entrada: ent ? v : 0,
        saida:   ent ? 0 : v,
        descricao: f.descricao.trim(),
        natureza: ent ? "Receita" : f.natureza,
        ...servicoDoForm(f),
      };
    }
  });
}

/* ═══════════════ RECEBIMENTOS ═══════════════ */
function renderRecebimentos() {
  // resumo por cliente
  const porCliente = {};
  const recPer = dados.rec.filter(r => dentroDe(r.data, filtroRecPeriodo));
  for (const r of recPer) {
    const c = r.cliente;
    if (!porCliente[c]) porCliente[c] = { horas:0, faturado:0, recebido:0 };
    porCliente[c].horas    += r.horas;
    if (r.servico_id) continue; // cobrado pelo serviço, não por hora avulsa
    porCliente[c].faturado += r.valor_total;
    // só conta como recebido o que está marcado como "Recebido?" — é a
    // mesma regra que decide o que entra no Extrato, então os cards batem
    // com a contabilidade de verdade.
    porCliente[c].recebido += r.recebido ? (r.valor_pago || r.valor_total) : 0;
  }
  $("rec-clientes").innerHTML = listaComVerMais("clientes", Object.entries(porCliente).sort((a, b) => b[1].faturado - a[1].faturado).map(([c, d]) => {
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
  }), 1);

  const filtrado = recPer
    .filter(r => filtroCliente === "todos" || r.cliente === filtroCliente)
    .slice().reverse();

  const linhasRec = filtrado.map(r => {
    const svR = r.servico_id ? dados.servicos.find(x => x.id === r.servico_id) : null;
    const statusHtml = svR
      ? `<span class="chip chip-status chip-servico">Serviço: ${escHtml(svR.nome)}</span>`
      : r.recebido
        ? `<span class="chip chip-status chip-pago">Recebido</span>`
        : `<span class="chip chip-status chip-pendente">A receber</span>`;
    return `<tr class="linha-clicavel" role="button" tabindex="0" title="Editar registro"
      onclick="aoClicarLinha(() => abrirModalRecebimento(${r.id}))" onkeydown="teclaLinha(event)">
    <td class="td-data">${fData(r.data)}</td>
    <td>${escHtml(r.cliente)}${r.tipo_recebimento_id ? `<div class="td-natureza">${escHtml(nomeTipoRecebimento(r.tipo_recebimento_id))}</div>` : ""}</td>
    <td class="num td-mudo">${r.hora_inicial != null ? num(r.hora_inicial) + " → " + num(r.hora_final) : "—"}</td>
    <td class="num">${r.horas ? num(r.horas) : "—"}</td>
    <td class="num td-mudo">${r.valor_hora ? brl0(r.valor_hora) : "—"}</td>
    <td class="num">${r.valor_total ? brl0(r.valor_total) : "—"}</td>
    <td class="num ${r.valor_pago ? "pos" : ""}">${r.valor_pago ? brl0(r.valor_pago) : "—"}</td>
    <td>${statusHtml}</td>
    <td class="td-acao"><span class="indicador-acao" title="Editar registro">${icone("chevron-right", "icone-sm")}</span></td>
  </tr>`;
  });
  $("rec-corpo").innerHTML = linhasRec.length ? linhasComVerMais("horas", linhasRec, 20, 9) :
  '<tr><td colspan="9" class="vazio">Nenhum registro de horas neste período.</td></tr>';
}

function filtrarCliente(c) {
  filtroCliente = (filtroCliente === c) ? "todos" : c;
  renderRecebimentos();
}

function abrirModalRecebimento(id) {
  const r = id ? dados.rec.find(x => x.id === id) : null;
  const semDinheiro = !vejoFinanceiro; // operador: só cliente, operador e horímetro
  let bancoHoras = null;
  abrirModal({
    titulo: r ? "Editar serviço" : "Horas trabalhadas",
    tabela: "recebimentos", id,
    tituloExclusao: r ? `o registro de ${r.cliente} (${fData(r.data)})` : null,
    avisoExcluir: r && (r.lancamento_id || r.lancamento_pendente_id || r.agenda_id)
      ? "Isso também remove o(s) lançamento(s) vinculado(s) no Extrato" + (r.agenda_id ? " e a conta a receber em Contas." : ".")
      : null,
    campos: [
      { nome:"data", rotulo:"Data", tipo:"date", valor: r?.data || hoje() },
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(false), valor: equipamentoPadrao(r?.equipamento_id, false), obrigatorio: true },
      ...campoServico(r?.servico_id, (id) => {
        const sv = dados.servicos.find(x => x.id === Number(id));
        const cmp = (n) => document.querySelector(`#modal-campos [data-campo="${n}"]`);
        if (sv) {
          if (cmp("cliente") && !cmp("cliente").value && sv.cliente) cmp("cliente").value = sv.cliente;
          if (cmp("valor_hora") && sv.valor_hora) cmp("valor_hora").value = moedaMascara(sv.valor_hora);
        }
      }),
      { nome:"cliente", rotulo:"Cliente", tipo:"texto", valor: r?.cliente || "", lista: nomesAtivos(dados.clientes), obrigatorio: true,
        aoMudar(nome) {
          const c = dados.clientes.find(x => x.nome === nome);
          if (c && c.valor_hora_padrao) {
            const campoVh = document.querySelector('#modal-campos [data-campo="valor_hora"]');
            if (campoVh) campoVh.value = moedaMascara(c.valor_hora_padrao);
          }
        } },
      { nome:"operador", rotulo:"Operador", tipo:"texto", valor: r?.operador || "", lista: nomesAtivos(dados.operadores) },
      // "Obra / contrato" virou Serviço; o campo antigo só aparece em registros que já tinham obra
      { nome:"obra", rotulo:"Obra / contrato", tipo:"texto", valor: r?.obra || "", lista: nomesAtivos(dados.obras), oculto: dados.temServicos && !r?.obra },
      { nome:"hora_inicial", rotulo:"Horímetro inicial", tipo:"numero", valor: r?.hora_inicial ?? "", obrigatorio: true },
      { nome:"hora_final", rotulo:"Horímetro final", tipo:"numero", valor: r?.hora_final ?? "", obrigatorio: true },
      { nome:"_sep_fin", rotulo:"Cobrança", tipo:"separador", oculto: semDinheiro },
      { nome:"valor_hora", rotulo:"Valor da hora (R$)", tipo:"moeda", valor: r?.valor_hora ?? (dados.clientes.find(c => c.nome === r?.cliente)?.valor_hora_padrao || ""), oculto: semDinheiro },
      { nome:"recebido", rotulo:"Já recebi por estas horas", tipo:"checkbox", largo:true, valor: r?.recebido ?? false, oculto: semDinheiro, visivelSe: f => !semDinheiro && !f.servico_id },
      { nome:"valor_pago", rotulo:"Valor recebido (se diferente do total)", tipo:"moeda", valor: r?.valor_pago || "", oculto: semDinheiro, visivelSe: f => !semDinheiro && !f.servico_id && f.recebido },
      { nome:"_banco", rotulo:"Conta onde entrou", tipo:"select", opcoes: opcoesContaBancaria(), valor: contaDoLancamento(r?.lancamento_id), oculto: semDinheiro, visivelSe: f => !semDinheiro && !f.servico_id && f.recebido },
      { nome:"tipo_recebimento_id", rotulo:"Tipo de receita", tipo:"select", opcoes: opcoesTipoRecebimento(true), valor: r?.tipo_recebimento_id != null ? String(r.tipo_recebimento_id) : "", oculto: semDinheiro, visivelSe: f => !semDinheiro && opcoesTipoRecebimento(false).length > 0 },
    ],
    montar(f) {
      if (!f.cliente.trim()) throw erroCampo("cliente", "Informe o cliente.");
      if (!f.equipamento_id) throw erroCampo("equipamento_id", "Selecione o equipamento.");
      const hi = f.hora_inicial === "" ? null : Number(f.hora_inicial);
      const hf = f.hora_final === "" ? null : Number(f.hora_final);
      if (hi != null && hf != null && hf <= hi) throw erroCampo("hora_final", "O horímetro final precisa ser maior que o inicial.");
      const horas = (hi != null && hf != null) ? Math.max(0, hf - hi) : 0;
      const vh = numDeMoeda(f.valor_hora);
      const valor_total = horas * vh;
      // se marcou "Recebido?" e não preencheu o valor pago, assume o valor
      // total (evita ter que digitar o mesmo número duas vezes)
      const vinculado = !!f.servico_id;
      let valor_pago = vinculado || !f.recebido ? 0 : numDeMoeda(f.valor_pago);
      if (f.recebido && !vinculado && !valor_pago) valor_pago = valor_total;
      bancoHoras = f._banco || contaPadrao();
      return {
        data: f.data, equipamento_id: Number(f.equipamento_id), cliente: f.cliente.trim(),
        operador: f.operador.trim(), obra: f.obra.trim(),
        hora_inicial: hi, hora_final: hf, horas,
        valor_hora: vh, valor_total,
        valor_pago, recebido: !vinculado && !!f.recebido,
        tipo_recebimento_id: f.tipo_recebimento_id ? Number(f.tipo_recebimento_id) : null,
        ...servicoDoForm(f),
      };
    },
    async aposSalvar(salvo) {
      if (salvo.servico_id) {
        // apontamento de um serviço: quem cobra é o serviço (sem lançamento nem "a receber" próprio)
        await sincronizarLancamento({ origemId: salvo.id, tabelaOrigem: "recebimentos", lancamentoId: r?.lancamento_id ?? salvo.lancamento_id, valor: 0, tipo: "entrada", data: salvo.data, grupo: "Recebimentos", descricao: "" });
        await sincronizarAgendaEspelho({ origemId: salvo.id, origemTabela: "recebimentos", agendaId: r?.agenda_id ?? salvo.agenda_id, pendente: false, item: "", data: null, valor: 0, natureza: "Receita", centroCustoId: null, equipamentoId: null, grupo: "Recebimentos" });
        await sincronizarRecebivelServico(salvo.servico_id);
        if (r?.servico_id && r.servico_id !== salvo.servico_id) await sincronizarRecebivelServico(r.servico_id);
        return;
      }
      if (r?.servico_id) await sincronizarRecebivelServico(r.servico_id);
      if (salvo.recebido) {
        // recebido: lança no Extrato como movimentação realizada, e
        // garante que não sobra nenhum compromisso pendente na Agenda
        await sincronizarLancamento({
          origemId: salvo.id, tabelaOrigem: "recebimentos", lancamentoId: r?.lancamento_id ?? salvo.lancamento_id,
          valor: salvo.valor_pago || salvo.valor_total, tipo: "entrada", data: salvo.data, status: "pago", banco: bancoHoras,
          grupo: "Recebimentos", descricao: "Recebimento - " + salvo.cliente,
          centroCustoId: salvo.centro_custo_id, equipamentoId: salvo.equipamento_id,
        });
        await sincronizarAgendaEspelho({
          origemId: salvo.id, origemTabela: "recebimentos", agendaId: r?.agenda_id ?? salvo.agenda_id,
          pendente: false, item: "", data: null, valor: 0,
          natureza: "Receita", centroCustoId: null, equipamentoId: null, grupo: "Recebimentos",
        });
      } else {
        // ainda não recebido: não entra no Extrato (não é dinheiro de
        // verdade ainda) — fica só como compromisso a receber na Agenda
        await sincronizarLancamento({
          origemId: salvo.id, tabelaOrigem: "recebimentos", lancamentoId: r?.lancamento_id ?? salvo.lancamento_id,
          valor: 0, tipo: "entrada", data: salvo.data, grupo: "Recebimentos", descricao: "",
        });
        await sincronizarAgendaEspelho({
          origemId: salvo.id, origemTabela: "recebimentos", agendaId: r?.agenda_id ?? salvo.agenda_id,
          pendente: salvo.valor_total > 0, item: "A receber - " + salvo.cliente,
          data: salvo.data, valor: -salvo.valor_total, // negativo: é entrada, não saída (mesma convenção do estorno)
          natureza: "Receita", centroCustoId: salvo.centro_custo_id, equipamentoId: salvo.equipamento_id,
          grupo: "Recebimentos",
        });
      }
    },
    async aoExcluir() {
      await removerLancamentoVinculado(r?.lancamento_id);
      await removerLancamentoVinculado(r?.lancamento_pendente_id);
      if (r?.agenda_id) await sb.from("agenda").delete().eq("id", r.agenda_id);
    },
  });
}

/* ═══════════════ DIESEL ═══════════════ */
// cor e letra de cada combustível (selo no painel e linhas do gráfico)
const COR_COMB = { Diesel: "#F5B301", Gasolina: "#FF7A3D", Etanol: "#3ECF8E", GNV: "#4DA3FF", Flex: "#A78BFA" };
const LETRA_COMB = { Diesel: "D", Gasolina: "G", Etanol: "E", GNV: "GNV", Flex: "F" };
function badgeComb(c) {
  const nome = c || "Diesel";
  return `<span class="badge-comb" style="--cor-comb:${COR_COMB[nome] || "#8a8f98"}" title="${escHtml(nome)}">${LETRA_COMB[nome] || escHtml(nome.charAt(0).toUpperCase())}</span>`;
}

// Janela de datas escolhida no filtro de período do abastecimento.
// Eficiência da máquina: litros de diesel por hora trabalhada, "tanque a
// tanque". Para cada abastecimento, divide os litros pelas horas faturadas
// (Recebimentos) entre o abastecimento anterior e este. Assume tanque cheio
// a cada abastecimento; o primeiro só serve de marco inicial.
const PALETA_EQUIP = ["#F5B301", "#4DA3FF", "#3ECF8E", "#A78BFA", "#FF7A3D"];
function calcularEficiencia(de = "", ate = "") {
  const porAbast = new Map(), series = [];
  let litros = 0, horas = 0, custo = 0;
  const maquinas = [...new Set(dados.die.map(d => d.equipamento_id))].filter(id => tipoEquipamento(id) === "Maquina");
  for (const id of maquinas) {
    const fills = dados.die
      .filter(d => d.equipamento_id === id && (d.combustivel || "Diesel") === "Diesel" && d.litros > 0)
      .slice().sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.id - b.id);
    const recs = dados.rec.filter(r => r.equipamento_id === id && r.horas > 0);
    const pontos = [];
    for (let i = 1; i < fills.length; i++) {
      const ini = fills[i - 1].data, fim = fills[i].data;
      if ((de && fim < de) || (ate && fim > ate)) continue; // fora do período escolhido (o abastecimento anterior pode estar fora: serve de marco)
      if (fim <= ini) continue; // dois no mesmo dia: não dá pra separar as horas
      const h = recs.filter(r => r.data > ini && r.data <= fim).reduce((t, r) => t + r.horas, 0);
      if (h <= 0) continue;
      porAbast.set(fills[i].id, { lh: fills[i].litros / h, h });
      pontos.push({ data: fim, lh: fills[i].litros / h });
      litros += fills[i].litros; horas += h; custo += fills[i].valor_total || 0;
    }
    if (pontos.length) series.push({ id, pontos });
  }
  return { porAbast, series, litros, horas, custo };
}

// todos os abastecimentos visíveis: os da seleção atual + os pares (carro de apoio)
const todosAbastecimentos = () => dados.die.concat(dados.dieExtra || []);
const acharAbastecimento = (id) => todosAbastecimentos().find(x => x.id === id);

function renderDiesel() {
  // (filtro por centro de custo removido: o conceito saiu do sistema)

  // Vendo uma máquina, só entram os abastecimentos DELA (o carro de apoio
  // fica de fora). Selos de combustível e marca de nota conjunta só
  // aparecem no "Total do negócio", onde todos os equipamentos se misturam.
  const visaoGeral = contexto.equipamentoId == null;
  const { de, ate } = intervaloDe(filtroDiesel.periodo);
  const doFiltro = dados.die.filter(d =>
    (!de || d.data >= de) && (!ate || d.data <= ate) &&
    (filtroDiesel.combustivel === "todos" || d.combustivel === filtroDiesel.combustivel)
  );

  let litros = 0, custo = 0, aPagar = 0, vencido = 0;
  const hj = hoje();
  const porComb = {}; // litros e custo por combustível (preço médio não se mistura)
  for (const d of doFiltro) {
    litros += d.litros; custo += d.valor_total;
    const c = d.combustivel || "Diesel";
    (porComb[c] = porComb[c] || { litros: 0, custo: 0 });
    porComb[c].litros += d.litros || 0; porComb[c].custo += d.valor_total || 0;
    if (d.status === "pendente") {
      aPagar += d.valor_total;
      if (d.vencimento && d.vencimento < hj) vencido += d.valor_total;
    }
  }
  const combs = Object.keys(porComb).sort((x, y) => porComb[y].litros - porComb[x].litros);
  const medio = (c) => porComb[c].litros > 0 ? porComb[c].custo / porComb[c].litros : 0;
  const efic = calcularEficiencia(de, ate);
  const kpisBase = [
    kpi("Consumo médio", efic.horas > 0 ? num(efic.litros / efic.horas, 1) + " L/h" : "—",
      efic.horas > 0 ? `${num(efic.litros, 0)} L em ${num(efic.horas, 1)} h trabalhadas` : "precisa de 2+ abastecimentos e horas lançadas em Recebimentos", null, true),
    kpi("Custo de combustível por hora", efic.horas > 0 ? brl(efic.custo / efic.horas) + "/h" : "—",
      efic.horas > 0 ? "diesel ÷ horas trabalhadas" : ""),
    kpi("Combustível consumido", num(litros,0) + " L", brl0(custo) + " no período"),
    combs.length <= 1
      ? kpi("Preço médio do litro", brl(litros > 0 ? custo/litros : 0))
      : kpi(`Preço médio do litro · ${combs[0]}`, brl(medio(combs[0])), combs.slice(1).map(c => `${c} ${brl(medio(c))}`).join(" · ")),
  ];
  $("kpis-diesel").innerHTML = kpisBase.join("");

  // gráfico do consumo (L/h) a cada abastecimento, uma linha por máquina
  const cardConsumo = $("card-consumo");
  if (cardConsumo) {
    cardConsumo.classList.toggle("oculto", !efic.series.length);
    if (efic.series.length) {
      const datas = [...new Set(efic.series.flatMap(sr => sr.pontos.map(p => p.data)))].sort();
      desenharGrafico("graf-consumo", {
        type: "line",
        data: {
          labels: datas.map(fData),
          datasets: efic.series.map((sr, i) => ({ label: nomeEquipamento(sr.id) + " · L/h",
            data: datas.map(dt => { const p = sr.pontos.find(x => x.data === dt); return p ? Math.round(p.lh * 100) / 100 : null; }),
            spanGaps: true, borderColor: PALETA_EQUIP[i % PALETA_EQUIP.length], backgroundColor: PALETA_EQUIP[i % PALETA_EQUIP.length],
            borderWidth: 2, pointRadius: 3.5, tension: .1 }))
        },
        options: opcoesGrafico({ legenda: efic.series.length > 1, decimais: 1 })
      });
    }
  }

  // gráfico: uma linha por combustível (cada um com a sua cor)
  const pts = doFiltro.filter(d => d.valor_unit > 0 && d.litros > 0)
    .sort((x, y) => String(x.data).localeCompare(String(y.data)) || x.id - y.id);
  const combsGraf = [...new Set(pts.map(p => p.combustivel || "Diesel"))];
  desenharGrafico("graf-diesel", {
    type: "line",
    data: {
      labels: pts.map(p => fData(p.data)),
      datasets: combsGraf.map(c => ({ label: c + " R$/L",
        data: pts.map(p => (p.combustivel || "Diesel") === c ? p.valor_unit : null), spanGaps: true,
        borderColor: COR_COMB[c] || "#F5B301", backgroundColor: COR_COMB[c] || "#F5B301", borderWidth:2, pointRadius:3, tension:.1 }))
    },
    options: opcoesGrafico({ legenda: combsGraf.length > 1, decimais:2 })
  });

  // Cada equipamento/combustível é uma linha própria no demonstrativo, com
  // um selo colorido (D, G, E…). Os dois lados de uma nota conjunta ficam
  // juntos e marcados com 🔗 — mas cada um mostra o seu valor.
  const gruposMap = {};
  doFiltro.forEach(d => {
    const chave = d.grupo_abastecimento_id
      ? "par-" + Math.min(d.id, d.grupo_abastecimento_id) + "-" + Math.max(d.id, d.grupo_abastecimento_id)
      : "solo-" + d.id;
    (gruposMap[chave] = gruposMap[chave] || []).push(d);
  });
  const grupos = Object.values(gruposMap).sort((a,b) => Math.max(...b.map(x=>x.id)) - Math.max(...a.map(x=>x.id)));
  grupos.forEach(g => g.sort((x, y) => (tipoEquipamento(x.equipamento_id) === "Maquina" ? 0 : 1) - (tipoEquipamento(y.equipamento_id) === "Maquina" ? 0 : 1) || x.id - y.id));

  const linhas = [];
  grupos.forEach(grupo => grupo.forEach((d, i) => {
    const venceu = d.status === "pendente" && d.vencimento && d.vencimento < hj;
    const statusHtml = d.status === "pendente"
      ? `<span class="chip chip-status ${venceu ? "chip-vencido" : "chip-pendente"}">${venceu ? "Vencido" : "A pagar"}</span>`
      : `<span class="chip chip-status chip-pago">Pago</span>`;
    const emPar = grupo.length > 1;
    const classe = "linha-clicavel" + (emPar ? " linha-par" + (i === 0 ? " par-ini" : "") + (i === grupo.length - 1 ? " par-fim" : "") : "");
    const tagPar = visaoGeral && d.grupo_abastecimento_id
      ? ` <span class="tag-par" title="Esta linha faz parte de uma nota conjunta (máquina + carro de apoio)">🔗 nota conjunta</span>` : "";
    const desc = Number(d.desconto) > 0 ? `<div class="td-vencimento">desconto ${brl(d.desconto)}</div>` : "";
    linhas.push(`<tr class="${classe}" role="button" tabindex="0" title="Editar abastecimento"
        onclick="aoClicarLinha(() => abrirModalDiesel(${d.id}))" onkeydown="teclaLinha(event)">
      <td class="td-data">${fData(d.data)}</td>
      <td>
        <div class="comb-linha">${visaoGeral ? badgeComb(d.combustivel) + " " : ""}<span>${escHtml(nomeEquipamento(d.equipamento_id)) || "—"}</span>${tagPar}</div>
        <div class="td-natureza">${escHtml(d.combustivel || "Diesel")}${d.local ? " · " + escHtml(d.local) : ""}${d.comprovante_pagamento_path || d.nota_fiscal_path ? ` <span title="Tem comprovante/nota anexado">📎</span>` : ""}</div>
      </td>
      <td class="num">${d.litros ? num(d.litros, d.litros % 1 ? 2 : 0) : "—"}${efic.porAbast.has(d.id) ? `<div class="td-vencimento" title="Litros ÷ horas trabalhadas desde o abastecimento anterior (${num(efic.porAbast.get(d.id).h, 1)} h)">${num(efic.porAbast.get(d.id).lh, 1)} L/h</div>` : ""}</td>
      <td class="num td-mudo">${d.valor_unit ? brl(d.valor_unit) : "—"}${desc}</td>
      <td class="num neg">${d.valor_total ? brl(d.valor_total) : "—"}</td>
      <td>${statusHtml}${d.status === "pendente" && d.vencimento ? `<div class="td-vencimento">vence ${fData(d.vencimento)}</div>` : ""}</td>
      <td class="td-acao"><span class="indicador-acao" title="Editar abastecimento">${icone("chevron-right", "icone-sm")}</span></td>
    </tr>`);
  }));
  $("die-corpo").innerHTML = linhas.length ? linhasComVerMais("diesel", linhas, 20, 7) :
  '<tr><td colspan="7" class="vazio">Nenhum abastecimento neste período.</td></tr>';
}

function abrirDetalheAbastecimentoConjunto(ids) {
  const itens = ids.map(acharAbastecimento).filter(Boolean);
  if (!itens.length) return;
  const total = itens.reduce((t, d) => t + (d.valor_total || 0), 0);
  const html = itens.map(d => {
    const desc = Number(d.desconto) > 0 ? ` · desconto ${brl(d.desconto)}` : "";
    return `
    <button type="button" class="detalhe-linha" onclick="fecharModal(); abrirModalDiesel(${d.id})">
      <span><strong>${escHtml(nomeEquipamento(d.equipamento_id))}</strong> · ${escHtml(d.combustivel)}
        <small>${num(d.litros, d.litros % 1 ? 2 : 0)} L · ${brl(d.valor_unit || 0)}/L${desc}${d.nota_fiscal_path ? " · 📎 nota" : ""}</small></span>
      <b>${brl(d.valor_total)}</b>
    </button>`;
  }).join("");
  abrirModal({
    titulo: `Abastecimento conjunto — ${fData(itens[0].data)}`,
    tabela: "_detalhe_abastecimento",
    corpoCustom: `<p class="detalhe-nota">${escHtml(itens[0].local || "")}${itens[0].local ? " · " : ""}clique num item para editar.</p>
      <div class="detalhe-lista">${html}</div>
      <div class="detalhe-total"><span>Total da nota</span><b>${brl(total)}</b></div>`,
    semSalvar: true,
  });
}

function abrirModalDiesel(id) {
  const d = id ? acharAbastecimento(id) : null;
  const temVeiculoCadastrado = opcoesEquipamentoPorTipo("Veiculo").length > 0;
  const equipInicial = Number(equipamentoPadrao(d?.equipamento_id, false)) || null;
  const tipoEquip = tipoEquipamento(equipInicial);
  let carroApoioForm = null; // captura os dados do carro de apoio no montar(), lido no aposSalvar
  bancoDieselForm = null;
  let anexosForm = {};       // arquivos escolhidos no formulário, enviados no aposSalvar
  let chaveNota = null;      // chave de 44 dígitos lida do QR da nota anexada
  let notaTrocada = false;   // escolheu outro arquivo de nota nesta edição

  // Ao anexar a foto da nota: (1) lê o QR Code (chave, número, CNPJ do posto,
  // aviso de nota repetida) e (2) a IA lê os itens da foto (litros, preços,
  // desconto) e preenche o formulário. Uma parte falhar não derruba a outra.
  async function lerNotaAnexada(arquivo, mostrar) {
    chaveNota = null;
    notaTrocada = !!arquivo;
    if (!arquivo) { mostrar(""); return; }
    if (!arquivo.type.startsWith("image/")) {
      mostrar("PDF anexado. A leitura automática só funciona com foto da nota.");
      return;
    }
    const aindaEsta = () => campoForm("arq_nota")?.files?.[0] === arquivo; // trocou a foto no meio?
    const linhas = [];
    let tom = "ok";
    const atualizar = (extra) => mostrar([...linhas, ...(extra ? [extra] : [])].join("\n"), tom);
    mostrar("Lendo o QR Code da nota…");

    // usa a chave de 44 dígitos: mostra os dados e avisa se a nota já foi lançada
    const usarChave = async (info) => {
      chaveNota = info.chave;
      linhas.push(`${info.tipo} nº ${info.numero} · série ${info.serie} · ${String(info.mes).padStart(2, "0")}/${info.ano} · CNPJ ${NotaQR.formatarCnpj(info.cnpj)}`);
      // confere no banco (não só no que está na tela): vale em qualquer equipamento
      const repetida = await buscarNotaRepetida(info.chave, d?.id);
      if (repetida) {
        linhas.push(`⛔ ESSA NOTA JÁ FOI LANÇADA em ${fData(repetida.data)}${repetida.local ? " (" + repetida.local + ")" : ""}. O app não vai deixar salvar de novo.`);
        tom = "erro";
      }
    };
    // preenche o fornecedor só se estiver vazio (nunca sobrescreve o que você digitou)
    const usarEmitente = (nome) => {
      if (!nome) return false;
      const existente = dados.fornecedores.find(f => semAcento(f.nome) === semAcento(nome));
      const campoLocal = campoForm("local");
      if (campoLocal && !campoLocal.value.trim()) {
        campoLocal.value = existente ? existente.nome : nome;
        linhas.push("Fornecedor preenchido: " + campoLocal.value);
      } else linhas.push("Emitente: " + nome);
      return true;
    };

    // ── 1) QR Code
    let texto = null;
    try { texto = await NotaQR.lerQrDeArquivo(arquivo); } catch (e) { console.error("Falha ao ler o QR:", e); }
    if (!aindaEsta()) return;
    let info = null;
    const chaveQr = NotaQR.extrairChave(texto);
    if (!chaveQr) linhas.push("Não consegui ler o QR Code dessa foto.");
    else {
      info = NotaQR.interpretarChave(chaveQr);
      if (!info.chaveConfere) { linhas.push("QR lido, mas a chave da nota não confere. Confira a foto."); tom = "aviso"; info = null; }
      else await usarChave(info);
    }
    atualizar();

    let nomeUsado = false;
    if (info && info.cnpjConfere) {
      const nome = await buscarNomeEmpresa(info.cnpj);
      if (!aindaEsta()) return;
      nomeUsado = usarEmitente(nome);
      if (!nome) linhas.push("Não consegui buscar o nome do posto. Preencha o fornecedor.");
      atualizar();
    }

    // ── 2) IA lê os itens — só em abastecimento novo e sem litros/valor digitados
    if (d || campoForm("litros")?.value || campoForm("valor_total")?.value) return;
    atualizar("Lendo os itens da nota com IA…");
    const nota = await lerNotaComIA(arquivo);
    if (!aindaEsta()) return;
    if (nota.erro) {
      linhas.push(MENSAGEM_ERRO_IA[nota.erro] || `Não consegui ler os itens da nota (${nota.erro}). Preencha litros e valores à mão.`);
      tom = "aviso";
      atualizar();
      return;
    }
    if (!info && nota.chave) {
      const infoIA = NotaQR.interpretarChave(nota.chave);
      if (infoIA && infoIA.chaveConfere) await usarChave(infoIA);
    }
    if (!nomeUsado) {
      const nome = nota.emitente?.cnpj && NotaQR.cnpjValido(nota.emitente.cnpj) ? await buscarNomeEmpresa(nota.emitente.cnpj) : null;
      if (!aindaEsta()) return;
      usarEmitente(nome || nota.emitente?.nome);
    }
    if (preencherPelaNota(nota, linhas) && tom !== "erro") tom = "aviso";
    atualizar();
  }

  // Preenche o formulário com os itens lidos da nota. Cada item traz o seu
  // desconto; se a nota só informa o desconto no total, ele vai pro maior
  // item (e só se for o principal). Devolve true quando há algo pra conferir.
  function preencherPelaNota(nota, linhas) {
    const itens = (nota.itens || []).map(i => ({ ...i, combustivel: combustivelDoItem(i.descricao), desc: Number(i.desconto) || 0 }));
    const combustiveis = itens.filter(i => i.combustivel && i.quantidade > 0 && i.valorTotal > 0);
    if (!combustiveis.length) { linhas.push("A nota não tem item de combustível reconhecido."); return true; }

    const ehMaquina = tipoEquipamento(Number(campoForm("equipamento_id")?.value)) === "Maquina";
    const principal = combustiveis.find(i => ehMaquina ? i.combustivel === "Diesel" : i.combustivel !== "Diesel") || combustiveis[0];
    const carro = ehMaquina && temVeiculoCadastrado
      ? combustiveis.find(i => i !== principal && i.combustivel !== principal.combustivel && i.combustivel !== "Diesel") : null;

    let avisoDesconto = null;
    if (!itens.some(i => i.desc > 0) && (Number(nota.descontoTotal) || 0) > 0) {
      const maiorItem = combustiveis.reduce((a, b) => (b.valorTotal > a.valorTotal ? b : a));
      if (principal === maiorItem || carro === maiorItem) {
        maiorItem.desc = Math.min(Number(nota.descontoTotal), maiorItem.valorTotal);
        avisoDesconto = `⚠ A nota só informa o desconto no total (${brl(nota.descontoTotal)}). Apliquei ao maior item (${maiorItem.combustivel}); se ele valia para outro, corrija.`;
      } else avisoDesconto = `⚠ A nota tem desconto de ${brl(nota.descontoTotal)}, mas não sei a qual item pertence. Não apliquei, confira.`;
    }
    const pago = (i) => arred(i.valorTotal - i.desc, 2);
    const duasCasas = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001;
    const linhaItem = (i) =>
      `${i.combustivel} ${num(i.quantidade, i.quantidade % 1 ? 3 : 0)} L × ${brl(i.valorUnit || 0)}${i.desc > 0 ? " − desconto " + brl(i.desc) : ""} = ${brl(pago(i))}`;
    let conferir = false;

    if (nota.data) campoForm("data").value = nota.data;
    campoForm("combustivel").value = principal.combustivel;
    campoForm("litros").value = String(principal.quantidade);
    campoForm("valor_unit_bruto").value = moedaMascara(principal.valorUnit || arred(principal.valorTotal / principal.quantidade, 2));
    campoForm("valor_total").value = moedaMascara(pago(principal));
    totalEditado = true; // o total vem da nota, não de litros × preço
    recalcularValores();
    linhas.push("Lido da nota: " + linhaItem(principal));
    if (avisoDesconto) { linhas.push(avisoDesconto); conferir = true; }
    if (principal.valorUnit && !duasCasas(principal.valorUnit)) {
      linhas.push(`⚠ O preço do litro na nota tem 3 casas (${principal.valorUnit}); o campo guarda 2. Confira o desconto.`);
      conferir = true;
    }

    const chk = campoForm("tem_carro_apoio");
    if (carro && chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event("change"));
      campoForm("carro_combustivel").value = carro.combustivel;
      campoForm("carro_litros").value = String(carro.quantidade);
      campoForm("carro_valor_unit_bruto").value = moedaMascara(carro.valorUnit || arred(carro.valorTotal / carro.quantidade, 2));
      campoForm("carro_valor_total").value = moedaMascara(pago(carro));
      carroTotalEditado = true; // o total vem da nota
      recalcularCarro();
      if (carro.valorUnit && !duasCasas(carro.valorUnit)) {
        linhas.push(`⚠ O preço do litro do carro na nota tem 3 casas (${carro.valorUnit}); o campo guarda 2. Confira o desconto.`);
        conferir = true;
      }
      const veiculos = opcoesEquipamentoPorTipo("Veiculo");
      if (veiculos.length === 1) campoForm("carro_equipamento_id").value = String(veiculos[0]).split("|")[0];
      linhas.push("Carro de apoio: " + linhaItem(carro) + (veiculos.length === 1 ? "" : " (escolha qual carro)"));
      if (veiculos.length !== 1) conferir = true;
    }

    const sobras = itens.filter(i => i !== principal && i !== carro);
    if (sobras.length) {
      linhas.push("Itens da nota que não foram lançados: " + sobras.map(i => `${i.descricao} (${brl(pago(i))})`).join(", ") + ".");
      conferir = true;
    }
    // a IA pode errar um dígito: as contas da própria nota entregam o erro
    const contaErrada = itens.find(i => i.valorUnit && Math.abs(i.quantidade * i.valorUnit - i.valorTotal) > 0.06);
    if (contaErrada) {
      linhas.push(`⚠ Na linha "${contaErrada.descricao}", quantidade × preço não bate com o valor do item. Confira os números com a foto.`);
      conferir = true;
    }
    const somaNota = itens.reduce((t, i) => t + pago(i), 0);
    if (nota.valorPago != null && Math.abs(somaNota - nota.valorPago) > 0.05) {
      linhas.push(`⚠ A soma dos itens (${brl(somaNota)}) não bate com o valor pago na nota (${brl(nota.valorPago)}). Confira os números com a foto.`);
      conferir = true;
    }
    return conferir;
  }

  // ── Valores do litro / desconto ──────────────────────────────────────
  // Você informa litros, preço do litro (o da bomba) e o valor total pago.
  // O desconto e o preço FINAL do litro (total ÷ litros) saem sozinhos.
  const arred = (n, casas) => Math.round(n * 10 ** casas) / 10 ** casas;
  const campoForm = (nome) => document.querySelector(`#modal-campos [data-campo="${nome}"]`);
  const parGrupo = d && d.grupo_abastecimento_id ? acharAbastecimento(d.grupo_abastecimento_id) : null;
  const precoBrutoInicial = d ? (d.valor_unit_bruto ?? d.valor_unit) : "";
  // enquanto o total não for mexido à mão, ele acompanha litros × preço.
  // Num registro já salvo com desconto, o total é respeitado como está.
  let totalEditado = !!d && Math.abs((d.litros || 0) * (precoBrutoInicial || 0) - (d.valor_total || 0)) > 0.005;
  const fmtLitro = (v) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  let carroTotalEditado = false;
  // pre = "" (abastecimento principal) ou "carro_" (carro de apoio)
  function recalcular(pre, editado) {
    if (!campoForm(pre + "litros")) return;
    const litros = Number(campoForm(pre + "litros").value) || 0;
    const bruto = numDeMoeda(campoForm(pre + "valor_unit_bruto").value);
    if (!editado && litros > 0 && bruto > 0) campoForm(pre + "valor_total").value = moedaMascara(arred(litros * bruto, 2));
    const total = numDeMoeda(campoForm(pre + "valor_total").value);
    const desconto = litros > 0 && bruto > 0 && total > 0 ? arred(litros * bruto - total, 2) : 0;
    const final = litros > 0 && total > 0 ? total / litros : 0;
    const pct = desconto !== 0 && litros * bruto > 0 ? ` (${num(Math.abs(desconto) / (litros * bruto) * 100, 1)}%)` : "";
    campoForm(pre + "desconto_calc").value = !total || !litros || !bruto ? "—"
      : desconto === 0 ? "Sem desconto" : (desconto > 0 ? brl(desconto) : "Acréscimo de " + brl(-desconto)) + pct;
    campoForm(pre + "preco_final_calc").value = final > 0 ? fmtLitro(final) : "—";
    atualizarTotalNota();
  }
  const recalcularValores = () => recalcular("", totalEditado);
  const recalcularCarro = () => recalcular("carro_", carroTotalEditado);

  // soma da nota: máquina + carro de apoio (novo) ou + o par já lançado (edição)
  function atualizarTotalNota() {
    const el = campoForm("total_nota_calc");
    if (!el) return;
    const a = numDeMoeda(campoForm("valor_total")?.value);
    let b = 0;
    if (parGrupo) b = Number(parGrupo.valor_total) || 0;
    else if (campoForm("tem_carro_apoio")?.checked) b = numDeMoeda(campoForm("carro_valor_total")?.value);
    el.value = brl(a + b) + (b ? `   =   ${brl(a)} + ${brl(b)}` : "");
  }

  // ordem pensada no fluxo: 1) anexa a nota (o app lê e preenche), 2) dados
  // gerais, 3) a máquina, 4) o carro de apoio (se houve), 5) soma e pagamento.
  const campos = [
    { tipo:"separador", rotulo:"① Nota fiscal e comprovantes (foto ou PDF, até 10 MB)" },
    { nome:"arq_nota", rotulo:"Nota fiscal ou recibo — anexe primeiro: o app lê e preenche o formulário", tipo:"arquivo", largo:true, atual: d?.nota_fiscal_path || "", aoEscolher: lerNotaAnexada },
    { nome:"arq_comprovante", rotulo:"Comprovante de pagamento", tipo:"arquivo", largo:true, atual: d?.comprovante_pagamento_path || "" },
    { tipo:"separador", rotulo:"② Dados gerais" },
    { nome:"data", rotulo:"Data", tipo:"date", valor: d?.data || hoje(), obrigatorio: true },
    { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(false), valor: equipamentoPadrao(d?.equipamento_id, false), obrigatorio: true,
      // o carro de apoio só faz sentido quando quem está abastecendo é uma
      // máquina (Pá Carregadeira, Retroescavadeira) — troca o equipamento
      // no formulário e o checkbox aparece/some na hora, sem reabrir o modal.
      aoMudar(novoId) {
        const ehMaquina = tipoEquipamento(Number(novoId)) === "Maquina";
        const chk = document.querySelector('#modal-campos [data-campo="tem_carro_apoio"]');
        if (!chk) return;
        const linha = chk.closest("label");
        if (linha) linha.classList.toggle("oculto", !ehMaquina || !temVeiculoCadastrado);
        if (!ehMaquina && chk.checked) {
          chk.checked = false;
          document.querySelectorAll('#modal-campos [data-grupo-cond="carroApoio"]').forEach(el => el.classList.add("oculto"));
          atualizarTotalNota();
        }
      } },
    { nome:"local", rotulo:"Posto / fornecedor (razão social)", tipo:"texto", largo:true, valor: d?.local || "", autocompletar:true, lista: nomesAtivos(dados.fornecedores) },
  ];
  if (parGrupo) {
    campos.push({ tipo:"info", largo:true, acaoId: parGrupo.id, acaoRotulo:"Abrir o outro lançamento",
      texto:`🔗 Nota conjunta: este lançamento faz par com ${nomeEquipamento(parGrupo.equipamento_id)} · ${parGrupo.combustivel} (${brl(parGrupo.valor_total)}). Cada um tem o seu valor; a soma aparece em "Total da nota".` });
  }
  campos.push(
    { tipo:"separador", rotulo: temVeiculoCadastrado ? "③ ⛽ Abastecimento da máquina" : "③ ⛽ Abastecimento" },
    { nome:"combustivel", rotulo:"Combustível", tipo:"select",
      opcoes:["Diesel|Diesel","Gasolina|Gasolina","Etanol|Etanol","GNV|GNV","Flex|Flex"],
      valor: d?.combustivel || (tipoEquip === "Veiculo" ? "Gasolina" : "Diesel") },
    { nome:"litros", rotulo:"Litros", tipo:"numero", valor: d?.litros ?? "", obrigatorio: true, aoMudar: recalcularValores },
    { nome:"valor_unit_bruto", rotulo:"Preço do litro na bomba (R$)", tipo:"moeda", valor: precoBrutoInicial ?? "", aoMudar: recalcularValores },
    { nome:"valor_total", rotulo:"Valor total pago (R$)", tipo:"moeda", valor: d?.valor_total ?? "", obrigatorio: true,
      aoMudar() { totalEditado = true; recalcularValores(); } },
    { nome:"desconto_calc", rotulo:"Desconto", tipo:"calculado", valor:"—" },
    { nome:"preco_final_calc", rotulo:"Preço final do litro", tipo:"calculado", valor:"—" },
  );
  if (temVeiculoCadastrado && !parGrupo) {
    campos.push(
      { nome:"tem_carro_apoio", rotulo:"🚗 Esta nota também tem abastecimento do carro de apoio", tipo:"checkbox", largo:true, controla:"carroApoio",
        valor:false, oculto: tipoEquip !== "Maquina", aoMudar: atualizarTotalNota },
      { tipo:"separador", rotulo:"🚗 Abastecimento do carro de apoio", grupoCondicional:"carroApoio", oculto:true },
      { nome:"carro_equipamento_id", rotulo:"Qual carro", tipo:"select", opcoes: opcoesEquipamentoPorTipo("Veiculo"), valor:"", grupoCondicional:"carroApoio", oculto:true, obrigatorio: true },
      { nome:"carro_combustivel", rotulo:"Combustível", tipo:"select",
        opcoes:["Gasolina|Gasolina","Etanol|Etanol/Álcool","GNV|GNV"], valor:"Gasolina", grupoCondicional:"carroApoio", oculto:true },
      { nome:"carro_litros", rotulo:"Litros", tipo:"numero", valor:"", grupoCondicional:"carroApoio", oculto:true, obrigatorio: true, aoMudar: recalcularCarro },
      { nome:"carro_valor_unit_bruto", rotulo:"Preço do litro na bomba (R$)", tipo:"moeda", valor:"", grupoCondicional:"carroApoio", oculto:true, aoMudar: recalcularCarro },
      { nome:"carro_valor_total", rotulo:"Valor total pago (R$)", tipo:"moeda", valor:"", grupoCondicional:"carroApoio", oculto:true, obrigatorio: true,
        aoMudar() { carroTotalEditado = true; recalcularCarro(); } },
      { nome:"carro_desconto_calc", rotulo:"Desconto", tipo:"calculado", valor:"—", grupoCondicional:"carroApoio", oculto:true },
      { nome:"carro_preco_final_calc", rotulo:"Preço final do litro", tipo:"calculado", valor:"—", grupoCondicional:"carroApoio", oculto:true },
    );
  }
  // soma da nota: só quando existe carro de apoio (ligado agora ou já lançado)
  if (parGrupo || (temVeiculoCadastrado && !parGrupo)) {
    campos.push({ nome:"total_nota_calc", rotulo:"💰 Total da nota (máquina + carro de apoio)", tipo:"calculado", largo:true, valor:"—",
      ...(parGrupo ? {} : { grupoCondicional:"carroApoio", oculto:true }) });
  }
  campos.push(
    { tipo:"separador", rotulo:"④ Pagamento" },
    { nome:"status", rotulo:"Situação", tipo:"select", opcoes:["pago|Pago à vista","pendente|A pagar (fiado)"], valor: d?.status || "pago" },
    { nome:"vencimento", rotulo:"Vence em", tipo:"date", valor: d?.vencimento || "", obrigatorio: (f) => f.status === "pendente", visivelSe: f => f.status === "pendente" },
    { nome:"_banco", rotulo:"Conta de onde saiu", tipo:"select", opcoes: opcoesContaBancaria(), valor: contaDoLancamento(d?.lancamento_id), visivelSe: f => f.status === "pago" },
    { tipo:"separador", rotulo:"Classificação" },
    { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Variavel|Custo variável","Fixo|Custo fixo"], valor: d?.natureza || "Variavel" },
    ...campoServico(d?.servico_id),
  );

  abrirModal({
    titulo: d ? "Editar abastecimento" : "Novo abastecimento",
    tabela: "diesel", id,
    tituloExclusao: d ? `o abastecimento de ${fData(d.data)}` : null,
    avisoExcluir: [
      d && (d.lancamento_id || d.agenda_id)
        ? "Isso também remove o lançamento vinculado no Extrato" + (d.agenda_id ? " e a conta a receber em Contas." : ".") : null,
      parGrupo ? `Nota conjunta: o abastecimento ${nomeEquipamento(parGrupo.equipamento_id)} · ${parGrupo.combustivel} (${brl(parGrupo.valor_total)}) e o lançamento dele no Extrato também serão excluídos.` : null,
    ].filter(Boolean).join(" ") || null,
    campos,
    // última barreira: mesmo com o aviso ignorado, nota repetida não grava
    async antesDeSalvar() {
      if (!chaveNota) return null;
      const rep = await buscarNotaRepetida(chaveNota, d?.id);
      return rep ? `⛔ Essa nota já foi lançada em ${fData(rep.data)}${rep.local ? " (" + rep.local + ")" : ""}. Para lançar outra, troque ou remova a nota anexada.` : null;
    },
    montar(f) {
      const litros = Number(f.litros) || 0;
      const bruto = numDeMoeda(f.valor_unit_bruto);
      // total pago manda; se não foi preenchido, vale litros × preço do litro
      const total = numDeMoeda(f.valor_total) || arred(litros * bruto, 2);
      if (!total) throw erroCampo("valor_total", "Informe o valor total pago (ou os litros e o preço do litro).");
      const vu = litros > 0 ? arred(total / litros, 4) : bruto;
      const precoBruto = bruto > 0 ? bruto : vu;
      const desconto = litros > 0 && bruto > 0 ? arred(litros * bruto - total, 2) : 0;
      if (!f.equipamento_id) throw erroCampo("equipamento_id", "Selecione o equipamento.");
      if (f.status === "pendente" && !f.vencimento) throw erroCampo("vencimento", "Informe quando vence o pagamento.");
      bancoDieselForm = f._banco || contaPadrao();

      carroApoioForm = null;
      if (f.tem_carro_apoio) {
        const carroLitros = Number(f.carro_litros) || 0;
        const carroBruto = numDeMoeda(f.carro_valor_unit_bruto);
        const carroTotal = numDeMoeda(f.carro_valor_total) || arred(carroLitros * carroBruto, 2);
        if (!f.carro_equipamento_id) throw erroCampo("carro_equipamento_id", "Selecione qual foi o carro de apoio.");
        if (!carroTotal) throw erroCampo("carro_valor_total", "Informe o valor total pago do carro de apoio (ou os litros e o preço do litro).");
        carroApoioForm = {
          equipamento_id: Number(f.carro_equipamento_id), combustivel: f.carro_combustivel,
          litros: carroLitros,
          valor_unit: carroLitros > 0 ? arred(carroTotal / carroLitros, 4) : carroBruto,
          valor_unit_bruto: carroBruto > 0 ? carroBruto : (carroLitros > 0 ? arred(carroTotal / carroLitros, 4) : 0),
          desconto: carroLitros > 0 && carroBruto > 0 ? arred(carroLitros * carroBruto - carroTotal, 2) : 0,
          valor_total: carroTotal,
        };
      }

      anexosForm = {
        comprovante: campoForm("arq_comprovante")?.files?.[0] || null, removerComprovante: !!f.arq_comprovante_remover,
        nota: campoForm("arq_nota")?.files?.[0] || null,               removerNota: !!f.arq_nota_remover,
      };
      validarAnexo(anexosForm.comprovante, "Comprovante de pagamento");
      validarAnexo(anexosForm.nota, "Nota fiscal/recibo");

      const registro = {
        data: f.data, equipamento_id: Number(f.equipamento_id), combustivel: f.combustivel,
        local: f.local.trim(), litros, valor_unit: vu, valor_unit_bruto: precoBruto, desconto, valor_total: total,
        status: f.status, vencimento: f.status === "pendente" ? f.vencimento : null,
        natureza: f.natureza,
        ...servicoDoForm(f),
      };
      // chave da nota (do QR): só mexe quando a nota foi trocada ou removida
      if (chaveNota) registro.nota_chave = chaveNota;
      else if (notaTrocada || anexosForm.removerNota) registro.nota_chave = null;
      return registro;
    },
    async aposSalvar(salvo) {
      // anexos e fornecedor novo não podem derrubar o resto da sincronização
      await salvarAnexosAbastecimento(salvo, d, anexosForm);
      await registrarFornecedor(salvo.local);
      // sempre sincroniza com o extrato — "pago" entra como realizado,
      // "a pagar" entra como pendente (não conta no saldo até dar baixa).
      await sincronizarLancamento({
        origemId: salvo.id, tabelaOrigem: "diesel", lancamentoId: d?.lancamento_id ?? salvo.lancamento_id,
        valor: salvo.valor_total, tipo: "saida", data: salvo.data, status: salvo.status, banco: bancoDieselForm,
        grupo: "Combustível", descricao: "Abastecimento" + (salvo.local ? " - " + salvo.local : ""),
        natureza: salvo.natureza, centroCustoId: salvo.centro_custo_id, equipamentoId: salvo.equipamento_id,
        servicoId: salvo.servico_id ?? null,
      });
      // "a pagar" também aparece como compromisso na Agenda, na data do
      // vencimento — some sozinho quando você dá baixa aqui no Diesel.
      await sincronizarAgendaEspelho({
        origemId: salvo.id, origemTabela: "diesel", agendaId: d?.agenda_id ?? salvo.agenda_id,
        pendente: salvo.status === "pendente", item: "Combustível a pagar",
        data: salvo.vencimento, valor: salvo.valor_total,
        natureza: salvo.natureza, centroCustoId: salvo.centro_custo_id, equipamentoId: salvo.equipamento_id,
        grupo: "Combustível",
      });
      // carro de apoio: cria um SEGUNDO abastecimento, separado, com seu
      // próprio equipamento e combustível — o valor da gasolina não se
      // mistura com o do diesel, cada um com seu próprio total.
      if (carroApoioForm) {
        try {
          await criarAbastecimentoCarroApoio(salvo, carroApoioForm);
        } catch (e) {
          console.error("Falha ao registrar o carro de apoio:", e);
          alertaErro("O abastecimento da máquina foi salvo, mas o do carro de apoio NÃO. Lance o carro de apoio separado.", "Salvo pela metade");
        }
      }
    },
    async aoExcluir() {
      await removerLancamentoVinculado(d?.lancamento_id);
      if (d?.agenda_id) await sb.from("agenda").delete().eq("id", d.agenda_id);
      await removerAnexo(d?.comprovante_pagamento_path);
      await removerAnexo(d?.nota_fiscal_path);
      // nota conjunta: excluir um lado exclui o outro (e o lançamento dele no Extrato)
      const apagados = await excluirParesDoAbastecimento(d);
      if (apagados.length) avisoAposExcluir = `Nota conjunta excluída: ${apagados.join(" e ")} também ${apagados.length > 1 ? "foram removidos" : "foi removido"}.`;
    },
  });
  recalcularValores();
}

// Procura no banco um abastecimento já lançado com a mesma chave de nota.
async function buscarNotaRepetida(chave, ignorarId) {
  try {
    const { data, error } = await sb.from("diesel").select("id,data,local").eq("nota_chave", chave);
    if (error) throw error;
    return (data || []).find(x => x.id !== ignorarId) || null;
  } catch (e) {
    console.error("Falha ao conferir nota repetida:", e);
    return todosAbastecimentos().find(x => x.nota_chave === chave && x.id !== ignorarId) || null;
  }
}

// Nome do posto a partir do CNPJ (consulta pública, gratuita — BrasilAPI).
// Se falhar ou demorar, devolve null e o fornecedor é preenchido à mão.
const cacheEmpresas = new Map();
async function buscarNomeEmpresa(cnpj) {
  if (cacheEmpresas.has(cnpj)) return cacheEmpresas.get(cnpj);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch("https://brasilapi.com.br/api/cnpj/v1/" + cnpj, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const nome = nomeAmigavel(j.razao_social || j.nome_fantasia || "");
    if (nome) cacheEmpresas.set(cnpj, nome);
    return nome || null;
  } catch (e) {
    console.error("Falha ao consultar o CNPJ:", e);
    return null;
  } finally { clearTimeout(timer); }
}
// "AUTO POSTO SAO JOSE LTDA" -> "Auto Posto Sao Jose LTDA"
function nomeAmigavel(txt) {
  txt = String(txt).trim().replace(/\s+/g, " ");
  if (txt !== txt.toUpperCase()) return txt; // já vem com maiúsculas/minúsculas certas
  const siglas = new Set(["LTDA", "ME", "EPP", "EIRELI", "SA", "S/A", "MEI", "CIA"]);
  const miudas = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
  return txt.split(" ").map((p, i) => {
    if (siglas.has(p)) return p;
    if (i > 0 && miudas.has(p)) return p.toLowerCase();
    return p.charAt(0) + p.slice(1).toLowerCase();
  }).join(" ");
}

// Tipo de combustível a partir da descrição do item da nota.
function combustivelDoItem(descricao) {
  const t = semAcento(descricao).toUpperCase();
  const achado = [["DIESEL", "Diesel"], ["GASOLINA", "Gasolina"], ["ETANOL", "Etanol"], ["ALCOOL", "Etanol"], ["GNV", "GNV"]]
    .find(([palavra]) => t.includes(palavra));
  return achado ? achado[1] : null;
}

// Mensagens amigáveis para os erros da leitura por IA.
const MENSAGEM_ERRO_IA = {
  ia_nao_configurada: "A leitura por IA ainda não foi ativada (falta cadastrar a chave da IA na Vercel). Preencha litros e valores à mão.",
  ia_chave_invalida: "A chave da API da IA é inválida. Preencha litros e valores à mão.",
  ia_sem_saldo: "A conta da API da IA está sem saldo. Preencha litros e valores à mão.",
  ia_limite: "A IA atingiu o limite de uso por agora. Tente de novo em instantes ou preencha à mão.",
  nota_nao_legivel: "A IA não conseguiu ler os itens dessa foto. Tente uma foto mais nítida ou preencha à mão.",
};

// Manda a foto (reduzida) pro servidor (/api/ler-nota), que pede à IA a leitura
// dos itens, desconto e totais. Devolve os dados ou { erro }.
async function lerNotaComIA(arquivo) {
  let img;
  try { img = await NotaQR.reduzirImagem(arquivo, 2000, 0.88); }
  catch (e) { console.error("Falha ao preparar a imagem:", e); return { erro: "imagem_ilegivel" }; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { erro: "sem_sessao" };
    const r = await fetch("/api/ler-nota", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ imagem: img.base64, tipo: img.tipo }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { erro: j.erro || "http_" + r.status };
  } catch (e) {
    console.error("Falha ao ler a nota com IA:", e);
    return { erro: e && e.name === "AbortError" ? "demorou_demais" : "sem_conexao" };
  } finally { clearTimeout(timer); }
}

// Cadastra o fornecedor/posto digitado, se ainda não existe — assim ele já
// aparece na lista da próxima vez (e na aba Administração → Fornecedores).
async function registrarFornecedor(nome) {
  nome = String(nome || "").trim();
  if (!nome) return;
  const jaExiste = dados.fornecedores.some(f => String(f.nome).trim().toLowerCase() === nome.toLowerCase());
  if (jaExiste) return;
  try {
    const { error } = await sb.from("fornecedores").insert({ nome });
    if (error && error.code !== "23505") throw error; // 23505 = já existia, tudo bem
  } catch (e) {
    console.error("Falha ao cadastrar o fornecedor:", e);
  }
}

// Envia/troca/remove o comprovante e a nota depois que o abastecimento foi
// salvo, e grava os caminhos no registro. Se algo falhar, o abastecimento
// continua salvo e o aviso aparece no lugar de "Registro criado".
async function salvarAnexosAbastecimento(salvo, anterior, arq) {
  if (!arq) return;
  const itens = [
    { arquivo: arq.comprovante, remover: arq.removerComprovante, coluna: "comprovante_pagamento_path", rotulo: "o comprovante de pagamento" },
    { arquivo: arq.nota,        remover: arq.removerNota,        coluna: "nota_fiscal_path",           rotulo: "a nota fiscal/recibo" },
  ];
  const mudancas = {}, antigos = [], falhas = [];
  for (const it of itens) {
    const antigo = anterior?.[it.coluna] || null;
    if (it.arquivo) {
      try { mudancas[it.coluna] = await enviarAnexo("abastecimentos", it.arquivo); if (antigo) antigos.push(antigo); }
      catch (e) { console.error("Falha ao enviar anexo:", e); falhas.push(it.rotulo); }
    } else if (it.remover && antigo) {
      mudancas[it.coluna] = null; antigos.push(antigo);
    }
  }
  if (Object.keys(mudancas).length) {
    const { error } = await sb.from("diesel").update(mudancas).eq("id", salvo.id);
    if (error) {
      console.error("Falha ao gravar os anexos:", error);
      for (const c in mudancas) if (mudancas[c]) await removerAnexo(mudancas[c]); // não deixa arquivo órfão
      antigos.length = 0;
      falhas.push("os anexos");
    }
  }
  for (const caminho of antigos) await removerAnexo(caminho);
  if (falhas.length) avisoAposSalvar = "Abastecimento salvo, mas não consegui enviar " + falhas.join(" e ") + ". Edite e tente de novo.";
}

let bancoDieselForm = null; // conta escolhida no último formulário de abastecimento
async function criarAbastecimentoCarroApoio(salvoPrincipal, carro) {
  const registro = {
    data: salvoPrincipal.data, equipamento_id: carro.equipamento_id, combustivel: carro.combustivel,
    local: salvoPrincipal.local, litros: carro.litros, valor_unit: carro.valor_unit, valor_unit_bruto: carro.valor_unit_bruto, desconto: carro.desconto, valor_total: carro.valor_total,
    status: salvoPrincipal.status, vencimento: salvoPrincipal.vencimento,
    natureza: salvoPrincipal.natureza, centro_custo_id: salvoPrincipal.centro_custo_id,
    grupo_abastecimento_id: salvoPrincipal.id,
  };
  if (dados.temServicos) registro.servico_id = salvoPrincipal.servico_id ?? null;
  const { data: novo, error } = await sb.from("diesel").insert(marcarBase(registro)).select().single();
  if (error || !novo) {
    console.error("Falha ao criar abastecimento do carro de apoio:", error);
    throw error || new Error("Falha ao criar o abastecimento do carro de apoio.");
  }
  // o principal também aponta pro par, pra qualquer um dos dois lados achar o outro
  await sb.from("diesel").update({ grupo_abastecimento_id: novo.id }).eq("id", salvoPrincipal.id).is("grupo_abastecimento_id", null);

  await sincronizarLancamento({
    origemId: novo.id, tabelaOrigem: "diesel", lancamentoId: null,
    valor: novo.valor_total, tipo: "saida", data: novo.data, status: novo.status, banco: bancoDieselForm,
    grupo: "Combustível", descricao: "Abastecimento" + (novo.local ? " - " + novo.local : "") + " (carro de apoio)",
    natureza: novo.natureza, centroCustoId: novo.centro_custo_id, equipamentoId: novo.equipamento_id,
    servicoId: novo.servico_id ?? null,
  });
  await sincronizarAgendaEspelho({
    origemId: novo.id, origemTabela: "diesel", agendaId: null,
    pendente: novo.status === "pendente", item: "Combustível a pagar",
    data: novo.vencimento, valor: novo.valor_total,
    natureza: novo.natureza, centroCustoId: novo.centro_custo_id, equipamentoId: novo.equipamento_id,
    grupo: "Combustível",
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
    ? listaComVerMais("man-proximas", proximas.map(m => `
      <div class="man-proxima-linha linha-clicavel" role="button" tabindex="0" onclick="aoClicarLinha(() => abrirModalManutencao(${m.id}))" onkeydown="teclaLinha(event)">
        <span class="chip" style="border-color:${COR_TIPO_MAN[m.tipo]};color:${COR_TIPO_MAN[m.tipo]}">${ROTULO_TIPO_MAN[m.tipo]}</span>
        <span class="man-proxima-desc">${escHtml(m.descricao || "—")}${contexto.equipamentoId == null ? " · " + escHtml(nomeEquipamento(m.equipamento_id)) : ""}</span>
        <span class="man-proxima-data">${fData(m.proxima_data || m.data)}${m.proxima_horimetro ? " · " + num(m.proxima_horimetro,0) + "h" : ""}</span>
      </div>`), 1)
    : '<div class="vazio">Nenhuma manutenção agendada.</div>';

  const filtrado = dados.man.filter(m =>
    dentroDe(m.data, filtroManPeriodo) &&
    (filtroManutencao.tipo === "todos" || m.tipo === filtroManutencao.tipo) &&
    (filtroManutencao.status === "todos" || (filtroManutencao.status === "realizadas" ? m.realizada : !m.realizada))
  );

  const linhasMan = filtrado.map(m => {
    const venceu = m.status_pagamento === "pendente" && m.vencimento && m.vencimento < hj;
    const statusHtml = !m.realizada
      ? `<span class="chip chip-status chip-pendente">Agendada</span>`
      : (m.status_pagamento === "pendente"
        ? `<span class="chip chip-status ${venceu ? "chip-vencido" : "chip-pendente"}">${venceu ? "Vencido" : "A pagar"}</span>`
        : `<span class="chip chip-status chip-pago">Pago</span>`);
    const proxTxt = m.proxima_data ? fData(m.proxima_data) : (m.proxima_horimetro ? num(m.proxima_horimetro,0) + " h" : "—");
    return `<tr class="linha-clicavel" role="button" tabindex="0" title="Editar manutenção"
      onclick="aoClicarLinha(() => abrirModalManutencao(${m.id}))" onkeydown="teclaLinha(event)">
      <td class="td-data">${fData(m.data)}</td>
      <td class="td-mudo">${contexto.equipamentoId == null ? escHtml(nomeEquipamento(m.equipamento_id)) : "—"}</td>
      <td><span class="chip" style="border-color:${COR_TIPO_MAN[m.tipo]};color:${COR_TIPO_MAN[m.tipo]}">${ROTULO_TIPO_MAN[m.tipo]}</span></td>
      <td class="num">${m.horimetro ? num(m.horimetro,0) : "—"}</td>
      <td class="td-desc">${escHtml(m.descricao || "—")}${m.pecas ? `<div class="td-natureza">peças: ${escHtml(m.pecas)}</div>` : ""}</td>
      <td class="td-mudo">${escHtml(m.fornecedor) || "—"}</td>
      <td class="num neg">${m.valor_total ? brl(m.valor_total) : "—"}</td>
      <td>${statusHtml}</td>
      <td class="td-mudo">${proxTxt}</td>
      <td class="td-acao"><span class="indicador-acao" title="Editar manutenção">${icone("chevron-right", "icone-sm")}</span></td>
    </tr>`;
  });
  $("man-corpo").innerHTML = linhasMan.length ? linhasComVerMais("manutencao", linhasMan, 20, 10) :
  '<tr><td colspan="10" class="vazio">Nenhuma manutenção neste período.</td></tr>';
}

function abrirModalManutencao(id) {
  const m = id ? dados.man.find(x => x.id === id) : null;
  let bancoManutencao = null;
  abrirModal({
    titulo: m ? "Editar manutenção" : "Nova manutenção",
    tabela: "manutencoes", id,
    tituloExclusao: m ? `a manutenção de ${fData(m.data)}` : null,
    avisoExcluir: m && (m.lancamento_id || m.agenda_id)
      ? "Isso também remove o lançamento vinculado no Extrato" + (m.agenda_id ? " e a conta a receber em Contas." : ".")
      : null,
    campos: [
      { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(false), valor: equipamentoPadrao(m?.equipamento_id, false), obrigatorio: true },
      { nome:"tipo", rotulo:"Tipo", tipo:"select", opcoes:["preventiva|Preventiva","preditiva|Preditiva","corretiva|Corretiva"], valor: m?.tipo || "preventiva" },
      { nome:"realizada", rotulo:"Já foi feita (desmarque para agendar)", tipo:"checkbox", largo:true, valor: m?.realizada ?? true },
      { nome:"data", rotulo:"Data", tipo:"date", valor: m?.data || hoje(), obrigatorio: true },
      { nome:"horimetro", rotulo:"Horímetro", tipo:"numero", valor: m?.horimetro ?? "" },
      { nome:"descricao", rotulo:"O que foi / será feito", tipo:"texto", largo:true, valor: m?.descricao || "" },
      { nome:"pecas", rotulo:"Peças trocadas/compradas", tipo:"texto", largo:true, valor: m?.pecas || "", visivelSe: f => f.realizada },
      { nome:"fornecedor", rotulo:"Oficina / fornecedor", tipo:"texto", valor: m?.fornecedor || "", lista: nomesAtivos(dados.fornecedores) },
      { nome:"valor_pecas", rotulo:"Valor peças (R$)", tipo:"moeda", valor: m?.valor_pecas ?? "" },
      { nome:"valor_mao_obra", rotulo:"Valor mão de obra (R$)", tipo:"moeda", valor: m?.valor_mao_obra ?? "" },
      { nome:"natureza", rotulo:"Natureza", tipo:"select", opcoes:["Variavel|Custo variável","Fixo|Custo fixo"], valor: m?.natureza || "Variavel" },
      { nome:"status_pagamento", rotulo:"Pagamento", tipo:"select", opcoes:["pago|Já foi pago","pendente|Ainda vou pagar"], valor: m?.status_pagamento || "pago", visivelSe: f => f.realizada },
      { nome:"vencimento", rotulo:"Vence em", tipo:"date", valor: m?.vencimento || "", obrigatorio: (f) => f.realizada && f.status_pagamento === "pendente", visivelSe: f => f.realizada && f.status_pagamento === "pendente" },
      { nome:"_banco", rotulo:"Conta de onde saiu", tipo:"select", opcoes: opcoesContaBancaria(), valor: contaDoLancamento(m?.lancamento_id), visivelSe: f => f.realizada && f.status_pagamento === "pago" },
      { nome:"proxima_data", rotulo:"Próxima revisão (data)", tipo:"date", valor: m?.proxima_data || "" },
      { nome:"proxima_horimetro", rotulo:"Próxima revisão (horímetro)", tipo:"numero", valor: m?.proxima_horimetro ?? "" },
      ...campoServico(m?.servico_id),
    ],
    montar(f) {
      if (!f.equipamento_id) throw erroCampo("equipamento_id", "Selecione o equipamento.");
      if (!f.descricao.trim() && !f.pecas.trim()) throw erroCampo("descricao", "Descreva o serviço ou as peças.");
      if (f.realizada && f.status_pagamento === "pendente" && !f.vencimento) throw erroCampo("vencimento", "Informe quando vence o pagamento.");
      bancoManutencao = f._banco || contaPadrao();
      const vp = numDeMoeda(f.valor_pecas);
      const vm = numDeMoeda(f.valor_mao_obra);
      return {
        equipamento_id: Number(f.equipamento_id), tipo: f.tipo, data: f.data, realizada: !!f.realizada,
        horimetro: f.horimetro === "" ? null : Number(f.horimetro),
        descricao: f.descricao.trim(), pecas: f.pecas.trim(), fornecedor: f.fornecedor.trim(),
        valor_pecas: vp, valor_mao_obra: vm, valor_total: vp + vm,
        natureza: f.natureza,
        status_pagamento: f.realizada ? f.status_pagamento : "pendente",
        vencimento: f.realizada && f.status_pagamento === "pendente" ? f.vencimento : null,
        proxima_data: f.proxima_data || null,
        proxima_horimetro: f.proxima_horimetro === "" ? null : Number(f.proxima_horimetro),
        ...servicoDoForm(f),
      };
    },
    async aposSalvar(salvo) {
      // sempre sincroniza com o extrato: agendada ou a pagar entra como
      // pendente (é um compromisso previsto, mas o dinheiro ainda não saiu);
      // só realizada + paga conta como movimentação de fato.
      const pendente = !(salvo.realizada && salvo.status_pagamento === "pago");
      await sincronizarLancamento({
        origemId: salvo.id, tabelaOrigem: "manutencoes", lancamentoId: m?.lancamento_id ?? salvo.lancamento_id,
        valor: salvo.valor_total, tipo: "saida", data: salvo.data, grupo: "Manutenção",
        status: pendente ? "pendente" : "pago", banco: bancoManutencao,
        descricao: "Manutenção" + (salvo.fornecedor ? " - " + salvo.fornecedor : ""),
        natureza: salvo.natureza, centroCustoId: salvo.centro_custo_id, equipamentoId: salvo.equipamento_id,
        servicoId: salvo.servico_id ?? null,
      });
      // agendada ou a pagar também aparece como compromisso na Agenda —
      // some sozinho quando a manutenção é realizada e paga.
      await sincronizarAgendaEspelho({
        origemId: salvo.id, origemTabela: "manutencoes", agendaId: m?.agenda_id ?? salvo.agenda_id,
        pendente, item: "Manutenção a pagar",
        data: salvo.vencimento || salvo.data, valor: salvo.valor_total,
        natureza: salvo.natureza, centroCustoId: salvo.centro_custo_id, equipamentoId: salvo.equipamento_id,
        grupo: "Manutenção",
      });
    },
    async aoExcluir() {
      await removerLancamentoVinculado(m?.lancamento_id);
      if (m?.agenda_id) await sb.from("agenda").delete().eq("id", m.agenda_id);
    },
  });
}

async function abrirModalMeuPerfil() {
  const { data: { user } } = await sb.auth.getUser();
  const meu = dados.perfis.find(p => p.id === meuUserId);
  abrirModal({
    titulo: "Meu perfil",
    tabela: "_meu_perfil",
    campos: [
      { nome:"nome", rotulo:"Nome", tipo:"texto", largo:true, valor: meu?.nome || "" },
      { nome:"_email", rotulo:"E-mail", tipo:"texto", largo:true, valor: user?.email || "" },
      { nome:"avatar_url", rotulo:"Link da foto (opcional)", tipo:"texto", largo:true, valor: meu?.avatar_url || "" },
      { nome:"nova_senha", rotulo:"Nova senha (deixe em branco pra não trocar)", tipo:"senha", valor:"" },
    ],
    semExcluir: true,
    montar(f) {
      if (!f.nome.trim()) throw erroCampo("nome", "Informe o nome.");
      if (f.nova_senha && f.nova_senha.length < 6) throw erroCampo("nova_senha", "A nova senha precisa ter pelo menos 6 caracteres.");
      return { nome: f.nome.trim(), avatar_url: f.avatar_url.trim() || null, nova_senha: f.nova_senha };
    },
    async aoSalvar(reg) {
      const btn = $("modal-salvar");
      btn.disabled = true; btn.textContent = "Salvando…";
      const { error } = await sb.from("perfis").update({ nome: reg.nome, avatar_url: reg.avatar_url }).eq("id", meuUserId);
      if (error) {
        btn.disabled = false; btn.textContent = "Salvar";
        mostrarErroForm(erroBanco(error));
        return;
      }
      if (reg.nova_senha) {
        const { error: errSenha } = await sb.auth.updateUser({ password: reg.nova_senha });
        if (errSenha) {
          toast("Nome/foto salvos, mas a senha não pôde ser trocada: " + errSenha.message);
        }
      }
      btn.disabled = false; btn.textContent = "Salvar";
      fecharModal();
      toast("Perfil atualizado.");
      await carregarTudo();
    }
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
    nota:"telefone e valor de hora padrão preenchem sozinhos ao escolher o cliente em Horas e Serviços.",
    abrir:"abrirModalCliente" },
  { chave:"fornecedores",   tabela:"fornecedores",     titulo:"Fornecedores / Oficinas",
    nota:"postos de combustível, oficinas — sugestão automática no Abastecimento e na Manutenção.",
    abrir:"abrirModalFornecedor" },
  { chave:"gruposDespesa",  tabela:"grupos_despesa",   titulo:"Grupos de despesa",
    nota:"categorias de despesa usadas no Extrato e em Contas.",
    abrir:"abrirModalGrupoDespesa" },
  { chave:"contasBancarias",tabela:"contas_bancarias", titulo:"Contas bancárias",
    nota:"contas usadas no Extrato.",
    abrir:"abrirModalContaBancaria" },
  { chave:"operadores",     tabela:"operadores",       titulo:"Operadores",
    nota:"quem opera a máquina — sugestão automática em Horas trabalhadas.",
    abrir:"abrirModalOperador" },
  { chave:"obras",          tabela:"obras",            titulo:"Obras / Contratos",
    nota:"pra separar rentabilidade por obra, além do cliente — sugestão automática em Horas trabalhadas.",
    abrir:"abrirModalObra" },
  { chave:"tiposRecebimento", tabela:"tipos_recebimento", titulo:"Tipos de receita",
    nota:"classifica a origem da receita (locação, frete, serviço avulso) — usado em Horas trabalhadas.",
    abrir:"abrirModalTipoRecebimento" },
];

const SECOES_ADMIN = [
  { chave: "empresa", titulo: "Empresa", tipo: "empresa", grupo: "Geral", icone: "inicio", sub: "nome e conta padrão" },
  ...CADASTROS_ADMIN.filter(c => c.chave !== "obras" && c.chave !== "centrosCusto").map(c => ({ chave: c.chave, titulo: c.titulo, tipo: "cadastro", config: c, grupo: "Cadastros", icone: c.chave === "equipamentos" ? "tractor" : c.chave === "contasBancarias" ? "banco" : c.chave === "clientes" ? "usuario" : "extrato" })),
  { chave: "feriados", titulo: "Feriados", tipo: "feriados", grupo: "Cadastros", icone: "agenda" },
  { chave: "usuarios", titulo: "Usuários e acessos", tipo: "usuarios", grupo: "Pessoas", icone: "usuario" },
  { chave: "auditoria", titulo: "Histórico de alterações", tipo: "auditoria", grupo: "Pessoas", icone: "relogio", sub: "quem fez o quê" },
];
let adminSecaoAtiva = null;
let filtroHistorico = "todos";

function mudarSecaoAdmin(chave) {
  adminSecaoAtiva = chave;
  renderAdministracao();
  window.scrollTo(0, 0);
}
const qtdSecaoAdmin = (s) => s.tipo === "cadastro" ? (dados[s.config.chave] || []).length
  : s.tipo === "feriados" ? dados.feriados.length : s.tipo === "usuarios" ? dados.perfis.length : null;

function renderAdministracao() {
  const celular = !telaCombina("(min-width: 1024px)");
  if (!celular && (!adminSecaoAtiva || !SECOES_ADMIN.some(s => s.chave === adminSecaoAtiva))) adminSecaoAtiva = SECOES_ADMIN[0].chave;
  if (adminSecaoAtiva && !SECOES_ADMIN.some(s => s.chave === adminSecaoAtiva)) adminSecaoAtiva = null;

  // menu: lateral no computador; no celular, uma lista de seções (tela própria)
  const grupos = [...new Set(SECOES_ADMIN.map(s => s.grupo))];
  const menu = grupos.map(g => `
    <h3 class="grupo-titulo">${g}</h3>
    <div class="mais-lista">${SECOES_ADMIN.filter(s => s.grupo === g).map(s => {
      const q = qtdSecaoAdmin(s);
      return `<button type="button" class="mais-item ${s.chave === adminSecaoAtiva ? "ativo" : ""}" onclick="mudarSecaoAdmin('${s.chave}')">${icone(s.icone)}<span><b>${s.titulo}</b>${s.sub ? `<small>${s.sub}</small>` : q != null ? `<small>${q} cadastrado${q === 1 ? "" : "s"}</small>` : ""}</span>${icone("chevron-right", "icone-sm mais-seta")}</button>`;
    }).join("")}</div>`).join("");
  $("admin-sidebar").innerHTML = menu;
  $("admin-sidebar").classList.toggle("oculto", celular && !!adminSecaoAtiva);
  const conteudo = $("admin-conteudo");
  conteudo.classList.toggle("oculto", celular && !adminSecaoAtiva);
  if (!adminSecaoAtiva) { conteudo.innerHTML = ""; return; }

  const secao = SECOES_ADMIN.find(s => s.chave === adminSecaoAtiva);
  const voltar = celular ? `<button type="button" class="btn-voltar" onclick="mudarSecaoAdmin(null)">${icone("chevron-right", "icone-sm")} Configurações</button>` : "";
  const cabeca = (titulo, nota, botao) => `${voltar}
    <div class="admin-cabeca"><h2 class="titulo-risco"><span>${titulo}</span></h2>${botao || ""}</div>
    ${nota ? `<p class="cartao-nota">${nota}</p>` : ""}`;
  const linha = (onclick, principal, extra = "", lead = "") => `
    <button type="button" class="admin-linha" onclick="${onclick}">${lead}<span class="admin-linha-nome">${principal}</span>${extra}${icone("chevron-right", "icone-sm mais-seta")}</button>`;

  if (secao.tipo === "empresa") {
    const cfgNome = document.querySelector("[data-empresa-nome]")?.textContent || "";
    conteudo.innerHTML = cabeca("Empresa", "aparece no topo do aplicativo e é usada nos lançamentos automáticos.") + `
      <div class="lista-cartao">
        ${linha("abrirModalEmpresa()", `<b>Nome da empresa</b><small>${escHtml(cfgNome)}</small>`)}
        ${linha("abrirModalEmpresa()", `<b>Conta padrão</b><small>${escHtml(contaPadrao())} — onde entram abastecimentos, manutenções e recebimentos quando você não escolhe outra</small>`)}
      </div>`;
    return;
  }

  if (secao.tipo === "cadastro") {
    const c = secao.config;
    const lista = (dados[c.chave] || []).slice().sort((a, b) => (a.ativo === false) - (b.ativo === false) || String(a.nome).localeCompare(String(b.nome), "pt"));
    conteudo.innerHTML = cabeca(c.titulo, c.nota, meuPapel === "admin" ? `<button class="btn-primario" onclick="${c.abrir}(null)">+ Novo</button>` : "") + `
      <div class="lista-cartao">${lista.length
        ? lista.map(item => linha(`${c.abrir}(${item.id})`, `<b>${escHtml(item.nome)}</b>${item.telefone ? `<small>${escHtml(item.telefone)}</small>` : item.tipo ? `<small>${item.tipo === "Veiculo" ? "veículo de apoio" : "máquina"}</small>` : ""}`,
            item.ativo === false ? `<span class="chip chip-status">Inativo</span>` : "")).join("")
        : '<div class="vazio">Nenhum cadastrado ainda.</div>'}</div>`;
    return;
  }

  if (secao.tipo === "feriados") {
    const fer = dados.feriados.slice().sort((a,b) => b.data.localeCompare(a.data));
    conteudo.innerHTML = cabeca("Feriados", "usados para avisar quando um vencimento cai em dia sem expediente. Feriados móveis (Carnaval, Páscoa) entram ano a ano.", `<button class="btn-primario" onclick="abrirModalFeriado(null)">+ Novo</button>`) + `
      <div class="lista-cartao">${fer.length
        ? fer.map(f => linha(`abrirModalFeriado(${f.id})`, `<b>${escHtml(f.descricao || "Feriado")}</b><small>${fData(f.data)}</small>`)).join("")
        : '<div class="vazio">Nenhum feriado cadastrado.</div>'}</div>`;
    return;
  }

  if (secao.tipo === "usuarios") {
    const ROTULO_PAPEL = { admin:"Administrador", operacional:"Operacional", leitura:"Só leitura" };
    const CLASSE_PAPEL = { admin:"chip-pago", operacional:"chip-pendente", leitura:"" };
    conteudo.innerHTML = cabeca("Usuários e acessos", "Toque em uma pessoa para definir o que ela pode ver e fazer. Para dar acesso a alguém novo, crie o login dela no Supabase (Authentication → Add user): ela aparece aqui como \"Só leitura\" até você liberar.") + `
      <div class="lista-cartao">${dados.perfis.length
        ? dados.perfis.map(p => linha(`abrirModalPerfil('${p.id}')`,
            `<b>${escHtml(p.nome || "Sem nome")}</b><small>${p.papel === "admin" ? "acesso total" : (p.ve_financeiro === false ? "sem acesso ao dinheiro" : "vê o financeiro")}</small>`,
            `<span class="chip chip-status ${CLASSE_PAPEL[p.papel] || ""}">${ROTULO_PAPEL[p.papel] || p.papel}</span>${p.ativo === false ? `<span class="chip chip-status chip-vencido">Bloqueado</span>` : ""}`,
            avatarHtml(p.nome, p.avatar_url))).join("")
        : '<div class="vazio">Nenhum usuário. Rode a migração correcoes_v19.sql no Supabase.</div>'}</div>`;
    return;
  }

  if (secao.tipo === "auditoria") {
    const pessoas = dados.perfis.filter(p => dados.logAtividade.some(l => l.usuario_id === p.id));
    const itens = agruparHistorico(dados.logAtividade.filter(l => filtroHistorico === "todos" || l.usuario_id === filtroHistorico));
    let diaAtual = "";
    const html = itens.map(it => {
      const dia = isoLocal(new Date(it.quando));
      const titDia = dia !== diaAtual ? `<h3 class="grupo-titulo">${dia === hoje() ? "Hoje" : dia === somarDias(hoje(), -1) ? "Ontem" : fData(dia)}</h3>` : "";
      diaAtual = dia;
      const hora = new Date(it.quando).toTimeString().slice(0, 5);
      return titDia + `<div class="hist-item">
        ${it.sistema ? `<span class="avatar-fallback hist-sistema">${icone("atualizar", "icone-sm")}</span>` : avatarHtml(it.nome, it.avatar)}
        <div class="hist-texto">
          <div><b>${escHtml(it.nome)}</b> ${it.frase}</div>
          ${it.detalhe ? `<small>${it.detalhe}</small>` : ""}
          ${it.extra ? `<small class="hist-extra">${it.extra}</small>` : ""}
        </div>
        <span class="hist-hora">${hora}</span>
      </div>`;
    }).join("");
    conteudo.innerHTML = cabeca("Histórico de alterações", "o que cada pessoa criou, alterou ou excluiu (últimas 300 alterações).") + `
      ${pessoas.length > 1 ? `<div class="filtros"><select onchange="filtroHistorico = this.value; renderAdministracao()">
        <option value="todos">Todas as pessoas</option>
        ${pessoas.map(p => `<option value="${p.id}" ${filtroHistorico === p.id ? "selected" : ""}>${escHtml(p.nome || "Sem nome")}</option>`).join("")}
      </select></div>` : ""}
      <div class="lista-cartao hist-lista">${html || '<div class="vazio">Nenhuma alteração registrada ainda.</div>'}</div>`;
  }
}

/* ── Histórico: transforma o log técnico em frases ── */
const NOME_TABELA_HIST = { lancamentos: "o Extrato", recebimentos: "Horas", diesel: "Abastecimento", manutencoes: "Manutenção", agenda: "Contas", servicos: "Serviços" };
const ROTULO_CAMPO_HIST = {
  data: "data", valor_total: "valor", entrada: "valor", saida: "valor", valor: "valor", litros: "litros", valor_unit: "preço do litro",
  valor_unit_bruto: "preço da bomba", desconto: "desconto", status: "situação", status_pagamento: "situação", vencimento: "vencimento",
  descricao: "descrição", item: "descrição", grupo: "categoria", natureza: "tipo de custo", banco: "conta", local: "posto",
  combustivel: "combustível", equipamento_id: "equipamento", centro_custo_id: "centro de custo", cliente: "cliente", operador: "operador",
  hora_inicial: "horímetro", hora_final: "horímetro", horas: "horas", valor_hora: "valor da hora", valor_pago: "valor recebido",
  recebido: "recebido", servico_id: "serviço", nome: "nome", data_fim: "fim", data_inicio: "início", valor_fechado: "valor fechado",
  cobranca: "cobrança", pecas: "peças", fornecedor: "oficina", valor_pecas: "peças", valor_mao_obra: "mão de obra", realizada: "realizada",
  data_pagamento: "data do pagamento", mes: "vencimento", dia: "vencimento", ano: "vencimento", tipo: "tipo",
  proxima_data: "próxima revisão", proxima_horimetro: "próxima revisão", comprovante_pagamento_path: "comprovante", nota_fiscal_path: "nota fiscal",
};
function registroDoLog(l) {
  if (l.dados) return normNum(l.dados, l.tabela);
  const fonte = { lancamentos: dados.lanc, recebimentos: dados.rec, diesel: dados.die, manutencoes: dados.man, agenda: dados.age, servicos: dados.servicos }[l.tabela];
  return (fonte || []).find(x => x.id === l.registro_id) || null;
}
function descreverRegistroHist(tabela, r) {
  if (!r) return { oque: { lancamentos: "um lançamento", recebimentos: "um registro de horas", diesel: "um abastecimento", manutencoes: "uma manutenção", agenda: "uma conta", servicos: "um serviço" }[tabela] || "um registro", detalhe: "" };
  const eq = r.equipamento_id ? nomeEquipamento(r.equipamento_id) : "";
  const j = (...p) => p.filter(Boolean).map(escHtml).join(" · ");
  switch (tabela) {
    case "lancamentos": return { oque: r.entrada > 0 ? "uma receita" : "uma despesa", detalhe: j(r.descricao || r.grupo, brl(r.entrada || r.saida), r.banco, fData(r.data)) };
    case "diesel": return { oque: "um abastecimento", detalhe: j(`${num(r.litros || 0, 0)} L de ${r.combustivel || "Diesel"}`, brl(r.valor_total), eq, r.local, fData(r.data)) };
    case "recebimentos": return { oque: "horas trabalhadas", detalhe: j(`${num(r.horas || 0)} h`, r.cliente, eq, fData(r.data)) };
    case "manutencoes": return { oque: "uma manutenção", detalhe: j(r.descricao, r.valor_total ? brl(r.valor_total) : "", eq, fData(r.data)) };
    case "agenda": return { oque: r.valor < 0 ? "uma conta a receber" : "uma conta a pagar", detalhe: j(r.item, brl(Math.abs(r.valor || 0)), r.ano ? `vence ${String(r.dia).padStart(2, "0")}/${String(r.mes).padStart(2, "0")}/${r.ano}` : "") };
    case "servicos": return { oque: "um serviço", detalhe: j(r.nome, r.cliente) };
    default: return { oque: "um registro", detalhe: "" };
  }
}
// Junta o que a mesma pessoa fez no mesmo instante (ex.: salvar um abastecimento
// também cria o lançamento no Extrato) numa linha só, e as alterações feitas
// direto no banco (sem usuário) numa linha "Sistema" por dia.
function agruparHistorico(logs) {
  const grupos = [];
  for (const l of logs) {
    const t = new Date(l.criado_em).getTime();
    const ult = grupos[grupos.length - 1];
    const mesmo = ult && ult.usuario_id === l.usuario_id && (l.usuario_id
      ? Math.abs(ult.t - t) <= 15000
      : isoLocal(new Date(ult.t)) === isoLocal(new Date(t)));
    if (mesmo) { ult.itens.push(l); ult.t = Math.min(ult.t, t); }
    else grupos.push({ usuario_id: l.usuario_id, t, itens: [l] });
  }
  const VERBO = { criar: "criou", editar: "alterou", excluir: "excluiu" };
  return grupos.map(g => {
    if (!g.usuario_id) return { sistema: true, nome: "Sistema", quando: g.itens[0].criado_em, frase: `fez ${g.itens.length} ajuste${g.itens.length > 1 ? "s" : ""} automático${g.itens.length > 1 ? "s" : ""} no banco`, detalhe: "migrações e correções feitas direto no banco de dados" };
    const p = dados.perfis.find(x => x.id === g.usuario_id);
    // ação principal: o que a pessoa mexeu de fato (o lançamento/conta gerados vêm junto)
    const principal = g.itens.find(x => x.tabela !== "lancamentos" && x.tabela !== "agenda") || g.itens.find(x => x.tabela !== "agenda") || g.itens[0];
    const reg = registroDoLog(principal);
    const d = descreverRegistroHist(principal.tabela, reg);
    const campos = principal.acao === "editar" && principal.campos ? [...new Set(principal.campos.map(c => ROTULO_CAMPO_HIST[c] || c.replace(/_/g, " ")))] : [];
    const outros = g.itens.filter(x => x !== principal);
    const resumoOutros = outros.length ? [...new Set(outros.map(x => (x.tabela === "lancamentos" ? "lançamento no Extrato" : x.tabela === "agenda" ? "conta em Contas" : NOME_TABELA_HIST[x.tabela] || x.tabela)))] : [];
    return {
      nome: p?.nome || "Usuário sem nome", avatar: p?.avatar_url, quando: g.itens[0].criado_em,
      frase: `${VERBO[principal.acao] || principal.acao} ${d.oque}${principal.tabela !== "lancamentos" ? " em " + NOME_TABELA_HIST[principal.tabela] : ""}`,
      detalhe: d.detalhe,
      extra: [campos.length ? "mudou: " + campos.join(", ") : "", resumoOutros.length ? "junto: " + resumoOutros.join(", ") : ""].filter(Boolean).join(" · "),
    };
  });
}

// Empresa: nome exibido e conta padrão (tabela config)
function abrirModalEmpresa() {
  abrirModal({
    titulo: "Empresa",
    tabela: "_empresa",
    campos: [
      { nome: "empresa_nome", rotulo: "Nome da empresa", tipo: "texto", largo: true, valor: document.querySelector("[data-empresa-nome]")?.textContent || "", obrigatorio: true },
      { nome: "conta_padrao", rotulo: "Conta padrão dos lançamentos automáticos", tipo: "select", largo: true, opcoes: opcoesContaBancaria(), valor: contaPadrao() },
    ],
    montar(f) {
      if (!f.empresa_nome.trim()) throw erroCampo("empresa_nome", "Informe o nome da empresa.");
      return { empresa_nome: f.empresa_nome.trim(), conta_padrao: f.conta_padrao };
    },
    async aoSalvar(reg) {
      const { error } = await sb.from("config").upsert([{ chave: "empresa_nome", valor: reg.empresa_nome }, { chave: "conta_padrao", valor: reg.conta_padrao }]);
      if (error) { mostrarErroForm(erroBanco(error)); return; }
      fecharModal();
      toast("Dados da empresa salvos.");
      await carregarTudo();
    },
  });
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
        { nome:"nome", rotulo:"Nome", tipo:"texto", largo:true, valor: item?.nome || "", obrigatorio: true },
        ...camposExtra.map(c => ({ ...c, valor: c.padrao ? (item && item[c.nome] != null ? item[c.nome] : c.padrao(item)) : (item ? (item[c.nome] ?? "") : "") })),
        { nome:"ativo", rotulo:"Ativo", tipo:"checkbox", valor: item?.ativo ?? true },
      ],
      montar(f) {
        if (!f.nome.trim()) throw erroCampo("nome", "Informe o nome.");
        const extra = {};
        camposExtra.forEach(c => {
          extra[c.nome] = c.tipo === "moeda" ? (f[c.nome] ? numDeMoeda(f[c.nome]) : null)
            : c.tipo === "checkbox" ? !!f[c.nome] : String(f[c.nome] || "").trim();
        });
        return { nome: f.nome.trim(), ...extra, ativo: !!f.ativo };
      }
    });
  };
}

const abrirModalEquipamentoAdmin = criarModalCadastro("equipamentos", "equipamentos", "equipamento", [
  { nome:"tipo", rotulo:"Tipo", tipo:"select", opcoes:["Maquina|Máquina (controla por horímetro)","Veiculo|Veículo (carro de apoio)"] },
  { nome:"controla_resultado", rotulo:"Tem resultado próprio (painel só dele). Desmarcado: os gastos entram só no total do negócio", tipo:"checkbox", largo:true, padrao: (item) => controlaResultado(item || { tipo: "Maquina" }) },
  { nome:"imagem_url", rotulo:"Foto (link da imagem, opcional)", tipo:"texto", largo:true },
]);
const abrirModalCentroCusto      = criarModalCadastro("centros_custo", "centrosCusto", "centro de custo");
const abrirModalFornecedor       = criarModalCadastro("fornecedores", "fornecedores", "fornecedor");
const abrirModalGrupoDespesa     = criarModalCadastro("grupos_despesa", "gruposDespesa", "grupo de despesa");
const abrirModalContaBancaria    = criarModalCadastro("contas_bancarias", "contasBancarias", "conta bancária");
const abrirModalOperador         = criarModalCadastro("operadores", "operadores", "operador");
const abrirModalObra             = criarModalCadastro("obras", "obras", "obra/contrato");
const abrirModalTipoRecebimento  = criarModalCadastro("tipos_recebimento", "tiposRecebimento", "tipo de recebimento");
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
      if (!f.data) throw erroCampo("data", "Informe a data.");
      return { data: f.data, descricao: f.descricao.trim() };
    }
  });
}

const NOME_MODULO = { extrato:"Extrato", recebimentos:"Horas trabalhadas", diesel:"Abastecimento", manutencao:"Manutenção", agenda:"Contas a pagar/receber" };

function abrirModalPerfil(id) {
  const p = dados.perfis.find(x => x.id === id);
  if (!p) return;
  const souEu = id === meuUserId;
  const modulos = p.modulos || {};
  const equipLiberados = new Set(dados.perfisEquipamentos.filter(pe => pe.perfil_id === id).map(pe => pe.equipamento_id));

  abrirModal({
    titulo: "Editar usuário",
    tabela: "perfis", id,
    semExcluir: true,
    campos: [
      { nome:"nome", rotulo:"Nome", tipo:"texto", largo:true, valor: p.nome || "", obrigatorio: true },
      { nome:"papel", rotulo:"O que pode fazer", tipo:"select", largo:true,
        opcoes:["leitura|Só consultar (não lança nada)","operacional|Lançar e editar (não exclui)","admin|Administrador (tudo, inclusive excluir e configurar)"],
        valor: p.papel || "leitura" },
      { nome:"ativo", rotulo:"Acesso liberado (desmarque para bloquear)", tipo:"checkbox", largo:true, valor: p.ativo ?? true },
      { nome:"_sep_ver", rotulo:"O que pode ver", tipo:"separador", visivelSe: f => f.papel !== "admin" },
      { nome:"ve_financeiro", rotulo:"Dinheiro: saldo, Extrato, Contas e lucro dos Serviços", tipo:"checkbox", largo:true, valor: p.ve_financeiro ?? true, visivelSe: f => f.papel !== "admin" },
      ...Object.entries(NOME_MODULO).filter(([chave]) => !["extrato", "agenda"].includes(chave)).map(([chave, rotulo]) => ({
        nome: "mod_" + chave, rotulo, tipo:"checkbox", valor: modulos[chave] ?? true, visivelSe: f => f.papel !== "admin",
      })),
      ...Object.entries(NOME_MODULO).filter(([chave]) => ["extrato", "agenda"].includes(chave)).map(([chave, rotulo]) => ({
        nome: "mod_" + chave, rotulo, tipo:"checkbox", valor: modulos[chave] ?? true, visivelSe: f => f.papel !== "admin" && f.ve_financeiro,
      })),
      { nome:"_sep_eq", rotulo:"Equipamentos (nenhum marcado = todos)", tipo:"separador", visivelSe: f => f.papel !== "admin" },
      ...dados.equipamentos.map(e => ({
        nome: "equip_" + e.id, rotulo: e.nome, tipo:"checkbox", valor: equipLiberados.has(e.id), visivelSe: f => f.papel !== "admin",
      })),
    ],
    montar(f) {
      if (!f.nome.trim()) throw erroCampo("nome", "Informe o nome.");
      if (souEu && (f.papel !== "admin" || !f.ativo)) {
        throw "Você não pode tirar seu próprio acesso de administrador ou se desativar — peça pra outro admin fazer isso.";
      }
      const mods = {};
      Object.keys(NOME_MODULO).forEach(chave => { mods[chave] = !!f["mod_" + chave]; });
      const equipSelecionados = dados.equipamentos.filter(e => f["equip_" + e.id]).map(e => e.id);
      return {
        nome: f.nome.trim(), papel: f.papel, ativo: !!f.ativo, ve_financeiro: !!f.ve_financeiro,
        modulos: mods, _equipamentosSelecionados: equipSelecionados,
      };
    },
    async aoSalvar(reg) {
      const equipSel = reg._equipamentosSelecionados;
      delete reg._equipamentosSelecionados;

      const btn = $("modal-salvar");
      btn.disabled = true; btn.textContent = "Salvando…";
      const { error } = await sb.from("perfis").update(reg).eq("id", id);
      if (error) {
        btn.disabled = false; btn.textContent = "Editar";
        mostrarErroForm(erroBanco(error));
        return;
      }
      // regrava do zero as liberações de equipamento (mais simples que diff)
      await sb.from("perfis_equipamentos").delete().eq("perfil_id", id);
      if (equipSel.length) {
        await sb.from("perfis_equipamentos").insert(equipSel.map(eid => ({ perfil_id: id, equipamento_id: eid })));
      }
      btn.disabled = false; btn.textContent = "Editar";
      fecharModal();
      toast("Usuário atualizado.");
      await carregarTudo();
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

function anosDaAgenda() {
  const anos = new Set(dados.age.map(a => a.ano));
  anos.add(anoAgenda); anos.add(Number(hoje().slice(0,4)));
  return [...anos].sort((a,b) => b - a);
}
function prepararFiltroAgendaAno() {
  $("age-ano-btn").innerHTML = `${icone("agenda", "icone-sm")}<span>Ano de ${anoAgenda}</span>${icone("chevron-right", "icone-sm btn-periodo-seta")}`;
}
function abrirSeletorAnoAgenda() {
  abrirModal({ titulo: "Ano", tabela: "_ano", folha: true, semSalvar: true,
    corpoCustom: `<div class="chips-periodo">${anosDaAgenda().map(a => `<button type="button" class="chip-periodo ${a === anoAgenda ? "ativo" : ""}" data-ano="${a}">${a}</button>`).join("")}</div>` });
  document.querySelectorAll("#modal-campos [data-ano]").forEach(b => b.addEventListener("click", () => { anoAgenda = Number(b.dataset.ano); fecharModal(); renderAgenda(); }));
}

// Data de vencimento de um item da agenda (dia em texto → data real).
function vencimentoAgenda(a) {
  const d = calcularDataAgenda(a.ano, a.mes, a.dia);
  return d ? isoLocal(d) : `${a.ano}-${String(a.mes).padStart(2, "0")}-01`;
}
// Tudo o que está em aberto (manual ou vindo de abastecimento, manutenção e serviços).
function contasEmAberto() {
  return dados.age.filter(a => a.status_pagamento !== "pago" && a.valor)
    .map(a => ({ ...a, venc: vencimentoAgenda(a) }))
    .sort((x, y) => x.venc.localeCompare(y.venc));
}
const ROTULO_ORIGEM = { diesel: "Abastecimento", manutencoes: "Manutenção", recebimentos: "Horas", servicos: "Serviço" };
function somarDias(iso, n) { const [y, m, d] = iso.split("-").map(Number); return isoLocal(new Date(y, m - 1, d + n)); }

function linhaConta(a, compacta) {
  const hj = hoje();
  const receber = a.valor < 0;
  const atraso = a.venc < hj;
  const quando = a.venc === hj ? "hoje" : a.venc === somarDias(hj, 1) ? "amanhã" : fData(a.venc);
  const podePagar = !a.origem_tabela && meuPapel !== "leitura";
  return `<div class="conta-item ${atraso ? "atrasada" : ""}" role="button" tabindex="0"
      onclick="aoClicarLinha(() => abrirLinhaDaAgenda(${a.id}))" onkeydown="teclaLinha(event)">
    <span class="conta-data ${atraso ? "neg" : ""}">${atraso ? icone("alerta", "icone-sm") + " " : ""}${quando}</span>
    <span class="conta-desc"><b>${escHtml(a.item)}</b>${!compacta ? `<small>${escHtml([ROTULO_ORIGEM[a.origem_tabela] ? "via " + ROTULO_ORIGEM[a.origem_tabela] : a.grupo, contexto.equipamentoId == null && a.equipamento_id ? nomeEquipamento(a.equipamento_id) : ""].filter(Boolean).join(" · "))}</small>` : ""}</span>
    <span class="conta-valor ${receber ? "pos" : ""}">${receber ? "+ " : ""}${brl(Math.abs(a.valor))}</span>
    ${podePagar ? `<button type="button" class="btn-pagar" onclick="event.stopPropagation(); abrirModalBaixaAgenda(${a.id})">${receber ? "Receber" : "Pagar"}</button>` : `<span class="btn-pagar-vazio"></span>`}
  </div>`;
}

function gruposPorVencimento(contas, prefixo) {
  const hj = hoje(), em7 = somarDias(hj, 7), em30 = somarDias(hj, 30);
  const grupos = [
    ["Atrasadas", contas.filter(a => a.venc < hj)],
    ["Próximos 7 dias", contas.filter(a => a.venc >= hj && a.venc <= em7)],
    ["Até 30 dias", contas.filter(a => a.venc > em7 && a.venc <= em30)],
    ["Depois", contas.filter(a => a.venc > em30)],
  ];
  return grupos.filter(([, l]) => l.length).map(([t, l], i) => `
    <h3 class="grupo-titulo">${t} <span>${l.length} · ${brl0(l.reduce((s, a) => s + Math.abs(a.valor), 0))}</span></h3>
    <div class="lista-cartao">${listaComVerMais(prefixo + i, l.map(a => linhaConta(a)), 1)}</div>`).join("");
}
function renderContasLista() {
  const hj = hoje(), em7 = somarDias(hj, 7);
  const contas = contasEmAberto().filter(a => a.valor > 0 && dentroDe(a.venc, filtroContasPeriodo));
  const soma = (l) => l.reduce((t, a) => t + a.valor, 0);
  $("age-lista").innerHTML = `
    <div class="resumo-contas">
      <div class="resumo-contas-item ${soma(contas.filter(a => a.venc < hj)) ? "neg" : ""}"><span>Atrasado</span><b>${brl0(soma(contas.filter(a => a.venc < hj)))}</b></div>
      <div class="resumo-contas-item"><span>Em 7 dias</span><b>${brl0(soma(contas.filter(a => a.venc >= hj && a.venc <= em7)))}</b></div>
      <div class="resumo-contas-item"><span>Total a pagar</span><b>${brl0(soma(contas))}</b></div>
    </div>
    ${contas.length ? gruposPorVencimento(contas, "pagar-") : `<div class="vazio-bonito">${icone("check")}<b>Nada a pagar</b><span>Nenhuma conta em aberto neste período.</span></div>`}`;
}

// A receber: contas a receber em aberto + o que os serviços em andamento vão cobrar
function renderReceber() {
  const el = $("rcb-lista");
  if (!el) return;
  const hj = hoje();
  const contas = contasEmAberto().filter(a => a.valor < 0 && dentroDe(a.venc, filtroReceberPeriodo));
  const servs = (dados.servicos || []).filter(sv => sv.status === "andamento" && (contexto.equipamentoId == null || sv.equipamento_id == null || sv.equipamento_id === contexto.equipamentoId))
    .map(sv => ({ sv, r: resumoServico(sv) })).filter(x => x.r.aReceber > 0.5);
  const soma = (l) => l.reduce((t, a) => t + Math.abs(a.valor), 0);
  const totServ = servs.reduce((t, x) => t + x.r.aReceber, 0);
  el.innerHTML = `
    <div class="resumo-contas">
      <div class="resumo-contas-item ${soma(contas.filter(a => a.venc < hj)) ? "neg" : ""}"><span>Atrasado</span><b>${brl0(soma(contas.filter(a => a.venc < hj)))}</b></div>
      <div class="resumo-contas-item pos"><span>Contas a receber</span><b>${brl0(soma(contas))}</b></div>
      <div class="resumo-contas-item"><span>Serviços em andamento</span><b>${brl0(totServ)}</b></div>
    </div>
    ${contas.length ? gruposPorVencimento(contas, "receber-") : ""}
    ${servs.length ? `<h3 class="grupo-titulo">Serviços em andamento <span>${servs.length} · ${brl0(totServ)}</span></h3>
      <div class="lista-cartao">${listaComVerMais("receber-serv", servs.map(({ sv, r }) => `
        <div class="registro-item" role="button" tabindex="0" onclick="abrirDetalheServico(${sv.id})" onkeydown="teclaLinha(event)">
          <span class="registro-icone" style="--cor-tile:#4EC9D4">${icone("servico")}</span>
          <span class="registro-texto"><b>${escHtml(sv.nome)}</b><small>${escHtml(sv.cliente || "")}</small></span>
          <span class="registro-data pos">${brl(r.aReceber)}</span>
        </div>`), 1)}</div>` : ""}
    ${!contas.length && !servs.length ? `<div class="vazio-bonito">${icone("check")}<b>Nada a receber</b><span>Nenhuma conta a receber neste período.</span></div>` : ""}`;
}

// Cartão "Vence em breve" do painel do gestor
function renderVencimentosPainel() {
  const el = $("pnl-vencimentos");
  if (!el) return;
  const hj = hoje(), em7 = somarDias(hj, 7);
  const prox = contasEmAberto().filter(a => a.venc <= em7);
  const atrasadas = prox.filter(a => a.venc < hj).length;
  el.innerHTML = `
    <div class="cartao-cabeca">
      <h2 class="titulo-risco"><span>Vence em breve</span></h2>
      <button type="button" class="btn-link" onclick="irPara('agenda')">Ver todas</button>
    </div>
    <p class="cartao-nota">${prox.length ? `${prox.length} conta${prox.length > 1 ? "s" : ""} até ${fData(em7)}${atrasadas ? ` · <span class="neg">${atrasadas} atrasada${atrasadas > 1 ? "s" : ""}</span>` : ""}` : "nenhuma conta vencendo nos próximos 7 dias"}</p>
    <div class="lista-cartao lista-compacta">${listaComVerMais("vencimentos", prox.map(a => linhaConta(a, true)), 1)}</div>`;
}

function renderAgenda() {
  const anual = modoAgenda === "ano";
  $("age-lista").classList.toggle("oculto", anual);
  $("age-anual").classList.toggle("oculto", !anual);
  $("age-periodo-slot").classList.toggle("oculto", anual);
  $("age-ano-btn").classList.toggle("oculto", !anual);
  renderReceber();
  renderContasLista();
  if (!anual) return;
  prepararFiltroAgendaAno();
  const doAno = dados.age.filter(a => a.ano === anoAgenda);
  const meses = [...new Set(doAno.map(a => a.mes))].sort((a,b) => a-b);
  const porItem = {};
  for (const a of doAno) {
    // compromissos espelhados (Diesel/Manutenção "a pagar") se agrupam numa
    // única linha por item, ignorando o dia individual de cada um — o
    // detalhamento por abastecimento/manutenção aparece ao clicar.
    const agregado = !!a.origem_tabela;
    const chave = agregado ? ("§AGREGADO§" + a.item) : (a.item + "§" + a.dia);
    if (!porItem[chave]) porItem[chave] = { item: a.item, dia: agregado ? "vários" : a.dia, valores: {}, idsPorMes: {}, pagos: {}, origem: a.origem_tabela, agregado };
    porItem[chave].valores[a.mes] = (porItem[chave].valores[a.mes] || 0) + a.valor;
    (porItem[chave].idsPorMes[a.mes] = porItem[chave].idsPorMes[a.mes] || []).push(a.id);
    if (!agregado) porItem[chave].pagos[a.mes] = a.status_pagamento === "pago";
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

  $("age-corpo").innerHTML = itens.map(i => {
    const rotuloOrigem = i.origem === "diesel" ? "via Abastecimento" : i.origem === "manutencoes" ? "via Manutenção" : i.origem === "recebimentos" ? "via Recebimentos" : "";
    const qtdTotal = Object.values(i.idsPorMes).reduce((s,arr) => s + arr.length, 0);
    return `<tr class="linha-clicavel" data-item="${escHtml(i.item)}" data-dia="${escHtml(i.dia)}" data-agregado="${i.agregado ? "1" : "0"}">
      <td class="col-fixa td-desc">${escHtml(i.item)}${rotuloOrigem ? `<div class="td-natureza">${rotuloOrigem}${qtdTotal>1 ? " · " + qtdTotal + " itens" : ""}</div>` : ""}</td>
      <td class="num td-mudo">${escHtml(i.dia) || "—"}</td>
      ${meses.map(m => {
        const v = i.valores[m];
        const classe = !v ? "td-zero" : i.pagos[m] ? "pago" : v < 0 ? "pos" : "";
        return v
          ? `<td class="num cel-mes ${classe}" data-mes="${m}" title="Ver ${MESES[m-1]}">${num(v,0)}</td>`
          : `<td class="num ${classe}">·</td>`;
      }).join("")}
      <td class="num td-total">${brl0(i.total)}</td>
    </tr>`;
  }).join("") +
    (itens.length ? `<tr class="linha-total">
      <td class="col-fixa">Total do mês</td><td></td>
      ${totaisMes.map(t => `<td class="num">${num(t,0)}</td>`).join("")}
      <td class="num td-total">${brl0(totalGeral)}</td>
    </tr>` : `<tr><td colspan="${meses.length+3}" class="vazio">Nenhum compromisso em ${anoAgenda}.</td></tr>`);
}

// clicar num compromisso: escolhe o mês a editar via modal
function abrirModalAgendaItem(item, dia, agregado) {
  if (meuPapel === "leitura") { toast("Seu acesso é somente leitura."); return; }
  const linhas = agregado
    ? dados.age.filter(a => a.item === item && a.origem_tabela && a.ano === anoAgenda)
    : dados.age.filter(a => a.item === item && a.dia === dia && a.ano === anoAgenda);
  if (!linhas.length) return;

  // agrupa por mês — cada mês pode ter 1 ou vários itens (ex.: 2 abastecimentos no mesmo mês)
  const porMes = {};
  linhas.forEach(a => { (porMes[a.mes] = porMes[a.mes] || []).push(a); });
  const meses = Object.keys(porMes).map(Number).sort((a,b) => a-b);

  if (meses.length === 1) { abrirGrupoAgendaDoMes(porMes[meses[0]]); return; }

  _agendaPorMesAtual = porMes;
  const html = meses.map(m => {
    const grupo = porMes[m];
    const total = grupo.reduce((s,a) => s+a.valor, 0);
    return `<button type="button" class="detalhe-linha" onclick="fecharModal(); abrirMesDaAgenda(${m})">
      <span>${MESES[m-1]}${grupo.length > 1 ? " · " + grupo.length + " itens" : ""}</span>
      <b>${brl0(total)}</b>
    </button>`;
  }).join("");
  abrirModal({
    titulo: "Compromisso: " + item,
    tabela: "_escolha_agenda",
    corpoCustom: `<div class="detalhe-lista">${html}</div>`,
    semSalvar: true,
  });
}

// Clique direto numa célula da matriz (item × mês específico): mesma
// filtragem de linhas do abrirModalAgendaItem acima, só que já restrita
// ao mês clicado — pula o modal "escolha o mês" e cai direto no que
// abrirModalAgendaItem cairia DEPOIS de escolher esse mês (1 item resolve
// na hora, vários abrem a lista do mês). Não duplica regra nenhuma de
// baixa/estorno/sincronização — só entra mais cedo na mesma cadeia.
function abrirCelulaAgendaMes(item, dia, agregado, mes) {
  if (meuPapel === "leitura") { toast("Seu acesso é somente leitura."); return; }
  const linhas = agregado
    ? dados.age.filter(a => a.item === item && a.origem_tabela && a.ano === anoAgenda && a.mes === mes)
    : dados.age.filter(a => a.item === item && a.dia === dia && a.ano === anoAgenda && a.mes === mes);
  if (!linhas.length) return;
  abrirGrupoAgendaDoMes(linhas);
}

let _agendaPorMesAtual = null;
function abrirMesDaAgenda(mes) {
  if (!_agendaPorMesAtual) return;
  abrirGrupoAgendaDoMes(_agendaPorMesAtual[mes]);
}

// Um item só nesse mês: resolve direto. Vários (ex.: 2 abastecimentos a
// pagar no mesmo mês): mostra a lista pra escolher qual abrir.
function abrirGrupoAgendaDoMes(grupo) {
  if (grupo.length === 1) { abrirLinhaDaAgenda(grupo[0].id); return; }
  const ordenado = grupo.slice().sort((a,b) => (a.dia || "").localeCompare(b.dia || "", "pt", { numeric: true }));
  const html = ordenado.map(a => {
    const origemTxt = a.origem_tabela === "diesel" ? "Abastecimento" : a.origem_tabela === "manutencoes" ? "Manutenção" : a.origem_tabela === "recebimentos" ? "Recebimentos" : "";
    return `<button type="button" class="detalhe-linha" onclick="fecharModal(); abrirLinhaDaAgenda(${a.id})">
      <span>${a.dia ? "dia " + escHtml(a.dia) : ""}${origemTxt ? (a.dia ? " · " : "") + origemTxt : ""}</span>
      <b>${brl0(a.valor)}</b>
    </button>`;
  }).join("");
  abrirModal({
    titulo: `${grupo.length} itens — ${MESES[grupo[0].mes-1]}`,
    tabela: "_detalhe_agenda",
    corpoCustom: `<div class="detalhe-lista">${html}</div>`,
    semSalvar: true,
  });
}

// Se o compromisso foi criado automaticamente pelo Diesel/Manutenção (é um
// "espelho" de um item a pagar), editar tem que ser feito lá — senão a
// próxima sincronização sobrescreve. Compromissos criados manualmente
// seguem pro seletor normal (Baixar / Editar).
function abrirLinhaDaAgenda(id) {
  const a = dados.age.find(x => x.id === id);
  if (!a) return;
  if (a.origem_tabela === "diesel") { abrirModalDiesel(a.origem_id); return; }
  if (a.origem_tabela === "manutencoes") { abrirModalManutencao(a.origem_id); return; }
  if (a.origem_tabela === "recebimentos") { abrirModalRecebimento(a.origem_id); return; }
  if (a.origem_tabela === "servicos") { abrirDetalheServico(a.origem_id); return; }
  abrirModalEscolhaAcaoAgenda(id);
}

// Seletor BAIXAR / EDITAR — aparece antes de abrir o formulário completo,
// já que na maioria das vezes o que se quer fazer é só dar baixa.
function abrirModalEscolhaAcaoAgenda(id) {
  const a = dados.age.find(x => x.id === id);
  if (!a) return;
  const jaPago = a.status_pagamento === "pago";
  const receber = a.valor < 0;
  const html = `<div class="acao-botoes">
    <button type="button" class="acao-botao acao-destaque" onclick="fecharModal(); abrirModalBaixaAgenda(${id})">
      <span class="acao-titulo">${jaPago ? "Desfazer" : receber ? "Confirmar recebimento" : "Pagar"}</span>
      <span class="acao-sub">${jaPago ? "volta para em aberto e tira do Extrato" : receber ? "o dinheiro entrou" : "o dinheiro saiu"}</span>
    </button>
    <button type="button" class="acao-botao" onclick="fecharModal(); abrirModalAgenda(${id})">
      <span class="acao-titulo">Editar</span>
      <span class="acao-sub">valor, vencimento, descrição</span>
    </button>
  </div>`;
  abrirModal({
    titulo: a.item,
    tabela: "_acao_agenda",
    corpoCustom: html,
    semSalvar: true,
  });
}

// Mini formulário só pra dar baixa (ou estornar) — sem precisar abrir o
// formulário completo de edição.
function abrirModalBaixaAgenda(id) {
  const a = dados.age.find(x => x.id === id);
  if (!a) return;
  const jaPago = a.status_pagamento === "pago";
  const receber = a.valor < 0;
  abrirModal({
    titulo: (jaPago ? "Desfazer: " : receber ? "Receber: " : "Pagar: ") + a.item,
    tabela: "_baixa_agenda",
    rotuloSalvar: jaPago ? "Voltar para em aberto" : receber ? "Confirmar recebimento" : "Confirmar pagamento",
    campos: jaPago ? [{ tipo:"info", texto:`O lançamento de ${brl(Math.abs(a.valor))} sai do Extrato e a conta volta a ficar em aberto.` }] : [
      { tipo:"info", texto:`${receber ? "Valor a receber" : "Valor a pagar"}: ${brl(Math.abs(a.valor))}` },
      { nome:"data_pagamento", rotulo: receber ? "Data do recebimento" : "Data do pagamento", tipo:"date", valor: hoje() },
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

function abrirModalAgenda(id, tipoNovo) {
  const a = id ? dados.age.find(x => x.id === id) : null;
  const tipo = a ? (a.valor < 0 ? "receber" : "pagar") : (tipoNovo || "pagar");
  const ehPagar = (f) => f._tipo === "pagar";
  const grupos = opcoesGrupoDespesa();
  const campos = [
    { nome:"_tipo", rotulo:"É uma conta…", tipo:"select", largo:true, opcoes:["pagar|A pagar (vai sair dinheiro)","receber|A receber (vai entrar dinheiro)"], valor: tipo },
    { nome:"item", rotulo:"Descrição", tipo:"texto", largo:true, valor: a?.item || "", obrigatorio:true },
    { nome:"valor", rotulo:"Valor (R$)", tipo:"moeda", valor: a ? Math.abs(a.valor) : "", obrigatorio:true },
    { nome:"vencimento", rotulo:"Vencimento", tipo:"date", valor: a ? vencimentoAgenda(a) : hoje(), obrigatorio:true },
    { nome:"grupo", rotulo:"Categoria (vai para o Extrato)", tipo:"select", opcoes: grupos, valor: a?.grupo && a.grupo !== "Recebimentos" ? a.grupo : (grupos.includes("Outras despesas") ? "Outras despesas" : grupos[0]), visivelSe: ehPagar },
    { nome:"natureza", rotulo:"Tipo de custo", tipo:"select", opcoes:["Fixo|Custo fixo","Variavel|Custo variável","Investimento|Investimento"], valor: a?.natureza && a.natureza !== "Receita" ? a.natureza : "Fixo", visivelSe: ehPagar },
    { nome:"equipamento_id", rotulo:"Equipamento", tipo:"select", opcoes: opcoesEquipamento(true), valor: equipamentoPadrao(a?.equipamento_id, true) },
    { nome:"status_pagamento", rotulo:"Situação", tipo:"select", opcoes:["pendente|Em aberto","pago|Já foi paga / recebida"], valor: a?.status_pagamento || "pendente" },
    { nome:"data_pagamento", rotulo:"Data do pagamento", tipo:"date", valor: a?.data_pagamento || hoje(), visivelSe: f => f.status_pagamento === "pago" },
  ];
  if (!id) {
    campos.push({ nome:"replicarMeses", rotulo:"Repete todo mês? Quantos meses a mais (0 = não repete)", tipo:"numero", largo:true, valor: 0 });
  }

  abrirModal({
    titulo: a ? "Editar conta" : tipo === "receber" ? "Nova conta a receber" : "Nova conta a pagar",
    tabela: "agenda", id,
    tituloExclusao: a ? `a conta "${a.item}"` : null,
    avisoExcluir: a && a.lancamento_id ? "Isso também remove o lançamento vinculado no Extrato." : null,
    campos,
    montar(f) {
      if (!f.item.trim()) throw erroCampo("item", "Informe a descrição da conta.");
      const v = numDeMoeda(f.valor);
      if (!v || v <= 0) throw erroCampo("valor", "Informe um valor maior que zero.");
      if (!f.vencimento) throw erroCampo("vencimento", "Informe o vencimento.");
      if (f.status_pagamento === "pago" && !f.data_pagamento) throw erroCampo("data_pagamento", "Informe a data do pagamento.");
      const [ano, mes, dia] = f.vencimento.split("-").map(Number);
      const pagar = ehPagar(f);
      return {
        item: f.item.trim(), equipamento_id: f.equipamento_id ? Number(f.equipamento_id) : null,
        grupo: pagar ? f.grupo : "Recebimentos", ano, dia: String(dia), mes, valor: pagar ? v : -v,
        natureza: pagar ? f.natureza : "Receita", centro_custo_id: a?.centro_custo_id ?? null,
        status_pagamento: f.status_pagamento, data_pagamento: f.status_pagamento === "pago" ? f.data_pagamento : null,
        _replicarMeses: id ? 0 : Math.max(0, Math.min(60, Number(f.replicarMeses) || 0)),
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
    ({ data: salvos, error } = await sb.from("agenda").insert(marcarBase(linhas)).select());
  }
  btn.disabled = false; btn.textContent = id ? "Editar" : "Salvar";
  if (error) {
    mostrarErroForm(erroBanco(error));
    return;
  }

  // sempre gera (ou atualiza) a movimentação no extrato — em aberto entra
  // como pendente (aparece desde a criação do compromisso, não só na
  // baixa), dar baixa muda pra pago; exatamente como Diesel/Manutenção.
  for (const s of salvos || []) {
    const linkAtual = id ? lancamentoIdExistente : null;
    const tipo = s.valor >= 0 ? "saida" : "entrada";
    const dataVencimento = calcularDataAgenda(s.ano, s.mes, s.dia);
    const dataLancamento = s.data_pagamento || (dataVencimento ? isoLocal(dataVencimento) : hoje());
    try {
      await sincronizarLancamento({
        origemId: s.id, tabelaOrigem: "agenda", lancamentoId: linkAtual,
        valor: Math.abs(s.valor), tipo, status: s.status_pagamento,
        data: dataLancamento,
        grupo: s.grupo || "Outras despesas", descricao: s.item,
        natureza: s.natureza, centroCustoId: s.centro_custo_id, equipamentoId: s.equipamento_id,
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
  $("modal-fundo").classList.toggle("modal-folha", !!ctx.folha || !!ctx.corpoCustom);
  marcarModalNoHistorico();
  $("modal-titulo").textContent = ctx.titulo;
  $("modal-titulo").classList.toggle("modal-titulo-perigo", !!ctx.tituloPerigo);
  $("modal-erro").classList.add("oculto");

  if (ctx.corpoCustom) {
    // corpo em HTML livre (ex.: lista de itens clicáveis) em vez de formulário
    $("modal-campos").innerHTML = ctx.corpoCustom;
  } else {
  $("modal-campos").innerHTML = ctx.campos.map(c => {
    const largo = (c.largo ? "form-larga " : "") + (c.oculto ? "oculto " : "");
    const dataGrupo = c.grupoCondicional ? `data-grupo-cond="${c.grupoCondicional}"` : "";
    if (c.tipo === "separador") {
      return `<div class="form-separador form-larga ${c.oculto ? "oculto" : ""}" ${dataGrupo} data-sep="${escHtml(c.nome || "")}">${c.rotulo}</div>`;
    }
    if (c.tipo === "info") {
      return `<div class="form-info form-larga">${escHtml(c.texto)}${c.acaoId
        ? ` <button type="button" class="btn-link" data-abrir-par="${c.acaoId}">${escHtml(c.acaoRotulo || "Abrir")}</button>` : ""}</div>`;
    }
    if (c.tipo === "checkbox") {
      return `<label class="campo-checkbox ${largo}" ${dataGrupo}>
        <input type="checkbox" data-campo="${c.nome}" ${c.valor ? "checked" : ""}> ${c.rotulo}</label>`;
    }
    if (c.tipo === "select") {
      const ops = c.opcoes.map(o => {
        const [val, rot] = String(o).includes("|") ? o.split("|") : [o, o];
        return `<option value="${escHtml(val)}" ${String(c.valor) === String(val) ? "selected" : ""}>${escHtml(rot)}</option>`;
      }).join("");
      return `<label class="${largo}" ${dataGrupo}>${c.rotulo}<select data-campo="${c.nome}">${ops}</select></label>`;
    }
    if (c.tipo === "moeda") {
      return `<label class="${largo}" ${dataGrupo}>${c.rotulo}
        <input type="text" inputmode="decimal" data-campo="${c.nome}" data-moeda="1" data-negativo="${c.negativo ? 1 : 0}" value="${escHtml(moedaMascara(c.valor))}">
      </label>`;
    }
    // campo só de leitura, preenchido por código (ex.: desconto e preço
    // final do litro no abastecimento) — disabled pra não parecer editável
    if (c.tipo === "calculado") {
      return `<label class="${largo}" ${dataGrupo}>${c.rotulo}
        <input type="text" disabled class="campo-calculado" data-campo="${c.nome}" value="${escHtml(c.valor)}">
      </label>`;
    }
    // anexo (foto ou PDF) — o arquivo só sobe quando o registro é salvo;
    // se já existe um anexo, dá pra abrir ou marcar pra remover
    if (c.tipo === "arquivo") {
      const atual = c.atual
        ? `<div class="arquivo-atual">
            <button type="button" class="btn-link" data-ver-arquivo="${escHtml(c.atual)}">📎 Ver arquivo atual</button>
            <label class="campo-checkbox"><input type="checkbox" data-campo="${c.nome}_remover"> Remover</label>
          </div>` : "";
      return `<div class="campo-arquivo ${largo}" ${dataGrupo}>
        <label>${c.rotulo}<input type="file" accept="image/*,application/pdf" data-campo="${c.nome}"></label>
        <div class="arquivo-status oculto" data-status-arquivo="${c.nome}"></div>
        ${atual}
      </div>`;
    }
    const tipo = c.tipo === "date" ? "date" : c.tipo === "numero" ? "number" : c.tipo === "senha" ? "password" : "text";
    const extra = c.tipo === "numero" ? 'step="any" inputmode="decimal"' : "";
    // autocompletar: lista própria que desce assim que o campo ganha foco
    // ou começa a digitar (funciona igual no celular, onde o datalist
    // nativo é inconsistente). Sem a opção, segue o datalist de sempre.
    if (c.autocompletar && c.lista) {
      return `<label class="campo-auto ${largo}" ${dataGrupo}>${c.rotulo}
        <input type="${tipo}" autocomplete="off" data-campo="${c.nome}" value="${escHtml(c.valor)}">
        <ul class="sugestoes oculto" role="listbox"></ul></label>`;
    }
    const listaId = c.lista ? `lista-${c.nome}` : "";
    const listaHtml = c.lista
      ? `<datalist id="${listaId}">${c.lista.map(v => `<option value="${escHtml(v)}">`).join("")}</datalist>` : "";
    return `<label class="${largo}" ${dataGrupo}>${c.rotulo}
      <input type="${tipo}" ${extra} data-campo="${c.nome}" value="${escHtml(c.valor)}" ${c.lista ? `list="${listaId}"` : ""}>
      ${listaHtml}</label>`;
  }).join("");

  // aplica a máscara monetária nos campos "moeda" (formata a cada tecla e
  // absorve ponto/vírgula digitados — quem manda é o dígito, não o separador)
  document.querySelectorAll('#modal-campos [data-moeda]').forEach(ligarMascaraMoeda);

  // marca os obrigatórios com * e tira o aviso vermelho assim que o campo é mexido
  ctx.campos.forEach(c => {
    if (!c.obrigatorio || !c.nome) return;
    const el = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    if (!el) return;
    const rot = el.closest("label");
    if (rot && !rot.querySelector(".req-marca")) {
      const marca = document.createElement("span");
      marca.className = "req-marca"; marca.textContent = " *";
      const texto = [...rot.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (texto) {
        const span = document.createElement("span");
        span.className = "rotulo-texto";
        span.textContent = texto.textContent.trim();
        span.appendChild(marca);
        rot.replaceChild(span, texto);
      } else rot.insertBefore(marca, el);
    }
    const limpar = () => limparObrigatorio(el);
    el.addEventListener("input", limpar);
    el.addEventListener("change", limpar);
  });

  // hooks de campo (ex.: autopreencher valor de hora ao escolher o cliente,
  // mostrar/esconder o carro de apoio conforme o equipamento escolhido)
  ctx.campos.forEach(c => {
    if (!c.aoMudar) return;
    const el = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    if (!el) return;
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => c.aoMudar(el.value));
  });

  // checkbox que mostra/esconde um grupo de campos (ex.: "houve carro de
  // apoio?" revela os campos do carro)
  ctx.campos.forEach(c => {
    if (c.tipo !== "checkbox" || !c.controla) return;
    const chk = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    if (!chk) return;
    const aplicar = () => {
      document.querySelectorAll(`#modal-campos [data-grupo-cond="${c.controla}"]`)
        .forEach(el => el.classList.toggle("oculto", !chk.checked));
    };
    chk.addEventListener("change", aplicar);
    aplicar();
  });

  // campos que só aparecem conforme outro campo (ex.: "Categoria" só em despesa,
  // "Data do pagamento" só se já foi pago) — reavalia a cada mudança no formulário
  const mc = $("modal-campos");
  if (mc._visivel) { mc.removeEventListener("input", mc._visivel); mc.removeEventListener("change", mc._visivel); mc._visivel = null; }
  const condicionais = ctx.campos.filter(c => c.visivelSe);
  if (condicionais.length) {
    mc._visivel = () => {
      const f = lerFormulario();
      condicionais.forEach(c => {
        const alvo = c.tipo === "separador"
          ? mc.querySelector(`[data-sep="${c.nome}"]`)
          : mc.querySelector(`[data-campo="${c.nome}"]`)?.closest("label, .campo-arquivo");
        if (alvo) alvo.classList.toggle("oculto", !c.visivelSe(f));
      });
    };
    mc.addEventListener("input", mc._visivel);
    mc.addEventListener("change", mc._visivel);
    mc._visivel();
  }

  ctx.campos.forEach(c => {
    if (!c.autocompletar || !c.lista) return;
    const el = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    if (el) ligarAutocompletar(el, c.lista);
  });
  document.querySelectorAll("#modal-campos [data-abrir-par]").forEach(b =>
    b.addEventListener("click", () => { const alvo = Number(b.dataset.abrirPar); fecharModal(); abrirModalDiesel(alvo); }));
  document.querySelectorAll("#modal-campos [data-ver-arquivo]").forEach(b =>
    b.addEventListener("click", () => abrirAnexo(b.dataset.verArquivo)));

  // campo de arquivo com leitura automática (ex.: QR da nota fiscal): chama
  // o aoEscolher(arquivo, mostrar) assim que um arquivo é escolhido; "mostrar"
  // escreve a mensagem de status logo abaixo do campo.
  ctx.campos.forEach(c => {
    if (c.tipo !== "arquivo" || !c.aoEscolher) return;
    const el = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    const st = document.querySelector(`#modal-campos [data-status-arquivo="${c.nome}"]`);
    if (!el || !st) return;
    const mostrar = (texto, tom) => {
      st.textContent = texto || "";
      st.className = "arquivo-status" + (texto ? " " + (tom || "") : " oculto");
    };
    el.addEventListener("change", () => c.aoEscolher(el.files[0] || null, mostrar));
  });
  }

  const btnExcluir = $("modal-excluir");
  btnExcluir.classList.toggle("oculto", !(ctx.id || ctx.mostrarExcluir) || !!ctx.semExcluir);
  btnExcluir.disabled = false;
  btnExcluir.textContent = "Excluir";
  btnExcluir.onclick = ctx.aoExcluirClique ? ctx.aoExcluirClique : () => excluirRegistro();
  $("modal-salvar").classList.toggle("oculto", !!ctx.semSalvar);
  $("modal-salvar").textContent = ctx.rotuloSalvar || "Salvar";
  $("modal-cancelar").classList.toggle("oculto", !!ctx.semSalvar);
  $("modal-fundo").classList.toggle("modal-sem-acoes", !!ctx.semSalvar && !(ctx.id || ctx.mostrarExcluir));
  $("modal-salvar").onclick = () => salvarRegistro();
  $("modal-fundo").classList.remove("oculto");

  // autofoco no primeiro campo do formulário (ou primeiro botão, nos
  // modais de corpoCustom — escolha de mês/ação da Agenda etc.), pra quem
  // usa teclado não precisar clicar antes de digitar/navegar.
  requestAnimationFrame(() => {
    // no celular, focar abre o teclado por cima do formulário — só foca no desktop
    if (telaCombina("(pointer: coarse)")) return;
    const primeiro = $("modal-campos").querySelector(
      'input:not([type="hidden"]):not(:disabled), select:not(:disabled), button:not(:disabled)'
    );
    if (primeiro) primeiro.focus({ preventScroll: true });
  });
}

function fecharModal() {
  $("modal-fundo").classList.add("oculto");
  const t = $("toast"); if (t.classList.contains("toast-erro")) t.classList.add("oculto");
  modalCtx = null;
  desmarcarModalNoHistorico();
}

// Lista de sugestões que desce sob o campo de texto: filtra pelo que foi
// digitado (sem diferenciar maiúsculas/acentos), setas + Enter escolhem,
// Esc fecha só a lista. Continua sendo texto livre — digitar um nome novo
// funciona normalmente (e, no abastecimento, ele é cadastrado ao salvar).
function semAcento(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function ligarAutocompletar(input, lista) {
  const ul = input.parentElement.querySelector(".sugestoes");
  if (!ul) return;
  let itens = [], ativo = -1;
  const fechar = () => { ul.classList.add("oculto"); ativo = -1; };
  const marcar = () => ul.querySelectorAll("li").forEach((li, i) => li.classList.toggle("ativo", i === ativo));
  const escolher = (valor) => { input.value = valor; fechar(); };
  const abrir = () => {
    const q = semAcento(input.value.trim());
    itens = lista.filter(n => !q || semAcento(n).includes(q)).slice(0, 8);
    if (!itens.length || (itens.length === 1 && semAcento(itens[0]) === q)) { fechar(); return; }
    ul.innerHTML = itens.map((n, i) => `<li role="option" data-i="${i}">${escHtml(n)}</li>`).join("");
    ativo = -1;
    ul.classList.remove("oculto");
  };
  input.addEventListener("input", abrir);
  input.addEventListener("focus", abrir);
  input.addEventListener("blur", fechar);
  // mousedown (não click) + preventDefault: escolhe antes do campo perder o foco
  ul.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    const li = ev.target.closest("li");
    if (li) escolher(itens[Number(li.dataset.i)]);
  });
  input.addEventListener("keydown", (ev) => {
    const aberta = !ul.classList.contains("oculto");
    if (!aberta) { if (ev.key === "ArrowDown") { ev.preventDefault(); abrir(); } return; }
    if (ev.key === "ArrowDown") { ev.preventDefault(); ativo = (ativo + 1) % itens.length; marcar(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; marcar(); }
    else if (ev.key === "Enter" && ativo >= 0) { ev.preventDefault(); ev.stopPropagation(); escolher(itens[ativo]); }
    else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); fechar(); }
  });
}

/* ═══════════ ANEXOS (Supabase Storage) ═══════════
   Comprovantes e notas ficam num bucket PRIVADO ("comprovantes", criado
   pelo correcoes_v22.sql). No banco guardamos só o caminho; pra abrir, o
   sistema pede um link temporário assinado (vale 5 minutos). */
const BUCKET_ANEXOS = "comprovantes";
const TAMANHO_MAX_ANEXO = 10 * 1024 * 1024; // 10 MB

function validarAnexo(arquivo, rotulo) {
  if (!arquivo) return;
  if (arquivo.size > TAMANHO_MAX_ANEXO) throw `${rotulo}: o arquivo passa de 10 MB.`;
  const ok = arquivo.type.startsWith("image/") || arquivo.type === "application/pdf";
  if (!ok) throw `${rotulo}: envie uma foto (JPG/PNG) ou um PDF.`;
}
async function enviarAnexo(pasta, arquivo) {
  const nome = semAcento(arquivo.name).replace(/[^a-z0-9._-]+/g, "_").slice(-80);
  const caminho = `${pasta}/${crypto.randomUUID()}-${nome}`;
  const { error } = await sb.storage.from(BUCKET_ANEXOS).upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
  if (error) throw error;
  return caminho;
}
async function removerAnexo(caminho) {
  if (!caminho) return;
  try { await sb.storage.from(BUCKET_ANEXOS).remove([caminho]); }
  catch (e) { console.error("Falha ao remover anexo:", e); }
}
async function abrirAnexo(caminho) {
  // abre a aba antes do await, senão o navegador bloqueia como pop-up
  const aba = window.open("", "_blank");
  const { data, error } = await sb.storage.from(BUCKET_ANEXOS).createSignedUrl(caminho, 300);
  if (error || !data) {
    if (aba) aba.close();
    console.error("Falha ao abrir anexo:", error);
    alertaErro("O arquivo não abriu. Confira a internet e tente de novo.", "Não deu para abrir o anexo");
    return;
  }
  if (aba) aba.location.href = data.signedUrl; else window.open(data.signedUrl, "_blank");
}

function lerFormulario() {
  const f = {};
  document.querySelectorAll("#modal-campos [data-campo]").forEach(el => {
    f[el.dataset.campo] = el.type === "checkbox" ? el.checked : el.value;
  });
  return f;
}

// mensagem que o aposSalvar() pode deixar pra aparecer no lugar do "Registro
// criado/atualizado" (que senão cobriria na hora qualquer aviso de falha)
let avisoAposSalvar = null;

// Campos com `obrigatorio: true` (ou uma função (f) => boolean, p/ obrigatório
// só em certas situações) piscam em vermelho com "Campo obrigatório" quando
// ficam vazios. Campos escondidos (ex.: carro de apoio desligado) são ignorados.
function limparObrigatorio(el) {
  const rot = el.closest("label");
  if (!rot) return;
  rot.classList.remove("campo-invalido");
  const m = rot.querySelector(".msg-obrigatorio");
  if (m) m.classList.add("oculto");
}
// campo dentro de um grupo escondido do formulário (o próprio modal não conta)
function escondidoNoForm(el) {
  const raiz = $("modal-campos");
  for (let n = el; n && n !== raiz; n = n.parentElement) if (n.classList.contains("oculto")) return true;
  return false;
}
function validarObrigatorios() {
  const ctx = modalCtx;
  if (!ctx || !ctx.campos) return true;
  const f = lerFormulario();
  let primeiro = null;
  for (const c of ctx.campos) {
    if (!c.obrigatorio || !c.nome) continue;
    if (typeof c.obrigatorio === "function" && !c.obrigatorio(f)) continue;
    const el = document.querySelector(`#modal-campos [data-campo="${c.nome}"]`);
    if (!el || escondidoNoForm(el)) continue;
    const vazio = el.hasAttribute("data-moeda") ? !(numDeMoeda(el.value) > 0) : String(el.value).trim() === "";
    if (!vazio) continue;
    const rot = el.closest("label");
    if (!rot) continue;
    let m = rot.querySelector(".msg-obrigatorio");
    if (!m) { m = document.createElement("span"); m.className = "msg-obrigatorio"; m.textContent = "Campo obrigatório"; rot.appendChild(m); }
    m.classList.remove("oculto");
    rot.classList.remove("campo-invalido");
    void rot.offsetWidth; // reinicia a animação de piscar
    rot.classList.add("campo-invalido");
    if (!primeiro) primeiro = el;
  }
  if (!primeiro) return true;
  if (primeiro.scrollIntoView) primeiro.scrollIntoView({ block: "center", behavior: "smooth" });
  primeiro.focus({ preventScroll: true });
  toast("Preencha os campos destacados em vermelho.", "erro");
  return false;
}

async function salvarRegistro() {
  if (!modalCtx) return;
  const btn = $("modal-salvar"), erro = $("modal-erro");
  erro.classList.add("oculto");
  avisoAposSalvar = null;
  if (!validarObrigatorios()) return;
  let reg;
  try { reg = modalCtx.montar(lerFormulario()); }
  catch (e) { if (e instanceof Error) console.error(e); mostrarErroForm(e); return; }
  if (modalCtx.antesDeSalvar) {
    btn.disabled = true;
    let barrar = null;
    try { barrar = await modalCtx.antesDeSalvar(reg); } catch (e) { console.error(e); }
    btn.disabled = false;
    if (barrar) { mostrarErroForm(barrar); return; }
  }

  if (modalCtx.aoSalvar) { await modalCtx.aoSalvar(reg); return; }

  btn.disabled = true; btn.textContent = "Salvando…";
  const q = modalCtx.id
    ? sb.from(modalCtx.tabela).update(reg).eq("id", modalCtx.id).select().single()
    : sb.from(modalCtx.tabela).insert(TABELAS_COM_BASE.has(modalCtx.tabela) ? marcarBase(reg) : reg).select().single();
  const { data: salvo, error } = await q;
  if (error) {
    btn.disabled = false; btn.textContent = modalCtx.id ? "Editar" : "Salvar";
    mostrarErroForm(erroBanco(error));
    return;
  }

  if (modalCtx.aposSalvar) {
    try { await modalCtx.aposSalvar(salvo); }
    catch (e) {
      console.error("Falha ao sincronizar com o extrato:", e);
      alertaErro("O registro foi salvo, mas o lançamento no Extrato ou a conta em aberto não foram atualizados. Abra o registro e salve de novo.", "Salvo pela metade");
    }
  }

  const eraEdicao = !!modalCtx.id;
  btn.disabled = false; btn.textContent = eraEdicao ? "Editar" : "Salvar";
  fecharModal();
  toast(avisoAposSalvar || (eraEdicao ? "Registro atualizado." : "Registro criado."));
  avisoAposSalvar = null;
  await carregarTudo();
}

// Excluir sempre passa primeiro pela confirmação estilizada (nunca exclui
// direto) — substitui o confirm() nativo do navegador, que quebrava a
// linguagem visual bem na hora de uma ação destrutiva.
function excluirRegistro() {
  if (!modalCtx || !modalCtx.id) return;
  abrirModalConfirmarExclusao(modalCtx);
}

// Guarda o contexto do formulário que estava aberto (ctxOriginal) e troca
// o conteúdo do MESMO modal pra uma confirmação — "Cancelar" reabre esse
// contexto do zero (equivalente ao confirm() cancelado: nada muda), e o
// botão vermelho só executa a exclusão de fato quando confirmado. Nenhuma
// regra de exclusão/sincronização muda — aoExcluir, o delete da tabela e
// o carregarTudo() continuam sendo os mesmos de sempre, só que chamados
// depois dessa etapa a mais em vez de depois do confirm().
function abrirModalConfirmarExclusao(ctxOriginal) {
  const nome = ctxOriginal.tituloExclusao || ("o registro \"" + ctxOriginal.titulo + "\"");
  const avisoHtml = ctxOriginal.avisoExcluir
    ? `<p class="confirmar-exclusao-aviso">${escHtml(ctxOriginal.avisoExcluir)}</p>` : "";
  abrirModal({
    titulo: "Excluir registro?",
    tituloPerigo: true,
    tabela: "_confirmar_exclusao",
    corpoCustom: `<div class="confirmar-exclusao">
      <p>Tem certeza que quer excluir ${escHtml(nome)}? Essa ação não pode ser desfeita.</p>
      ${avisoHtml}
    </div>`,
    semSalvar: true,
    mostrarExcluir: true,
    aoExcluirClique: () => executarExclusao(ctxOriginal),
    aoCancelarClique: () => abrirModal(ctxOriginal),
  });
  // o corpo da confirmação não tem campo nenhum (é só texto), então o
  // autofoco genérico do abrirModal() não acha nada — aqui a gente manda
  // explicitamente pro botão seguro (Cancelar), não pro destrutivo, pra um
  // Enter apertado sem querer não confirmar a exclusão.
  requestAnimationFrame(() => $("modal-cancelar").focus({ preventScroll: true }));
}

let avisoAposExcluir = null;

// Apaga os outros abastecimentos da mesma nota conjunta (o par para o qual
// este aponta e qualquer um que aponte para este), com o lançamento no
// Extrato, o compromisso na Agenda e os anexos de cada um.
// Devolve uma descrição de cada um que foi removido.
async function excluirParesDoAbastecimento(d) {
  if (!d) return [];
  const pares = new Map();
  try {
    if (d.grupo_abastecimento_id) {
      const { data } = await sb.from("diesel").select("*").eq("id", d.grupo_abastecimento_id).maybeSingle();
      if (data) pares.set(data.id, data);
    }
    const { data: apontam } = await sb.from("diesel").select("*").eq("grupo_abastecimento_id", d.id);
    (apontam || []).forEach(x => pares.set(x.id, x));
  } catch (e) { console.error("Falha ao localizar o par da nota conjunta:", e); return []; }

  const apagados = [];
  for (const par of pares.values()) {
    if (par.id === d.id) continue;
    try {
      await removerLancamentoVinculado(par.lancamento_id);
      if (par.agenda_id) await sb.from("agenda").delete().eq("id", par.agenda_id);
      await removerAnexo(par.comprovante_pagamento_path);
      await removerAnexo(par.nota_fiscal_path);
      const { error } = await sb.from("diesel").delete().eq("id", par.id);
      if (error) throw error;
      apagados.push(`${nomeEquipamento(par.equipamento_id)} · ${par.combustivel} (${brl(par.valor_total)})`);
    } catch (e) { console.error("Falha ao excluir o par da nota conjunta:", e); }
  }
  return apagados;
}

async function executarExclusao(ctxOriginal) {
  avisoAposExcluir = null;
  const btn = $("modal-excluir");
  btn.disabled = true;
  btn.textContent = "Excluindo…";

  if (ctxOriginal.aoExcluir) {
    try { await ctxOriginal.aoExcluir(); }
    catch (e) { console.error("Falha ao remover lançamento vinculado:", e); }
  }

  const { error } = await sb.from(ctxOriginal.tabela).delete().eq("id", ctxOriginal.id);
  if (error) {
    btn.disabled = false;
    btn.textContent = "Excluir";
    alertaErro(erroBanco(error), "Não deu para excluir");
    return;
  }
  fecharModal();
  toast(avisoAposExcluir || "Registro excluído.");
  avisoAposExcluir = null;
  await carregarTudo();
}

/* ═══════════ SINCRONIZAÇÃO AUTOMÁTICA COM O EXTRATO ═══════════
   Recebimentos (valor pago) e Diesel (valor total) geram/atualizam
   um lançamento correspondente no extrato, evitando digitar duas
   vezes e os números divergirem entre as abas. */
// Espelha um Diesel/Manutenção "a pagar" como um compromisso na Agenda —
// diferente de sincronizarLancamento, este NÃO mexe no Extrato (quem já faz
// isso é o próprio Diesel/Manutenção); é só pra aparecer no calendário.
// Quando deixa de ser pendente (foi pago, ou o valor zerou), o compromisso
// espelho é removido — nesse momento já virou movimentação realizada.
async function sincronizarAgendaEspelho({ origemId, origemTabela, agendaId, pendente, item, data, valor, natureza, centroCustoId, equipamentoId, grupo }) {
  if (!pendente || !valor || !data) {
    if (agendaId) {
      await sb.from("agenda").delete().eq("id", agendaId);
      await sb.from(origemTabela).update({ agenda_id: null }).eq("id", origemId);
    }
    return;
  }
  const [ano, mes, dia] = data.split("-").map(Number);
  const campos = {
    item, dia: String(dia), mes, ano, valor,
    natureza, centro_custo_id: centroCustoId, equipamento_id: equipamentoId,
    grupo, status_pagamento: "pendente", origem_tabela: origemTabela, origem_id: origemId,
  };
  if (agendaId) {
    await sb.from("agenda").update(campos).eq("id", agendaId);
  } else {
    const { data: novo, error } = await sb.from("agenda").insert(marcarBase(campos)).select().single();
    if (!error && novo) await sb.from(origemTabela).update({ agenda_id: novo.id }).eq("id", origemId);
  }
}

async function sincronizarLancamento({ origemId, tabelaOrigem, lancamentoId, valor, tipo, data, grupo, descricao, natureza = "Variavel", centroCustoId = null, equipamentoId = null, status = "pago", banco = null, campoVinculo = "lancamento_id", servicoId }) {
  banco = banco || contaPadrao();
  // sem valor: se existia um lançamento vinculado, remove
  if (!valor || valor <= 0) {
    if (lancamentoId) {
      await sb.from("lancamentos").delete().eq("id", lancamentoId);
      await sb.from(tabelaOrigem).update({ [campoVinculo]: null }).eq("id", origemId);
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
    equipamento_id: equipamentoId,
    status,
  };
  if (dados.temServicos && servicoId !== undefined) campos.servico_id = servicoId;
  if (lancamentoId) {
    await sb.from("lancamentos").update(campos).eq("id", lancamentoId);
  } else {
    const { data: novo, error } = await sb.from("lancamentos").insert(marcarBase(campos)).select().single();
    if (!error && novo) {
      await sb.from(tabelaOrigem).update({ [campoVinculo]: novo.id }).eq("id", origemId);
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
  const comSaldo = dados.lanc.map(l => {
    if (ehRealizado(l)) acc += l.entrada - l.saida;
    return { ...l, saldo: acc };
  });
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
    l.status === "pendente" ? "A pagar/receber" : "Realizado",
  ]);
  baixarCSV("extrato.csv", ["Data","Grupo","Subgrupo","Descrição","Conta","Entrada","Saída","Saldo","Situação"], linhas);
}

function exportarRecebimentosCSV() {
  const filtrado = dados.rec.filter(r => filtroCliente === "todos" || r.cliente === filtroCliente);
  const linhas = filtrado.map(r => [
    r.data, r.cliente, r.hora_inicial ?? "", r.hora_final ?? "",
    (r.horas || 0).toFixed(2).replace(".", ","),
    (r.valor_hora || 0).toFixed(2).replace(".", ","),
    (r.valor_total || 0).toFixed(2).replace(".", ","),
    (r.valor_pago || 0).toFixed(2).replace(".", ","),
    r.recebido ? "Recebido" : "A receber",
  ]);
  baixarCSV("recebimentos.csv",
    ["Data","Cliente","Horímetro inicial","Horímetro final","Horas","R$/h","Faturado","Pago","Situação"], linhas);
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
