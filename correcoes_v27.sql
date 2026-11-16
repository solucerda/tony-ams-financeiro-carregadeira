-- v27: o cadastro do equipamento define se ele tem resultado próprio.
-- false = só gera custo para o total do negócio (ex.: carro de apoio) e não
-- aparece como opção de painel próprio. null = decide pelo tipo (Veículo = não).
alter table public.equipamentos add column if not exists controla_resultado boolean;
