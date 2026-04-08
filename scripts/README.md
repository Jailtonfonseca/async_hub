# ===========================================
# Scripts de Gerenciamento do AsyncHub
# ===========================================

## 🚀 Inicialização

### Iniciar todos os serviços
```bash
docker compose up -d
```

### Iniciar com rebuild (após mudanças no código)
```bash
docker compose up -d --build
```

### Ver logs em tempo real
```bash
docker compose logs -f
```

### Ver logs de um serviço específico
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
docker compose logs -f redis
```

## 🛑 Parada

### Parar todos os serviços
```bash
docker compose down
```

### Parar e remover volumes (cuidado: apaga dados!)
```bash
docker compose down -v
```

## 🔍 Monitoramento

### Script automático de monitoramento
```bash
./scripts/monitor.sh
```
Verifica saúde de todos os serviços, uso de recursos e logs de erro.

### Ver status dos containers
```bash
docker compose ps
```

### Verificar health checks
```bash
docker inspect --format='{{.State.Health.Status}}' async-hub-backend
docker inspect --format='{{.State.Health.Status}}' async-hub-db
docker inspect --format='{{.State.Health.Status}}' async-hub-redis
```

### Acessar terminal do backend
```bash
docker exec -it async-hub-backend sh
```

### Acessar terminal do banco de dados
```bash
docker exec -it async-hub-db bash
```

### Acessar Redis CLI
```bash
docker exec -it async-hub-redis redis-cli
```

## 💾 Backup

### Criar backup do banco de dados
```bash
./scripts/backup.sh
```

### Restaurar backup
```bash
zcat backups/backup_async_hub_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i async-hub-db mysql -uasync_user -passync_pass async_hub
```

## 🔄 Migrações do TypeORM

### Gerar nova migração
```bash
docker exec -it async-hub-backend npx typeorm-ts-node-commonjs migration:generate src/migrations/NomeDaMigracao
```

### Rodar migrações
```bash
docker exec -it async-hub-backend npx typeorm-ts-node-commonjs migration:run
```

### Reverter migração
```bash
docker exec -it async-hub-backend npx typeorm-ts-node-commonjs migration:revert
```

## 🧪 Desenvolvimento

### Reiniciar apenas o backend
```bash
docker compose restart backend
```

### Reiniciar apenas o frontend
```bash
docker compose restart frontend
```

### Reconstruir apenas um serviço
```bash
docker compose build backend
docker compose build frontend
```

## 📊 Variáveis de Ambiente

### Copiar arquivo de exemplo
```bash
cp .env.example .env
```

### Editar variáveis de ambiente
Edite o arquivo `.env` na raiz do projeto.

Variáveis principais:
- `NODE_ENV`: development ou production
- `DB_USER`, `DB_PASS`, `DB_NAME`: Credenciais do banco
- `CORS_ORIGINS`: Origens permitidas para CORS
- `TYPEORM_SYNCHRONIZE`: false em produção
- `VITE_API_URL`: URL da API para o frontend

## 🐛 Troubleshooting

### Backend não inicia
1. Verifique logs: `docker compose logs backend`
2. Confirme que DB e Redis estão saudáveis
3. Verifique variáveis de ambiente no .env

### Frontend não conecta ao backend
1. Verifique `VITE_API_URL` no .env
2. Confirme que backend está rodando: `docker compose ps`
3. Teste endpoint: `curl http://localhost:4000/health`

### Banco de dados não conecta
1. Aguarde health check do MariaDB (~30s)
2. Verifique credenciais no .env
3. Acesse DB: `docker exec -it async-hub-db mysql -uasync_user -passync_pass`

### Limpar cache e reconstruir
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 📈 Produção

### Configurar para produção
1. Copie `.env.example` para `.env`
2. Altere `NODE_ENV=production`
3. Defina `TYPEORM_SYNCHRONIZE=false`
4. Configure senhas fortes no .env
5. Execute: `docker compose -f docker-compose.yml up -d`

### Deploy com Docker Compose
```bash
# Build otimizado para produção
docker compose -f docker-compose.yml build

# Iniciar em background
docker compose -f docker-compose.yml up -d

# Verificar status
docker compose -f docker-compose.yml ps
```
