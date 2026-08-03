-- ============================================================
-- CORREÇÕES v13 — CARRO DE APOIO (VEÍCULO) E OUTROS COMBUSTÍVEIS
-- Execute no SQL Editor do Supabase (depois de v1 a v12).
--
-- A aba "Diesel" vira "Abastecimento" no app (por baixo continua sendo a
-- mesma tabela — evita uma migração arriscada de renomear tudo). Agora
-- aceita combustível (Diesel/Gasolina/Etanol/Flex) e hodômetro (km), além
-- do horímetro que já existia — máquina usa horímetro, veículo usa
-- hodômetro.
-- ============================================================

-- Tipo do equipamento: Máquina (controla por horímetro) ou Veículo
-- (controla por hodômetro/km). Tudo que já existe é "Maquina" por padrão.
alter table equipamentos add column if not exists tipo text not null default 'Maquina'
  check (tipo in ('Maquina','Veiculo'));

-- Combustível do abastecimento — tudo que já existe é "Diesel" por padrão.
alter table diesel add column if not exists combustivel text not null default 'Diesel'
  check (combustivel in ('Diesel','Gasolina','Etanol','Flex'));

-- Hodômetro (km), alternativa ao horímetro pra veículos.
alter table diesel add column if not exists hodometro_inicial numeric;
alter table diesel add column if not exists hodometro_final numeric;
