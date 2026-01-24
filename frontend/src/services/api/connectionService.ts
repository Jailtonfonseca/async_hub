const API_URL = ''; // Uses Vite proxy

export const connectionService = {
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
};
