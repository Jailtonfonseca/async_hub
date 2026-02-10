# Análise de possíveis erros e melhorias

## 1) Erros prováveis (alta prioridade)

### 1.1 Build do backend quebrando por incompatibilidades de tipos
A compilação TypeScript do backend falha em múltiplos pontos (adapters e providers), o que indica risco de deploy quebrado e regressões silenciosas no ambiente de desenvolvimento.

**Impacto:** impossibilidade de gerar artefato de produção com confiança.

**Melhorias sugeridas:**
- Padronizar versões e tipagem das bibliotecas HTTP (ex.: `axios`) e dos SDKs externos.
- Revisar tipos de retorno das integrações de IA (respostas atualmente tratadas como `unknown`).
- Adicionar etapa obrigatória de `npm run build` no pipeline antes de merge.

### 1.2 Build do frontend quebrando por ausência de configuração TypeScript
O script de build do frontend usa `tsc && vite build`, mas o `tsc` abre ajuda ao invés de compilar, comportamento típico quando não há `tsconfig.json` resolvível no diretório.

**Impacto:** build de produção não conclui.

**Melhorias sugeridas:**
- Criar/validar `frontend/tsconfig.json` e, se necessário, `tsconfig.node.json`.
- Ajustar script para `tsc -p tsconfig.json && vite build`.

### 1.3 Rotas com tipagem `any` no backend
No `index.ts` há handlers com `req`/`res` em `any`, reduzindo a segurança de tipo e a capacidade de detectar erros em tempo de build.

**Impacto:** maior chance de bugs em runtime e refactors inseguros.

**Melhorias sugeridas:**
- Substituir `any` por `Request` e `Response` do Express.
- Criar tipos para payloads de endpoints sensíveis (`/api/sync/interval`, `/api/tokens/*`).

### 1.4 Possível erro de domínio de dados no `SyncScheduler`
Os erros de compilação indicam propriedades incompatíveis na criação de `Product` (como `sourceMarketplace`) em relação ao tipo inferido pela entidade.

**Impacto:** sincronização pode falhar em produção, afetando catálogo.

**Melhorias sugeridas:**
- Revisar entidade `Product` e alinhar campos usados no scheduler.
- Criar teste de integração do fluxo de sincronização com fixtures por marketplace.

## 2) Riscos de arquitetura e operação

### 2.1 `synchronize: true` no TypeORM
A configuração atual do datasource mantém sincronização automática de schema.

**Impacto:** risco de mudanças destrutivas no banco em ambiente produtivo.

**Melhorias sugeridas:**
- Desativar `synchronize` fora de desenvolvimento.
- Adotar migrations versionadas para evolução de schema.

### 2.2 CORS aberto sem restrição explícita
O backend usa `app.use(cors())` sem whitelist de origens.

**Impacto:** superfície maior para consumo indevido da API em ambientes expostos.

**Melhorias sugeridas:**
- Configurar origens permitidas via variável de ambiente.
- Restringir métodos e headers conforme necessidade real.

### 2.3 URL da API no frontend fixada em IP local no Docker Compose
A variável `VITE_API_URL` está fixada em IP privado específico.

**Impacto:** baixa portabilidade entre ambientes e falha em máquinas diferentes.

**Melhorias sugeridas:**
- Parametrizar via `.env` por ambiente.
- Em ambiente Docker local, preferir hostname de serviço (`http://backend:4000`) quando aplicável.

## 3) Segurança e boas práticas

### 3.1 Arquivo `.env` versionado no backend
Existe arquivo `.env` no projeto backend.

**Impacto:** risco de exposição de segredos dependendo do conteúdo/uso.

**Melhorias sugeridas:**
- Garantir `.env` no `.gitignore` (manter apenas `.env.example`).
- Rotacionar credenciais caso já tenham sido compartilhadas.

### 3.2 Tratamento genérico de erros em rotas
Várias rotas retornam mensagens genéricas sem padronização de código/estrutura de erro.

**Impacto:** observabilidade e troubleshooting limitados.

**Melhorias sugeridas:**
- Padronizar envelope de erro (`code`, `message`, `details`, `traceId`).
- Usar middleware único para mapear erros de domínio/infra.

## 4) Plano sugerido de estabilização (curto prazo)

1. **Corrigir builds (backend + frontend)** como bloqueador de release.
2. **Remover `any` de handlers críticos** e reforçar tipos de contratos API.
3. **Desativar `synchronize` em produção** e introduzir migrations.
4. **Parametrizar CORS e `VITE_API_URL`** por ambiente.
5. **Adicionar CI mínimo** com:
   - `npm --prefix backend run build`
   - `npm --prefix frontend run build`
   - checagens de lint/typecheck

## 5) Comandos usados nesta análise

- `npm --prefix backend run build`
- `npm --prefix frontend run build`
- inspeção de arquivos-chave de backend/frontend e compose
