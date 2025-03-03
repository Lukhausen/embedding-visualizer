import { useState, useEffect, useCallback } from 'react'
import { FaPlus, FaTimes, FaTable, FaSortAmountDown, FaSortAmountUp, FaTh } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { getEmbedding } from '../services/openaiService'
import './WordListManager.css'

function WordListManager({ onWordsChange, initialWords = [] }) {
  const [wordsWithEmbeddings, setWordsWithEmbeddings] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedEmbedding, setSelectedEmbedding] = useState(null)
  const [sortDirection, setSortDirection] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load saved words only once on initial mount
  useEffect(() => {
    try {
      const savedWords = localStorage.getItem('embedding-words')
      
      if (savedWords) {
        const parsedWords = JSON.parse(savedWords)
        if (Array.isArray(parsedWords) && parsedWords.length > 0) {
          setWordsWithEmbeddings(parsedWords)
          // Also notify parent to ensure sync
          if (onWordsChange) {
            onWordsChange(parsedWords.map(item => item.text))
          }
        } else if (initialWords && initialWords.length > 0) {
          // If no saved words but initial words provided
          const initialWordsWithEmbeddings = initialWords.map(item => {
            if (typeof item === 'string') {
              return { text: item, embedding: null }
            }
            return item
          })
          setWordsWithEmbeddings(initialWordsWithEmbeddings)
        }
      } else if (initialWords && initialWords.length > 0) {
        // If no saved words but initial words provided
        const initialWordsWithEmbeddings = initialWords.map(item => {
          if (typeof item === 'string') {
            return { text: item, embedding: null }
          }
          return item
        })
        setWordsWithEmbeddings(initialWordsWithEmbeddings)
      }
    } catch (error) {
      console.error('Error loading saved words:', error)
    } finally {
      setIsInitialized(true)
    }
  }, []) // Run only once on mount

  // Save to localStorage when words change, but only after initialization
  useEffect(() => {
    if (!isInitialized) return;
    
    try {
      localStorage.setItem('embedding-words', JSON.stringify(wordsWithEmbeddings))
    } catch (error) {
      console.error('Error saving words to localStorage:', error)
    }
    
    // Notify parent component with just the text values
    if (onWordsChange) {
      onWordsChange(wordsWithEmbeddings.map(item => item.text))
    }
  }, [wordsWithEmbeddings, onWordsChange, isInitialized])

  // Handle input change
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value)
    if (error) setError('')
  }, [error])
  
  // Add word function using useCallback to prevent unnecessary rerenders
  const addWord = useCallback(async () => {
    const wordToAdd = inputValue.trim()
    
    if (!wordToAdd) {
      setError('Please enter a word or phrase')
      return
    }
    
    if (wordsWithEmbeddings.some(item => item.text === wordToAdd)) {
      setError('This word is already in the list')
      return
    }
    
    setLoading(true)
    
    try {
      // Get the API key from localStorage
      const apiKey = localStorage.getItem('openai-api-key')
      
      if (!apiKey) {
        toast.warning('No API key found. Please add your OpenAI API key in settings.')
        setWordsWithEmbeddings(prev => [...prev, { text: wordToAdd, embedding: null }])
        setInputValue('')
        setError('')
        return
      }
      
      const embedding = await getEmbedding(wordToAdd, apiKey)
      
      // Use functional state update to avoid race conditions
      setWordsWithEmbeddings(prev => {
        // Verify the word wasn't added while waiting for API
        if (prev.some(item => item.text === wordToAdd)) {
          toast.info(`"${wordToAdd}" was already added while waiting for embedding.`)
          return prev;
        }
        return [...prev, { text: wordToAdd, embedding }]
      })
      
      toast.success(`"${wordToAdd}" added with embedding successfully!`)
    } catch (error) {
      console.error('Error getting embedding:', error)
      toast.error(`Error: ${error.message}`)
      
      // Still add the word but without embedding
      setWordsWithEmbeddings(prev => {
        // Check if word exists before adding
        if (prev.some(item => item.text === wordToAdd)) {
          return prev;
        }
        return [...prev, { text: wordToAdd, embedding: null }]
      })
    } finally {
      setLoading(false)
      setInputValue('')
      setError('')
    }
  }, [inputValue, wordsWithEmbeddings]);

  // Rest of your existing functions with useCallback
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addWord()
    }
  }, [addWord])
  
  const removeWord = useCallback((wordToRemove) => {
    setWordsWithEmbeddings(prev => prev.filter(item => item.text !== wordToRemove))
  }, [])

  const clearAllWords = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all words?')) {
      setWordsWithEmbeddings([])
    }
  }, [])
  
  const showEmbedding = (embedding, word) => {
    setSelectedEmbedding({ 
      data: embedding, 
      word,
      sortedData: null // Initialize with no sorting
    });
    setSortDirection(null);
  }
  
  const closeEmbeddingView = () => {
    setSelectedEmbedding(null);
    setSortDirection(null);
  }
  
  const handleSort = (direction) => {
    if (!selectedEmbedding?.data) return;
    
    if (sortDirection === direction) {
      // If already sorted in this direction, remove sorting
      setSelectedEmbedding({
        ...selectedEmbedding,
        sortedData: null
      });
      setSortDirection(null);
    } else {
      // Apply the requested sorting
      const sortedData = sortEmbedding(selectedEmbedding.data, direction);
      setSelectedEmbedding({
        ...selectedEmbedding,
        sortedData
      });
      setSortDirection(direction);
    }
  }
  
  // Add a sorting function for embedding values - now using absolute magnitude
  const sortEmbedding = (embedding, direction) => {
    if (!embedding || !direction) return embedding;

    // Create pairs of [value, index] to preserve original positions
    const pairs = embedding.map((value, index) => ({ value, index, magnitude: Math.abs(value) }));
    
    // Sort by magnitude (absolute value)
    pairs.sort((a, b) => {
      if (direction === 'asc') {
        return a.magnitude - b.magnitude; // Smallest absolute value first
      } else {
        return b.magnitude - a.magnitude; // Largest absolute value first
      }
    });
    
    return pairs;
  }
  
  // Function to render embedding data in a readable format
  const renderEmbeddingData = (embedding) => {
    if (!embedding) return 'No embedding data available';
    
    // Determine whether to use sorted or original data
    const dataToRender = selectedEmbedding?.sortedData || embedding.map((value, index) => ({ value, index }));
    
    if (embedding.length > 50) {
      // For large embeddings, show with pagination or limited view
      return (
        <div className="embedding-data">
          <p>Vector of {embedding.length} dimensions</p>
          <div className="embedding-table">
            {dataToRender.slice(0, 100).map((item) => (
              <div key={item.index} className="embedding-row">
                <span className="dimension">[{item.index}]:</span>
                <span className="value">{item.value.toFixed(6)}</span>
              </div>
            ))}
            {embedding.length > 100 && (
              <div className="embedding-ellipsis">
                ...and {embedding.length - 100} more values
              </div>
            )}
          </div>
        </div>
      );
    }
    
    // For smaller embeddings, show all values
    return (
      <div className="embedding-data">
        <div className="embedding-table">
          {dataToRender.map((item) => (
            <div key={item.index} className="embedding-row">
              <span className="dimension">[{item.index}]:</span>
              <span className="value">{item.value.toFixed(6)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Replace the embedding modal with this full-page version
  const renderEmbeddingModal = () => {
    if (!selectedEmbedding) return null;
    
    return (
      <div className="embedding-modal-overlay-fullscreen" onClick={closeEmbeddingView}>
        <div className="embedding-modal-fullscreen" onClick={e => e.stopPropagation()}>
          <div className="embedding-modal-header">
            <h3>Embedding for "{selectedEmbedding.word}"</h3>
            <div className="embedding-controls">
              <button 
                className={`sort-button ${sortDirection === 'desc' ? 'active' : ''}`}
                onClick={() => handleSort('desc')}
                title="Sort by highest magnitude"
              >
                <FaSortAmountDown />
                <span>Highest |x|</span>
              </button>
              <button 
                className={`sort-button ${sortDirection === 'asc' ? 'active' : ''}`}
                onClick={() => handleSort('asc')}
                title="Sort by lowest magnitude"
              >
                <FaSortAmountUp />
                <span>Lowest |x|</span>
              </button>
              <button 
                className={`sort-button ${sortDirection === null ? 'active' : ''}`}
                onClick={() => {
                  setSelectedEmbedding({
                    ...selectedEmbedding,
                    sortedData: null
                  });
                  setSortDirection(null);
                }}
                title="Original order"
              >
                <FaTh />
                <span>Original</span>
              </button>
              <button className="close-modal-button" onClick={closeEmbeddingView}>
                <FaTimes />
              </button>
            </div>
          </div>
          <div className="embedding-modal-content">
            {renderEmbeddingData(selectedEmbedding.data)}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="word-list-container">
      <div className="word-input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter a word or phrase"
          className={`word-input ${error ? 'error' : ''}`}
          aria-label="Word or phrase input"
          disabled={loading}
        />
        <button 
          onClick={addWord} 
          className="add-button" 
          title="Add Word"
          aria-label="Add word"
          disabled={loading}
        >
          <FaPlus />
        </button>
      </div>
      
      {error && <div className="input-error">{error}</div>}
      
      <div className="word-list-header">
        <div className="word-count">
          {wordsWithEmbeddings.length} {wordsWithEmbeddings.length === 1 ? 'word' : 'words'} added
        </div>
        {wordsWithEmbeddings.length > 1 && (
          <button 
            onClick={clearAllWords} 
            className="clear-all-button"
            title="Clear all words"
          >
            Clear All
          </button>
        )}
      </div>
      
      {wordsWithEmbeddings.length > 0 ? (
        <div className="word-list">
          <ul>
            {wordsWithEmbeddings.map((item, index) => (
              <li key={`word-${index}-${item.text}`} className="word-item">
                <span className="word-text">{item.text}</span>
                <div className="word-actions">
                  {item.embedding && (
                    <button 
                      onClick={() => showEmbedding(item.embedding, item.text)}
                      className="view-embedding-button"
                      title="View embedding vector"
                      aria-label={`View embedding for ${item.text}`}
                    >
                      <FaTable />
                    </button>
                  )}
                  <button 
                    onClick={() => removeWord(item.text)}
                    className="remove-button"
                    title={`Remove ${item.text}`}
                    aria-label={`Remove ${item.text}`}
                  >
                    <FaTimes />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="no-words-message">
          No words added yet. Add some words to visualize in 3D space.
        </div>
      )}
      
      {selectedEmbedding && renderEmbeddingModal()}
      
      {loading && <div className="loading-overlay">Generating embedding...</div>}
    </div>
  )
}

export default WordListManager 