/* ═══════════════════════════════════════════════════════
   SHELL — navegação mobile-first, rotas, "Novo registro",
   Início do operador, hub "Mais" e web app (PWA).
   Carregado depois do app.js: usa as funções e o estado de lá.
   ═══════════════════════════════════════════════════════ */

"use strict";

// Cada página do app. "grupo" decide em qual botão da barra inferior ela mora.
const NAV_PAGINAS = {
  painel:        { titulo: "Início",        grupo: "inicio",   icone: "inicio" },
  inicio:        { titulo: "Início",        grupo: "inicio",   icone: "inicio" },
  extrato:       { titulo: "Extrato",       grupo: "caixa",    icone: "extrato",       modulo: "extrato",      financeiro: true },
  agenda:        { titulo: "Contas",        grupo: "caixa",    icone: "agenda",        modulo: "agenda",       financeiro: true, sub: "Contas a pagar" },
  servicos:      { titulo: "Serviços",      grupo: "operacao", icone: "servico",       financeiro: true },
  recebimentos:  { titulo: "Horas",         grupo: "operacao", icone: "relogio",       modulo: "recebimentos", sub: "Horas trabalhadas" },
  diesel:        { titulo: "Abastecimento", grupo: "operacao", icone: "abastecimento", modulo: "diesel" },
  manutencao:    { titulo: "Manutenção",    grupo: "operacao", icone: "manutencao",    modulo: "manutencao" },
  administracao: { titulo: "Configurações", grupo: "mais",     icone: "administracao", admin: true },
  mais:          { titulo: "Mais",          grupo: "mais",     icone: "mais",          rotuloLateral: "Conta e aplicativo" },
};
const NAV_GRUPOS = [
  { chave: "inicio",   rotulo: "Início",   icone: "inicio",   paginas: ["painel", "inicio"] },
  { chave: "caixa",    rotulo: "Caixa",    icone: "caixa",    paginas: ["extrato", "agenda"] },
  { chave: "novo" },
  { chave: "operacao", rotulo: "Operação", icone: "operacao", paginas: ["servicos", "recebimentos", "diesel", "manutencao"] },
  { chave: "mais",     rotulo: "Mais",     icone: "mais",     paginas: ["mais", "administracao"] },
];
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
const paginasDoGrupo = (g) => (g.paginas || []).filter(paginaPermitida);

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
  ultimaDoGrupo[pag.grupo] = aba;
  document.querySelectorAll(".secao").forEach(s => s.classList.toggle("oculto", s.id !== "aba-" + aba));
  $("topo-titulo").textContent = pag.titulo;
  document.body.dataset.pagina = aba;
  document.querySelectorAll("[data-nav-grupo]").forEach(b => b.classList.toggle("ativo", b.dataset.navGrupo === pag.grupo));
  document.querySelectorAll("[data-nav-pagina]").forEach(b => b.classList.toggle("ativo", b.dataset.navPagina === aba));
  renderSubnav(pag.grupo, aba);
  if (mudou) {
    window.scrollTo(0, 0);
    // gráficos desenhados com a seção escondida ficam com tamanho zero
    requestAnimationFrame(() => Object.values(graficos).forEach(g => { try { g.resize(); } catch (e) { /* ignora */ } }));
  }
}
function renderSubnav(grupoChave, aba) {
  const g = NAV_GRUPOS.find(x => x.chave === grupoChave);
  const pags = g && grupoChave !== "mais" ? paginasDoGrupo(g) : [];
  const el = $("subnav");
  el.classList.toggle("oculto", pags.length < 2);
  el.innerHTML = pags.map(p => `<button type="button" class="subnav-item ${p === aba ? "ativo" : ""}" data-nav-pagina="${p}">${escHtml(NAV_PAGINAS[p].sub || NAV_PAGINAS[p].titulo)}</button>`).join("");
}

function iniciarNavegacao() {
  window.addEventListener("hashchange", () => mostrarPagina(paginaDaUrl() || paginaInicial()));
  document.addEventListener("click", (ev) => {
    const lancar = ev.target.closest("[data-acao-lancar]");
    if (lancar) { abrirNovoRegistro(); return; }
    const grupo = ev.target.closest("[data-nav-grupo]");
    if (grupo) {
      const g = NAV_GRUPOS.find(x => x.chave === grupo.dataset.navGrupo);
      const pags = paginasDoGrupo(g);
      const destino = pags.includes(ultimaDoGrupo[g.chave]) ? ultimaDoGrupo[g.chave] : pags[0];
      // tocar de novo no grupo já aberto volta para a primeira página dele
      irPara(NAV_PAGINAS[paginaAtual]?.grupo === g.chave && paginaAtual === destino ? pags[0] : destino);
      return;
    }
    const pag = ev.target.closest("[data-nav-pagina]");
    if (pag) irPara(pag.dataset.navPagina);
  });
  registrarWebApp();
}

// Chamado pelo carregarTudo depois de saber o papel/módulos de quem entrou.
function aplicarPermissoesNavegacao() {
  const grupos = NAV_GRUPOS.filter(g => g.chave === "novo" || paginasDoGrupo(g).length);
  const podeCriar = meuPapel !== "leitura" && opcoesNovoRegistro().length > 0;
  $("barra-inferior").style.gridTemplateColumns = `repeat(${grupos.filter(g => g.chave !== "novo" || podeCriar).length}, 1fr)`;
  $("barra-inferior").innerHTML = grupos.map(g => g.chave === "novo"
    ? (podeCriar ? `<button type="button" class="nav-novo" data-acao-lancar aria-label="Novo registro"><span>${icone("plus")}</span></button>` : "")
    : `<button type="button" class="nav-item" data-nav-grupo="${g.chave}">${icone(g.icone)}<span>${g.rotulo}</span><i class="nav-selo oculto" data-selo="${g.chave}"></i></button>`).join("");

  $("lateral-nav").innerHTML = NAV_GRUPOS.filter(g => g.chave !== "novo").map(g => {
    const pags = paginasDoGrupo(g);
    if (!pags.length) return "";
    const titulo = g.chave === "inicio" ? "" : `<div class="lateral-grupo">${g.chave === "mais" ? "Gestão" : g.rotulo}</div>`;
    return titulo + pags.map(p => `<button type="button" class="lateral-item" data-nav-pagina="${p}">${icone(NAV_PAGINAS[p].icone)}<span>${escHtml(NAV_PAGINAS[p].rotuloLateral || NAV_PAGINAS[p].titulo)}</span><i class="nav-selo oculto" data-selo-pagina="${p}"></i></button>`).join("");
  }).join("");
  document.querySelector(".lateral-novo").classList.toggle("oculto", !podeCriar);

  const desejada = paginaAtual || paginaDaUrl() || paginaInicial();
  const destino = paginaPermitida(desejada) ? desejada : paginaInicial();
  if (location.hash !== "#/" + destino) history.replaceState(history.state, "", "#/" + destino);
  paginaAtual = null; // força redesenhar estados ativos
  mostrarPagina(destino);
  // atalho do ícone instalado ("Novo abastecimento"): #/diesel?novo=1
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
    op.push({ chave: "despesa", titulo: "Despesa", sub: "saiu dinheiro", icone: "saida", cor: "#F0564A", fn: () => abrirModalLancamento(null, "saida") });
    op.push({ chave: "receita", titulo: "Receita", sub: "entrou dinheiro", icone: "entrada", cor: "#3ECF8E", fn: () => abrirModalLancamento(null, "entrada") });
  }
  if (vejoFinanceiro && meusModulos.agenda !== false) {
    op.push({ chave: "conta", titulo: "Conta a pagar", sub: "boleto, parcela, mensalidade", icone: "agenda", cor: "#A78BFA", fn: () => abrirModalAgenda(null, "pagar") });
    op.push({ chave: "conta_receber", titulo: "Conta a receber", sub: "cliente que vai pagar depois", icone: "entrada", cor: "#2FB37A", fn: () => abrirModalAgenda(null, "receber") });
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
      <div class="lista-cartao">${proximas.map(m => `
        <div class="registro-item" role="button" tabindex="0" onclick="aoClicarLinha(() => abrirModalManutencao(${m.id}))" onkeydown="teclaLinha(event)">
          <span class="registro-icone" style="--cor-tile:#FF8C42">${icone("manutencao")}</span>
          <span class="registro-texto"><b>${escHtml(m.descricao || "Manutenção")}</b><small>${escHtml(nomeEquipamento(m.equipamento_id))}</small></span>
          <span class="registro-data">${m.proxima_data ? fData(m.proxima_data) : m.proxima_horimetro ? num(m.proxima_horimetro, 0) + " h" : fData(m.data)}</span>
        </div>`).join("")}</div>` : ""}
    <h3 class="grupo-titulo">Últimos registros</h3>
    <div class="lista-cartao">${recentes.length ? recentes.map(r => `
      <div class="registro-item" role="button" tabindex="0" onclick="aoClicarLinha(() => ${abrir[r.tipo]}(${r.id}))" onkeydown="teclaLinha(event)">
        <span class="registro-icone">${icone(r.icone)}</span>
        <span class="registro-texto"><b>${escHtml(r.titulo)}</b><small>${escHtml(r.sub)}</small></span>
        <span class="registro-data">${fData(r.data)}</span>
      </div>`).join("") : `<div class="vazio">Nada registrado ainda. Use os botões acima.</div>`}</div>`;
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
  el.innerHTML = `
    <div class="mais-usuario">
      ${avatarHtml(nomeUsuario, perfil?.avatar_url)}
      <div><b>${escHtml(nomeUsuario)}</b><small>${ROTULO_PAPEL[meuPapel] || ""}</small></div>
    </div>
    <div class="mais-lista">
      ${podeInstalar ? linha("baixar", "Instalar o aplicativo", "abre como app, direto da tela inicial", "instalarWebApp()", "mais-destaque") : ""}
      ${linha("usuario", "Meu perfil", "nome, foto e senha", "abrirModalMeuPerfil()")}
      ${meuPapel === "admin" ? linha("administracao", "Configurações", "empresa, cadastros, usuários e histórico", "irPara('administracao'); mudarSecaoAdmin(null)") : ""}
      ${linha("atualizar", "Atualizar dados", "busca de novo no servidor", "carregarTudo().then(() => toast('Dados atualizados.'))")}
    </div>
    ${meuPapel === "admin" ? `
      <h3 class="grupo-titulo">Base de dados</h3>
      <div class="cartao cartao-base">
        <div class="segmentado segmentado-largo" id="mais-base">
          <button type="button" data-valor="nova" class="${modoBase === "nova" ? "ativo" : ""}">Operação nova</button>
          <button type="button" data-valor="antiga" class="${modoBase === "antiga" ? "ativo" : ""}">Base antiga</button>
          <button type="button" data-valor="tudo" class="${modoBase === "tudo" ? "ativo" : ""}">Tudo</button>
        </div>
        <p class="cartao-nota">A base antiga guarda o que foi lançado antes da arrumação. Nada é apagado.</p>
      </div>` : ""}
    <div class="mais-lista">
      ${linha("sair", "Sair", "", "sair()", "mais-sair")}
    </div>
    <p class="mais-versao">TA Frota · versão ${VERSAO_APP}</p>`;
  const seg = $("mais-base");
  if (seg) ligarSegmentado("mais-base", (v) => trocarBase(v));
}

// Selo vermelho com as contas atrasadas no botão "Caixa"
function renderSelosNav() {
  const atrasadas = vejoFinanceiro ? contasEmAberto().filter(a => a.venc < hoje() && a.valor > 0).length : 0;
  document.querySelectorAll('[data-selo="caixa"], [data-selo-pagina="agenda"]').forEach(s => {
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
const VERSAO_APP = "2.2.0";
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
