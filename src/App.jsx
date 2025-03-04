import { useState, useCallback, useRef, useEffect } from 'react'
import ControlPanel from './components/ControlPanel'
import EmbeddingVisualizer from './components/EmbeddingVisualizer'
import { loadAxisLabels, loadLabelsPerAxis, saveAxisLabels } from './services/axisLabelService'
import './App.css'

function App() {
  const [words, setWords] = useState([])
  const [wordsWithEmbeddings, setWordsWithEmbeddings] = useState([])
  const [algorithm, setAlgorithm] = useState('pca')
  const [axisLabels, setAxisLabels] = useState(() => loadAxisLabels())
  const [textSize, setTextSize] = useState(1)
  const [labelsPerAxis, setLabelsPerAxis] = useState(() => loadLabelsPerAxis())
  const visualizerRef = useRef(null)

  const handleWordsChange = useCallback((newWords, newWordsWithEmbeddings) => {
    // Validate input to prevent unexpected state updates
    if (Array.isArray(newWords)) {
      setWords(newWords);
    }
    
    if (Array.isArray(newWordsWithEmbeddings)) {
      setWordsWithEmbeddings(newWordsWithEmbeddings);
      
      // Check if we have at least 3 words with embeddings to enable axis label updates
      const validEmbeddings = newWordsWithEmbeddings.filter(word => word && word.embedding !== null);
      if (validEmbeddings.length >= 3) {
        // Set a flag to indicate embeddings have changed and may need new labels
        localStorage.setItem('embeddings-updated', 'true');
      }
    }
  }, [])
  
  const handleAlgorithmChange = useCallback((newAlgorithm) => {
    setAlgorithm(newAlgorithm)
    // Save the selected algorithm to localStorage
    localStorage.setItem('selected-dimension-algorithm', newAlgorithm)
  }, [])
  
  const handleAxisLabelsChange = useCallback((newLabels, newLabelsPerAxis) => {
    // Update local state directly
    setAxisLabels(newLabels);
    if (newLabelsPerAxis) {
      setLabelsPerAxis(newLabelsPerAxis);
    }
    // Save to localStorage through the service
    saveAxisLabels(newLabels, newLabelsPerAxis);
  }, [])
  
  const handleTextSizeChange = useCallback((newSize) => {
    setTextSize(newSize)
    // The actual saving is done in the SettingsManager component
  }, [])
  
  // Clean up the useEffect that loads saved data
  useEffect(() => {
    // Load saved preferences only once on mount
    const savedAlgorithm = localStorage.getItem('selected-dimension-algorithm')
    if (savedAlgorithm) {
      setAlgorithm(savedAlgorithm)
    }
    
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
    
    // Check once on mount only
    const checkForAxisLabelUpdates = () => {
      const labelsUpdated = localStorage.getItem('axis-labels-updated');
      
      if (labelsUpdated === 'true') {
        localStorage.removeItem('axis-labels-updated');
        const updatedLabels = loadAxisLabels();
        if (JSON.stringify(updatedLabels) !== JSON.stringify(axisLabels)) {
          setAxisLabels(updatedLabels);
        }
      }
    };
    
    checkForAxisLabelUpdates();
  }, []);
  
  /**
   * Store reference to visualizer functions
   */
  const handleVisualizerRef = useCallback((visualizerAPI) => {
    if (visualizerAPI) {
      visualizerRef.current = visualizerAPI
    }
  }, [])

  // Add a new useEffect to listen for label update events
  useEffect(() => {
    const handleAxisLabelsUpdated = () => {
      // Load the updated labels
      const updatedLabels = loadAxisLabels();
      const updatedLabelsPerAxis = loadLabelsPerAxis();
      
      // Prevent unnecessary updates by comparing with current state
      if (JSON.stringify(updatedLabels) !== JSON.stringify(axisLabels)) {
        setAxisLabels(updatedLabels);
      }
      
      if (updatedLabelsPerAxis !== labelsPerAxis) {
        setLabelsPerAxis(updatedLabelsPerAxis);
      }
    };
    
    // Listen for the custom event
    window.addEventListener('axis-labels-updated', handleAxisLabelsUpdated);
    
    return () => {
      window.removeEventListener('axis-labels-updated', handleAxisLabelsUpdated);
    };
  }, [axisLabels, labelsPerAxis]);

  return (
    <div className="app-container">
      <ControlPanel 
        words={words} 
        wordsWithEmbeddings={wordsWithEmbeddings}
        onWordsChange={handleWordsChange}
        selectedAlgorithm={algorithm}
        onAlgorithmChange={handleAlgorithmChange}
        axisLabels={axisLabels}
        onAxisLabelsChange={handleAxisLabelsChange}
        textSize={textSize}
        onTextSizeChange={handleTextSizeChange}
        labelsPerAxis={labelsPerAxis}
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
