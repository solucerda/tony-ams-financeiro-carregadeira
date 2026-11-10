-- v24: separa a "base antiga" (operação inicial, bagunçada) da operação nova.
-- Nada é apagado: os registros existentes ganham legado = true e o app passa
-- a mostrar só os novos por padrão (botão "Base" no topo troca a visão).
-- Antes de marcar, copia tudo para o schema backup_20261110 (não exposto pela API).

create schema if not exists backup_20261110;
revoke all on schema backup_20261110 from public, anon, authenticated;

create table if not exists backup_20261110.lancamentos  as select * from public.lancamentos;
create table if not exists backup_20261110.recebimentos as select * from public.recebimentos;
create table if not exists backup_20261110.diesel       as select * from public.diesel;
create table if not exists backup_20261110.agenda       as select * from public.agenda;
create table if not exists backup_20261110.manutencoes  as select * from public.manutencoes;
create table if not exists backup_20261110.config       as select * from public.config;

alter table public.lancamentos  add column if not exists legado boolean not null default false;
alter table public.recebimentos add column if not exists legado boolean not null default false;
alter table public.diesel       add column if not exists legado boolean not null default false;
alter table public.agenda       add column if not exists legado boolean not null default false;
alter table public.manutencoes  add column if not exists legado boolean not null default false;

-- tudo o que existe agora é base antiga
update public.lancamentos  set legado = true where legado = false;
update public.recebimentos set legado = true where legado = false;
update public.diesel       set legado = true where legado = false;
update public.agenda       set legado = true where legado = false;
update public.manutencoes  set legado = true where legado = false;

create index if not exists lancamentos_legado_idx  on public.lancamentos (legado);
create index if not exists recebimentos_legado_idx on public.recebimentos (legado);
create index if not exists diesel_legado_idx       on public.diesel (legado);
create index if not exists agenda_legado_idx       on public.agenda (legado);
create index if not exists manutencoes_legado_idx  on public.manutencoes (legado);
