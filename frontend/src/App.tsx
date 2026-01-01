import { useState, useEffect } from 'react'

function App() {
    const [status, setStatus] = useState('Checking Backend...')

    useEffect(() => {
        fetch('http://localhost:4000/health')
            .then(res => res.json())
            .then(data => setStatus(data.message))
            .catch(() => setStatus('Backend not connected'))
    }, [])

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                    ASync Hub
                </h1>
                <p className="text-xl text-gray-400 mb-8">Central de Integração Multi-Marketplace</p>

                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p>Backend Status: <span className="font-mono text-green-400">{status}</span></p>
                </div>
            </div>
        </div>
    )
}

export default App
