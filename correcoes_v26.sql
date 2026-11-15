-- v26: histórico com "o quê" — guarda uma cópia do registro e quais campos
-- mudaram em cada edição. Edições que só trocam vínculos internos (ids de
-- lançamento/agenda, base antiga) deixam de poluir o histórico.
alter table public.log_atividade add column if not exists dados jsonb;
alter table public.log_atividade add column if not exists campos text[];

create or replace function public.registrar_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  r jsonb;
  o jsonb;
  cs text[];
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    select array_agg(e.key order by e.key) into cs
      from jsonb_each(r) e
     where e.value is distinct from o -> e.key
       and e.key not in ('lancamento_id','lancamento_pendente_id','agenda_id','grupo_abastecimento_id','legado','criado_em');
    if cs is null then return new; end if;
  end if;
  insert into public.log_atividade (usuario_id, tabela, registro_id, acao, dados, campos)
  values (auth.uid(), tg_table_name, (r ->> 'id')::bigint,
          case tg_op when 'INSERT' then 'criar' when 'UPDATE' then 'editar' else 'excluir' end,
          r, cs);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
