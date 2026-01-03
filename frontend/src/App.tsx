import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Analytics from './pages/Analytics';
import AIAds from './pages/AIAds';
import MercadoLibreCallback from './pages/MercadoLibreCallback';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* OAuth Callback - No Layout */}
                <Route path="/callback/mercadolibre" element={<MercadoLibreCallback />} />

                {/* Main App Routes - With Layout */}
                <Route path="/*" element={
                    <Layout>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/products" element={<Products />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/ai-ads" element={<AIAds />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/logs" element={<Logs />} />
                        </Routes>
                    </Layout>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

