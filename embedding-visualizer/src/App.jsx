import { useState, useCallback } from 'react'
import ControlPanel from './components/ControlPanel'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import './App.css'

function App() {
  const [words, setWords] = useState([])

  const handleWordsChange = useCallback((newWords) => {
    setWords(newWords)
  }, [])

  return (
    <div className="app-container">
      <ControlPanel onWordsChange={handleWordsChange} />
      <EmbeddingVisualizer words={words} />
    </div>
  )
}

export default App
