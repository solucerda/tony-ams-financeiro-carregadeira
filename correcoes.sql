-- ============================================================
-- CORREÇÕES — GERENCIADOR FINANCEIRO (TA TRANSPORTE)
-- Execute este script UMA VEZ no SQL Editor do Supabase, no
-- projeto que já tem o schema.sql original rodado.
-- Não repete os dados: só ajusta o que já existe e prepara o
-- banco para as novas funções do app (sincronização automática
-- com o extrato e "marcar como pago" na agenda).
-- ============================================================

-- 1) Colunas novas: ligam um registro de Recebimentos/Diesel ao
--    lançamento que o app passa a criar/atualizar automaticamente
--    no Extrato. "on delete set null" evita erro se o lançamento
--    for apagado direto pelo Table Editor.
alter table recebimentos add column if not exists lancamento_id bigint references lancamentos(id) on delete set null;
alter table diesel       add column if not exists lancamento_id bigint references lancamentos(id) on delete set null;

-- 2) Coluna nova: marca um compromisso da Agenda como pago.
alter table agenda add column if not exists pago boolean not null default false;

-- 3) Datas erradas na migração original (ano 2027 em vez de 2026).
update diesel set data = '2026-04-04'
where data = '2027-04-04';

-- 4) Linhas "de totais" que vieram da planilha misturadas com os
--    compromissos reais da Agenda. Elas somavam junto com os itens
--    de verdade e inflavam o gráfico e o "total previsto" (o app
--    agora calcula esses totais sozinho, então essas linhas ficaram
--    redundantes e causavam contagem em dobro).
delete from agenda where item in (
  'Total à pagar',
  'Total Pago',
  'Saldo à pagar',
  'Valor estimado de hora',
  'Quant. Hr à trabalhar (pagar despesas)'
);

-- Pronto. Depois de rodar isto, publique os arquivos atualizados
-- (app.js, index.html, style.css) e recarregue o site.
