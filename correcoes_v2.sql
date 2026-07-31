-- ============================================================
-- CORREÇÕES v2 — CONTAS A PAGAR NO DIESEL
-- Execute no SQL Editor do Supabase (depois do correcoes.sql).
-- Adiciona local/fornecedor, situação (pago/a pagar) e vencimento
-- aos abastecimentos, para dar controle de contas a pagar.
-- ============================================================

alter table diesel add column if not exists local text not null default '';
alter table diesel add column if not exists status text not null default 'pago' check (status in ('pago','pendente'));
alter table diesel add column if not exists vencimento date;

-- Os abastecimentos já cadastrados continuam marcados como "pago" por
-- padrão (é o comportamento que o app já tinha antes desta versão).
