-- ============================================================
-- CORREÇÕES v14 — CENTRO DE CUSTO EM RECEBIMENTOS
-- Execute no SQL Editor do Supabase (depois de v1 a v13).
--
-- Indica pra qual conta/centro o dinheiro recebido entrou (ex.: "Conta
-- corrente Bradesco", "Caixa/Dinheiro") — usa o mesmo cadastro de centros
-- de custo já usado em Extrato, Diesel/Abastecimento, Manutenção e Agenda.
-- ============================================================

alter table recebimentos add column if not exists centro_custo_id bigint references centros_custo(id) on delete set null;
