-- ============================================================
-- CORREÇÕES v8 — REMOVE "JÁ FOI PAGO" DA AGENDA
-- Execute no SQL Editor do Supabase (depois de v1 a v7).
--
-- A baixa de pagamento passa a ser controlada individualmente em cada
-- lançamento (Extrato, Diesel, Manutenção) — a Agenda volta a ser só
-- a previsão dos compromissos, sem duplicar esse controle.
-- ============================================================

alter table agenda drop column if exists pago;

-- Nada muda na máscara monetária (R$ 0,00) — isso é só front-end (app.js),
-- não precisa de nenhuma alteração no banco.
