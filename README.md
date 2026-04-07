# AsyncHub - Integrador de Marketplaces

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61dafb)](https://reactjs.org/)
[![Node](https://img.shields.io/badge/Node.js-18+-339933)](https://nodejs.org/)

**AsyncHub** é uma plataforma completa de sincronização e gerenciamento de produtos entre múltiplos marketplaces (Mercado Livre, Amazon, WooCommerce), com automação via IA para otimização de anúncios.

## 🚀 Funcionalidades Principais

### Sincronização Multi-Marketplace
- **Integração nativa** com Mercado Livre, Amazon e WooCommerce
- **Sincronização automática** de estoque, preços e informações de produtos
- **Atualização em tempo real** via webhooks
- **Refresh automático** de tokens de acesso

### Gerenciamento de Produtos
- CRUD completo de produtos
- **Agrupamento inteligente** por SKU ou ID personalizado
- Histórico de sincronização
- Mapeamento de atributos entre plataformas

### Inteligência Artificial
- **Geração automática** de títulos e descrições otimizadas
- Sugestões de melhorias em anúncios existentes
- Suporte a múltiplos providers (OpenAI, Gemini, OpenRouter)
- Aprovação/rejeição de sugestões com um clique

### Monitoramento e Logs
- Dashboard com status das conexões
- Logs detalhados de webhooks e sincronizações
- Health checks em tempo real
- Métricas de performance

## 🏗️ Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend API   │────▶│   MariaDB       │
│   (React+Vite)  │◀────│   (Node+Express) │◀────│   (TypeORM)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │        │
                              ▼        ▼
                        ┌─────────┐ ┌──────────┐
                        │  Redis  │ │External  │
                        │ (Cache) │ │APIs (ML, │
                        └─────────┘ │Amazon...)│
                                    └──────────┘
```

### Stack Tecnológico

**Backend:**
- Node.js 18+ com TypeScript
- Express.js para API REST
- TypeORM para persistência de dados
- MariaDB como banco de dados principal
- Redis para cache e filas (opcional)
- Axios para chamadas HTTP externas

**Frontend:**
- React 18 com TypeScript
- Vite para build e dev server
- TailwindCSS para estilização
- React Router para navegação
- Lucide React para ícones

**Infraestrutura:**
- Docker e Docker Compose
- Containers isolados para cada serviço
- Redes internas para comunicação segura

## 📦 Instalação

### Pré-requisitos

- Node.js 18 ou superior
- Docker e Docker Compose (recomendado)
- MySQL/MariaDB 10.5+ (se não usar Docker)
- Redis 6+ (opcional)

### Opção 1: Usando Docker (Recomendado)

```bash
# Clonar repositório
git clone <repository-url>
cd async-hub

# Copiar arquivo de exemplo e configurar
cp backend/.env.example backend/.env
# Editar backend/.env com suas credenciais

# Subir todos os serviços
docker-compose up -d

# Acessar aplicação
# Frontend: http://localhost:3000
# Backend: http://localhost:4000
```

### Opção 2: Instalação Manual

#### Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Rodar migrações (se necessário)
npm run build
# TypeORM criará tabelas automaticamente em dev

# Iniciar servidor
npm run dev          # Desenvolvimento
npm run build && npm start  # Produção
```

#### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Configurar proxy (opcional)
# Editar vite.config.ts se necessário

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build
npm run preview
```

## ⚙️ Configuração

### Variáveis de Ambiente

#### Backend (.env)

```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=async_hub
DB_SSL=false

# CORS Configuration (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# TypeORM (only enable synchronize in development)
TYPEORM_SYNCHRONIZE=true

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Settings (optional)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
```

#### Frontend

O frontend usa proxy do Vite para desenvolvimento. Para produção, configure:

```bash
# .env.local (opcional)
VITE_API_URL=https://api.seudominio.com
```

### Configuração dos Marketplaces

#### Mercado Livre

1. Acesse [Mercado Libre Developers](https://developers.mercadolibre.com.br/)
2. Crie uma aplicação para obter `APP_ID` e `SECRET_KEY`
3. Configure o callback URL: `http://localhost:3000/mercadolivre/callback`
4. No dashboard, clique em "Conectar" e autorize

#### Amazon

1. Acesse [Amazon SP-API](https://developer.amazon.com/selling-partner-api)
2. Registre sua aplicação e obtenha credenciais LWA
3. Configure IAM role com permissões necessárias
4. No dashboard, clique em "Conectar Amazon"

#### WooCommerce

1. Acesse seu painel WordPress → WooCommerce → Configurações → Avançado → API REST
2. Crie novas chaves de API com permissão de leitura/escrita
3. Copie `Consumer Key` e `Consumer Secret`
4. No dashboard AsyncHub, insira as credenciais junto com a URL da loja

## 📖 Uso

### Dashboard

Após login, você verá:
- Status das conexões com marketplaces
- Últimas sincronizações realizadas
- Gráficos de produtos ativos/inativos
- Atalhos para ações rápidas

### Conectar Marketplace

1. Navegue até **Configurações**
2. Selecione o marketplace desejado
3. Preencha as credenciais
4. Clique em "Conectar"
5. Será redirecionado para OAuth (quando aplicável)

### Sincronizar Produtos

**Automático:**
- O sistema sincroniza a cada 15 minutos (configurável)
- Webhooks atualizam em tempo real quando disponíveis

**Manual:**
1. Vá para **Produtos**
2. Clique em "Importar de..." no marketplace desejado
3. Aguarde o processo completar

### Agrupar Produtos

Para vincular produtos de diferentes marketplaces:

1. Edite um produto
2. Preencha o campo "Group ID" com um identificador único
3. Outros produtos com o mesmo Group ID serão sincronizados juntos

### IA para Otimização

1. Selecione um produto na lista
2. Clique em "Gerar Sugestões com IA"
3. Revise as sugestões geradas
4. Aplique as mudanças desejadas

## 🔌 API REST

### Endpoints Principais

#### Conexões

```bash
GET    /api/connections              # Listar conexões
POST   /api/connections/mercadolibre # Conectar ML
POST   /api/connections/amazon       # Conectar Amazon
POST   /api/connections/woocommerce  # Conectar WooCommerce
DELETE /api/connections/:marketplace # Remover conexão
```

#### Produtos

```bash
GET    /api/products                 # Listar produtos
GET    /api/products/:id             # Detalhes do produto
POST   /api/products                 # Criar produto
PUT    /api/products/:id             # Atualizar produto
DELETE /api/products/:id             # Remover produto
GET    /api/products/groups          # Listar grupos
POST   /api/products/import/:source  # Importar de marketplace
```

#### Sincronização

```bash
GET    /api/sync/status              # Status do scheduler
GET    /api/sync/history             # Histórico de syncs
POST   /api/sync/trigger             # Trigger sync global
POST   /api/sync/trigger/:marketplace # Trigger sync específico
POST   /api/sync/interval            # Configurar intervalo
```

#### Tokens

```bash
GET    /api/tokens/status/:marketplace # Status do token
POST   /api/tokens/refresh/:marketplace # Forçar refresh
```

#### Webhooks

```bash
POST   /api/webhooks/mercadolibre    # Webhook ML
POST   /api/webhooks/woocommerce     # Webhook WooCommerce
GET    /api/webhooks/logs            # Logs de webhooks
POST   /api/webhooks/test            # Testar webhooks
```

#### IA

```bash
GET    /api/ai/status                # Status dos providers
POST   /api/ai/generate/:productId   # Gerar sugestões
GET    /api/ai/suggestions           # Listar sugestões pendentes
POST   /api/ai/suggestions/:id/approve    # Aprovar sugestão
POST   /api/ai/suggestions/:id/reject     # Rejeitar sugestão
POST   /api/ai/suggestions/:id/create-in-ml # Criar no ML
```

### Exemplo de Requisição

```bash
# Listar produtos
curl -X GET http://localhost:4000/api/products \
  -H "Content-Type: application/json"

# Importar produtos do Mercado Livre
curl -X POST http://localhost:4000/api/products/import/mercadolibre \
  -H "Content-Type: application/json"

# Trigger manual de sincronização
curl -X POST http://localhost:4000/api/sync/trigger \
  -H "Content-Type: application/json"
```

## 🧪 Testes

```bash
# Backend
cd backend
npm test              # Rodar testes
npm run test:watch    # Modo watch
npm run test:coverage # Coverage report

# Frontend
cd frontend
npm test              # Rodar testes
```

## 📊 Monitoramento

### Health Check

```bash
curl http://localhost:4000/health
```

Resposta:
```json
{
  "status": "ok",
  "message": "Back-end is running!",
  "database": "connected",
  "tokenRefresh": "active",
  "syncScheduler": {
    "isRunning": true,
    "lastSync": "2024-01-15T10:30:00.000Z",
    "nextSync": "2024-01-15T10:45:00.000Z",
    "intervalMinutes": 15
  }
}
```

### Logs

Os logs são escritos no console e podem ser acessados via:

```bash
# Docker
docker-compose logs -f backend

# Manual
tail -f backend/logs/app.log
```

## 🔒 Segurança

### Boas Práticas Implementadas

- ✅ Helmet.js para headers de segurança HTTP
- ✅ CORS configurável com lista branca
- ✅ Rate limiting em endpoints críticos
- ✅ Validação de assinatura em webhooks (HMAC)
- ✅ Tokens sensíveis nunca expostos nas respostas
- ✅ SSL opcional para conexão com banco de dados

### Recomendações Adicionais

1. **Produção**: Desative `TYPEORM_SYNCHRONIZE`
2. **CORS**: Restrinja origens apenas aos domínios necessários
3. **HTTPS**: Use reverse proxy (Nginx/Traefik) com SSL
4. **Secrets**: Use gerenciador de secrets (Vault, AWS Secrets Manager)
5. **Backup**: Configure backups automáticos do banco de dados

## 🛠️ Troubleshooting

### Problemas Comuns

#### Banco de dados não conecta

```bash
# Verificar se DB está rodando
docker-compose ps

# Checar logs
docker-compose logs db

# Validar credenciais no .env
```

#### Tokens expiram frequentemente

- Verifique se o refresh service está rodando
- Confirme que `refreshToken` foi salvo corretamente
- Para Amazon, valide que as credenciais LWA estão corretas

#### Sincronização falha

```bash
# Verificar status do scheduler
curl http://localhost:4000/api/sync/status

# Checar logs de erro
docker-compose logs backend | grep -i error

# Trigger manual para debug
curl -X POST http://localhost:4000/api/sync/trigger
```

#### Webhooks não chegam

- Valide URLs de callback nos marketplaces
- Verifique se o backend está acessível externamente
- Use ngrok para testes locais: `ngrok http 4000`

### Logs de Debug

Ative logging detalhado:

```bash
# Backend .env
NODE_ENV=development
TYPEORM_LOGGING=true
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código

- TypeScript estrito (sem `any`)
- ESLint + Prettier configurados
- Testes obrigatórios para novas features
- Commits semânticos

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- **Documentação**: `/docs`
- **Issues**: GitHub Issues
- **Email**: suporte@asyncHub.com

## 🙏 Agradecimentos

- [Mercado Livre Developers](https://developers.mercadolibre.com.br/)
- [Amazon SP-API](https://developer.amazon.com/selling-partner-api)
- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- Comunidade open-source

---

**AsyncHub** © 2024 - Todos os direitos reservados
