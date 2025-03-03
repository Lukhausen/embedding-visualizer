import { useState, useEffect, useCallback, useMemo } from 'react'
import { FaChevronLeft, FaChevronRight, FaList, FaKey, FaCube, FaTags, FaCog } from 'react-icons/fa'
import ApiKeyManager from './ApiKeyManager'
import WordListManager from './WordListManager'
import DimensionReductionSelector from './DimensionReductionSelector'
import AxisLabelManager from './AxisLabelManager'
import SettingsManager from './SettingsManager'
import './ControlPanel.css'

function ControlPanel({ 
  words, 
  onWordsChange, 
  selectedAlgorithm, 
  onAlgorithmChange, 
  axisLabels, 
  onAxisLabelsChange,
  textSize,
  onTextSizeChange
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('words') // 'words', 'settings', 'dimensions', 'axisLabels', or 'appSettings'
  
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
  
  const handleAxisLabelsChange = useCallback((newLabels, labelsPerAxis) => {
    if (onAxisLabelsChange) {
      onAxisLabelsChange(newLabels, labelsPerAxis);
    }
  }, [onAxisLabelsChange]);
  
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
          className={`tab-button ${activeTab === 'axisLabels' ? 'active' : ''}`}
          onClick={() => changeTab('axisLabels')}
          aria-label="Axis Labels"
          title="Customize Axis Labels"
        >
          <FaTags size={20} />
          <span className="tab-label">Axis Labels</span>
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
        <button 
          className={`tab-button ${activeTab === 'appSettings' ? 'active' : ''}`}
          onClick={() => changeTab('appSettings')}
          aria-label="App Settings"
          title="App Settings"
        >
          <FaCog size={20} />
          <span className="tab-label">App Settings</span>
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
            ) : activeTab === 'axisLabels' ? (
              <>
                <FaTags /> Axis Labels
              </>
            ) : activeTab === 'settings' ? (
              <>
                <FaKey /> API Settings
              </>
            ) : (
              <>
                <FaCog /> App Settings
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
        
        {activeTab === 'axisLabels' && (
          <div className="tab-content">
            <AxisLabelManager
              axisLabels={axisLabels}
              onAxisLabelsChange={handleAxisLabelsChange}
              algorithmId={selectedAlgorithm}
              words={words}
            />
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="tab-content">
            <ApiKeyManager />
          </div>
        )}
        
        {activeTab === 'appSettings' && (
          <div className="tab-content">
            <SettingsManager
              textSize={textSize}
              onTextSizeChange={onTextSizeChange}
            />
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