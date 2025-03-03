import { useState, useCallback, useRef, useEffect } from 'react'
import ControlPanel from './components/ControlPanel'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import './App.css'

function App() {
  const [words, setWords] = useState([])
  const [algorithm, setAlgorithm] = useState('pca')
  const visualizerRef = useRef(null)

  const handleWordsChange = useCallback((newWords) => {
    setWords(newWords)
  }, [])
  
  const handleAlgorithmChange = useCallback((newAlgorithm) => {
    setAlgorithm(newAlgorithm)
    // Save the selected algorithm to localStorage
    localStorage.setItem('selected-dimension-algorithm', newAlgorithm)
  }, [])
  
  // Load saved algorithm choice when component mounts
  useEffect(() => {
    const savedAlgorithm = localStorage.getItem('selected-dimension-algorithm')
    if (savedAlgorithm) {
      setAlgorithm(savedAlgorithm)
    }
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
      <ControlPanel 
        words={words} 
        onWordsChange={handleWordsChange}
        selectedAlgorithm={algorithm}
        onAlgorithmChange={handleAlgorithmChange} 
      />
      <EmbeddingVisualizer 
        words={words} 
        onFocusChanged={handleVisualizerRef}
        algorithmId={algorithm}
      />
    </div>
  )
}

export default App
