import { useState, useEffect } from 'react'
import './ApiKeyManager.css'

function ApiKeyManager() {
  const [apiKey, setApiKey] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  
  // Load API key and visibility state from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai-api-key')
    const savedVisibility = localStorage.getItem('api-key-manager-visible')
    
    if (savedApiKey) {
      setApiKey(savedApiKey)
      // If we have a saved API key, respect the saved visibility or default to hidden
      setIsVisible(savedVisibility === 'true')
    } else {
      // If no saved API key, always show the manager
      setIsVisible(true)
    }
  }, [])
  
  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value)
  }
  
  const saveApiKey = () => {
    localStorage.setItem('openai-api-key', apiKey)
    setIsVisible(false)
    localStorage.setItem('api-key-manager-visible', 'false')
  }
  
  const toggleVisibility = () => {
    const newVisibility = !isVisible
    setIsVisible(newVisibility)
    localStorage.setItem('api-key-manager-visible', newVisibility.toString())
  }
  
  return (
    <div className="api-key-manager">
      {isVisible ? (
        <div className="api-key-form">
          <input
            type="password"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter OpenAI API Key"
            className="api-key-input"
          />
          <button onClick={saveApiKey} className="save-button">Save</button>
          {apiKey && (
            <button onClick={toggleVisibility} className="toggle-button">Hide</button>
          )}
        </div>
      ) : (
        <button onClick={toggleVisibility} className="show-button">API Key Settings</button>
      )}
    </div>
  )
}

export default ApiKeyManager 