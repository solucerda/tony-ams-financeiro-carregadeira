-- ============================================================
-- CORREÇÕES v9 — BAIXA NA AGENDA COM SINCRONIZAÇÃO NO EXTRATO
-- Execute no SQL Editor do Supabase (depois de v1 a v8).
--
-- Reintroduz o controle de pagamento na Agenda — mas dessa vez com o
-- mesmo mecanismo do Diesel e da Manutenção: ao marcar como "Pago", o
-- app cria automaticamente a movimentação correspondente no Extrato
-- (e remove se você voltar o status para "Em aberto").
-- ============================================================

alter table agenda add column if not exists status_pagamento text not null default 'pendente'
  check (status_pagamento in ('pago','pendente'));
alter table agenda add column if not exists data_pagamento date;
alter table agenda add column if not exists grupo text not null default 'Outras despesas';
alter table agenda add column if not exists lancamento_id bigint references lancamentos(id) on delete set null;
