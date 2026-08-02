-- ============================================================
-- CORREÇÕES v7 — CENTRO DE CUSTO VIRA CADASTRO (não lista fixa)
-- Execute no SQL Editor do Supabase (depois de v1 a v6).
--
-- Motivo: "centro de custo" na prática representa coisas como cartão de
-- crédito, financiamento bancário, conta corrente etc. — itens que vocês
-- vão querer cadastrar e ajustar ao longo do tempo, não uma lista fixa
-- de departamentos. Isso agora é uma tabela de verdade, gerenciável pela
-- aba "Administração" do app.
-- ============================================================

create table if not exists centros_custo (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table centros_custo enable row level security;
drop policy if exists "auth_centros_custo" on centros_custo;
create policy "auth_centros_custo" on centros_custo for all to authenticated using (true) with check (true);

-- Migra os valores fixos que já existiam (v6) para linhas de verdade,
-- assim nenhum lançamento perde a classificação.
insert into centros_custo (nome)
  select distinct centro_custo from lancamentos where centro_custo is not null
  union
  select distinct centro_custo from diesel where centro_custo is not null
  union
  select distinct centro_custo from manutencoes where centro_custo is not null
  union
  select distinct centro_custo from agenda where centro_custo is not null
on conflict (nome) do nothing;

-- Adiciona a referência (FK) em cada tabela...
alter table lancamentos  add column if not exists centro_custo_id bigint references centros_custo(id) on delete set null;
alter table diesel       add column if not exists centro_custo_id bigint references centros_custo(id) on delete set null;
alter table manutencoes  add column if not exists centro_custo_id bigint references centros_custo(id) on delete set null;
alter table agenda       add column if not exists centro_custo_id bigint references centros_custo(id) on delete set null;

-- ...e preenche a partir do texto antigo.
update lancamentos  set centro_custo_id = (select id from centros_custo where nome = lancamentos.centro_custo);
update diesel       set centro_custo_id = (select id from centros_custo where nome = diesel.centro_custo);
update manutencoes  set centro_custo_id = (select id from centros_custo where nome = manutencoes.centro_custo);
update agenda       set centro_custo_id = (select id from centros_custo where nome = agenda.centro_custo);

-- Remove a coluna de texto antiga (com a lista fixa/check constraint) —
-- ela foi totalmente substituída pela referência acima.
alter table lancamentos  drop column if exists centro_custo;
alter table diesel       drop column if exists centro_custo;
alter table manutencoes  drop column if exists centro_custo;
alter table agenda       drop column if exists centro_custo;

-- Sugestão: depois de rodar isto, abra a aba "Administração" no app e
-- renomeie/adicione os centros de custo reais (ex.: "Cartão Nubank",
-- "Financiamento Caixa - Pá Carregadeira", "Conta corrente Bradesco").
-- Os 6 nomes antigos (Operacional, Administrativo etc.) ficaram cadastrados
-- automaticamente — edite ou desative os que não fizerem sentido.
