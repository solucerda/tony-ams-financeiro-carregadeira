-- v29: tipo de custo (fixo/variável/investimento) passa a ser definido na categoria
-- de despesa pelo gestor, e não mais por quem faz o lançamento.
--
-- A coluna começa VAZIA de propósito (nenhum dado é alterado): enquanto uma categoria
-- estiver sem tipo definido, os formulários continuam perguntando como antes.
-- Depois de rodar, abra Administração → Categorias de despesa e escolha o tipo de
-- cada categoria. Lançamentos antigos não são modificados.

alter table grupos_despesa add column if not exists natureza text;

alter table grupos_despesa drop constraint if exists grupos_despesa_natureza_check;
alter table grupos_despesa add constraint grupos_despesa_natureza_check
  check (natureza is null or natureza in ('Fixo','Variavel','Investimento'));
