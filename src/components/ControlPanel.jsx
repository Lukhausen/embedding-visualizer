import { useState, useEffect, useCallback, useMemo } from 'react'
import { FaChevronLeft, FaChevronRight, FaList, FaKey, FaCube } from 'react-icons/fa'
import ApiKeyManager from './ApiKeyManager'
import WordListManager from './WordListManager'
import DimensionReductionSelector from './DimensionReductionSelector'
import './ControlPanel.css'

function ControlPanel({ words, onWordsChange, selectedAlgorithm, onAlgorithmChange }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('words') // 'words', 'settings', or 'dimensions'
  
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
    onWordsChange(newWords); // Directly call onWordsChange to update App's state
  }, [onWordsChange]);
  
  const handleAlgorithmChange = useCallback((algorithmId) => {
    if (onAlgorithmChange) {
      onAlgorithmChange(algorithmId);
    }
  }, [onAlgorithmChange]);
  
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
          className={`tab-button ${activeTab === 'dimensions' ? 'active' : ''}`}
          onClick={() => changeTab('dimensions')}
          aria-label="Dimension Reduction"
          title="Dimension Reduction"
        >
          <FaCube size={20} />
          <span className="tab-label">Dimensions</span>
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
            ) : activeTab === 'dimensions' ? (
              <>
                <FaCube /> Dimension Reduction
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
        
        {activeTab === 'dimensions' && (
          <div className="tab-content">
            <div className="dimension-description">
              <p>Select an algorithm to reduce the high-dimensional embedding vectors to 3D coordinates for visualization.</p>
            </div>
            <DimensionReductionSelector
              selectedAlgorithm={selectedAlgorithm}
              onChange={handleAlgorithmChange}
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