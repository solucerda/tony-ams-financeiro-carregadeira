-- ============================================================
-- CORREÇÕES v5 — AGENDA COM ANO (replicação por vários meses +
-- alerta de dia não útil)
-- Execute no SQL Editor do Supabase (depois de v1 a v4).
-- ============================================================

-- A Agenda até aqui só guardava mês/dia (era uma matriz anual solta, sem
-- distinguir o ano). Para replicar um compromisso por vários meses com
-- datas reais — e poder checar se a data cai num fim de semana — ela
-- precisa saber o ano de cada compromisso.
alter table agenda add column if not exists ano int not null default extract(year from current_date)::int;

-- Os compromissos já cadastrados são todos de 2026 (o ano dos dados
-- migrados da planilha original).
update agenda set ano = 2026;
