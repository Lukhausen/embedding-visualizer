import { useState, useEffect, useCallback } from 'react'
import { FaPlus, FaTimes, FaTable } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { getEmbedding } from '../services/openaiService'
import EmbeddingViewer from './EmbeddingViewer'
import './WordListManager.css'

function WordListManager({ onWordsChange, initialWords = [] }) {
  const [wordsWithEmbeddings, setWordsWithEmbeddings] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedEmbedding, setSelectedEmbedding] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load saved words only once on initial mount
  useEffect(() => {
    try {
      const savedWords = localStorage.getItem('embedding-words')
      
      if (savedWords) {
        const parsedWords = JSON.parse(savedWords)
        if (Array.isArray(parsedWords) && parsedWords.length > 0) {
          setWordsWithEmbeddings(parsedWords)
          // Move this notification to its own effect so it happens after render
          // Don't call onWordsChange here
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

  // Add a new effect to handle notifying the parent after initialization
  useEffect(() => {
    if (isInitialized && onWordsChange) {
      onWordsChange(wordsWithEmbeddings.map(item => item.text))
    }
  }, [isInitialized, onWordsChange, wordsWithEmbeddings])

  // Save to localStorage when words change, but only after initialization
  useEffect(() => {
    if (!isInitialized) return;
    
    try {
      localStorage.setItem('embedding-words', JSON.stringify(wordsWithEmbeddings))
    } catch (error) {
      console.error('Error saving words to localStorage:', error)
    }
  }, [wordsWithEmbeddings, isInitialized]);

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
        const newWordsList = [...wordsWithEmbeddings, { text: wordToAdd, embedding: null }];
        setWordsWithEmbeddings(newWordsList)
        // Notify parent with updated words list
        onWordsChange?.(newWordsList.map(item => item.text))
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
        const newList = [...prev, { text: wordToAdd, embedding }];
        // Notify parent with updated words list
        onWordsChange?.(newList.map(item => item.text))
        return newList;
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
        const newList = [...prev, { text: wordToAdd, embedding: null }];
        // Notify parent with updated words list
        onWordsChange?.(newList.map(item => item.text))
        return newList;
      })
    } finally {
      setLoading(false)
      setInputValue('')
      setError('')
    }
  }, [inputValue, wordsWithEmbeddings, onWordsChange]);

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
  
  // Show the embedding viewer modal
  const showEmbedding = (embedding, word) => {
    setSelectedEmbedding({ 
      data: embedding,
      word
    });
  }
  
  // Close the embedding viewer modal
  const closeEmbeddingView = () => {
    setSelectedEmbedding(null);
  }
  
  // Handle embedding viewer callbacks
  const handleEmbeddingViewerClose = () => {
    closeEmbeddingView();
  }
  
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
      
      {selectedEmbedding && (
        <EmbeddingViewer 
          embedding={selectedEmbedding.data} 
          word={selectedEmbedding.word} 
          onClose={handleEmbeddingViewerClose} 
        />
      )}
      
      {loading && <div className="loading-overlay">Generating embedding...</div>}
    </div>
  )
}

export default WordListManager 