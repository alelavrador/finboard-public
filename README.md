# FinBoard One

> Dashboard de finanças pessoais que consolida contas, cartões, investimentos e empréstimos de vários bancos brasileiros numa única tela, via [Pluggy](https://pluggy.ai/) (Open Finance Brasil).

[![Node](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Visão geral consolidada** — saldo total, fluxo de caixa mensal, evolução de investimentos
- **Múltiplos bancos** numa só interface, conectados via Pluggy Open Finance
- **Categorização automática** com regras por palavra-chave, agrupamento e renomeação de categorias
- **Cartões manuais** — adicione cartões/cobranças que não estão no Open Finance
- **Investimentos manuais** com histórico mensal e gráfico de evolução
- **Persistência local em SQLite** — seus dados ficam no seu computador, em `data.db`
- **Backup/restore JSON** — export e import direto da aba Admin
- **Tema escuro** moderno, responsivo, com gráficos SVG sem dependências de chart libs
- **Funciona offline** após primeira sincronização (cache + service worker)
- **PWA-friendly** — adicione à tela inicial do iPad via Safari

## Stack

- **Backend:** Node.js + Express + `better-sqlite3` + Pluggy API
- **Frontend:** HTML + CSS + JavaScript vanilla modular (ES modules, sem build step)
- **Storage:** SQLite (key-value) + filesystem (settings.json)

## Pré-requisitos

- **Node.js 20+** ([download](https://nodejs.org/))
- **Conta gratuita na Pluggy** ([cadastro](https://dashboard.pluggy.ai/sign-up))

## Setup

### 1. Clonar e instalar

```bash
git clone https://github.com/SEU_USUARIO/finboard-one.git
cd finboard-one
npm install
```

### 2. Configurar credenciais Pluggy

Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai/sign-up) (gratuita). No painel da Pluggy, copie:

- **Client ID** (em *Applications* → sua app)
- **Client Secret** (em *Applications* → sua app → *Show*)

Crie o `.env` a partir do template e preencha:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
PLUGGY_CLIENT_ID=cole-aqui-seu-client-id
PLUGGY_CLIENT_SECRET=cole-aqui-seu-client-secret
APP_TOKEN=
```

### 3. Gerar o `APP_TOKEN`

O `APP_TOKEN` é um cookie que protege as rotas `/api/*` no seu localhost. Gere com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o valor gerado em `APP_TOKEN=` no `.env`.

### 4. Rodar

```bash
npm start
```

Abra `http://localhost:3000` no navegador. Na primeira vez, vai aparecer a aba **Admin** com "Conectado" no badge superior.

### 5. Conectar seus bancos

1. Na aba **Admin**, clique em **Gerar connect token** e copie o token gerado
2. Use esse token no [Pluggy Connect](https://docs.pluggy.ai/docs/connect-widget) (widget web/app) pra autorizar os bancos que você quer conectar
3. Cada banco autorizado gera um **item ID** (UUID)
4. Cole os item IDs (um por linha) no campo "Item IDs" do Admin e clique **Salvar**
5. Aguarde a sincronização. Os dados vão popular as outras abas.

## Uso

| Aba | O que faz |
|---|---|
| **Visão Geral** | Saldo consolidado, KPIs, fluxo de caixa mensal, top categorias |
| **Financeiro** | Lista de transações com filtros, troca de categoria, regras |
| **Cartões** | Faturas dos cartões, evolução mensal, lançamentos por cartão |
| **Investimentos** | Posições agregadas + investimentos manuais com snapshots |
| **Conexões** | Status de cada banco conectado |
| **Editar dados** | Renomear contas/categorias, criar grupos, excluir categorias dos totais, regras automáticas |
| **Admin** | Credenciais Pluggy, itemIds, connect token, backup/restore |

## Backup

A aba **Admin** tem botões:

- **⬇ Baixar backup (JSON)** — exporta todas as regras, categorizações, investimentos manuais (com snapshots), cartões manuais, renomeações, etc.
- **⬆ Restaurar de arquivo…** — importa um JSON gerado anteriormente

O backup **não inclui** credenciais nem dados crus da Pluggy. Esses vêm direto da API a cada sync.

Faça backup periodicamente e guarde em local seguro (iCloud Drive, Dropbox, etc.).

## Segurança

- Todas as rotas `/api/*` exigem o `APP_TOKEN` (cookie ou header `X-App-Token`)
- CORS restrito a `http://localhost:3000` e `http://127.0.0.1:3000`
- `express.static` serve só `public/` — arquivos sensíveis (`.env`, `settings.json`, `data.db`) ficam fora do alcance HTTP
- O app foi pensado pra rodar em **localhost**, não em servidor exposto à internet sem hardening adicional

## Acessar do iPad / celular na mesma rede

Para acessar do iPad/celular pelo Safari na mesma WiFi:

1. No `.env`, troca `HOST=127.0.0.1` por `HOST=0.0.0.0`
2. Reinicia o servidor. Ele vai logar os IPs da LAN, ex: `http://192.168.1.42:3000`
3. No iPad/celular, abra essa URL no Safari
4. (Opcional) Compartilhar → *Adicionar à Tela de Início* para virar atalho PWA

## Estrutura

```
.
├── server.js                 backend (proxy Pluggy + KV store SQLite + auth)
├── settings.json             itemIds, clientUserId, webhookUrl (gitignored)
├── data.db                   SQLite KV — gerado automaticamente (gitignored)
├── .env                      secrets (gitignored)
├── package.json
└── public/                   frontend (estático)
    ├── index.html
    ├── styles.css
    └── js/
        ├── app.js            entry point
        ├── nav.js            navegação entre abas
        ├── api.js            chamadas à API + fetchJson
        ├── render.js         todas as renderX()
        ├── charts.js         gráficos SVG
        ├── normalize.js      normalização, filtros, cálculos
        ├── storage.js        KV via /api/kv/* (com fallback localStorage)
        ├── utils.js          state global, helpers de formatação
        └── modals.js         focus trap, ESC, backdrop click
```

## Scripts

```bash
npm start    # roda em produção
npm run dev  # roda com --watch (recarrega ao editar server.js)
```

## Roadmap

- [ ] Build Electron (.dmg / .exe) pra instalação sem terminal
- [ ] Cache de `/api/full-sync` para evitar bater na Pluggy em cada page reload
- [ ] Snapshot histórico de investimentos Pluggy (hoje só `currentValue` do dia da sync)
- [ ] Testes automatizados

## Contribuindo

Pull requests bem-vindos. Antes de PRs grandes, abra uma issue pra discutir a direção.

## Licença

MIT — veja [LICENSE](LICENSE).

## Disclaimer

Este é um projeto pessoal, não-oficial e não-comercial. Pluggy é uma marca registrada de seus respectivos donos. Use por sua conta e risco. O autor não se responsabiliza por nada que aconteça com seus dados financeiros.
