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

    // Token Management
    async getTokenStatus(marketplace: string) {
        const res = await fetch(`${API_URL}/api/tokens/status/${marketplace}`);
        return res.json();
    },

    async refreshToken(marketplace: string) {
        const res = await fetch(`${API_URL}/api/tokens/refresh/${marketplace}`, { method: 'POST' });
        return res.json();
    },
};
