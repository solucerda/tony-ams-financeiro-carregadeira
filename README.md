# Gerenciador Financeiro — Pá Carregadeira (TA Transporte)

Sistema de controle financeiro da pá carregadeira, com todos os dados migrados
da planilha original (fev–jul/2026): extrato, recebimentos por cliente,
controle de diesel e agenda de pagamentos.

**Stack (mesmo padrão do portal `cipesudoeste/diagnose`):**
HTML + CSS + JavaScript puro, sem build · Chart.js e Supabase via CDN ·
Google Fonts (Oswald, Inter, JetBrains Mono) · Deploy na Vercel via GitHub.

```
gerenciador-financeiro/
├── index.html      → página única (login + aplicação)
├── style.css       → tema visual
├── app.js          → lógica: autenticação, CRUD e gráficos
├── config.js       → URL e anon key do Supabase (você preenche)
├── schema.sql      → cria as tabelas e insere os dados da planilha
└── README.md       → este arquivo
```

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto novo
   (região São Paulo / `sa-east-1`, se disponível).
2. No menu lateral, abra **SQL Editor → New query**.
3. Copie **todo** o conteúdo do arquivo `schema.sql`, cole no editor e clique
   em **Run**. Isso cria as 5 tabelas, ativa a segurança (RLS) e já insere
   os 200 lançamentos do extrato, os recebimentos, os abastecimentos e a
   agenda de pagamentos vindos da planilha.
4. Vá em **Authentication → Users → Add user → Create new user** e crie o
   seu usuário de acesso (e-mail + senha). Marque **Auto Confirm User**.
   > O site não tem tela de cadastro de propósito: só entra quem você criar
   > aqui no painel. Pode criar mais usuários (sócio, contador) do mesmo jeito.
5. Vá em **Project Settings → API** e anote:
   - **Project URL**
   - **anon public key**

## 2. Configurar o site

Abra o arquivo `config.js` no VS Code e preencha:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "sua-anon-key-aqui";
```

> A anon key **pode** ficar no código do site — ela é pública por natureza.
> Quem protege os dados é o RLS criado pelo `schema.sql`: sem login, ninguém
> lê nem escreve nada.

## 3. Testar localmente (opcional)

No VS Code, instale a extensão **Live Server**, clique com o botão direito no
`index.html` → **Open with Live Server**. Faça login com o usuário criado no
passo 1.4.

## 4. Subir para o GitHub

```bash
git init
git add .
git commit -m "Gerenciador financeiro - pá carregadeira"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/financeiro-pa-carregadeira.git
git push -u origin main
```

## 5. Publicar na Vercel

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o
   repositório do GitHub.
2. Framework Preset: **Other** (é um site estático, sem build). Não precisa
   de variável de ambiente nem comando de build — só clicar em **Deploy**.
3. Pronto: o site fica no ar num link `.vercel.app`, e cada `git push` na
   branch `main` publica automaticamente a nova versão.

---

## Como usar no dia a dia

- **Painel** — saldo em caixa, fluxo mensal (entradas × saídas × saldo
  acumulado) e ranking de para onde o dinheiro está indo.
- **Extrato** — todos os lançamentos com saldo corrido, filtros por mês,
  grupo e busca. Botão **+ Lançamento** para registrar entradas e saídas;
  o lápis (✎) edita ou exclui.
- **Recebimentos** — cartões por cliente (horas, faturado, recebido, em
  aberto). Ao registrar horímetro inicial/final, as horas e o valor faturado
  são calculados sozinhos.
- **Diesel** — consumo em L/h, preço médio, custo de diesel por hora da
  máquina e histórico de abastecimentos.
- **Agenda** — compromissos por mês; clique numa linha para editar o valor
  de um mês específico.

## Observações sobre a migração da planilha

- Categorias com erro de digitação foram unificadas
  ("Investimnto" → "Investimento", "Tarifas " → "Tarifas").
- O saldo inicial (R$ 95.267,88) veio da aba Extrato e fica na tabela
  `config` — dá para ajustar direto no Table Editor do Supabase.
- Saídas foram gravadas como valores positivos na coluna `saida`
  (o app faz o sinal na exibição e no cálculo do saldo).
