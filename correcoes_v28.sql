-- v28: cadastro completo do equipamento (combustível, marca, modelo, ano,
-- placa, aquisição, valor de compra e entrada). Só estrutura.
alter table public.equipamentos add column if not exists combustivel text check (combustivel in ('Diesel','Gasolina','Etanol','GNV','Flex'));
alter table public.equipamentos add column if not exists marca text;
alter table public.equipamentos add column if not exists modelo text;
alter table public.equipamentos add column if not exists ano integer;
alter table public.equipamentos add column if not exists placa text;
alter table public.equipamentos add column if not exists data_aquisicao date;
alter table public.equipamentos add column if not exists valor_compra numeric(14,2);
alter table public.equipamentos add column if not exists teve_entrada boolean;
alter table public.equipamentos add column if not exists valor_entrada numeric(14,2);
