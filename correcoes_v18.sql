-- ============================================================
-- CORREÇÕES v18 — CHECKBOX "RECEBIDO?" EM RECEBIMENTOS
-- Execute no SQL Editor do Supabase (depois de v1 a v17).
--
-- Substitui a lógica automática de "saldo a receber" por uma decisão
-- simples: Recebido? Se sim, lança no Extrato (realizado). Se não, fica
-- só na Agenda como compromisso a receber — não achata mais o saldo em
-- caixa com pendências parciais automáticas.
-- ============================================================

alter table recebimentos add column if not exists recebido boolean not null default true;

-- Estimativa razoável pros registros que já existiam: considera recebido
-- só quem já tinha o valor pago igual (ou maior) que o valor total.
update recebimentos set recebido = (valor_pago >= valor_total and valor_total > 0);
