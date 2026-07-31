-- ============================================================
-- CORREÇÕES v3 — CLASSIFICAÇÃO POR NATUREZA (FIXO/VARIÁVEL/INVESTIMENTO)
-- Execute no SQL Editor do Supabase (depois do correcoes.sql e do
-- correcoes_v2.sql).
-- ============================================================

-- 1) Extrato: toda saída ganha uma natureza; toda entrada é 'Receita'
--    automaticamente (o app cuida disso ao salvar — aqui só classificamos
--    o que já existe).
alter table lancamentos add column if not exists natureza text not null default 'Variavel'
  check (natureza in ('Fixo','Variavel','Investimento','Receita'));

update lancamentos set natureza = 'Receita' where entrada > 0;
update lancamentos set natureza = 'Investimento' where grupo = 'Investimento';
update lancamentos set natureza = 'Fixo'
  where grupo in ('Financiamento','Seguro Frota','Taxas fixas','Tarifas');
-- Combustível, Manutenção, Pessoal e Outras despesas ficam como "Variavel"
-- (o valor padrão da coluna) — ajuste manualmente no Table Editor os casos
-- que você souber que são fixos (ex.: uma mensalidade de manutenção).

-- 2) Diesel: cada abastecimento também é classificado (default variável,
--    já que o consumo muda mês a mês).
alter table diesel add column if not exists natureza text not null default 'Variavel'
  check (natureza in ('Fixo','Variavel'));

-- 3) Agenda: compromissos futuros também recebem natureza, pra dar visão
--    de quanto do previsto é fixo/variável/investimento.
alter table agenda add column if not exists natureza text not null default 'Fixo'
  check (natureza in ('Fixo','Variavel','Investimento'));

update agenda set natureza = 'Investimento'
  where item ilike '%consórcio%' or item ilike '%consorcio%' or item ilike '%financiamento%';
update agenda set natureza = 'Variavel'
  where item ilike '%combustível%' or item ilike '%combustivel%' or item ilike '%abastecimento%'
     or item ilike '%frete%' or item ilike '%deslocamento%';
-- os demais (seguro, cartão, rastreador etc.) ficam como "Fixo", que é o padrão.
