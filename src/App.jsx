import { useState, useCallback, useRef, useEffect } from 'react'
import ControlPanel from './components/ControlPanel'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import './App.css'

function App() {
  const [words, setWords] = useState([])
  const [algorithm, setAlgorithm] = useState('pca')
  const [axisLabels, setAxisLabels] = useState({ x: "X", y: "Y", z: "Z" })
  const [textSize, setTextSize] = useState(1)
  const [labelsPerAxis, setLabelsPerAxis] = useState(1)
  const visualizerRef = useRef(null)

  const handleWordsChange = useCallback((newWords) => {
    setWords(newWords)
  }, [])
  
  const handleAlgorithmChange = useCallback((newAlgorithm) => {
    setAlgorithm(newAlgorithm)
    // Save the selected algorithm to localStorage
    localStorage.setItem('selected-dimension-algorithm', newAlgorithm)
  }, [])
  
  const handleAxisLabelsChange = useCallback((newLabels, newLabelsPerAxis) => {
    setAxisLabels(newLabels)
    if (newLabelsPerAxis) {
      setLabelsPerAxis(newLabelsPerAxis)
    }
    // Save the axis labels to localStorage
    localStorage.setItem('axis-labels', JSON.stringify(newLabels))
    if (newLabelsPerAxis) {
      localStorage.setItem('labels-per-axis', newLabelsPerAxis.toString())
    }
  }, [])
  
  const handleTextSizeChange = useCallback((newSize) => {
    setTextSize(newSize)
    // The actual saving is done in the SettingsManager component
  }, [])
  
  // Load saved algorithm choice, axis labels, and text size when component mounts
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
    
    // Load saved text size
    const savedTextSize = localStorage.getItem('app-text-size')
    if (savedTextSize) {
      try {
        const parsedSize = parseFloat(savedTextSize)
        if (!isNaN(parsedSize)) {
          setTextSize(parsedSize)
        }
      } catch (error) {
        console.error('Failed to parse saved text size:', error)
      }
    }
    
    // Load saved labels per axis setting
    const savedLabelsPerAxis = localStorage.getItem('labels-per-axis')
    if (savedLabelsPerAxis) {
      try {
        const parsedValue = parseInt(savedLabelsPerAxis)
        if (!isNaN(parsedValue)) {
          setLabelsPerAxis(parsedValue)
        }
      } catch (error) {
        console.error('Failed to parse saved labels per axis:', error)
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
        textSize={textSize}
        onTextSizeChange={handleTextSizeChange}
      />
      <EmbeddingVisualizer 
        words={words} 
        onFocusChanged={handleVisualizerRef}
        algorithmId={algorithm}
        axisLabels={axisLabels}
        textSize={textSize}
        labelsPerAxis={labelsPerAxis}
      />
    </div>
  )
}

export default App
