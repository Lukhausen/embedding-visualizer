import { useState, useCallback, useRef } from 'react'
import ControlPanel from './components/ControlPanel'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import './App.css'

function App() {
  const [words, setWords] = useState([])
  const visualizerRef = useRef(null)

  const handleWordsChange = useCallback((newWords) => {
    setWords(newWords)
  }, [])
  
  /**
   * Store reference to visualizer functions
   */
  const handleVisualizerRef = useCallback((visualizerAPI) => {
    if (visualizerAPI) {
      visualizerRef.current = visualizerAPI
    }
  }, [])

  return (
    <div className="app-container">
      <ControlPanel words={words} onWordsChange={handleWordsChange} />
      <EmbeddingVisualizer 
        words={words} 
        onFocusChanged={handleVisualizerRef}
      />
    </div>
  )
}

export default App
