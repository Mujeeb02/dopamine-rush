import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { startAnalytics } from './lib/analytics'

startAnalytics()

createRoot(document.getElementById("root")!).render(<App />);
