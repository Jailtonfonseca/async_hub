#!/bin/bash

# ===========================================
# Script de Backup do Banco de Dados AsyncHub
# ===========================================

set -e

# Configurações
BACKUP_DIR="./backups"
DB_CONTAINER="async-hub-db"
DB_NAME="${DB_NAME:-async_hub}"
DB_USER="${DB_USER:-async_user}"
DB_PASS="${DB_PASS:-async_pass}"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${DATE}.sql.gz"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo "🔄 Iniciando backup do banco de dados..."
echo "📦 Banco: $DB_NAME"
echo "💾 Arquivo: $BACKUP_FILE"

# Executar backup usando docker exec
docker exec "$DB_CONTAINER" mysqldump \
    -u"$DB_USER" \
    -p"$DB_PASS" \
    --single-transaction \
    --quick \
    --lock-tables=false \
    "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verificar se o backup foi criado com sucesso
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup concluído com sucesso!"
    echo "📊 Tamanho: $SIZE"
    echo "📍 Local: $BACKUP_FILE"
else
    echo "❌ Erro: Backup não foi criado"
    exit 1
fi

# Manter apenas os últimos 7 backups
echo "🧹 Limpando backups antigos (mantendo últimos 7)..."
cd "$BACKUP_DIR"
ls -t backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
echo "✅ Limpeza concluída"

echo "🎉 Processo de backup finalizado!"
