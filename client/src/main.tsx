import './force-dark.css'; // force dark theme globally
document.documentElement.classList.add('dark'); // set before render

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
