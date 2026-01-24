import { connectionService } from "./services/api/connectionService";
import { productService } from "./services/api/productService";

const API_URL = ''; // Uses Vite proxy - requests go to /api/* and /health

export const api = {
    // Health
    async health() {
        const res = await fetch(`${API_URL}/health`);
        return res.json();
    },

    // Connections (Refactored)
    ...connectionService,

    // Products (Refactored)
    ...productService,

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
