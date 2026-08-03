-- ============================================================
-- CORREÇÕES v11 — EXTRATO PASSA A REFLETIR "A PAGAR" DE VERDADE
-- Execute no SQL Editor do Supabase (depois de v1 a v10).
--
-- Duas correções encontradas numa varredura pedida pelo usuário:
--
-- 1) Diesel/Manutenção/Agenda marcados como "a pagar" não geravam NENHUMA
--    movimentação no Extrato — a informação ficava presa na própria aba.
--    Agora sempre sincronizam, com uma situação (status) de pago/pendente.
--
-- 2) Bug mais sério: a movimentação criada automaticamente por Diesel/
--    Manutenção/Agenda/Recebimentos nunca preenchia o campo equipamento_id
--    — por isso ela desaparecia do Extrato ao filtrar por um equipamento
--    específico (só aparecia no modo "Total do negócio"). Corrigido daqui
--    pra frente e também retroativamente nos dados que já existem.
-- ============================================================

-- 1) Situação do lançamento: pago (realizado) ou pendente (a pagar/receber,
--    ainda não afeta o saldo em caixa).
alter table lancamentos add column if not exists status text not null default 'pago'
  check (status in ('pago','pendente'));

-- 2) Corrige retroativamente o equipamento das movimentações que já foram
--    criadas automaticamente e ficaram com equipamento_id em branco.
update lancamentos l set equipamento_id = d.equipamento_id
  from diesel d where d.lancamento_id = l.id and l.equipamento_id is null;
update lancamentos l set equipamento_id = m.equipamento_id
  from manutencoes m where m.lancamento_id = l.id and l.equipamento_id is null;
update lancamentos l set equipamento_id = a.equipamento_id
  from agenda a where a.lancamento_id = l.id and l.equipamento_id is null;
update lancamentos l set equipamento_id = r.equipamento_id
  from recebimentos r where r.lancamento_id = l.id and l.equipamento_id is null;
