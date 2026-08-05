-- ============================================================
-- CORREÇÕES v21 — FOTO DE USUÁRIO E DE EQUIPAMENTO
-- Execute no SQL Editor do Supabase (depois de v1 a v20).
--
-- Guarda um LINK de imagem (não faz upload de arquivo — isso exigiria
-- configurar um bucket de Storage no Supabase, um passo a mais). Cole o
-- link de uma imagem já hospedada (Google Drive com link público, Imgur
-- etc.) no perfil do usuário ou no cadastro do equipamento.
-- ============================================================

alter table perfis add column if not exists avatar_url text;
alter table equipamentos add column if not exists imagem_url text;
