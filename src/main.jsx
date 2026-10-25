import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppearanceProvider } from './Appearance.jsx';
import './styles.css';
import './layout.css';
import './motion.css';
import './extras.css';
createRoot(document.getElementById('root')).render(<AppearanceProvider><header className="window-titlebar"><span>见微 <b>PaperDay</b></span><small>每天一篇 · 让好奇发生</small></header><div className="window-content"><App/></div></AppearanceProvider>);
