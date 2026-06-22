# Guia: publicar este projeto no GitHub

> Este arquivo é só pra você (autor). Você pode deletá-lo do repo depois de publicar — ou deixar como referência.

## Pré-requisitos

- Conta no GitHub: https://github.com
- Git instalado (Mac já vem com Xcode Command Line Tools; verifica com `git --version`)
- Idealmente, GitHub CLI (`gh`) instalado: `brew install gh` (opcional, deixa o processo mais rápido)

## Antes de mais nada: verificação final dos seus dados

A pasta atual NÃO contém seus dados sensíveis (verificamos). Mas confirme rodando:

```bash
cd ~/Documents/APP/finboard-public

# Nenhum desses arquivos pode aparecer:
ls .env settings.json data.db data.db-shm data.db-wal 2>/dev/null
# Se a linha acima imprimir algo, NÃO publique e me avise.

# Verifica se há credenciais reais (UUIDs) em arquivos versionáveis:
grep -rnE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" \
  --include="*.js" --include="*.html" --include="*.md" --include="*.json" \
  --exclude-dir=node_modules .
# Deve retornar vazio.
```

## Passo 1 — Criar repo no GitHub

### Opção A — via web (mais fácil)

1. Vá em https://github.com/new
2. **Repository name:** `finboard-one` (ou outro nome que preferir)
3. **Description:** "Dashboard de finanças pessoais via Pluggy Open Finance"
4. Visibilidade: **Public**
5. **NÃO** marque "Add a README file", "Add .gitignore", nem "Choose a license" — esse projeto já tem
6. Clique **Create repository**
7. Na tela seguinte, copie a URL HTTPS que aparece, algo como:
   `https://github.com/SEU_USUARIO/finboard-one.git`

### Opção B — via gh CLI

```bash
cd ~/Documents/APP/finboard-public
gh repo create finboard-one --public --source=. --remote=origin --description "Dashboard de finanças pessoais via Pluggy Open Finance"
```

(Se for sua primeira vez, vai pedir login: `gh auth login`)

## Passo 2 — Inicializar git e fazer o primeiro push

```bash
cd ~/Documents/APP/finboard-public

# Inicializa repo local
git init -b main

# Configura sua identidade git (se ainda não fez globalmente)
git config user.name "Seu Nome"
git config user.email "seu-email@exemplo.com"

# Verifica o que vai ser commitado (importante!)
git add .
git status
# Confira: NÃO pode aparecer .env, settings.json, data.db
# Se aparecer, pare e revise o .gitignore

# Confere o que estamos adicionando
git status

# Faz o commit inicial
git commit -m "Initial commit: FinBoard One"

# Conecta ao remote (se não usou gh CLI no passo 1)
git remote add origin https://github.com/SEU_USUARIO/finboard-one.git

# Empurra
git push -u origin main
```

## Passo 3 — Conferir no GitHub

Vai em `https://github.com/SEU_USUARIO/finboard-one` e verifica:

1. ✅ README aparece bonitinho na home do repo
2. ✅ LICENSE aparece reconhecida como "MIT" (badge no topo direito)
3. ❌ NÃO aparece `.env`, `settings.json`, `data.db` em lugar nenhum
4. ❌ NÃO aparece `node_modules/`

Se passou nos 4 checks, está tudo certo.

## Passo 4 — Atualizar referências `SEU_USUARIO`

Edite estes arquivos e troque `SEU_USUARIO` pelo seu username real do GitHub:

- `package.json` — `homepage`, `repository.url`, `bugs.url`
- `README.md` — não tem `SEU_USUARIO`, mas se você adicionar badges ou links, troque

```bash
# Substitui de uma vez:
sed -i '' 's|SEU_USUARIO|seu-username-real|g' package.json README.md
git commit -am "docs: atualizar urls do repo"
git push
```

## Passo 5 — Configurações recomendadas no repo

No GitHub, vai em **Settings** do repo:

- **General** → desmarca "Wikis", "Projects" se você não vai usar (limpa a UI)
- **General** → marca "Issues" (pra contribuidores reportarem problemas)
- **Branches** → adicione regra de proteção pra `main` (opcional, mas boa prática): exija PR pra mudanças

Aba **About** (lateral direita da home do repo):
- Description: já preenchida pelo gh CLI ou edita
- Website: deixe em branco (não tem site)
- Topics: adicione `finance`, `pluggy`, `open-finance`, `dashboard`, `nodejs`, `sqlite`, `brazil`

## Próximos passos (depois de publicar)

Quando quiser fazer o build do app instalável (.dmg e .exe) e disponibilizar pro seu amigo:

1. Volte aqui que eu te ajudo a adicionar `electron` + `electron-builder`
2. Faremos builds locais via `npm run dist:mac` e `npm run dist:win`
3. Vamos criar a primeira **Release** no GitHub com os arquivos anexados
4. Seu amigo baixa o `.dmg` ou `.exe` da página de Releases — sem terminal

## Compartilhando com seu amigo

Depois do passo 2, você já pode mandar pro amigo:

> "Oi! Fiz um app que junta extratos de vários bancos numa tela só. Tá no GitHub: https://github.com/SEU_USUARIO/finboard-one
>
> Pra instalar:
> 1. Cria conta gratuita na Pluggy: https://dashboard.pluggy.ai/sign-up
> 2. Segue o setup do README
>
> Se tiver dúvida, me chama."

Se ele não for técnico, espera o passo do build do Electron primeiro e manda só o link do .dmg/.exe da página de Releases.
