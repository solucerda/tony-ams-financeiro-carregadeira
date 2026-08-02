-- ============================================================
-- CORREÇÕES v6 — CENTRO DE CUSTO
-- Execute no SQL Editor do Supabase (depois de v1 a v5).
-- ============================================================

-- Lista fixa usada pelo app: Operacional, Administrativo, Comercial,
-- Manutenção, Financeiro, Diretoria.

alter table lancamentos add column if not exists centro_custo text not null default 'Operacional'
  check (centro_custo in ('Operacional','Administrativo','Comercial','Manutenção','Financeiro','Diretoria'));

alter table diesel add column if not exists centro_custo text not null default 'Operacional'
  check (centro_custo in ('Operacional','Administrativo','Comercial','Manutenção','Financeiro','Diretoria'));

alter table manutencoes add column if not exists centro_custo text not null default 'Manutenção'
  check (centro_custo in ('Operacional','Administrativo','Comercial','Manutenção','Financeiro','Diretoria'));

alter table agenda add column if not exists centro_custo text not null default 'Administrativo'
  check (centro_custo in ('Operacional','Administrativo','Comercial','Manutenção','Financeiro','Diretoria'));

-- Os lançamentos que vieram do Diesel/Manutenção herdam o centro de custo
-- 'Operacional'/'Manutenção' por padrão — ajuste manualmente no Table
-- Editor os que já existiam e você souber que pertencem a outro centro.
