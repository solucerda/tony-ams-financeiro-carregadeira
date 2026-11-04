-- ============================================================
-- CORREÇÕES v22 — DESCONTO NO ABASTECIMENTO + COMPROVANTES
-- Execute no SQL Editor do Supabase (depois de v1 a v21), ANTES de
-- publicar a nova versão do site.
--
-- 1) Abastecimento: guarda o preço do litro da bomba (valor_unit_bruto) e o
--    desconto em R$. O valor_unit passa a ser o preço FINAL do litro
--    (total pago ÷ litros) e o valor_total é o que foi realmente pago.
--    Registros antigos continuam iguais (desconto 0, preço bruto = valor_unit).
-- 2) Anexos: comprovante de pagamento e nota fiscal/recibo, num bucket
--    PRIVADO do Storage chamado "comprovantes" (só usuário logado acessa).
-- ============================================================

alter table diesel add column if not exists valor_unit_bruto numeric;
alter table diesel add column if not exists desconto numeric not null default 0;
alter table diesel add column if not exists comprovante_pagamento_path text;
alter table diesel add column if not exists nota_fiscal_path text;

update diesel set valor_unit_bruto = valor_unit where valor_unit_bruto is null;

-- bucket privado, arquivos de até 10 MB (foto ou PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "comprovantes_ver"      on storage.objects;
drop policy if exists "comprovantes_enviar"   on storage.objects;
drop policy if exists "comprovantes_trocar"   on storage.objects;
drop policy if exists "comprovantes_apagar"   on storage.objects;

create policy "comprovantes_ver"    on storage.objects for select to authenticated using (bucket_id = 'comprovantes');
create policy "comprovantes_enviar" on storage.objects for insert to authenticated with check (bucket_id = 'comprovantes');
create policy "comprovantes_trocar" on storage.objects for update to authenticated using (bucket_id = 'comprovantes') with check (bucket_id = 'comprovantes');
create policy "comprovantes_apagar" on storage.objects for delete to authenticated using (bucket_id = 'comprovantes');
