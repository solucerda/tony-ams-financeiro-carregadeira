-- ============================================================
-- CORREÇÕES v16 — VÍNCULO ENTRE ABASTECIMENTO PRINCIPAL E CARRO DE APOIO
-- Execute no SQL Editor do Supabase (depois de v1 a v15).
--
-- Permite agrupar visualmente os dois abastecimentos (máquina + carro de
-- apoio) numa linha só na aba Abastecimento, com detalhamento ao clicar.
-- ============================================================

alter table diesel add column if not exists grupo_abastecimento_id bigint references diesel(id) on delete set null;
