import { useState, useEffect } from 'react'
import { FaPlus, FaTimes } from 'react-icons/fa'
import './WordListManager.css'

function WordListManager({ onWordsChange, initialWords = [] }) {
  const [words, setWords] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')

  // Initialize words from props or localStorage - run only once
  useEffect(() => {
    // Priority: initialWords from props, then localStorage
    if (initialWords && initialWords.length > 0) {
      setWords(initialWords)
    } else {
      try {
        const savedWords = localStorage.getItem('embedding-words')
        if (savedWords) {
          const parsedWords = JSON.parse(savedWords)
          if (Array.isArray(parsedWords)) {
            setWords(parsedWords)
          }
        }
      } catch (error) {
        console.error('Error loading saved words:', error)
      }
    }
  }, []) // Empty dependency array ensures this runs only once

  // Notify parent and update localStorage when words change
  useEffect(() => {
    try {
      localStorage.setItem('embedding-words', JSON.stringify(words))
    } catch (error) {
      console.error('Error saving words to localStorage:', error)
    }
    
    // Notify parent component
    if (onWordsChange) {
      onWordsChange(words)
    }
  }, [words, onWordsChange])

  // Update internal state if initialWords prop changes after initial render
  useEffect(() => {
    if (initialWords && initialWords.length > 0 && 
        JSON.stringify(initialWords) !== JSON.stringify(words)) {
      setWords(initialWords)
    }
  }, [initialWords])

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    if (error) setError('')
  }
  
  const addWord = () => {
    const wordToAdd = inputValue.trim()
    
    if (!wordToAdd) {
      setError('Please enter a word or phrase')
      return
    }
    
    if (words.includes(wordToAdd)) {
      setError('This word is already in the list')
      return
    }
    
    setWords(prevWords => [...prevWords, wordToAdd])
    setInputValue('')
    setError('')
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addWord()
    }
  }
  
  const removeWord = (wordToRemove) => {
    setWords(prevWords => prevWords.filter(word => word !== wordToRemove))
  }

  const clearAllWords = () => {
    if (window.confirm('Are you sure you want to clear all words?')) {
      setWords([])
    }
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
        />
        <button 
          onClick={addWord} 
          className="add-button" 
          title="Add Word"
          aria-label="Add word"
        >
          <FaPlus />
        </button>
      </div>
      
      {error && <div className="input-error">{error}</div>}
      
      <div className="word-list-header">
        <div className="word-count">
          {words.length} {words.length === 1 ? 'word' : 'words'} added
        </div>
        {words.length > 1 && (
          <button 
            onClick={clearAllWords} 
            className="clear-all-button"
            title="Clear all words"
          >
            Clear All
          </button>
        )}
      </div>
      
      {words.length > 0 ? (
        <div className="word-list">
          <ul>
            {words.map((word, index) => (
              <li key={`word-${index}-${word}`} className="word-item">
                <span className="word-text">{word}</span>
                <button 
                  onClick={() => removeWord(word)}
                  className="remove-button"
                  title={`Remove ${word}`}
                  aria-label={`Remove ${word}`}
                >
                  <FaTimes />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="no-words-message">
          No words added yet. Add some words to visualize in 3D space.
        </div>
      )}
    </div>
  )
}

export default WordListManager 