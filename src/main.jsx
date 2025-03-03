import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.jsx'

// Initialize Three.js polyfills and global settings
// This ensures consistent behavior across browsers
import * as THREE from 'three'

// Check for WebGL support before mounting the app
const checkWebGLSupport = () => {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch (e) {
    return false
  }
}

// Initialize our app with proper error handling
const initApp = () => {
  const rootElement = document.getElementById('root')
  
  // Check WebGL support
  if (!checkWebGLSupport()) {
    rootElement.innerHTML = `
      <div style="color: white; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; background: rgba(0,0,0,0.8); border-radius: 8px;">
        <h2>WebGL Not Supported</h2>
        <p>Your browser or device doesn't seem to support WebGL, which is required for 3D visualization.</p>
        <p>Please try a modern browser like Chrome, Firefox, or Edge.</p>
      </div>
    `
    return
  }
  
  const root = createRoot(rootElement)
  
  // Set up HMR
  if (import.meta.hot) {
    import.meta.hot.accept()
  }
  
  root.render(
    <StrictMode>
      <App />
      <ToastContainer position="bottom-right" />
    </StrictMode>,
  )
}

// Start the application
initApp()
