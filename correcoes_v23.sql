-- ============================================================
-- CORREÇÕES v23 — CHAVE DA NOTA FISCAL (leitura do QR Code)
-- Execute no SQL Editor do Supabase (depois do v22).
--
-- Guarda a chave de acesso de 44 dígitos lida do QR Code da nota anexada ao
-- abastecimento. Serve pra avisar quando a mesma nota é lançada duas vezes.
-- ============================================================

alter table diesel add column if not exists nota_chave text;
create index if not exists diesel_nota_chave_idx on diesel (nota_chave) where nota_chave is not null;
