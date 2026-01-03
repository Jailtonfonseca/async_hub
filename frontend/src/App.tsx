import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
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
