/* ═══════════════════════════════════════════════════════
   SHELL — navegação mobile-first, rotas, "Novo registro",
   Início do operador, hub "Mais" e web app (PWA).
   Carregado depois do app.js: usa as funções e o estado de lá.
   ═══════════════════════════════════════════════════════ */

"use strict";

// Cada página do app. "secao" agrupa no menu Mais (celular) e na barra lateral (computador).
const NAV_PAGINAS = {
  painel:        { titulo: "Início",            secao: "inicio",     icone: "inicio" },
  inicio:        { titulo: "Início",            secao: "inicio",     icone: "inicio" },
  extrato:       { titulo: "Extrato",           secao: "Financeiro", icone: "extrato",       modulo: "extrato",      financeiro: true, sub: "entradas, saídas e saldo por conta" },
  agenda:        { titulo: "A pagar e receber", secao: "Financeiro", icone: "agenda",        modulo: "agenda",       financeiro: true, sub: "a pagar e a receber" },
  receber:       { titulo: "A pagar e receber", secao: "Financeiro", icone: "entrada",       modulo: "agenda",       financeiro: true, semMenu: true },
  servicos:      { titulo: "Serviços",          secao: "Operação",   icone: "servico",       financeiro: true, sub: "custo e lucro de cada trabalho" },
  recebimentos:  { titulo: "Horas trabalhadas", secao: "Operação",   icone: "relogio",       modulo: "recebimentos", sub: "horímetro por cliente" },
  diesel:        { titulo: "Abastecimento",     secao: "Operação",   icone: "abastecimento", modulo: "diesel",       sub: "consumo L/h e preço do litro" },
  manutencao:    { titulo: "Manutenção",        secao: "Operação",   icone: "manutencao",    modulo: "manutencao",   sub: "feitas e agendadas" },
  administracao: { titulo: "Configurações",     secao: "Gestão",     icone: "administracao", admin: true },
  mais:          { titulo: "Mais",              secao: "mais",       icone: "mais",          rotuloLateral: "Conta e aplicativo" },
};
const SECOES_MENU = ["Financeiro", "Operação"];
const ultimaDoGrupo = {};
let paginaAtual = null;

const paginaInicial = () => (vejoFinanceiro ? "painel" : "inicio");

function paginaPermitida(aba) {
  const p = NAV_PAGINAS[aba];
  if (!p) return false;
  if (aba === "painel") return vejoFinanceiro;
  if (aba === "inicio") return !vejoFinanceiro;
  if (p.admin) return meuPapel === "admin";
  if (p.financeiro && !vejoFinanceiro) return false;
  if (p.modulo) return meusModulos[p.modulo] !== false;
  return true;
}

/* ── Rotas (#/extrato etc.) — o botão voltar do celular funciona ── */
function irPara(aba) {
  if (!paginaPermitida(aba)) aba = paginaInicial();
  if (voltandoHist) { irDepoisDeVoltar = aba; return; }
  // saindo de uma janela direto para outra página: troca a entrada da janela no
  // histórico pela página nova (sem o "voltar" automático disputar com a navegação)
  if (modalNoHistorico && history.state && history.state.modal) {
    modalNoHistorico = false;
    history.replaceState(null, "", "#/" + aba);
    mostrarPagina(aba);
    return;
  }
  if (location.hash !== "#/" + aba) location.hash = "#/" + aba;
  else mostrarPagina(aba);
}
function paginaDaUrl() {
  const m = location.hash.match(/^#\/([a-z]+)/);
  return m ? m[1] : null;
}
function mostrarPagina(aba) {
  if (!paginaPermitida(aba)) aba = paginaInicial();
  const mudou = aba !== paginaAtual;
  paginaAtual = aba;
  const pag = NAV_PAGINAS[aba];
  document.querySelectorAll(".secao").forEach(s => s.classList.toggle("oculto", s.id !== "aba-" + aba));
  $("topo-titulo").textContent = pag.titulo;
  $("titulo-pagina").textContent = pag.titulo;
  $("cabeca-pagina").classList.toggle("oculto", pag.secao === "inicio" || aba === "mais");
  document.body.dataset.pagina = aba;
  const grupoNav = pag.secao === "inicio" ? "inicio" : "mais";
  document.querySelectorAll("[data-nav-grupo]").forEach(b => b.classList.toggle("ativo", b.dataset.navGrupo === grupoNav));
  document.querySelectorAll("[data-nav-pagina]").forEach(b => b.classList.toggle("ativo", b.dataset.navPagina === (aba === "receber" ? "agenda" : aba)));
  if (mudou) {
    window.scrollTo(0, 0);
    // gráficos desenhados com a seção escondida ficam com tamanho zero
    requestAnimationFrame(() => Object.values(graficos).forEach(g => { try { g.resize(); } catch (e) { /* ignora */ } }));
  }
}
function iniciarNavegacao() {
  window.addEventListener("hashchange", () => mostrarPagina(paginaDaUrl() || paginaInicial()));
  document.addEventListener("click", (ev) => {
    const lancar = ev.target.closest("[data-acao-lancar]");
    if (lancar) { abrirNovoRegistro(); return; }
    const grupo = ev.target.closest("[data-nav-grupo]");
    if (grupo) { irPara(grupo.dataset.navGrupo === "inicio" ? paginaInicial() : "mais"); return; }
    const pag = ev.target.closest("[data-nav-pagina]");
    if (pag) irPara(pag.dataset.navPagina);
  });
  $("btn-voltar-pagina").addEventListener("click", () => irPara("mais"));
  // gráficos desenhados dentro de um <details> fechado ficam com tamanho zero:
  // ao abrir, redimensiona (o evento "toggle" não borbulha, por isso captura)
  document.addEventListener("toggle", (ev) => {
    if (ev.target.open) requestAnimationFrame(() => Object.values(graficos).forEach(g => { try { g.resize(); } catch (e) { /* ignora */ } }));
  }, true);
  // "Ocultar valores": só uma classe no <body> (o CSS embaça os números); nenhum dado muda
  const olho = $("btn-olho");
  const aplicarOlho = (oculto) => {
    document.body.classList.toggle("valores-ocultos", oculto);
    olho.setAttribute("aria-pressed", String(oculto));
    olho.setAttribute("aria-label", oculto ? "Mostrar valores" : "Ocultar valores");
    olho.title = olho.getAttribute("aria-label");
  };
  try { aplicarOlho(localStorage.getItem("valoresOcultos") === "1"); } catch (e) { aplicarOlho(false); }
  olho.addEventListener("click", () => {
    const oculto = !document.body.classList.contains("valores-ocultos");
    aplicarOlho(oculto);
    try { localStorage.setItem("valoresOcultos", oculto ? "1" : "0"); } catch (e) { /* sem storage */ }
  });
  registrarWebApp();
}

// Chamado pelo carregarTudo depois de saber o papel/módulos de quem entrou.
function aplicarPermissoesNavegacao() {
  const podeCriar = meuPapel !== "leitura" && opcoesNovoRegistro().length > 0;
  // barra de baixo: Início · Adicionar · Mais (menu com todas as outras páginas)
  $("barra-inferior").style.gridTemplateColumns = `repeat(${podeCriar ? 3 : 2}, 1fr)`;
  $("barra-inferior").innerHTML =
    `<button type="button" class="nav-item" data-nav-grupo="inicio">${icone("inicio")}<span>Início</span></button>`
    + (podeCriar ? `<button type="button" class="nav-novo" data-acao-lancar aria-label="Adicionar"><span>${icone("plus")}</span><em>Adicionar</em></button>` : "")
    + `<button type="button" class="nav-item" data-nav-grupo="mais">${icone("mais")}<span>Mais</span><i class="nav-selo oculto" data-selo="mais"></i></button>`;

  // barra lateral (computador): todas as páginas agrupadas
  const lat = [`<button type="button" class="lateral-item" data-nav-pagina="${paginaInicial()}">${icone("inicio")}<span>Início</span></button>`];
  for (const sec of [...SECOES_MENU, "Gestão"]) {
    const pags = Object.keys(NAV_PAGINAS).filter(k => NAV_PAGINAS[k].secao === sec && !NAV_PAGINAS[k].semMenu && paginaPermitida(k));
    if (sec === "Gestão") pags.push("mais");
    if (!pags.length) continue;
    lat.push(`<div class="lateral-grupo">${sec}</div>` + pags.map(p => `<button type="button" class="lateral-item" data-nav-pagina="${p}">${icone(NAV_PAGINAS[p].icone)}<span>${escHtml(NAV_PAGINAS[p].rotuloLateral || NAV_PAGINAS[p].titulo)}</span><i class="nav-selo oculto" data-selo-pagina="${p}"></i></button>`).join(""));
  }
  $("lateral-nav").innerHTML = lat.join("");
  document.querySelector(".lateral-novo").classList.toggle("oculto", !podeCriar);

  const desejada = paginaAtual || paginaDaUrl() || paginaInicial();
  const destino = paginaPermitida(desejada) ? desejada : paginaInicial();
  if (location.hash !== "#/" + destino) history.replaceState(history.state, "", "#/" + destino);
  paginaAtual = null; // força redesenhar estados ativos
  mostrarPagina(destino);
  // atalho do ícone instalado ("Novo abastecimento"): #/diesel?novo=1
  pintarBotoesPeriodo();
  if (/[?&]novo=1/.test(location.hash)) {
    history.replaceState(history.state, "", "#/" + destino);
    const abrir = { diesel: () => abrirModalDiesel(null), recebimentos: () => abrirModalRecebimento(null), manutencao: () => abrirModalManutencao(null) }[destino];
    if (abrir && meuPapel !== "leitura") setTimeout(abrir, 50);
  }
}

/* ── Botão + : "Novo registro" ── */
function opcoesNovoRegistro() {
  const op = [];
  if (meusModulos.diesel !== false) op.push({ chave: "abastecimento", titulo: "Abastecimento", sub: "foto da nota preenche sozinho", icone: "abastecimento", cor: "#F5B301", fn: () => abrirModalDiesel(null) });
  if (vejoFinanceiro && dados.temServicos) op.push({ chave: "servico", titulo: "Serviço", sub: "cliente, custos e lucro do trabalho", icone: "servico", cor: "#4EC9D4", fn: () => abrirModalServico(null) });
  if (meusModulos.recebimentos !== false) op.push({ chave: "horas", titulo: "Horas trabalhadas", sub: "horímetro e cliente", icone: "relogio", cor: "#4DA3FF", fn: () => abrirModalRecebimento(null) });
  if (meusModulos.manutencao !== false) op.push({ chave: "manutencao", titulo: "Manutenção", sub: "conserto, peças e oficina", icone: "manutencao", cor: "#FF8C42", fn: () => abrirModalManutencao(null) });
  if (vejoFinanceiro && meusModulos.extrato !== false) {
    op.push({ chave: "despesa", titulo: "Despesa", sub: "já paguei ou vou pagar", icone: "saida", cor: "#F0564A", fn: () => abrirModalLancamento(null, "saida") });
    op.push({ chave: "receita", titulo: "Receita", sub: "já recebi ou vou receber", icone: "entrada", cor: "#3ECF8E", fn: () => abrirModalLancamento(null, "entrada") });
  }
  return op;
}
function tileHtml(o, classe) {
  return `<button type="button" class="${classe}" data-novo="${o.chave}" style="--cor-tile:${o.cor}">
    <span class="tile-icone">${icone(o.icone)}</span>
    <span class="tile-texto"><b>${o.titulo}</b><small>${o.sub}</small></span>
  </button>`;
}
function ligarTiles(raiz) {
  const ops = opcoesNovoRegistro();
  raiz.querySelectorAll("[data-novo]").forEach(b => b.addEventListener("click", () => {
    const o = ops.find(x => x.chave === b.dataset.novo);
    if (!o) return;
    if (!$("modal-fundo").classList.contains("oculto")) fecharModal();
    o.fn();
  }));
}
function abrirNovoRegistro() {
  if (meuPapel === "leitura") { toast("Seu acesso é somente leitura."); return; }
  const ops = opcoesNovoRegistro();
  abrirModal({
    titulo: "Novo registro",
    tabela: "_novo_registro",
    corpoCustom: `<p class="folha-contexto">em <b>${escHtml(contexto.nome || "Total do negócio")}</b></p><div class="tiles">${ops.map(o => tileHtml(o, "tile")).join("")}</div>`,
    semSalvar: true, folha: true,
  });
  ligarTiles($("modal-campos"));
}

/* ── Início do operador (usuário comum): só o que ele faz no dia a dia ── */
function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
function renderInicio() {
  const el = $("aba-inicio");
  if (!el || vejoFinanceiro) return;
  const perfil = dados.perfis.find(p => p.id === meuUserId);
  const nome = (perfil?.nome || "").split(" ")[0];
  const podeCriar = meuPapel !== "leitura";
  const recentes = [
    ...dados.die.map(d => ({ data: d.data, tipo: "diesel", id: d.id, titulo: `${num(d.litros, 0)} L de ${d.combustivel || "Diesel"}`, sub: nomeEquipamento(d.equipamento_id), icone: "abastecimento" })),
    ...dados.rec.map(r => ({ data: r.data, tipo: "rec", id: r.id, titulo: `${num(r.horas || 0)} h · ${r.cliente}`, sub: [nomeEquipamento(r.equipamento_id), r.hora_final != null ? "horímetro " + num(r.hora_final) : ""].filter(Boolean).join(" · "), icone: "relogio" })),
    ...dados.man.filter(m => m.realizada).map(m => ({ data: m.data, tipo: "man", id: m.id, titulo: m.descricao || "Manutenção", sub: nomeEquipamento(m.equipamento_id), icone: "manutencao" })),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id).slice(0, 8);
  const abrir = { diesel: "abrirModalDiesel", rec: "abrirModalRecebimento", man: "abrirModalManutencao" };
  const proximas = dados.man.filter(m => !m.realizada).sort((a, b) => (a.proxima_data || a.data).localeCompare(b.proxima_data || b.data)).slice(0, 3);
  const horasMes = dados.rec.filter(r => r.data.slice(0, 7) === hoje().slice(0, 7)).reduce((t, r) => t + (r.horas || 0), 0);
  const litrosMes = dados.die.filter(d => d.data.slice(0, 7) === hoje().slice(0, 7)).reduce((t, d) => t + (d.litros || 0), 0);

  el.innerHTML = `
    <div class="boas-vindas">
      <small>${saudacao()}${nome ? "," : ""}</small>
      <h2>${escHtml(nome || "bem-vindo")}</h2>
      <div class="mini-stats">
        <div><b>${num(horasMes)} h</b><span>trabalhadas no mês</span></div>
        <div><b>${num(litrosMes, 0)} L</b><span>abastecidos no mês</span></div>
      </div>
    </div>
    ${podeCriar ? `<h3 class="grupo-titulo">Registrar</h3><div class="acoes-grandes">${opcoesNovoRegistro().map(o => tileHtml(o, "acao-grande")).join("")}</div>` : ""}
    ${proximas.length ? `<h3 class="grupo-titulo">Próximas manutenções</h3>
      <div class="lista-cartao">${listaComVerMais("op-proximas", proximas.map(m => `
        <div class="registro-item" role="button" tabindex="0" onclick="aoClicarLinha(() => abrirModalManutencao(${m.id}))" onkeydown="teclaLinha(event)">
          <span class="registro-icone" style="--cor-tile:#FF8C42">${icone("manutencao")}</span>
          <span class="registro-texto"><b>${escHtml(m.descricao || "Manutenção")}</b><small>${escHtml(nomeEquipamento(m.equipamento_id))}</small></span>
          <span class="registro-data">${m.proxima_data ? fData(m.proxima_data) : m.proxima_horimetro ? num(m.proxima_horimetro, 0) + " h" : fData(m.data)}</span>
        </div>`), 1)}</div>` : ""}
    <h3 class="grupo-titulo">Últimos registros</h3>
    <div class="lista-cartao">${recentes.length ? listaComVerMais("op-recentes", recentes.map(r => `
      <div class="registro-item" role="button" tabindex="0" onclick="aoClicarLinha(() => ${abrir[r.tipo]}(${r.id}))" onkeydown="teclaLinha(event)">
        <span class="registro-icone">${icone(r.icone)}</span>
        <span class="registro-texto"><b>${escHtml(r.titulo)}</b><small>${escHtml(r.sub)}</small></span>
        <span class="registro-data">${fData(r.data)}</span>
      </div>`), 1) : `<div class="vazio">Nada registrado ainda. Use os botões acima.</div>`}</div>`;
  ligarTiles(el);
}

/* ── "Mais": perfil, configurações, base de dados, instalar, sair ── */
let promptInstalacao = null;
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => telaCombina("(display-mode: standalone)") || navigator.standalone === true;

function renderMais() {
  renderSelosNav();
  const el = $("aba-mais");
  if (!el) return;
  const perfil = dados.perfis.find(p => p.id === meuUserId);
  const nomeUsuario = perfil?.nome || "Usuário";
  const ROTULO_PAPEL = { admin: "Administrador", operacional: "Operacional", leitura: "Somente leitura" };
  const linha = (iconeNome, titulo, sub, acao, extra = "") =>
    `<button type="button" class="mais-item ${extra}" onclick="${acao}">${icone(iconeNome)}<span><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ""}</span>${icone("chevron-right", "icone-sm mais-seta")}</button>`;
  const podeInstalar = !instalado() && (promptInstalacao || ehIOS());
  const atrasadas = vejoFinanceiro ? contasEmAberto().filter(a => a.venc < hoje() && a.valor > 0).length : 0;
  // operador: o Início já tem os botões de registrar e os últimos registros — o menu fica só com a conta
  const paginasMenu = !vejoFinanceiro ? "" : SECOES_MENU.map(sec => {
    const pags = Object.keys(NAV_PAGINAS).filter(k => NAV_PAGINAS[k].secao === sec && !NAV_PAGINAS[k].semMenu && paginaPermitida(k));
    if (!pags.length) return "";
    return `<h3 class="mais-secao">${sec}</h3><div class="mais-grade">${pags.map(k => `
      <button type="button" class="mais-tile" onclick="irPara('${k}')">
        <span class="mais-tile-icone">${icone(NAV_PAGINAS[k].icone)}${k === "agenda" && atrasadas ? `<i class="mais-tile-selo" aria-label="${atrasadas} em atraso">${atrasadas > 9 ? "9+" : atrasadas}</i>` : ""}</span>
        <b>${NAV_PAGINAS[k].titulo}</b>
      </button>`).join("")}</div>`;
  }).join("");
  // Configurações (só administrador) aparece aqui mesmo, recolhida: cada linha abre a tela direto, sem um segundo menu
  const itemConfig = (s) => `<button type="button" class="mais-item" onclick="abrirConfig('${s.chave}')">${icone(s.icone)}<span><b>${s.titulo}</b></span>${icone("chevron-right", "icone-sm mais-seta")}</button>`;
  const configuracoes = meuPapel !== "admin" || typeof SECOES_ADMIN === "undefined" ? "" : `
    <details class="mais-config">
      <summary>${icone("administracao")}<span>Configurações</span>${icone("chevron-right", "icone-sm mais-seta")}</summary>
      ${(() => { const vis = secoesConfigVisiveis(); return [...new Set(vis.map(s => s.grupo))].map(g => `<h4 class="mais-config-grupo">${g}</h4><div class="mais-lista">${vis.filter(s => s.grupo === g).map(itemConfig).join("")}</div>`).join(""); })()}
    </details>`;
  el.innerHTML = `
    <button type="button" class="mais-perfil" onclick="abrirModalMeuPerfil()" aria-label="Abrir meu perfil">
      ${avatarHtml(nomeUsuario, perfil?.avatar_url)}
      <span class="mais-perfil-texto"><b>${escHtml(nomeUsuario)}</b><small>${ROTULO_PAPEL[meuPapel] || ""} · editar perfil</small></span>
      ${icone("chevron-right", "icone-sm mais-seta")}
    </button>
    ${podeInstalar ? `<button type="button" class="mais-instalar" onclick="instalarWebApp()">${icone("baixar")}<span><b>Instalar o aplicativo</b><small>abre direto da tela inicial</small></span></button>` : ""}
    ${paginasMenu}
    ${configuracoes}
    <div class="mais-rodape">
      <button type="button" class="mais-atualizar" onclick="carregarTudo().then(() => toast('Dados atualizados.'))">${icone("atualizar")}<span>Atualizar dados</span></button>
      <button type="button" class="mais-sair-btn" onclick="sair()">${icone("sair")}<span>Sair</span></button>
    </div>
    <p class="mais-versao">TA Frota · versão ${VERSAO_APP}</p>`;
}

// Selo vermelho com as contas atrasadas no botão "Caixa"
function renderSelosNav() {
  const atrasadas = vejoFinanceiro ? contasEmAberto().filter(a => a.venc < hoje() && a.valor > 0).length : 0;
  document.querySelectorAll('[data-selo="mais"], [data-selo-pagina="agenda"]').forEach(s => {
    s.textContent = atrasadas > 9 ? "9+" : String(atrasadas);
    s.classList.toggle("oculto", !atrasadas);
  });
}

/* ── Modal no histórico: o "voltar" do celular fecha a janela aberta ── */
let modalNoHistorico = false;
let voltandoHist = false;   // um history.back() nosso ainda em andamento
let irDepoisDeVoltar = null;
function marcarModalNoHistorico() {
  document.body.classList.add("modal-aberto");
  if (!modalNoHistorico && !voltandoHist) {
    try { history.pushState({ modal: true }, ""); modalNoHistorico = true; } catch (e) { /* ignora */ }
  }
}
function desmarcarModalNoHistorico() {
  document.body.classList.remove("modal-aberto");
  setTimeout(() => {
    // se outra janela abriu logo em seguida (fluxos encadeados), reaproveita a mesma entrada
    if (!modalNoHistorico || !$("modal-fundo").classList.contains("oculto")) return;
    modalNoHistorico = false;
    if (history.state && history.state.modal) { voltandoHist = true; history.back(); }
  }, 0);
}
window.addEventListener("popstate", () => {
  if (voltandoHist) {
    // fim do nosso próprio "voltar": se nesse meio-tempo abriu outra janela ou
    // pediram outra página, aplica agora
    voltandoHist = false;
    if (!$("modal-fundo").classList.contains("oculto")) {
      try { history.pushState({ modal: true }, ""); modalNoHistorico = true; } catch (e) { /* ignora */ }
    }
    if (irDepoisDeVoltar) { const a = irDepoisDeVoltar; irDepoisDeVoltar = null; irPara(a); }
    return;
  }
  if (history.state && history.state.modal) return;
  if (!modalNoHistorico) return;
  modalNoHistorico = false;
  if (!$("modal-fundo").classList.contains("oculto")) {
    $("modal-fundo").classList.add("oculto");
    document.body.classList.remove("modal-aberto");
    modalCtx = null;
  }
});

/* ── Web app instalável (PWA) ── */
const VERSAO_APP = "2.6.0";
function registrarWebApp() {
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    promptInstalacao = ev;
    if (appIniciado) renderMais();
  });
  window.addEventListener("appinstalled", () => { promptInstalacao = null; toast("Aplicativo instalado."); renderMais(); });
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js").catch(e => console.warn("Service worker não registrado:", e));
  }
}
async function instalarWebApp() {
  if (promptInstalacao) {
    promptInstalacao.prompt();
    try { await promptInstalacao.userChoice; } catch (e) { /* ignora */ }
    promptInstalacao = null;
    renderMais();
    return;
  }
  abrirModal({
    titulo: "Instalar no iPhone",
    tabela: "_instalar",
    folha: true, semSalvar: true,
    corpoCustom: `<ol class="passos-instalar">
      <li>Toque em <b>Compartilhar</b> (o quadrado com a seta, embaixo no Safari).</li>
      <li>Role e toque em <b>Adicionar à Tela de Início</b>.</li>
      <li>Toque em <b>Adicionar</b>. O app aparece com o ícone na tela inicial.</li>
    </ol>`,
  });
}
