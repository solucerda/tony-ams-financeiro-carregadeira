-- ============================================================
-- CORREÇÕES v4 — MULTIEQUIPAMENTO + MANUTENÇÕES
-- Execute no SQL Editor do Supabase (depois de correcoes.sql,
-- correcoes_v2.sql e correcoes_v3.sql).
-- ============================================================

-- 1) Tabela de equipamentos
create table if not exists equipamentos (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table equipamentos enable row level security;
drop policy if exists "auth_equipamentos" on equipamentos;
create policy "auth_equipamentos" on equipamentos for all to authenticated using (true) with check (true);

insert into equipamentos (nome) values ('Pá Carregadeira'), ('Retroescavadeira')
  on conflict (nome) do nothing;

-- 2) Cada tabela existente ganha equipamento_id. lancamentos e agenda
--    aceitam NULL (despesa/compromisso "geral", sem máquina específica —
--    ex.: contabilidade, cartório); recebimentos e diesel são sempre de
--    uma máquina, por isso ficam obrigatórios depois do backfill abaixo.
alter table lancamentos  add column if not exists equipamento_id bigint references equipamentos(id);
alter table recebimentos add column if not exists equipamento_id bigint references equipamentos(id);
alter table diesel       add column if not exists equipamento_id bigint references equipamentos(id);
alter table agenda       add column if not exists equipamento_id bigint references equipamentos(id);

-- Tudo que já existe no banco é da Pá Carregadeira (único equipamento até
-- agora) — depois disso, o app deixa você escolher o equipamento certo em
-- cada novo lançamento.
update lancamentos  set equipamento_id = (select id from equipamentos where nome = 'Pá Carregadeira') where equipamento_id is null;
update recebimentos set equipamento_id = (select id from equipamentos where nome = 'Pá Carregadeira') where equipamento_id is null;
update diesel        set equipamento_id = (select id from equipamentos where nome = 'Pá Carregadeira') where equipamento_id is null;
update agenda        set equipamento_id = (select id from equipamentos where nome = 'Pá Carregadeira') where equipamento_id is null;

alter table recebimentos alter column equipamento_id set not null;
alter table diesel       alter column equipamento_id set not null;

-- 3) Tabela de manutenções: preventiva/preditiva/corretiva, peças, próxima
--    revisão (por data ou por horímetro) e contas a pagar integradas ao
--    extrato (mesmo padrão do diesel).
create table if not exists manutencoes (
  id bigint generated always as identity primary key,
  equipamento_id bigint not null references equipamentos(id),
  tipo text not null default 'preventiva' check (tipo in ('preventiva','preditiva','corretiva')),
  realizada boolean not null default true,
  data date not null,
  horimetro numeric,
  descricao text not null default '',
  pecas text not null default '',
  fornecedor text not null default '',
  valor_pecas numeric not null default 0,
  valor_mao_obra numeric not null default 0,
  valor_total numeric not null default 0,
  natureza text not null default 'Variavel' check (natureza in ('Fixo','Variavel')),
  status_pagamento text not null default 'pago' check (status_pagamento in ('pago','pendente')),
  vencimento date,
  proxima_data date,
  proxima_horimetro numeric,
  lancamento_id bigint references lancamentos(id) on delete set null,
  criado_em timestamptz not null default now()
);
alter table manutencoes enable row level security;
drop policy if exists "auth_manutencoes" on manutencoes;
create policy "auth_manutencoes" on manutencoes for all to authenticated using (true) with check (true);

-- Pronto. Depois de rodar isto, publique os arquivos atualizados
-- (app.js, index.html, style.css) e recarregue o site. Na primeira tela
-- após o login você poderá escolher entre os equipamentos cadastrados ou
-- "Total do negócio" — dá pra cadastrar mais equipamentos direto por lá.
