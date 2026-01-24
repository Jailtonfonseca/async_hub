const API_URL = ''; // Uses Vite proxy

export const productService = {
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
};
