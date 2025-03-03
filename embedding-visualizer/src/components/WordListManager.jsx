import { useState, useEffect } from 'react'
import './WordListManager.css'

function WordListManager({ onWordsChange }) {
  const [words, setWords] = useState([])
  const [inputValue, setInputValue] = useState('')
  
  // Load saved words from localStorage on component mount
  useEffect(() => {
    const savedWords = localStorage.getItem('embedding-words')
    if (savedWords) {
      try {
        const parsedWords = JSON.parse(savedWords)
        setWords(parsedWords)
        onWordsChange?.(parsedWords)
      } catch (error) {
        console.error('Error parsing saved words:', error)
        setWords([])
        onWordsChange?.([])
      }
    }
  }, [onWordsChange])
  
  // Save words to localStorage whenever the list changes
  useEffect(() => {
    localStorage.setItem('embedding-words', JSON.stringify(words))
    onWordsChange?.(words)
  }, [words, onWordsChange])
  
  const handleInputChange = (e) => {
    setInputValue(e.target.value)
  }
  
  const addWord = () => {
    if (inputValue.trim() && !words.includes(inputValue.trim())) {
      setWords([...words, inputValue.trim()])
      setInputValue('')
    }
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      addWord()
    }
  }
  
  const removeWord = (wordToRemove) => {
    setWords(words.filter(word => word !== wordToRemove))
  }
  
  return (
    <div className="word-list-manager">
      <h2>Words for Embedding</h2>
      
      <div className="word-input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter a word or phrase"
          className="word-input"
        />
        <button onClick={addWord} className="add-button">Add</button>
      </div>
      
      {words.length > 0 ? (
        <div className="word-list">
          <h3>Your Words:</h3>
          <ul>
            {words.map((word, index) => (
              <li key={index} className="word-item">
                <span>{word}</span>
                <button 
                  onClick={() => removeWord(word)}
                  className="remove-button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="no-words-message">No words added yet. Add some words to visualize their embeddings.</p>
      )}
    </div>
  )
}

export default WordListManager 