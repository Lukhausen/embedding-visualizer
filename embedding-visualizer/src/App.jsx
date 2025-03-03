import { useState, useCallback } from 'react'
import ApiKeyManager from './components/ApiKeyManager'
import WordListManager from './components/WordListManager'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import './App.css'

function App() {
  const [words, setWords] = useState([])

  const handleWordsChange = useCallback((newWords) => {
    setWords(newWords)
  }, [])

  return (
    <div className="app-container">
      <ApiKeyManager />
      <h1>Embedding Visualizer</h1>
      <p>Use this tool to visualize embeddings from OpenAI's API.</p>
      <EmbeddingVisualizer words={words} />
      <WordListManager onWordsChange={handleWordsChange} />
    </div>
  )
}

export default App
