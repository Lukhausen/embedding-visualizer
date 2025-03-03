import { useState, useEffect, useCallback, useMemo } from 'react'
import { FaChevronLeft, FaChevronRight, FaList, FaKey } from 'react-icons/fa'
import ApiKeyManager from './ApiKeyManager'
import WordListManager from './WordListManager'
import './ControlPanel.css'

function ControlPanel({ words, onWordsChange }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('words') // 'words' or 'settings'
  
  // Check if panel state was saved previously - run only once
  useEffect(() => {
    const savedCollapsedState = localStorage.getItem('control-panel-collapsed')
    if (savedCollapsedState !== null) {
      setIsCollapsed(savedCollapsedState === 'true')
    }
    
    const savedActiveTab = localStorage.getItem('control-panel-active-tab')
    if (savedActiveTab) {
      setActiveTab(savedActiveTab)
    }
  }, [])
  
  // Save panel state when it changes
  useEffect(() => {
    localStorage.setItem('control-panel-collapsed', isCollapsed.toString())
  }, [isCollapsed])
  
  useEffect(() => {
    localStorage.setItem('control-panel-active-tab', activeTab)
  }, [activeTab])
  
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])
  
  const changeTab = useCallback((tab) => {
    if (activeTab === tab && !isCollapsed) {
      // If clicking the active tab and panel is open, collapse it
      setIsCollapsed(true)
    } else {
      // Otherwise open the panel and switch to that tab
      setActiveTab(tab)
      setIsCollapsed(false)
    }
  }, [activeTab, isCollapsed])
  
  const handleWordsChange = useCallback((newWords) => {
    // Only update state and notify parent if the array has actually changed
    // The JSON.stringify comparison is causing issues because it runs on every render
    onWordsChange(newWords); // Directly call onWordsChange to update App's state
  }, [onWordsChange]);
  
  return (
    <div className={`control-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="control-panel-tabs">
        <button 
          className={`tab-button ${activeTab === 'words' ? 'active' : ''}`}
          onClick={() => changeTab('words')}
          aria-label="Word List"
          title="Word List"
        >
          <FaList size={20} />
          <span className="tab-label">Words ({words.length})</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => changeTab('settings')}
          aria-label="API Settings"
          title="API Settings"
        >
          <FaKey size={20} />
          <span className="tab-label">API Key</span>
        </button>
      </div>
      
      <div className="control-panel-content">
        <div className="panel-header">
          <h3 className="panel-title">
            {activeTab === 'words' ? (
              <>
                <FaList /> Words for Embedding
              </>
            ) : (
              <>
                <FaKey /> API Settings
              </>
            )}
          </h3>
          <button 
            className="panel-close"
            onClick={toggleCollapse}
            aria-label="Close Panel"
            title="Close Panel"
          >
            <FaChevronLeft />
          </button>
        </div>

        {activeTab === 'words' && (
          <div className="tab-content">
            <WordListManager
              onWordsChange={handleWordsChange}
              initialWords={words}
            />
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="tab-content">
            <ApiKeyManager />
          </div>
        )}
      </div>
      
      {isCollapsed && (
        <div 
          className="collapsed-hint" 
          onClick={toggleCollapse}
          title="Expand Panel"
        >
          <FaChevronRight />
        </div>
      )}
    </div>
  )
}

export default ControlPanel 