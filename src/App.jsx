import { useState, useCallback, useRef, useEffect } from 'react'
import ControlPanel from './components/ControlPanel'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import './App.css'

function App() {
  const [words, setWords] = useState([])
  const [algorithm, setAlgorithm] = useState('pca')
  const [axisLabels, setAxisLabels] = useState({ x: "X", y: "Y", z: "Z" })
  const visualizerRef = useRef(null)

  const handleWordsChange = useCallback((newWords) => {
    setWords(newWords)
  }, [])
  
  const handleAlgorithmChange = useCallback((newAlgorithm) => {
    setAlgorithm(newAlgorithm)
    // Save the selected algorithm to localStorage
    localStorage.setItem('selected-dimension-algorithm', newAlgorithm)
  }, [])
  
  const handleAxisLabelsChange = useCallback((newLabels) => {
    setAxisLabels(newLabels)
    // Save the axis labels to localStorage
    localStorage.setItem('axis-labels', JSON.stringify(newLabels))
  }, [])
  
  // Load saved algorithm choice and axis labels when component mounts
  useEffect(() => {
    const savedAlgorithm = localStorage.getItem('selected-dimension-algorithm')
    if (savedAlgorithm) {
      setAlgorithm(savedAlgorithm)
    }
    
    const savedAxisLabels = localStorage.getItem('axis-labels')
    if (savedAxisLabels) {
      try {
        const parsedLabels = JSON.parse(savedAxisLabels)
        setAxisLabels(parsedLabels)
      } catch (error) {
        console.error('Failed to parse saved axis labels:', error)
      }
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
        axisLabels={axisLabels}
        onAxisLabelsChange={handleAxisLabelsChange}
      />
      <EmbeddingVisualizer 
        words={words} 
        onFocusChanged={handleVisualizerRef}
        algorithmId={algorithm}
        axisLabels={axisLabels}
      />
    </div>
  )
}

export default App
