import { useState, useEffect, useCallback, useRef } from 'react'
import { FaPlus, FaTimes, FaTable } from 'react-icons/fa'
import { toast } from 'react-toastify'
import { getEmbedding } from '../services/openaiService'
import EmbeddingViewer from './EmbeddingViewer'
import './WordListManager.css'
import { autoUpdateAxisLabels } from '../services/embeddingAnalysisService'

/**
 * Custom hook to manage the words list and its operations
 * 
 * @param {Object} options - Hook options
 * @param {Array} options.initialWords - Initial words to populate the list with
 * @param {Function} options.onWordsChange - Callback when words change
 * @param {string} options.algorithmId - Current algorithm ID for embedding analysis
 * @returns {Object} Word management methods and state
 */
function useWordManagement({ initialWords = [], onWordsChange, algorithmId }) {
  // State for words list (array of objects with text and embedding)
  const [words, setWords] = useState([])
  
  // State for tracking loading states and initialization
  const [isAddingWord, setIsAddingWord] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Refs for preventing concurrent operations
  const operationInProgressRef = useRef(false)
  const autoUpdateScheduledRef = useRef(false)
  
  // Initialize words from localStorage or props
  useEffect(() => {
    // Skip if already initialized to prevent potential loops
    if (isInitialized) return;
    
    try {
      // First try to load from localStorage
      const savedWords = localStorage.getItem('embedding-words')
      
      if (savedWords) {
        // Parse and validate saved words
        const parsedWords = JSON.parse(savedWords)
        if (Array.isArray(parsedWords)) {
          setWords(parsedWords)
        } else {
          console.error('Invalid saved words format:', parsedWords)
          setWords(initialWords.map(text => ({ text, embedding: null })))
        }
      } else {
        // If no saved words, use initialWords prop
        setWords(initialWords.map(text => ({ text, embedding: null })))
      }
      
      // Mark initialization as complete
      setIsInitialized(true)
    } catch (error) {
      console.error('Error initializing words:', error)
      // Fallback to initialWords on error
      setWords(initialWords.map(text => ({ text, embedding: null })))
      setIsInitialized(true)
    }
  }, [initialWords, isInitialized]) // Add isInitialized to dependency array
  
  // Save to localStorage when words change, but only after initialization
  useEffect(() => {
    if (!isInitialized) return
    
    try {
      localStorage.setItem('embedding-words', JSON.stringify(words))
    } catch (error) {
      console.error('Error saving words to localStorage:', error)
    }
  }, [words, isInitialized])

  // Notify parent component when words change (after initialization)
  // Use a ref to prevent this from causing infinite loops
  const prevWordsRef = useRef([]);
  useEffect(() => {
    if (!isInitialized || !onWordsChange) return
    
    // Skip update if words haven't actually changed
    const prevWordsJSON = JSON.stringify(prevWordsRef.current.map(w => w.text));
    const currentWordsJSON = JSON.stringify(words.map(w => w.text));
    
    if (prevWordsJSON === currentWordsJSON) return;
    
    // Update the ref to the current words
    prevWordsRef.current = words;
    
    onWordsChange(
      words.map(item => item.text),
      words
    )
    
    // Trigger axis label updates if we have enough words with embeddings
    const validEmbeddings = words.filter(word => word && word.embedding !== null)
    if (validEmbeddings.length >= 3) {
      localStorage.setItem('embeddings-updated', 'true')
    }
  }, [words, isInitialized, onWordsChange])

  // Function to trigger auto-update of axis labels
  const triggerAutoUpdate = useCallback((delay = 500) => {
    if (autoUpdateScheduledRef.current) return;
    
    autoUpdateScheduledRef.current = true;
    
    setTimeout(() => {
      if (algorithmId) {
        // Set the flag to force an update
        localStorage.setItem('force-axis-label-update', 'true');
        
        autoUpdateAxisLabels(algorithmId, 1)
          .then(result => {
            if (result) {
              console.log('Auto-updated axis labels successfully');
              // Use the new event-driven approach
              import('../services/axisLabelService').then(module => {
                module.triggerAxisLabelsUpdate();
              });
            }
          })
          .catch(err => {
            console.error('Error auto-updating axis labels:', err);
          })
          .finally(() => {
            autoUpdateScheduledRef.current = false;
          });
      } else {
        autoUpdateScheduledRef.current = false;
      }
    }, delay);
  }, [algorithmId]);

  // Check if word exists in the list
  const wordExists = useCallback((wordText) => {
    return words.some(item => item.text === wordText)
  }, [words])

  // Add a word to the list with or without embedding
  const addWord = useCallback(async (wordText) => {
    // Input validation
    if (!wordText || typeof wordText !== 'string') {
      console.error('Invalid word text:', wordText)
      return { success: false, error: 'Invalid word text' }
    }
    
    const wordToAdd = wordText.trim()
    
    if (!wordToAdd) {
      return { success: false, error: 'Please enter a word or phrase' }
    }
    
    // Check for duplicates
    if (wordExists(wordToAdd)) {
      return { success: false, error: 'This word is already in the list' }
    }
    
    // Prevent concurrent operations
    if (operationInProgressRef.current) {
      return { success: false, error: 'Another operation is in progress' }
    }
    
    operationInProgressRef.current = true
    setIsAddingWord(true)
    
    try {
      // Get the API key from localStorage
      const apiKey = localStorage.getItem('openai-api-key')
      let embedding = null
      
      // Try to get embedding if API key exists
      if (apiKey) {
        try {
          embedding = await getEmbedding(wordToAdd, apiKey)
        } catch (error) {
          console.error('Error getting embedding:', error)
          toast.error(`Embedding error: ${error.message}`)
          // Continue with null embedding
        }
      } else {
        toast.warning('No API key found. Please add your OpenAI API key in settings.')
      }
      
      // Add the word to the list (with or without embedding)
      setWords(prev => {
        // One more check for duplicates (in case multiple adds happen simultaneously)
        if (prev.some(item => item.text === wordToAdd)) {
          return prev
        }
        
        // Create new word object and add to list
        const newWord = { text: wordToAdd, embedding }
        const newList = [...prev, newWord]
        
        // Trigger auto-update of axis labels
        if (embedding !== null) {
          triggerAutoUpdate(500)
        }
        
        return newList
      })
      
      // Show appropriate toast message
      if (embedding !== null) {
        toast.success(`"${wordToAdd}" added with embedding successfully!`)
      } else {
        toast.info(`"${wordToAdd}" added without embedding.`)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error in addWord:', error)
      toast.error(`Error: ${error.message}`)
      return { success: false, error: error.message }
    } finally {
      setIsAddingWord(false)
      operationInProgressRef.current = false
    }
  }, [wordExists, triggerAutoUpdate])

  // Remove a word from the list
  const removeWord = useCallback((wordText) => {
    // Input validation
    if (!wordText || typeof wordText !== 'string') {
      console.error('Invalid word text for removal:', wordText)
      return { success: false, error: 'Invalid word text' }
    }
    
    // Prevent concurrent operations
    if (operationInProgressRef.current) {
      return { success: false, error: 'Another operation is in progress' }
    }
    
    operationInProgressRef.current = true
    
    try {
      // Remove the word from the list
      setWords(prev => {
        // Check if the word exists
        if (!prev.some(item => item.text === wordText)) {
          return prev
        }
        
        // Filter out the word
        const filteredList = prev.filter(item => item.text !== wordText)
        
        // Trigger auto-update of axis labels
        triggerAutoUpdate(500)
        
        // Flag that embeddings have changed
        localStorage.setItem('embeddings-updated', 'true')
        
        return filteredList
      })
      
      // Show toast notification
      toast.info(`Removed "${wordText}"`)
      
      return { success: true }
    } catch (error) {
      console.error('Error in removeWord:', error)
      return { success: false, error: error.message }
    } finally {
      operationInProgressRef.current = false
    }
  }, [triggerAutoUpdate])

  // Clear all words from the list
  const clearAllWords = useCallback(() => {
    // Prevent concurrent operations
    if (operationInProgressRef.current) {
      return { success: false, error: 'Another operation is in progress' }
    }
    
    operationInProgressRef.current = true
    
    try {
      // Clear the words list
      setWords([])
      
      // Flag that embeddings have changed
      localStorage.setItem('embeddings-updated', 'true')
      
      // Show toast notification
      toast.info('All words cleared')
      
      return { success: true }
    } catch (error) {
      console.error('Error in clearAllWords:', error)
      return { success: false, error: error.message }
    } finally {
      operationInProgressRef.current = false
    }
  }, [])

  // Return the hook API
  return {
    words,
    isAddingWord,
    isInitialized,
    addWord,
    removeWord,
    clearAllWords,
    wordExists
  }
}

/**
 * WordListManager Component
 * Manages a list of words with embeddings
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onWordsChange - Callback when words change
 * @param {Array} props.initialWords - Initial words to populate
 * @param {string} props.algorithmId - Current algorithm ID
 * @param {Array} props.wordsWithEmbeddings - External words with embeddings
 * @returns {JSX.Element} The component
 */
function WordListManager({ 
  onWordsChange, 
  initialWords = [], 
  algorithmId = 'pca',
  wordsWithEmbeddings: externalWordsWithEmbeddings 
}) {
  // State for input field and error messages
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState(null)
  const [selectedEmbedding, setSelectedEmbedding] = useState(null)
  
  // Get word management functions from custom hook
  const {
    words,
    isAddingWord,
    isInitialized,
    addWord,
    removeWord,
    clearAllWords,
    wordExists
  } = useWordManagement({
    initialWords,
    onWordsChange,
    algorithmId
  })
  
  // Handle input field changes
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value)
    setError(null)
  }, [])
  
  // Handle add word button click
  const handleAddWord = useCallback(async () => {
    if (!inputValue.trim()) {
      setError('Please enter a word or phrase')
      return
    }
    
    if (isAddingWord) {
      return
    }
    
    const result = await addWord(inputValue.trim())
    
    if (result.success) {
      setInputValue('')
      setError(null)
    } else {
      setError(result.error)
    }
  }, [inputValue, isAddingWord, addWord])
  
  // Handle enter key press in input field
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleAddWord()
    }
  }, [handleAddWord])
  
  // Handle remove word button click
  const handleRemoveWord = useCallback((wordText) => {
    removeWord(wordText)
  }, [removeWord])

  // Handle clear all button click
  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all words?')) {
      clearAllWords()
    }
  }, [clearAllWords])

  // Show embedding for a word
  const showEmbedding = useCallback((embedding, word) => {
    setSelectedEmbedding({ embedding, word })
  }, [])

  // Close embedding viewer
  const closeEmbeddingView = useCallback(() => {
    setSelectedEmbedding(null)
  }, [])

  // Return early if not initialized
  if (!isInitialized) {
    return <div className="word-list-container">Loading...</div>
  }

  return (
    <div className="word-list-container">
      <div className="word-input-container">
        <input
          type="text"
          className={`word-input ${error ? 'error' : ''}`}
          placeholder="Add a word or phrase..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isAddingWord}
        />
        <button 
          className="add-button" 
          onClick={handleAddWord}
          disabled={isAddingWord || !inputValue.trim()}
        >
          {isAddingWord ? '...' : <FaPlus />}
        </button>
      </div>
      
      {error && <div className="input-error">{error}</div>}
      
      <div className="word-list-header">
        <div className="word-count">Words: {words.length}</div>
        <button 
          className="clear-all-button" 
          onClick={handleClearAll}
          disabled={words.length === 0}
        >
          Clear All
        </button>
      </div>
      
      <div className="word-list">
        {words.length === 0 ? (
          <div className="no-words-message">
            No words added yet. Add some words to visualize their embeddings.
          </div>
        ) : (
          <ul>
            {words.map((item, index) => (
              <li key={index} className="word-item">
                <span className="word-text">{item.text}</span>
                <div className="word-actions">
                  <button 
                    className="remove-button"
                    onClick={() => handleRemoveWord(item.text)}
                    title="Remove word"
                  >
                    <FaTimes />
                  </button>
                  {item.embedding && (
                    <button 
                      className="view-embedding-button"
                      onClick={() => showEmbedding(item.embedding, item.text)}
                      title="View embedding vector"
                    >
                      <FaTable />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {selectedEmbedding && (
        <EmbeddingViewer
          embedding={selectedEmbedding.embedding}
          word={selectedEmbedding.word}
          onClose={closeEmbeddingView}
        />
      )}
    </div>
  )
}

export default WordListManager 