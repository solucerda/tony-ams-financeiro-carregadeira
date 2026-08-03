-- ============================================================
-- CORREÇÕES v17 — RECEBÍVEIS PENDENTES NO EXTRATO/AGENDA + TIPOS DE
-- RECEBIMENTO
-- Execute no SQL Editor do Supabase (depois de v1 a v16).
--
-- Recebimentos com saldo a receber (valor_total > valor_pago) agora
-- também geram uma movimentação PENDENTE no Extrato e um compromisso na
-- Agenda — igual já acontecia com Diesel/Manutenção "a pagar". A Agenda
-- vira, na prática, uma agenda de recebíveis E de contas a pagar juntos.
-- "Dar baixa" num recebimento é simplesmente editar e aumentar o "Valor
-- pago" até ele alcançar o "Valor total" — quando ficar tudo pago, a
-- pendência some sozinha do Extrato e da Agenda.
-- ============================================================

-- Cadastro de tipos de recebimento (Locação de máquina, Frete, etc.)
create table if not exists tipos_recebimento (
  id bigint generated always as identity primary key,
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table tipos_recebimento enable row level security;
drop policy if exists "auth_tipos_recebimento" on tipos_recebimento;
create policy "auth_tipos_recebimento" on tipos_recebimento for all to authenticated using (true) with check (true);
insert into tipos_recebimento (nome) values
  ('Locação de máquina'),('Frete/transporte'),('Serviço avulso'),('Outros')
on conflict (nome) do nothing;

alter table recebimentos add column if not exists tipo_recebimento_id bigint references tipos_recebimento(id);

-- Segundo vínculo: o saldo a receber (valor_total - valor_pago) gera sua
-- própria movimentação pendente, separada da que já existia pro valor pago.
alter table recebimentos add column if not exists lancamento_pendente_id bigint references lancamentos(id) on delete set null;
alter table recebimentos add column if not exists agenda_id bigint references agenda(id) on delete set null;

-- A Agenda passa a aceitar natureza "Receita" também (pros compromissos
-- espelhados de recebíveis, não só despesas).
alter table agenda drop constraint if exists agenda_natureza_check;
alter table agenda add constraint agenda_natureza_check
  check (natureza in ('Fixo','Variavel','Investimento','Receita'));
