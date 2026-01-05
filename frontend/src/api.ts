const API_URL = ''; // Uses Vite proxy - requests go to /api/* and /health

export const api = {
    // Health
    async health() {
        const res = await fetch(`${API_URL}/health`);
        return res.json();
    },

    // Connections
    async getConnections() {
        const res = await fetch(`${API_URL}/api/connections`);
        return res.json();
    },

    async getConnection(marketplace: string) {
        const res = await fetch(`${API_URL}/api/connections/${marketplace}`);
        return res.json();
    },

    async saveWooCommerceConnection(data: { apiUrl: string; apiKey: string; apiSecret: string }) {
        const res = await fetch(`${API_URL}/api/connections/woocommerce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    async saveMercadoLibreCredentials(data: { apiKey: string; apiSecret: string }) {
        const res = await fetch(`${API_URL}/api/connections/mercadolibre`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    async getMercadoLibreAuthUrl(redirectUri: string) {
        const res = await fetch(`${API_URL}/api/connections/mercadolibre/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`);
        return res.json();
    },

    async completeMercadoLibreAuth(code: string, redirectUri: string) {
        const res = await fetch(`${API_URL}/api/connections/mercadolibre/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        return res.json();
    },

    async testConnection(marketplace: string) {
        const res = await fetch(`${API_URL}/api/connections/${marketplace}/test`, { method: 'POST' });
        return res.json();
    },

    async deleteConnection(marketplace: string) {
        const res = await fetch(`${API_URL}/api/connections/${marketplace}`, { method: 'DELETE' });
        return res.json();
    },

    // Products
    async getProducts() {
        const res = await fetch(`${API_URL}/api/products`);
        return res.json();
    },

    async getProduct(id: number) {
        const res = await fetch(`${API_URL}/api/products/${id}`);
        return res.json();
    },

    async createProduct(data: any) {
        const res = await fetch(`${API_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    async updateProduct(id: number, data: any) {
        const res = await fetch(`${API_URL}/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    async deleteProduct(id: number) {
        const res = await fetch(`${API_URL}/api/products/${id}`, { method: 'DELETE' });
        return res.json();
    },

    async importProducts(marketplace: string) {
        const res = await fetch(`${API_URL}/api/products/import/${marketplace}`, { method: 'POST' });
        return res.json();
    },

    async syncProduct(id: number, marketplace: string) {
        const res = await fetch(`${API_URL}/api/products/${id}/sync/${marketplace}`, { method: 'POST' });
        return res.json();
    },

    // Product Groups
    async getProductGroups() {
        const res = await fetch(`${API_URL}/api/products/groups`);
        return res.json();
    },

    async setProductGroup(id: number, groupId: string | null) {
        const res = await fetch(`${API_URL}/api/products/${id}/group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId }),
        });
        return res.json();
    },

    async updateGroupStock(groupId: string, stock: number) {
        const res = await fetch(`${API_URL}/api/products/groups/${groupId}/stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock }),
        });
        return res.json();
    },

    // Token Management
    async getTokenStatus(marketplace: string) {
        const res = await fetch(`${API_URL}/api/tokens/status/${marketplace}`);
        return res.json();
    },

    async refreshToken(marketplace: string) {
        const res = await fetch(`${API_URL}/api/tokens/refresh/${marketplace}`, { method: 'POST' });
        return res.json();
    },

    // Sync Scheduler
    async getSyncStatus() {
        const res = await fetch(`${API_URL}/api/sync/status`);
        return res.json();
    },

    async getSyncHistory(limit: number = 10) {
        const res = await fetch(`${API_URL}/api/sync/history?limit=${limit}`);
        return res.json();
    },

    async triggerSync(marketplace?: string) {
        const url = marketplace
            ? `${API_URL}/api/sync/trigger/${marketplace}`
            : `${API_URL}/api/sync/trigger`;
        const res = await fetch(url, { method: 'POST' });
        return res.json();
    },

    async setSyncInterval(minutes: number) {
        const res = await fetch(`${API_URL}/api/sync/interval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutes }),
        });
        return res.json();
    },

    // Webhooks
    async getWebhookLogs(limit: number = 20) {
        const res = await fetch(`${API_URL}/api/webhooks/logs?limit=${limit}`);
        return res.json();
    },

    async testWebhooks() {
        const res = await fetch(`${API_URL}/api/webhooks/test`);
        return res.json();
    },

    // AI
    async getAIStatus() {
        const res = await fetch(`${API_URL}/api/ai/status`);
        return res.json();
    },

    async generateSuggestions(productId: number) {
        const res = await fetch(`${API_URL}/api/ai/generate/${productId}`, {
            method: 'POST',
        });
        return res.json();
    },

    async getPendingSuggestions() {
        const res = await fetch(`${API_URL}/api/ai/suggestions`);
        return res.json();
    },

    async getSuggestionsByProduct(productId: number) {
        const res = await fetch(`${API_URL}/api/ai/suggestions/product/${productId}`);
        return res.json();
    },

    async approveSuggestion(id: number) {
        const res = await fetch(`${API_URL}/api/ai/suggestions/${id}/approve`, {
            method: 'POST',
        });
        return res.json();
    },

    async rejectSuggestion(id: number) {
        const res = await fetch(`${API_URL}/api/ai/suggestions/${id}/reject`, {
            method: 'POST',
        });
        return res.json();
    },

    async updateSuggestion(id: number, data: any) {
        const res = await fetch(`${API_URL}/api/ai/suggestions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    async createSuggestionInML(id: number) {
        const res = await fetch(`${API_URL}/api/ai/suggestions/${id}/create-in-ml`, {
            method: 'POST',
        });
        return res.json();
    },

    // AI Settings
    async getAISettings() {
        const res = await fetch(`${API_URL}/api/ai/settings`);
        return res.json();
    },

    async saveAISettings(provider: string, data: { apiKey?: string; model?: string; isEnabled?: boolean }) {
        const res = await fetch(`${API_URL}/api/ai/settings/${provider}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },

    async testAIProvider(provider: string) {
        const res = await fetch(`${API_URL}/api/ai/settings/${provider}/test`, {
            method: 'POST',
        });
        return res.json();
    },

    async deleteAISettings(provider: string) {
        const res = await fetch(`${API_URL}/api/ai/settings/${provider}`, {
            method: 'DELETE',
        });
        return res.json();
    },
};
