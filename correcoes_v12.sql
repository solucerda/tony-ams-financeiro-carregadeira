-- ============================================================
-- CORREÇÕES v12 — DIESEL/MANUTENÇÃO "A PAGAR" APARECEM NA AGENDA
-- Execute no SQL Editor do Supabase (depois de v1 a v11).
--
-- Antes, "a pagar" só criava uma linha pendente no Extrato — mas não
-- aparecia na Agenda, que é onde vocês esperam ver o calendário de
-- compromissos financeiros. Agora, ao marcar Diesel ou Manutenção como
-- "a pagar", o app cria automaticamente um compromisso espelho na Agenda.
-- Ele some sozinho quando você dá baixa (nesse momento já virou uma
-- movimentação realizada no Extrato, não precisa mais aparecer como
-- pendência na Agenda).
-- ============================================================

-- Marca de onde veio um compromisso da Agenda (nulo = criado manualmente)
alter table agenda add column if not exists origem_tabela text;
alter table agenda add column if not exists origem_id bigint;

-- Vínculo de volta: qual linha da Agenda espelha este Diesel/Manutenção
alter table diesel      add column if not exists agenda_id bigint references agenda(id) on delete set null;
alter table manutencoes add column if not exists agenda_id bigint references agenda(id) on delete set null;

-- Preenchimento retroativo: cria o compromisso espelho pros abastecimentos
-- e manutenções que JÁ estavam pendentes antes desta migração — sem isso,
-- só apareceriam na Agenda na próxima vez que fossem editados e salvos.
insert into agenda (item, dia, mes, ano, valor, natureza, centro_custo_id, equipamento_id, grupo, status_pagamento, origem_tabela, origem_id)
select
  'Abastecimento' || case when local <> '' then ' - ' || local else '' end,
  extract(day from vencimento)::text,
  extract(month from vencimento)::int,
  extract(year from vencimento)::int,
  valor_total, natureza, centro_custo_id, equipamento_id, 'Combustível', 'pendente', 'diesel', id
from diesel
where status = 'pendente' and agenda_id is null and vencimento is not null;

update diesel d set agenda_id = ag.id
  from agenda ag where ag.origem_tabela = 'diesel' and ag.origem_id = d.id and d.agenda_id is null;

insert into agenda (item, dia, mes, ano, valor, natureza, centro_custo_id, equipamento_id, grupo, status_pagamento, origem_tabela, origem_id)
select
  'Manutenção' || case when fornecedor <> '' then ' - ' || fornecedor else '' end,
  extract(day from coalesce(vencimento, data))::text,
  extract(month from coalesce(vencimento, data))::int,
  extract(year from coalesce(vencimento, data))::int,
  valor_total, natureza, centro_custo_id, equipamento_id, 'Manutenção', 'pendente', 'manutencoes', id
from manutencoes
where not (realizada and status_pagamento = 'pago') and agenda_id is null and valor_total > 0;

update manutencoes m set agenda_id = ag.id
  from agenda ag where ag.origem_tabela = 'manutencoes' and ag.origem_id = m.id and m.agenda_id is null;
