# HairScan AI — Documentação Técnica de Setup

## Guia Completo de Implementação na Azure (Portal Web)

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo 1 — Criar Resource Group](#3-resource-group)
4. [Passo 2 — Criar Azure Storage Account](#4-storage-account)
5. [Passo 3 — Criar Azure OpenAI Service](#5-openai-service)
6. [Passo 4 — Criar Azure Functions](#6-azure-functions)
7. [Passo 5 — Deploy do Backend](#7-deploy-backend)
8. [Passo 6 — Criar Azure Static Web Apps](#8-static-web-apps)
9. [Passo 7 — Deploy do Frontend](#9-deploy-frontend)
10. [Passo 8 — Configurar CORS](#10-cors)
11. [Passo 9 — Testar](#11-testar)
12. [Estrutura do Projeto](#12-estrutura)
13. [API Reference](#13-api)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Visão Geral

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│   React Frontend │────▶│  Azure Functions (Python) │────▶│  Blob Storage   │
│   Static Web Apps│◀────│  - Upload de imagens      │     │  - Imagens      │
└─────────────────┘     │  - Comparação (OpenCV)    │     │  - Resultados   │
                        │  - Geração de laudo       │     └─────────────────┘
                        └──────────┬───────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  Azure OpenAI (GPT-4o)│
                        │  - Laudo textual IA   │
                        └──────────────────────┘
```

**Serviços Azure utilizados:**
- Azure Static Web Apps (Free) — Frontend
- Azure Functions (Consumption) — Backend
- Azure Blob Storage (Hot tier) — Imagens
- Azure OpenAI Service — Laudos IA

---

## 2. Pré-requisitos

- Conta Azure com subscription ativa
- Node.js 18+ instalado localmente
- Python 3.10+ instalado localmente
- Azure Functions Core Tools v4 (para desenvolvimento local)
- Git instalado
- VS Code (recomendado, com extensões Azure)

### Instalar Azure Functions Core Tools

**Windows (winget):**
```bash
winget install Microsoft.Azure.FunctionsCoreTools
```

**macOS (Homebrew):**
```bash
brew tap azure/functions
brew install azure-functions-core-tools@4
```

**Linux:**
```bash
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list'
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

---

## 3. Passo 1 — Criar Resource Group

O Resource Group agrupa todos os serviços do projeto.

1. Acesse o [Portal Azure](https://portal.azure.com)
2. Pesquise **"Resource groups"** na barra de busca
3. Clique em **"+ Create"**
4. Preencha:
   - **Subscription:** Sua subscription
   - **Resource group:** `rg-hairscan-ai`
   - **Region:** `Brazil South` (ou `East US 2` se Brazil South não tiver todos os serviços)
5. Clique **"Review + create"** → **"Create"**

---

## 4. Passo 2 — Criar Azure Storage Account

Armazena as imagens enviadas e os resultados de análise.

1. Pesquise **"Storage accounts"** no portal
2. Clique **"+ Create"**
3. Preencha:
   - **Resource group:** `rg-hairscan-ai`
   - **Storage account name:** `sthairscanai` (apenas letras minúsculas e números, único globalmente)
   - **Region:** Mesma do Resource Group
   - **Performance:** Standard
   - **Redundancy:** LRS (Locally-redundant storage) — mais barato para MVP
4. Aba **"Advanced":**
   - **Allow Blob anonymous access:** Disabled
   - Demais opções: manter padrão
5. Clique **"Review + create"** → **"Create"**

### Após criação:

6. Acesse o Storage Account criado
7. No menu lateral, vá em **"Containers"**
8. Clique **"+ Container"**
   - **Name:** `hairscan-images`
   - **Public access level:** Private
9. No menu lateral, vá em **"Access keys"**
10. Copie a **Connection string** do key1 — você vai precisar dela

> ⚠️ **Guarde a Connection String!** Será usada na configuração do Azure Functions.

---

## 5. Passo 3 — Criar Azure OpenAI Service

Gera os laudos textuais inteligentes usando GPT-4o.

1. Pesquise **"Azure OpenAI"** no portal
2. Clique **"+ Create"**
3. Preencha:
   - **Resource group:** `rg-hairscan-ai`
   - **Region:** `East US 2` (GPT-4o pode não estar disponível em Brazil South)
   - **Name:** `oai-hairscan-ai`
   - **Pricing tier:** Standard S0
4. Clique **"Review + create"** → **"Create"**

### Deploy do modelo GPT-4o:

5. Após criação, acesse o recurso
6. Clique em **"Go to Azure OpenAI Studio"** (ou acesse https://oai.azure.com)
7. No menu lateral, vá em **"Deployments"**
8. Clique **"+ Create new deployment"**
   - **Model:** gpt-4o
   - **Deployment name:** `gpt-4o`
   - **Deployment type:** Standard
9. Clique **"Create"**

### Copiar credenciais:

10. Volte ao portal Azure, no recurso OpenAI
11. No menu lateral, vá em **"Keys and Endpoint"**
12. Copie:
    - **KEY 1** (API Key)
    - **Endpoint** (ex: `https://oai-hairscan-ai.openai.azure.com/`)

> ⚠️ **Guarde a API Key e o Endpoint!**

---

## 6. Passo 4 — Criar Azure Functions

Backend serverless que processa as imagens.

1. Pesquise **"Function App"** no portal
2. Clique **"+ Create"**
3. Aba **"Basics":**
   - **Resource group:** `rg-hairscan-ai`
   - **Function App name:** `func-hairscan-ai` (único globalmente)
   - **Runtime stack:** Python
   - **Version:** 3.10 ou 3.11
   - **Region:** Mesma do Resource Group
   - **Operating System:** Linux
   - **Hosting plan:** Consumption (Serverless)
4. Aba **"Storage":**
   - **Storage account:** selecione `sthairscanai` (o que já criamos)
5. Clique **"Review + create"** → **"Create"**

### Configurar variáveis de ambiente:

6. Após criação, acesse o Function App
7. No menu lateral, vá em **"Environment variables"** (ou "Configuration")
8. Adicione as seguintes **Application settings:**

| Name | Value |
|------|-------|
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string do Storage Account (passo 4.10) |
| `AZURE_STORAGE_CONTAINER_NAME` | `hairscan-images` |
| `AZURE_OPENAI_ENDPOINT` | Endpoint do OpenAI (passo 5.12) |
| `AZURE_OPENAI_API_KEY` | API Key do OpenAI (passo 5.12) |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-4o` |
| `AZURE_OPENAI_API_VERSION` | `2024-12-01-preview` |

9. Clique **"Save"** e confirme o restart

---

## 7. Passo 5 — Deploy do Backend

### Opção A: Deploy via VS Code (recomendado)

1. Instale a extensão **"Azure Functions"** no VS Code
2. Abra a pasta `backend/` no VS Code
3. Pressione `Ctrl+Shift+P` → **"Azure Functions: Deploy to Function App"**
4. Selecione `func-hairscan-ai`
5. Confirme o deploy

### Opção B: Deploy via linha de comando

```bash
cd backend/

# Login na Azure
az login

# Deploy
func azure functionapp publish func-hairscan-ai --python
```

### Opção C: Deploy via Portal (ZIP Deploy)

1. Na pasta `backend/`, crie um arquivo ZIP com todos os arquivos:
   - `function_app.py`
   - `host.json`
   - `requirements.txt`
2. No Portal Azure, acesse o Function App
3. Menu lateral → **"Advanced Tools"** → **"Go"** (abre Kudu)
4. Vá em **"Tools"** → **"Zip Push Deploy"**
5. Arraste o ZIP para a área de deploy

### Testar o backend:

Acesse no navegador:
```
https://func-hairscan-ai.azurewebsites.net/api/health
```

Deve retornar:
```json
{"status": "healthy", "service": "hairscan-ai", "timestamp": "..."}
```

---

## 8. Passo 6 — Criar Azure Static Web Apps

Hospeda o frontend React.

### Preparar repositório Git:

1. Crie um repositório no GitHub (ex: `hairscan-ai`)
2. Faça push do código frontend:

```bash
cd frontend/
git init
git add .
git commit -m "Initial frontend"
git remote add origin https://github.com/SEU_USUARIO/hairscan-ai.git
git push -u origin main
```

### Criar no Portal:

3. Pesquise **"Static Web Apps"** no portal Azure
4. Clique **"+ Create"**
5. Preencha:
   - **Resource group:** `rg-hairscan-ai`
   - **Name:** `swa-hairscan-ai`
   - **Hosting plan:** Free
   - **Source:** GitHub
   - **Organization:** Seu usuário GitHub
   - **Repository:** `hairscan-ai`
   - **Branch:** `main`
6. **Build Details:**
   - **Build Preset:** React
   - **App location:** `/frontend`
   - **Output location:** `dist`
7. Clique **"Review + create"** → **"Create"**

> O Azure vai criar automaticamente um GitHub Action para CI/CD.

### Configurar variável de ambiente:

8. Após criação, acesse o Static Web App
9. Menu lateral → **"Environment variables"**
10. Adicione:
    - **Name:** `VITE_API_URL`
    - **Value:** `https://func-hairscan-ai.azurewebsites.net/api`
11. Clique **"Save"**

---

## 9. Passo 7 — Deploy do Frontend

Se você configurou o GitHub Actions (passo 8), o deploy é automático a cada push:

```bash
cd frontend/
npm install
npm run build  # Testar build local antes

git add .
git commit -m "Deploy frontend"
git push
```

O GitHub Action vai buildar e deployar automaticamente.

---

## 10. Passo 8 — Configurar CORS

Para que o frontend consiga chamar o backend.

1. No Portal, acesse o **Function App** (`func-hairscan-ai`)
2. Menu lateral → **"CORS"**
3. Em **"Allowed Origins"**, adicione:
   - `https://swa-hairscan-ai.azurestaticapps.net` (URL do seu Static Web App)
   - `http://localhost:3000` (para desenvolvimento local)
4. Marque **"Enable Access-Control-Allow-Credentials"**
5. Clique **"Save"**

---

## 11. Passo 9 — Testar

### Teste local:

**Terminal 1 — Backend:**
```bash
cd backend/
pip install -r requirements.txt
func start
```
Backend roda em `http://localhost:7071`

**Terminal 2 — Frontend:**
```bash
cd frontend/
npm install
npm run dev
```
Frontend roda em `http://localhost:3000`

### Teste em produção:

Acesse a URL do seu Static Web App:
```
https://swa-hairscan-ai.azurestaticapps.net
```

1. Faça upload de uma imagem de referência (mecha antes do tratamento)
2. Faça upload de uma imagem de teste (mecha depois do tratamento)
3. Clique em "Iniciar Análise"
4. Aguarde os resultados (mapa de segmentação + métricas + laudo)

---

## 12. Estrutura do Projeto

```
hairscan-ai/
├── backend/                      # Azure Functions (Python)
│   ├── function_app.py           # Endpoints da API (upload, analyze, results, health)
│   ├── host.json                 # Configuração do Azure Functions
│   ├── local.settings.json       # Variáveis de ambiente locais (NÃO commitar!)
│   └── requirements.txt          # Dependências Python
│
├── frontend/                     # React + Vite
│   ├── index.html                # Entry point HTML
│   ├── package.json              # Dependências Node.js
│   ├── vite.config.js            # Configuração do Vite (proxy para dev local)
│   ├── .env.example              # Template de variáveis de ambiente
│   └── src/
│       ├── main.jsx              # Entry point React
│       ├── App.jsx               # Componente principal (orquestra o fluxo)
│       ├── components/
│       │   ├── ImageUploader.jsx  # Upload com drag-and-drop
│       │   └── ResultsDashboard.jsx # Dashboard de resultados
│       └── services/
│           └── api.js            # Comunicação com o backend
│
└── docs/
    └── SETUP.md                  # Este documento
```

---

## 13. API Reference

### `GET /api/health`
Health check do serviço.

**Response:**
```json
{
  "status": "healthy",
  "service": "hairscan-ai",
  "timestamp": "2025-08-18T14:30:00.000000"
}
```

### `POST /api/upload`
Upload de imagem para o Blob Storage.

**Request:** `multipart/form-data`
- `file` — Arquivo de imagem (PNG/JPG/WebP, max 10MB)
- `type` — `"reference"` ou `"test"`

**Response:**
```json
{
  "success": true,
  "blob_name": "reference/abc123.jpg",
  "url": "https://sthairscanai.blob.core.windows.net/...",
  "type": "reference",
  "size": 245760
}
```

### `POST /api/analyze`
Disparar análise comparativa.

**Request:** `application/json`
```json
{
  "reference_blob": "reference/abc123.jpg",
  "test_blob": "test/def456.jpg"
}
```

**Response:**
```json
{
  "analysis_id": "a1b2c3d4e5f6",
  "timestamp": "2025-08-18T14:30:00.000000",
  "segmentation_map": "<base64 PNG>",
  "metrics": {
    "confidence": 56,
    "clarity": 4,
    "consistency": 100
  },
  "verdict": "reduction",
  "verdict_label": "Redução do Frizz",
  "report": "Excelente resultado! O tratamento promoveu...",
  "stats": {
    "improved_pct": 42.3,
    "worse_pct": 18.1,
    "unchanged_pct": 39.6
  }
}
```

### `GET /api/results/{analysis_id}`
Consultar resultado anterior.

---

## 14. Troubleshooting

### "CORS error" no navegador
→ Verifique se a URL do frontend está na lista de CORS do Function App (Passo 10).

### "Module not found: cv2" no Azure Functions
→ O pacote `opencv-python-headless` é necessário (não o `opencv-python`). Verifique o `requirements.txt`.

### "Azure OpenAI quota exceeded"
→ No Portal, acesse o recurso OpenAI → "Quotas" → aumente o limite de tokens/min do deployment.

### "Blob Storage connection refused"
→ Verifique se a Connection String está correta nas variáveis de ambiente do Function App.

### Frontend não conecta no backend em produção
→ Verifique se `VITE_API_URL` está configurado no Static Web App com a URL correta do Function App.

### Imagens não aparecem no mapa de segmentação
→ Verifique se as imagens são PNG ou JPG válidas. O OpenCV pode falhar com imagens corrompidas.

### Deploy do Function App falha
→ Verifique se a versão do Python no Function App é 3.10 ou 3.11 (compatível com as dependências).

---

## 💡 Próximos Passos (após MVP)

1. **Cosmos DB** — Persistir histórico de análises (substituir in-memory store)
2. **Azure AD B2C** — Autenticação de usuários
3. **Application Insights** — Monitoramento e telemetria
4. **Custom Domain** — Domínio personalizado no Static Web App
5. **Rate Limiting** — Adicionar API Management para controle de uso
6. **PDF Reports** — Gerar relatórios em PDF com os resultados
