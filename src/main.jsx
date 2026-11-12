// main.jsx: the entry point. The browser runs this file first.
import { StrictMode } from 'react' // React's development checks wrapper
import { createRoot } from 'react-dom/client' // connects React to the web page
import './index.css' // the app's styles
import App from './App.jsx' // the top-level component of the whole app

// Find the empty <div id="root"> in index.html and draw the App inside it.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
