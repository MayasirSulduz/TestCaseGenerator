import React, { useState, useEffect } from 'react';
import TestGenerator from './components/TestGenerator';
import { checkHealth } from './services/api';
import './App.css';

function App() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await checkHealth();
      if (response.status === 'success') {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendStatus('error');
    }
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <header className="header">
          <h1>
            AI-Powered Test Case Generator
          </h1>
          <p>Generate comprehensive unit tests automatically using Grok AI</p>

          {/* Backend Status Indicator */}
          <div className="status-indicator">
            {backendStatus === 'checking' && (
              <span className="status-badge status-checking">
                ⏳ Checking backend...
              </span>
            )}
            {backendStatus === 'connected' && (
              <span className="status-badge status-connected">
                ✓ Backend Connected
              </span>
            )}
            {backendStatus === 'error' && (
              <span className="status-badge status-error">
                ✕ Backend Disconnected
              </span>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          {backendStatus === 'error' ? (
            <div className="error-container">
              <h2>⚠️ Backend Connection Failed</h2>
              <p>Please make sure the backend server is running:</p>
              <div className="code-block">
                <code>npm run dev</code>
              </div>
              <button className="btn btn-primary" onClick={checkBackendHealth}>
                🔄 Retry Connection
              </button>
            </div>
          ) : backendStatus === 'connected' ? (
            <TestGenerator />
          ) : (
            <div className="loading">
              <div className="spinner"></div>
              <p>Connecting to backend...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;