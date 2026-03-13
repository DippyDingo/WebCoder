import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

const getOS = () => {
    const userAgent = navigator.userAgent;
    if (/Win/i.test(userAgent)) return "Windows";
    if (/Mac/i.test(userAgent)) return "macOS";
    if (/Linux/i.test(userAgent)) return "Linux";
    return "Unknown";
};
const OS = getOS();

const logClientError = (level: string, message: string, stack?: string) => {
    const errorInfo = {
        level: level,
        message: message,
        stack: stack || '',
        os: OS // Добавляем ОС в лог
    };
    
    fetch('/api/log', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(errorInfo)
    }).catch(console.error);
};

// Global Error Logging
window.onerror = function(message, source, lineno, colno, error) {
    const stack = error ? error.stack : `${source}:${lineno}:${colno}`;
    logClientError('error', message.toString(), stack);
};

// Catch Unhandled Promise Rejections
window.onunhandledrejection = function(event) {
    const reason = event.reason instanceof Error ? event.reason.message : event.reason.toString();
    const stack = event.reason instanceof Error ? event.reason.stack : '';
    logClientError('error', `Unhandled Rejection: ${reason}`, stack);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)