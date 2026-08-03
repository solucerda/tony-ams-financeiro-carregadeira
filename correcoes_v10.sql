-- ============================================================
-- CORREÇÕES v10 — NOVOS CADASTROS ADMINISTRÁVEIS
-- Execute no SQL Editor do Supabase (depois de v1 a v9).
--
-- Adiciona: Clientes, Fornecedores, Grupos de despesa, Contas bancárias,
-- Operadores, Obras/Contratos e Feriados — todos gerenciáveis pela aba
-- Administração. Nenhum desses vira campo obrigatório: os textos livres
-- que já existiam continuam funcionando, os cadastros só passam a
-- alimentar o autocomplete e (no caso de Grupos/Contas) as listas fixas
-- que antes só podiam ser mudadas editando o código.
-- ============================================================

-- Clientes — guarda telefone e valor de hora padrão pra não redigitar
create table if not exists clientes (
  id bigint generated always as identity primary key,
  nome text not null unique,
  telefone text not null default '',
  valor_hora_padrao numeric,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table clientes enable row level security;
drop policy if exists "auth_clientes" on clientes;
create policy "auth_clientes" on clientes for all to authenticated using (true) with check (true);
insert into clientes (nome)
  select distinct cliente from recebimentos where cliente is not null and cliente <> ''
  on conflict (nome) do nothing;

-- Fornecedores — postos de combustível, oficinas etc.
create table if not exists fornecedores (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table fornecedores enable row level security;
drop policy if exists "auth_fornecedores" on fornecedores;
create policy "auth_fornecedores" on fornecedores for all to authenticated using (true) with check (true);
insert into fornecedores (nome)
  select distinct local from diesel where local is not null and local <> ''
  union
  select distinct fornecedor from manutencoes where fornecedor is not null and fornecedor <> ''
  on conflict (nome) do nothing;

-- Grupos de despesa — antes era uma lista fixa no código
create table if not exists grupos_despesa (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table grupos_despesa enable row level security;
drop policy if exists "auth_grupos_despesa" on grupos_despesa;
create policy "auth_grupos_despesa" on grupos_despesa for all to authenticated using (true) with check (true);
insert into grupos_despesa (nome) values
  ('Combustível'),('Financiamento'),('Investimento'),('Manutenção'),
  ('Pessoal'),('Seguro Frota'),('Tarifas'),('Taxas fixas'),('Outras despesas')
on conflict (nome) do nothing;

-- Contas bancárias — antes era uma lista fixa no código
create table if not exists contas_bancarias (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table contas_bancarias enable row level security;
drop policy if exists "auth_contas_bancarias" on contas_bancarias;
create policy "auth_contas_bancarias" on contas_bancarias for all to authenticated using (true) with check (true);
insert into contas_bancarias (nome) values ('Bradesco'),('Caixa')
  on conflict (nome) do nothing;

-- Operadores — quem estava na máquina
create table if not exists operadores (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table operadores enable row level security;
drop policy if exists "auth_operadores" on operadores;
create policy "auth_operadores" on operadores for all to authenticated using (true) with check (true);
alter table recebimentos add column if not exists operador text not null default '';

-- Obras/Contratos — pra separar rentabilidade por obra, além do cliente
create table if not exists obras (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table obras enable row level security;
drop policy if exists "auth_obras" on obras;
create policy "auth_obras" on obras for all to authenticated using (true) with check (true);
alter table recebimentos add column if not exists obra text not null default '';

-- Feriados — usado no alerta de dia não útil da Agenda, além de sábado/domingo
create table if not exists feriados (
  id bigint generated always as identity primary key,
  data date not null unique,
  descricao text not null default '',
  criado_em timestamptz not null default now()
);
alter table feriados enable row level security;
drop policy if exists "auth_feriados" on feriados;
create policy "auth_feriados" on feriados for all to authenticated using (true) with check (true);
-- feriados nacionais fixos de 2026 (os móveis como Carnaval/Páscoa
-- precisam ser cadastrados manualmente pela aba Administração)
insert into feriados (data, descricao) values
  ('2026-01-01','Confraternização Universal'),
  ('2026-04-21','Tiradentes'),
  ('2026-05-01','Dia do Trabalho'),
  ('2026-09-07','Independência do Brasil'),
  ('2026-10-12','Nossa Senhora Aparecida'),
  ('2026-11-02','Finados'),
  ('2026-11-15','Proclamação da República'),
  ('2026-12-25','Natal')
on conflict (data) do nothing;
