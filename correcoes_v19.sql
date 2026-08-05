-- ============================================================
-- CORREÇÕES v19 — USUÁRIOS E NÍVEIS DE ACESSO
-- Execute no SQL Editor do Supabase (depois de v1 a v18).
--
-- IMPORTANTE — leia antes de rodar:
-- 1) Esta migração TRANCA a escrita/exclusão em quase todas as tabelas
--    pra quem não tiver o papel certo. O passo de backfill abaixo garante
--    que TODO usuário que já existe no seu projeto vira "admin"
--    automaticamente, então ninguém que já usa o sistema fica trancado
--    pra fora. Novos usuários criados DEPOIS desta migração entram como
--    "leitura" por padrão — um admin promove pela aba Administração.
-- 2) Pra criar um usuário novo: Supabase → Authentication → Users → Add
--    user (e-mail + senha). O perfil aparece sozinho na aba Administração
--    → Usuários, como "Leitura" — aí é só editar o nível de acesso.
-- 3) Se algo der errado e ninguém mais conseguir gravar dados, o "modo de
--    emergência" é rodar de novo, manualmente:
--      update perfis set papel = 'admin' where id = '<uuid do seu usuário>';
--    (o uuid aparece em Authentication → Users no Supabase).
-- ============================================================

-- 1) Tabela de perfis — um por usuário do Supabase Auth
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  papel text not null default 'leitura' check (papel in ('admin','operacional','leitura')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table perfis enable row level security;

drop policy if exists "leitura_perfis" on perfis;
create policy "leitura_perfis" on perfis for select to authenticated using (true);

-- 2) Função auxiliar: qual o papel do usuário logado agora (usada nas
--    políticas das outras tabelas). security definer = ignora RLS ao
--    consultar perfis, evitando recursão.
create or replace function public.meu_papel()
returns text
language sql security definer stable
as $$
  select papel from public.perfis where id = auth.uid() and ativo = true;
$$;

-- só admin pode mudar papel/ativo/nome de alguém pela aba Administração
drop policy if exists "admin_gerencia_perfis" on perfis;
create policy "admin_gerencia_perfis" on perfis for update to authenticated
  using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

-- 3) Todo usuário NOVO no Supabase Auth ganha um perfil "leitura" sozinho
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.perfis (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'leitura')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- 4) BACKFILL — todo usuário que já existe vira admin automaticamente,
--    pra ninguém perder acesso com esta migração.
insert into public.perfis (id, nome, papel)
select id, coalesce(raw_user_meta_data->>'nome', email), 'admin'
from auth.users
on conflict (id) do nothing;

-- 5) Aperta as políticas das demais tabelas:
--    - leitura: qualquer usuário autenticado continua podendo ver tudo
--      (sem mudança — evita qualquer risco de tela em branco)
--    - inserir/editar: cadastros administrativos exigem admin; o resto
--      (lançamentos, recebimentos, diesel, manutenção, agenda) aceita
--      admin ou operacional
--    - excluir: só admin, em qualquer tabela
do $$
declare
  t text;
begin
  -- tabelas operacionais (admin + operacional podem gravar)
  foreach t in array array['lancamentos','recebimentos','diesel','manutencoes','agenda']
  loop
    execute format('drop policy if exists %I on %I', 'auth_' || t, t);
    execute format('drop policy if exists %I on %I', 'ins_' || t, t);
    execute format('drop policy if exists %I on %I', 'upd_' || t, t);
    execute format('drop policy if exists %I on %I', 'del_' || t, t);
    execute format('drop policy if exists %I on %I', 'sel_' || t, t);
    execute format('create policy %I on %I for select to authenticated using (true)', 'sel_' || t, t);
    execute format('create policy %I on %I for insert to authenticated with check (public.meu_papel() in (''admin'',''operacional''))', 'ins_' || t, t);
    execute format('create policy %I on %I for update to authenticated using (public.meu_papel() in (''admin'',''operacional''))', 'upd_' || t, t);
    execute format('create policy %I on %I for delete to authenticated using (public.meu_papel() = ''admin'')', 'del_' || t, t);
  end loop;

  -- tabelas de cadastro/administração (só admin grava e exclui)
  foreach t in array array['equipamentos','centros_custo','clientes','fornecedores',
    'grupos_despesa','contas_bancarias','operadores','obras','feriados',
    'tipos_recebimento','config']
  loop
    execute format('drop policy if exists %I on %I', 'auth_' || t, t);
    execute format('drop policy if exists %I on %I', 'ins_' || t, t);
    execute format('drop policy if exists %I on %I', 'upd_' || t, t);
    execute format('drop policy if exists %I on %I', 'del_' || t, t);
    execute format('drop policy if exists %I on %I', 'sel_' || t, t);
    execute format('create policy %I on %I for select to authenticated using (true)', 'sel_' || t, t);
    execute format('create policy %I on %I for insert to authenticated with check (public.meu_papel() = ''admin'')', 'ins_' || t, t);
    execute format('create policy %I on %I for update to authenticated using (public.meu_papel() = ''admin'')', 'upd_' || t, t);
    execute format('create policy %I on %I for delete to authenticated using (public.meu_papel() = ''admin'')', 'del_' || t, t);
  end loop;
end $$;
