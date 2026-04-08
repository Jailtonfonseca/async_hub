#!/bin/bash

# ===========================================
# Script de Monitoramento do AsyncHub
# ===========================================
# Este script verifica a saúde de todos os serviços
# e exibe informações detalhadas

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "  AsyncHub - Monitoramento de Serviços"
echo "============================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    exit 1
fi

# Check container status
echo -e "${YELLOW}📦 Status dos Containers:${NC}"
echo "-------------------------------------------"
docker compose ps
echo ""

# Check health of each service
echo -e "${YELLOW}🏥 Saúde dos Serviços:${NC}"
echo "-------------------------------------------"

# Backend health check
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend:${NC} Saudável (HTTP $BACKEND_STATUS)"
    curl -s http://localhost:4000/health | jq '.' 2>/dev/null || curl -s http://localhost:4000/health
else
    echo -e "${RED}❌ Backend:${NC} Inacessível (HTTP $BACKEND_STATUS)"
fi
echo ""

# Frontend health check
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "304" ]; then
    echo -e "${GREEN}✅ Frontend:${NC} Saudável (HTTP $FRONTEND_STATUS)"
else
    echo -e "${RED}❌ Frontend:${NC} Inacessível (HTTP $FRONTEND_STATUS)"
fi
echo ""

# Database health check
DB_STATUS=$(docker inspect --format='{{.State.Health.Status}}' async-hub-db 2>/dev/null || echo "unhealthy")
if [ "$DB_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✅ MariaDB:${NC} Saudável"
else
    echo -e "${RED}❌ MariaDB:${NC} $DB_STATUS"
fi
echo ""

# Redis health check
REDIS_STATUS=$(docker inspect --format='{{.State.Health.Status}}' async-hub-redis 2>/dev/null || echo "unhealthy")
if [ "$REDIS_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✅ Redis:${NC} Saudável"
else
    echo -e "${RED}❌ Redis:${NC} $REDIS_STATUS"
fi
echo ""

# Resource usage
echo -e "${YELLOW}💾 Uso de Recursos:${NC}"
echo "-------------------------------------------"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" async-hub-backend async-hub-frontend async-hub-db async-hub-redis 2>/dev/null || echo "Estatísticas não disponíveis"
echo ""

# Recent logs (last 5 lines per service)
echo -e "${YELLOW}📋 Últimos Logs (erros):${NC}"
echo "-------------------------------------------"
for service in backend frontend db redis; do
    echo -e "\n${YELLOW}[$service]${NC}"
    docker compose logs --tail=5 $service 2>/dev/null | grep -i "error\|fail\|exception" || echo "  Sem erros recentes"
done
echo ""

echo "============================================"
echo "  Comandos Úteis:"
echo "============================================"
echo "  Ver logs em tempo real:  docker compose logs -f"
echo "  Reiniciar um serviço:    docker compose restart <servico>"
echo "  Ver detalhes:            docker compose ps -a"
echo "  Parar tudo:              docker compose down"
echo "  Backup do banco:         ./scripts/backup.sh"
echo "============================================"
