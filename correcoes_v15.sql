-- ============================================================
-- CORREÇÕES v15 — PERMITE GNV COMO COMBUSTÍVEL
-- Execute no SQL Editor do Supabase (depois de v1 a v14).
--
-- Bug encontrado: o formulário do carro de apoio já oferecia "GNV" como
-- opção de combustível, mas a trava (check constraint) da coluna só
-- permitia Diesel/Gasolina/Etanol/Flex — ao tentar salvar um abastecimento
-- de GNV, o banco recusava. Corrigido.
-- ============================================================

alter table diesel drop constraint if exists diesel_combustivel_check;
alter table diesel add constraint diesel_combustivel_check
  check (combustivel in ('Diesel','Gasolina','Etanol','Flex','GNV'));
