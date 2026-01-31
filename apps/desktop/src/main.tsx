import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <PrivyProvider
            appId={import.meta.env.VITE_PRIVY_APP_ID}
            config={{
                appearance: { theme: 'dark', accentColor: '#FFFFFF' },
                loginMethods: ['email', 'google'],
            }}
        >
            <App />
        </PrivyProvider>
    </React.StrictMode>
);
