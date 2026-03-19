import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { MockStateProvider } from './lib/mock-state';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <MockStateProvider>
      <App />
    </MockStateProvider>
  </BrowserRouter>,
);
