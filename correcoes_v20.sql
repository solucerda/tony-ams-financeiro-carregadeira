-- ============================================================
-- CORREÇÕES v20 — CONTROLE FINO DE PERMISSÕES
-- Execute no SQL Editor do Supabase (depois de v1 a v19).
--
-- Adiciona, nessa ordem:
-- 1) Permissões por módulo (cada usuário só grava no que foi liberado)
-- 2) Permissões por equipamento (restringir usuário a certas máquinas)
-- 3) Visibilidade financeira (esconder Painel/saldo de operador de campo)
-- 4) Trilha de auditoria (quem criou/editou/excluiu cada registro)
--
-- SEGURANÇA: administrador (papel = 'admin') sempre ignora as restrições
-- de módulo e de equipamento — só "operacional" é afetado por elas. Isso
-- evita qualquer risco de um admin se trancar fora sem querer. Todo
-- usuário que já existe recebe todos os módulos liberados por padrão,
-- então ninguém perde acesso que já tinha.
-- ============================================================

-- 1) PERMISSÕES POR MÓDULO ------------------------------------------------
alter table perfis add column if not exists modulos jsonb not null default
  '{"extrato":true,"recebimentos":true,"diesel":true,"manutencao":true,"agenda":true}'::jsonb;

create or replace function public.meu_modulo(m text)
returns boolean
language sql security definer stable
as $$
  select coalesce((select (modulos->>m)::boolean from perfis where id = auth.uid() and ativo = true), false);
$$;

-- 2) PERMISSÕES POR EQUIPAMENTO -------------------------------------------
create table if not exists perfis_equipamentos (
  perfil_id uuid not null references perfis(id) on delete cascade,
  equipamento_id bigint not null references equipamentos(id) on delete cascade,
  primary key (perfil_id, equipamento_id)
);
alter table perfis_equipamentos enable row level security;
drop policy if exists "leitura_perfis_equipamentos" on perfis_equipamentos;
create policy "leitura_perfis_equipamentos" on perfis_equipamentos for select to authenticated using (true);
drop policy if exists "admin_gerencia_perfis_equipamentos" on perfis_equipamentos;
create policy "admin_gerencia_perfis_equipamentos" on perfis_equipamentos for all to authenticated
  using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

-- sem nenhuma linha cadastrada pro usuário = sem restrição (acesso a todos
-- os equipamentos); só vira uma lista branca quando alguém cadastra pelo
-- menos um equipamento liberado pra aquele usuário.
create or replace function public.posso_equipamento(eq bigint)
returns boolean
language sql security definer stable
as $$
  select
    eq is null
    or not exists (select 1 from perfis_equipamentos where perfil_id = auth.uid())
    or exists (select 1 from perfis_equipamentos where perfil_id = auth.uid() and equipamento_id = eq);
$$;

-- 3) VISIBILIDADE FINANCEIRA (controle só de tela, não de banco) ---------
alter table perfis add column if not exists ve_financeiro boolean not null default true;

-- 4) TRILHA DE AUDITORIA ---------------------------------------------------
create table if not exists log_atividade (
  id bigint generated always as identity primary key,
  usuario_id uuid references perfis(id) on delete set null,
  tabela text not null,
  registro_id bigint,
  acao text not null check (acao in ('criar','editar','excluir')),
  criado_em timestamptz not null default now()
);
alter table log_atividade enable row level security;
drop policy if exists "leitura_log_atividade" on log_atividade;
create policy "leitura_log_atividade" on log_atividade for select to authenticated
  using (public.meu_papel() = 'admin');
-- gravação só acontece pelo gatilho abaixo (security definer), nunca direto pelo app

create or replace function public.registrar_log()
returns trigger
language plpgsql security definer
as $$
begin
  if (tg_op = 'INSERT') then
    insert into log_atividade (usuario_id, tabela, registro_id, acao) values (auth.uid(), tg_table_name, new.id, 'criar');
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into log_atividade (usuario_id, tabela, registro_id, acao) values (auth.uid(), tg_table_name, new.id, 'editar');
    return new;
  elsif (tg_op = 'DELETE') then
    insert into log_atividade (usuario_id, tabela, registro_id, acao) values (auth.uid(), tg_table_name, old.id, 'excluir');
    return old;
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['lancamentos','recebimentos','diesel','manutencoes','agenda']
  loop
    execute format('drop trigger if exists trg_log on %I', t);
    execute format('create trigger trg_log after insert or update or delete on %I for each row execute function public.registrar_log()', t);
  end loop;
end $$;

-- 5) REESCREVE AS POLÍTICAS DE ESCRITA DAS TABELAS OPERACIONAIS, AGORA
--    COMBINANDO PAPEL + MÓDULO + EQUIPAMENTO -----------------------------
do $$
declare
  t text;
  mod text;
  mapa jsonb := '{"lancamentos":"extrato","recebimentos":"recebimentos","diesel":"diesel","manutencoes":"manutencao","agenda":"agenda"}'::jsonb;
begin
  foreach t in array array['lancamentos','recebimentos','diesel','manutencoes','agenda']
  loop
    mod := mapa->>t;
    execute format('drop policy if exists %I on %I', 'ins_' || t, t);
    execute format('drop policy if exists %I on %I', 'upd_' || t, t);
    execute format('drop policy if exists %I on %I', 'del_' || t, t);

    execute format(
      'create policy %I on %I for insert to authenticated with check ((public.meu_papel() = ''admin'') or (public.meu_papel() = ''operacional'' and public.meu_modulo(%L) and public.posso_equipamento(equipamento_id)))',
      'ins_' || t, t, mod
    );
    execute format(
      'create policy %I on %I for update to authenticated using ((public.meu_papel() = ''admin'') or (public.meu_papel() = ''operacional'' and public.meu_modulo(%L) and public.posso_equipamento(equipamento_id))) with check ((public.meu_papel() = ''admin'') or (public.meu_papel() = ''operacional'' and public.meu_modulo(%L) and public.posso_equipamento(equipamento_id)))',
      'upd_' || t, t, mod, mod
    );
    execute format(
      'create policy %I on %I for delete to authenticated using (public.meu_papel() = ''admin'')',
      'del_' || t, t
    );
  end loop;
end $$;
