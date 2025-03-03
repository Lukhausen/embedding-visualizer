import { useState, useEffect } from 'react'
import './ApiKeyManager.css'

function ApiKeyManager() {
  const [apiKey, setApiKey] = useState('')
  
  // Load API key on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai-api-key')
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
  }, [])
  
  const handleApiKeyChange = (e) => {
    const newKey = e.target.value
    setApiKey(newKey)
    localStorage.setItem('openai-api-key', newKey)
  }
  
  return (
    <div className="api-key-container">
      <p className="api-key-description">
        Enter your OpenAI API key to generate embeddings
      </p>
      <input
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder="Enter OpenAI API Key"
        className="api-key-input"
      />
      {apiKey ? (
        <p className="api-key-status success">API key is set</p>
      ) : (
        <p className="api-key-status warning">No API key set</p>
      )}
      <p className="api-key-help">
        Your API key is stored only in your browser and never sent to any server except OpenAI.
      </p>
    </div>
  )
}

export default ApiKeyManager 