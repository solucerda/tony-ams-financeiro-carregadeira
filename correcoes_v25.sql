-- v25: SERVIÇOS (centro de resultado por trabalho/contrato)
-- Um serviço junta cliente, horas trabalhadas, custos (abastecimento,
-- manutenção, despesas) e o que já foi recebido — receita, custo e lucro
-- de cada serviço. Só estrutura: nenhum dado existente é alterado.

create table if not exists public.servicos (
  id bigint generated always as identity primary key,
  nome text not null,
  cliente text,
  equipamento_id bigint references public.equipamentos(id) on delete set null,
  data_inicio date not null default current_date,
  data_fim date,
  cobranca text not null default 'hora' check (cobranca in ('hora','fechado')),
  valor_hora numeric(12,2),
  valor_fechado numeric(12,2),
  status text not null default 'andamento' check (status in ('andamento','concluido','cancelado')),
  observacao text,
  agenda_id bigint references public.agenda(id) on delete set null,
  legado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists servicos_status_idx on public.servicos (status);

alter table public.lancamentos  add column if not exists servico_id bigint references public.servicos(id) on delete set null;
alter table public.recebimentos add column if not exists servico_id bigint references public.servicos(id) on delete set null;
alter table public.diesel       add column if not exists servico_id bigint references public.servicos(id) on delete set null;
alter table public.manutencoes  add column if not exists servico_id bigint references public.servicos(id) on delete set null;
create index if not exists lancamentos_servico_idx  on public.lancamentos (servico_id);
create index if not exists recebimentos_servico_idx on public.recebimentos (servico_id);
create index if not exists diesel_servico_idx       on public.diesel (servico_id);
create index if not exists manutencoes_servico_idx  on public.manutencoes (servico_id);

-- segurança: mesma regra das demais tabelas (todos leem; admin/operacional
-- criam e editam; só admin exclui)
alter table public.servicos enable row level security;
drop policy if exists sel_servicos on public.servicos;
drop policy if exists ins_servicos on public.servicos;
drop policy if exists upd_servicos on public.servicos;
drop policy if exists del_servicos on public.servicos;
create policy sel_servicos on public.servicos for select to authenticated using (true);
create policy ins_servicos on public.servicos for insert to authenticated with check (public.meu_papel() in ('admin','operacional'));
create policy upd_servicos on public.servicos for update to authenticated using (public.meu_papel() in ('admin','operacional')) with check (public.meu_papel() in ('admin','operacional'));
create policy del_servicos on public.servicos for delete to authenticated using (public.meu_papel() = 'admin');

drop trigger if exists trg_log on public.servicos;
create trigger trg_log after insert or update or delete on public.servicos for each row execute function public.registrar_log();
