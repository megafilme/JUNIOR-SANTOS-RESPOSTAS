# 🚛 Marcos Justificativa — Gerador de Justificativas Electrolux

Aplicação web para geração automática de justificativas operacionais de frota/logística Electrolux.

---

## ▶️ Rodando localmente

```bash
npm install
npm run dev
```

Acesse: `http://localhost:5173`

---

## 📦 Build de produção

```bash
npm run build
```

Os arquivos gerados ficam na pasta `dist/`.

---

## 🚀 Deploy — Passo a passo por servidor

---

### 1. 🔥 Firebase Hosting

**Pré-requisito:** ter o Firebase CLI instalado.

```bash
npm install -g firebase-tools
```

**Passos:**

```bash
# 1. Login no Firebase
firebase login

# 2. Inicializar (só na primeira vez)
firebase init hosting
#   → Use an existing project (ou crie um novo)
#   → Public directory: dist
#   → Configure as a single-page app: YES
#   → Set up automatic builds with GitHub: opcional

# 3. Build do projeto
npm run build

# 4. Deploy
firebase deploy --only hosting
```

**Deploy automático via GitHub Actions:**

No repositório do GitHub, vá em:
`Settings → Secrets and variables → Actions`

Adicione:
- **Secret:** `FIREBASE_SERVICE_ACCOUNT` → JSON da conta de serviço do Firebase  
- **Variable:** `FIREBASE_PROJECT_ID` → ID do seu projeto Firebase

O deploy roda automaticamente em cada push para `main`.

---

### 2. 😺 GitHub Pages

**Opção A — Deploy automático (recomendado):**

1. Suba o projeto para um repositório GitHub
2. Vá em `Settings → Pages`
3. Em **Source**, selecione `GitHub Actions`
4. Faça um push para `main` — o workflow `.github/workflows/deploy.yml` faz tudo automaticamente

**Opção B — Deploy manual:**

```bash
npm install -g gh-pages

npm run build
npx gh-pages -d dist
```

> ⚠️ Se o repositório não estiver na raiz (ex: `usuario.github.io/meu-repo`),
> adicione `base: '/meu-repo/'` no `vite.config.ts`.

---

### 3. ▲ Vercel

**Opção A — Interface web (mais fácil):**

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New → Project**
3. Importe o repositório GitHub
4. Vercel detecta Vite automaticamente
5. Clique em **Deploy** — pronto!

**Opção B — CLI:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

O arquivo `vercel.json` já está configurado.

---

### 4. 🟩 Netlify

**Opção A — Interface web:**

1. Acesse [netlify.com](https://netlify.com) e faça login
2. Clique em **Add new site → Import an existing project**
3. Conecte o repositório GitHub
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Clique em **Deploy** — pronto!

**Opção B — CLI:**

```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod --dir=dist
```

O arquivo `netlify.toml` já está configurado.

---

### 5. 🌐 Apache / Hospedagem compartilhada (cPanel, etc.)

```bash
# 1. Build
npm run build

# 2. Envie todo o conteúdo da pasta dist/ para public_html/
#    via FTP (FileZilla, WinSCP, etc.)
#    O arquivo .htaccess já está incluído no dist/ automaticamente
```

O arquivo `public/.htaccess` garante que rotas SPA funcionem corretamente.

---

### 6. 📡 Render / Railway / Fly.io

```bash
# Build command
npm run build

# Start command (para servidor estático)
npx serve dist -s -l 3000
```

Ou use a imagem `node:20-alpine` com:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "dist", "-s", "-l", "3000"]
```

---

## 📁 Arquivos de configuração incluídos

| Arquivo | Servidor |
|---|---|
| `firebase.json` | Firebase Hosting |
| `.firebaserc` | Firebase (projeto padrão) |
| `vercel.json` | Vercel |
| `netlify.toml` | Netlify |
| `public/_redirects` | Netlify / Cloudflare Pages |
| `public/.htaccess` | Apache / cPanel |
| `.github/workflows/deploy.yml` | GitHub Actions (Pages + Firebase) |
| `.gitignore` | Git |

---

## 🛠️ Tecnologias

- **React 19** + **TypeScript**
- **Vite 7**
- **Tailwind CSS 4**
- **XLSX** — leitura de planilhas Excel
- **react-dropzone** — upload por drag & drop

---

> Desenvolvido para uso interno — Electrolux / Marcos Justificativa
