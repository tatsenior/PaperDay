import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppearanceProvider } from './Appearance.jsx';
import './styles.css';
import './layout.css';
import './motion.css';
createRoot(document.getElementById('root')).render(<AppearanceProvider><App/></AppearanceProvider>);
