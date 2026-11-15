/* ═══════════════════════════════════════════════════════
   SERVIÇOS — centro de resultado de cada trabalho/contrato
   Junta cliente, horas, custos (abastecimento, manutenção, despesas)
   e recebimentos: mostra receita, custo e lucro de cada serviço.
   Quando o serviço é concluído e ainda falta receber, entra sozinho
   em Contas → "A receber".
   ═══════════════════════════════════════════════════════ */

"use strict";

let filtroServicos = "andamento";
let servicoPreSelecionado = null; // usado ao lançar algo "dentro" de um serviço
const ROTULO_STATUS_SERVICO = { andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };
const CLASSE_STATUS_SERVICO = { andamento: "chip-pendente", concluido: "chip-pago", cancelado: "" };

// Carrega serviços e TUDO que está ligado a eles, sem o filtro de equipamento:
// o resultado de um serviço é sempre o inteiro (máquina + carro de apoio + despesas gerais).
async function carregarServicos() {
  dados.servicos = []; dados.lancServ = []; dados.recServ = [];
  try {
    const [sv, ls, rs] = await Promise.all([
      porBase(sb.from("servicos").select("*")).order("data_inicio", { ascending: false }).order("id", { ascending: false }),
      porBase(sb.from("lancamentos").select("*")).not("servico_id", "is", null).order("data").order("id"),
      porBase(sb.from("recebimentos").select("*")).not("servico_id", "is", null).order("data").order("id"),
    ]);
    if (sv.error) throw sv.error;
    dados.temServicos = true;
    dados.servicos = (sv.data || []).map(o => normNum(o, "servicos"));
    dados.lancServ = (ls.data || []).map(o => normNum(o, "lancamentos"));
    dados.recServ = (rs.data || []).map(o => normNum(o, "recebimentos"));
  } catch (e) {
    dados.temServicos = false;
    console.warn("Serviços indisponíveis (rode correcoes_v25.sql):", e.message || e);
  }
}

/* ── Campo "Serviço" nos formulários ── */
function campoServico(valorAtual, aoMudar) {
  if (!dados.temServicos) return [];
  const atual = valorAtual ?? servicoPreSelecionado ?? null;
  const rot = (sv) => sv.nome + (sv.cliente ? " · " + sv.cliente : "");
  const lista = dados.servicos.filter(sv => sv.status === "andamento" || sv.id === atual);
  if (!lista.length && atual == null) return [];
  return [{
    nome: "servico_id", rotulo: "Serviço (opcional)", tipo: "select", largo: true,
    opcoes: ["|Nenhum (custo geral)"].concat(lista.map(sv => `${sv.id}|${rot(sv)}`)),
    valor: atual != null ? String(atual) : "", aoMudar,
  }];
}
function servicoDoForm(f) {
  if (!dados.temServicos || !("servico_id" in f)) return {};
  return { servico_id: f.servico_id ? Number(f.servico_id) : null };
}
function novoComServico(id, abrir) {
  fecharModal();
  servicoPreSelecionado = id;
  try { abrir(); } finally { servicoPreSelecionado = null; }
}

/* ── Números de um serviço ── */
function resumoServico(sv) {
  const lancs = dados.lancServ.filter(l => l.servico_id === sv.id && !ehAjusteSaldo(l));
  const recs = dados.recServ.filter(r => r.servico_id === sv.id);
  const horas = recs.reduce((t, r) => t + (r.horas || 0), 0);
  const faturadoHoras = recs.reduce((t, r) => t + (r.horas || 0) * (sv.valor_hora || r.valor_hora || 0), 0);
  const receita = sv.cobranca === "fechado" ? (sv.valor_fechado || 0) : faturadoHoras;
  const porGrupo = {};
  let custos = 0, custosPendentes = 0, recebido = 0;
  for (const l of lancs) {
    if (l.saida > 0) {
      custos += l.saida;
      if (l.status === "pendente") custosPendentes += l.saida;
      porGrupo[l.grupo] = (porGrupo[l.grupo] || 0) + l.saida;
    }
    if (l.entrada > 0 && ehRealizado(l)) recebido += l.entrada;
  }
  const lucro = receita - custos;
  return {
    lancs, recs, horas, receita, custos, custosPendentes, recebido, porGrupo, lucro,
    aReceber: Math.max(0, receita - recebido),
    margem: receita > 0 ? lucro / receita : null,
    custoHora: horas > 0 ? custos / horas : null,
  };
}

/* ── Página Serviços ── */
function renderServicos() {
  const el = $("srv-lista");
  if (!el) return;
  if (!dados.temServicos) {
    el.innerHTML = `<div class="vazio-bonito">${icone("alerta")}<b>Serviços ainda não ativados</b><span>Rode o arquivo correcoes_v25.sql no Supabase.</span></div>`;
    $("srv-resumo").innerHTML = "";
    return;
  }
  const lista = dados.servicos.filter(sv => filtroServicos === "todos" || sv.status === filtroServicos)
    .filter(sv => contexto.equipamentoId == null || sv.equipamento_id == null || sv.equipamento_id === contexto.equipamentoId);
  const rs = lista.map(sv => ({ sv, r: resumoServico(sv) }));
  const tot = rs.reduce((t, { r }) => ({ receita: t.receita + r.receita, custos: t.custos + r.custos, aReceber: t.aReceber + r.aReceber }), { receita: 0, custos: 0, aReceber: 0 });
  const lucroTot = tot.receita - tot.custos;
  $("srv-resumo").innerHTML = lista.length ? `
    <div class="resumo-contas">
      <div class="resumo-contas-item"><span>Receita</span><b>${brl0(tot.receita)}</b></div>
      <div class="resumo-contas-item neg"><span>Custos</span><b>${brl0(tot.custos)}</b></div>
      <div class="resumo-contas-item ${lucroTot >= 0 ? "pos" : "neg"}"><span>Lucro</span><b>${brl0(lucroTot)}</b></div>
    </div>
    ${tot.aReceber > 0.5 ? `<p class="cartao-nota srv-nota-receber">${brl0(tot.aReceber)} ainda a receber nestes serviços</p>` : ""}` : "";
  el.innerHTML = rs.length ? rs.map(({ sv, r }) => {
    const pctCusto = r.receita > 0 ? Math.min(100, r.custos / r.receita * 100) : (r.custos > 0 ? 100 : 0);
    return `<div class="servico-card" role="button" tabindex="0" onclick="abrirDetalheServico(${sv.id})" onkeydown="teclaLinha(event)">
      <div class="servico-topo">
        <b>${escHtml(sv.nome)}</b>
        <span class="chip chip-status ${CLASSE_STATUS_SERVICO[sv.status] || ""}">${ROTULO_STATUS_SERVICO[sv.status] || sv.status}</span>
      </div>
      <small class="servico-sub">${escHtml([sv.cliente, sv.equipamento_id ? nomeEquipamento(sv.equipamento_id) : "", "desde " + fData(sv.data_inicio)].filter(Boolean).join(" · "))}</small>
      <div class="servico-nums">
        <div><span>Receita</span><b>${brl0(r.receita)}</b></div>
        <div><span>Custos</span><b class="neg">${brl0(r.custos)}</b></div>
        <div><span>Lucro</span><b class="${r.lucro >= 0 ? "pos" : "neg"}">${brl0(r.lucro)}</b>${r.margem != null ? `<small>${num(r.margem * 100, 0)}%</small>` : ""}</div>
      </div>
      <div class="servico-barra" title="custos sobre a receita"><i style="width:${pctCusto.toFixed(1)}%" class="${r.lucro < 0 ? "estourou" : ""}"></i></div>
      <small class="servico-rodape">${num(r.horas)} h · recebido ${brl0(r.recebido)}${r.aReceber > 0.5 ? ` · <span class="amarelo">a receber ${brl0(r.aReceber)}</span>` : ""}</small>
    </div>`;
  }).join("") : `<div class="vazio-bonito">${icone("servico")}<b>Nenhum serviço ${filtroServicos === "andamento" ? "em andamento" : filtroServicos === "concluido" ? "concluído" : ""}</b><span>Crie um serviço para acompanhar custo e lucro de cada trabalho.</span>${meuPapel !== "leitura" ? `<button type="button" class="btn-primario" onclick="abrirModalServico(null)">+ Novo serviço</button>` : ""}</div>`;
}

/* ── Detalhe do serviço ── */
function abrirDetalheServico(id) {
  const sv = dados.servicos.find(x => x.id === id);
  if (!sv) { toast("Serviço não encontrado — atualize os dados."); return; }
  const r = resumoServico(sv);
  const podeEditar = meuPapel !== "leitura";
  const grupos = Object.entries(r.porGrupo).sort((a, b) => b[1] - a[1]);
  const maxG = grupos.length ? grupos[0][1] : 1;
  const movs = r.lancs.slice().sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  const html = `
    <p class="folha-contexto">${escHtml([sv.cliente, sv.equipamento_id ? nomeEquipamento(sv.equipamento_id) : "", fData(sv.data_inicio) + (sv.data_fim ? " a " + fData(sv.data_fim) : "")].filter(Boolean).join(" · "))}
      · <span class="chip chip-status ${CLASSE_STATUS_SERVICO[sv.status] || ""}">${ROTULO_STATUS_SERVICO[sv.status]}</span></p>
    <div class="srv-numeros">
      <div><span>Receita ${sv.cobranca === "fechado" ? "(valor fechado)" : "(horas × " + brl(sv.valor_hora || 0) + ")"}</span><b>${brl(r.receita)}</b></div>
      <div><span>Custos${r.custosPendentes > 0.5 ? ` · ${brl0(r.custosPendentes)} a pagar` : ""}</span><b class="neg">${brl(r.custos)}</b></div>
      <div class="srv-lucro ${r.lucro >= 0 ? "pos" : "neg"}"><span>Lucro${r.margem != null ? ` · margem ${num(r.margem * 100, 0)}%` : ""}</span><b>${brl(r.lucro)}</b></div>
      <div><span>Recebido</span><b class="pos">${brl(r.recebido)}</b></div>
      <div><span>A receber</span><b class="${r.aReceber > 0.5 ? "amarelo" : ""}">${brl(r.aReceber)}</b></div>
      <div><span>Horas${r.custoHora != null ? ` · custo ${brl0(r.custoHora)}/h` : ""}</span><b>${num(r.horas)} h</b></div>
    </div>
    ${podeEditar ? `<div class="srv-acoes">
      ${vejoFinanceiro ? `<button type="button" class="btn-primario" onclick="registrarRecebimentoServico(${sv.id})">${icone("entrada", "icone-sm")} Registrar recebimento</button>` : ""}
      <button type="button" class="btn-fantasma" onclick="novoComServico(${sv.id}, () => abrirModalRecebimento(null))">${icone("relogio", "icone-sm")} Horas</button>
      <button type="button" class="btn-fantasma" onclick="novoComServico(${sv.id}, () => abrirModalDiesel(null))">${icone("abastecimento", "icone-sm")} Abastecimento</button>
      ${vejoFinanceiro ? `<button type="button" class="btn-fantasma" onclick="novoComServico(${sv.id}, () => abrirModalLancamento(null, 'saida'))">${icone("saida", "icone-sm")} Despesa</button>` : ""}
      <button type="button" class="btn-fantasma" onclick="novoComServico(${sv.id}, () => abrirModalManutencao(null))">${icone("manutencao", "icone-sm")} Manutenção</button>
      <button type="button" class="btn-fantasma" onclick="fecharModal(); abrirModalServico(${sv.id})">${icone("pencil", "icone-sm")} Editar serviço</button>
    </div>` : ""}
    ${grupos.length ? `<h3 class="grupo-titulo">Custos por tipo</h3><div class="grupos">${grupos.map(([g, v]) => `
      <div class="grupo-linha"><span class="grupo-nome">${escHtml(g)}</span>
        <div class="grupo-barra-fundo"><div class="grupo-barra" style="width:${(v / maxG * 100).toFixed(1)}%;background:${CORES_GRUPO[g] || "#8B919C"}"></div></div>
        <span class="grupo-valor">${brl0(v)}</span></div>`).join("")}</div>` : ""}
    <h3 class="grupo-titulo">Movimentações <span>${movs.length}</span></h3>
    <div class="lista-cartao">${movs.length ? movs.map(l => `
      <div class="registro-item" role="button" tabindex="0" onclick="abrirLancamentoDoServico(${l.id})" onkeydown="teclaLinha(event)">
        <span class="registro-icone" style="--cor-tile:${l.entrada > 0 ? "#3ECF8E" : (CORES_GRUPO[l.grupo] || "#8B919C")}">${icone(l.entrada > 0 ? "entrada" : "saida")}</span>
        <span class="registro-texto"><b>${escHtml(l.descricao || l.grupo)}</b><small>${fData(l.data)} · ${escHtml(l.grupo)}${l.status === "pendente" ? " · pendente" : ""}</small></span>
        <span class="registro-data ${l.entrada > 0 ? "pos" : ""}">${l.entrada > 0 ? "+ " + brl(l.entrada) : brl(l.saida)}</span>
      </div>`).join("") : `<div class="vazio">Nenhum custo ou recebimento ligado ainda.</div>`}</div>
    ${r.recs.length ? `<h3 class="grupo-titulo">Horas <span>${r.recs.length}</span></h3>
    <div class="lista-cartao">${r.recs.slice().reverse().map(x => `
      <div class="registro-item" role="button" tabindex="0" onclick="fecharModal(); aoClicarLinha(() => abrirModalRecebimento(${x.id}))" onkeydown="teclaLinha(event)">
        <span class="registro-icone" style="--cor-tile:#4DA3FF">${icone("relogio")}</span>
        <span class="registro-texto"><b>${num(x.horas || 0)} h${x.operador ? " · " + escHtml(x.operador) : ""}</b><small>${fData(x.data)}${x.hora_final != null ? " · horímetro " + num(x.hora_inicial) + " → " + num(x.hora_final) : ""}</small></span>
        <span class="registro-data">${nomeEquipamento(x.equipamento_id)}</span>
      </div>`).join("")}</div>` : ""}
    ${sv.observacao ? `<p class="cartao-nota srv-obs">${escHtml(sv.observacao)}</p>` : ""}`;
  abrirModal({ titulo: sv.nome, tabela: "_detalhe_servico", corpoCustom: html, semSalvar: true, folha: true });
}

function abrirLancamentoDoServico(id) {
  const origem = origemDoLancamento(id);
  fecharModal();
  if (origem) { aoClicarLinha(() => window[origem.fn](origem.id)); return; }
  if (dados.lanc.some(l => l.id === id)) { aoClicarLinha(() => abrirModalLancamento(id)); return; }
  toast("Esse lançamento é de outro equipamento: troque para Total do negócio para editar.");
}

/* ── Formulário do serviço ── */
function abrirModalServico(id) {
  if (meuPapel === "leitura") { toast("Seu acesso é somente leitura."); return; }
  const sv = id ? dados.servicos.find(x => x.id === id) : null;
  const cmp = (n) => document.querySelector(`#modal-campos [data-campo="${n}"]`);
  const ajustarCobranca = (v) => {
    cmp("valor_hora")?.closest("label")?.classList.toggle("oculto", v === "fechado");
    cmp("valor_fechado")?.closest("label")?.classList.toggle("oculto", v !== "fechado");
  };
  abrirModal({
    titulo: sv ? "Editar serviço" : "Novo serviço",
    tabela: "servicos", id,
    tituloExclusao: sv ? `o serviço "${sv.nome}"` : null,
    avisoExcluir: sv ? "Abastecimentos, horas e lançamentos ligados a ele continuam existindo, só perdem o vínculo com o serviço." : null,
    campos: [
      { nome: "nome", rotulo: "Nome do serviço", tipo: "texto", largo: true, valor: sv?.nome || "", obrigatorio: true },
      { nome: "cliente", rotulo: "Cliente", tipo: "texto", valor: sv?.cliente || "", lista: nomesAtivos(dados.clientes),
        aoMudar(nome) {
          const c = dados.clientes.find(x => x.nome === nome);
          if (c && c.valor_hora_padrao && cmp("valor_hora")) cmp("valor_hora").value = moedaMascara(c.valor_hora_padrao);
        } },
      { nome: "equipamento_id", rotulo: "Equipamento", tipo: "select", opcoes: opcoesEquipamento(false).concat("|Vários / não definido"), valor: sv ? (sv.equipamento_id != null ? String(sv.equipamento_id) : "") : equipamentoPadrao(null, true) },
      { nome: "data_inicio", rotulo: "Início", tipo: "date", valor: sv?.data_inicio || hoje(), obrigatorio: true },
      { nome: "data_fim", rotulo: "Fim (previsto ou real)", tipo: "date", valor: sv?.data_fim || "" },
      { nome: "cobranca", rotulo: "Como vai cobrar", tipo: "select", opcoes: ["hora|Por hora trabalhada", "fechado|Valor fechado"], valor: sv?.cobranca || "hora", aoMudar: ajustarCobranca },
      { nome: "valor_hora", rotulo: "Valor da hora (R$)", tipo: "moeda", valor: sv?.valor_hora ?? "", oculto: sv?.cobranca === "fechado" },
      { nome: "valor_fechado", rotulo: "Valor fechado (R$)", tipo: "moeda", valor: sv?.valor_fechado ?? "", oculto: (sv?.cobranca || "hora") !== "fechado" },
      { nome: "status", rotulo: "Situação", tipo: "select", opcoes: ["andamento|Em andamento", "concluido|Concluído (gera o a receber)", "cancelado|Cancelado"], valor: sv?.status || "andamento" },
      { nome: "observacao", rotulo: "Observação", tipo: "texto", largo: true, valor: sv?.observacao || "" },
    ],
    montar(f) {
      if (!f.nome.trim()) throw "Dê um nome ao serviço.";
      if (f.data_fim && f.data_fim < f.data_inicio) throw "O fim não pode ser antes do início.";
      const vh = numDeMoeda(f.valor_hora), vf = numDeMoeda(f.valor_fechado);
      if (f.cobranca === "fechado" && !vf) throw "Informe o valor fechado do serviço.";
      return {
        nome: f.nome.trim(), cliente: f.cliente.trim() || null,
        equipamento_id: f.equipamento_id ? Number(f.equipamento_id) : null,
        data_inicio: f.data_inicio, data_fim: f.data_fim || (f.status === "concluido" ? hoje() : null),
        cobranca: f.cobranca, valor_hora: vh || null, valor_fechado: vf || null,
        status: f.status, observacao: f.observacao.trim() || null,
      };
    },
    async aposSalvar(salvo) { await sincronizarRecebivelServico(salvo.id); },
    async aoExcluir() { if (sv?.agenda_id) await sb.from("agenda").delete().eq("id", sv.agenda_id); },
  });
}

/* ── Recebimento do serviço (pagamento no fim, parcial ou adiantado) ── */
function registrarRecebimentoServico(id) {
  const sv = dados.servicos.find(x => x.id === id);
  if (!sv) return;
  const r = resumoServico(sv);
  fecharModal();
  abrirModal({
    titulo: "Recebimento — " + sv.nome,
    tabela: "_receber_servico",
    rotuloSalvar: "Registrar recebimento",
    campos: [
      { nome: "valor", rotulo: "Valor recebido (R$)", tipo: "moeda", largo: true, valor: r.aReceber > 0 ? r.aReceber : "", obrigatorio: true },
      { nome: "data", rotulo: "Data", tipo: "date", valor: hoje(), obrigatorio: true },
      { nome: "banco", rotulo: "Conta", tipo: "select", opcoes: opcoesContaBancaria(), valor: contaPadrao() },
      { nome: "concluir", rotulo: "Marcar o serviço como concluído", tipo: "checkbox", largo: true, valor: sv.status !== "andamento" || r.aReceber > 0 },
      { nome: "obs", rotulo: "Observação (opcional)", tipo: "texto", largo: true, valor: "" },
    ],
    montar(f) {
      const v = numDeMoeda(f.valor);
      if (!v || v <= 0) throw "Informe o valor recebido.";
      return { v, data: f.data, banco: f.banco, concluir: !!f.concluir, obs: f.obs.trim() };
    },
    async aoSalvar(x) {
      const btn = $("modal-salvar"), erro = $("modal-erro");
      btn.disabled = true;
      try {
        const { error } = await sb.from("lancamentos").insert(marcarBase({
          data: x.data, banco: x.banco, grupo: "Recebimentos", subgrupo: "",
          entrada: x.v, saida: 0, natureza: "Receita", status: "pago",
          descricao: `Recebimento — ${sv.nome}${sv.cliente ? " (" + sv.cliente + ")" : ""}${x.obs ? " · " + x.obs : ""}`,
          equipamento_id: sv.equipamento_id, centro_custo_id: null, servico_id: sv.id,
        }));
        if (error) throw error;
        if (x.concluir && sv.status === "andamento") {
          const { error: e2 } = await sb.from("servicos").update({ status: "concluido", data_fim: sv.data_fim || x.data }).eq("id", sv.id);
          if (e2) throw e2;
        }
        await sincronizarRecebivelServico(sv.id);
      } catch (e) {
        btn.disabled = false;
        erro.textContent = "Não foi possível registrar: " + (e.message || e);
        erro.classList.remove("oculto");
        return;
      }
      btn.disabled = false;
      fecharModal();
      toast(`Recebimento de ${brl(x.v)} registrado.`);
      await carregarTudo();
    },
  });
}

// Serviço concluído com saldo a receber → aparece em Contas → A receber
// (e some quando é recebido por inteiro). Busca no banco, não na tela.
async function sincronizarRecebivelServico(id) {
  if (!id || !dados.temServicos) return;
  try {
    const [{ data: sv }, { data: recs }, { data: lancs }] = await Promise.all([
      sb.from("servicos").select("*").eq("id", id).single(),
      sb.from("recebimentos").select("horas,valor_hora").eq("servico_id", id),
      sb.from("lancamentos").select("entrada,status").eq("servico_id", id),
    ]);
    if (!sv) return;
    const s = normNum(sv, "servicos");
    const receita = s.cobranca === "fechado" ? Number(s.valor_fechado || 0)
      : (recs || []).reduce((t, r) => t + Number(r.horas || 0) * Number(s.valor_hora || r.valor_hora || 0), 0);
    const recebido = (lancs || []).filter(l => l.status !== "pendente").reduce((t, l) => t + Number(l.entrada || 0), 0);
    const saldo = Math.round((receita - recebido) * 100) / 100;
    await sincronizarAgendaEspelho({
      origemId: s.id, origemTabela: "servicos", agendaId: s.agenda_id,
      pendente: s.status === "concluido" && saldo > 0.004,
      item: "A receber - " + s.nome + (s.cliente ? " (" + s.cliente + ")" : ""),
      data: s.data_fim || hoje(), valor: -saldo,
      natureza: "Receita", centroCustoId: null, equipamentoId: s.equipamento_id, grupo: "Recebimentos",
    });
  } catch (e) { console.error("Falha ao atualizar o a receber do serviço:", e); }
}
