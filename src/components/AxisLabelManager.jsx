import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'react-toastify';
import { FaTable, FaSortAmountDown, FaSortAmountUp, FaSync } from 'react-icons/fa';
import { saveAxisLabels, loadLabelsPerAxis } from '../services/axisLabelService';
import { generateAxisLabelIdeas, loadAxisLabelIdeas, saveAxisLabelIdeas } from '../services/axisLabelIdeasService';
import { 
  analyzeEmbeddingsForAxisLabels, 
  loadAxisLabelEmbeddings, 
  saveAxisLabelEmbeddings,
  refreshLabelsFromCache
} from '../services/embeddingAnalysisService';
import { generateAxisLabelsWorkflow } from '../services/axisLabelGenerationWorkflow';
import { getEmbedding } from '../services/openaiService';
import EmbeddingViewer from './EmbeddingViewer';
import './AxisLabelManager.css';
import { sortSuggestionsByAxisDimension } from '../services/sortingService';
import logger from '../utils/logger';

const MODULE = 'AxisLabelManager';

/**
 * Component for managing the labels of the X, Y, and Z axes
 * 
 * @param {Object} props - Component props
 * @param {Object} props.axisLabels - Current axis labels object {x, y, z}
 * @param {Function} props.onAxisLabelsChange - Callback when axis labels change
 * @param {String} props.algorithmId - The current dimension reduction algorithm ID
 * @param {Array} props.words - The current words being visualized
 * @param {Array} props.wordsWithEmbeddings - Words with their embeddings
 * @returns {JSX.Element} The component
 */
const AxisLabelManager = forwardRef(({ 
  axisLabels = { x: "X", y: "Y", z: "Z" }, 
  onAxisLabelsChange, 
  algorithmId, 
  words = [],
  wordsWithEmbeddings = []
}, ref) => {
  // Axis labels state
  const [labels, setLabels] = useState(axisLabels);
  // Always use 2 labels per axis
  const labelsPerAxis = 2;
  
  // AI generation controls
  const [iterationCount, setIterationCount] = useState(1);
  const [outputsPerPrompt, setOutputsPerPrompt] = useState(30);
  
  // Suggestions state with ref for stable access
  const [suggestions, setSuggestions] = useState([]);
  const [displayedSuggestions, setDisplayedSuggestions] = useState([]);
  const suggestionsRef = useRef([]);
  
  // Embeddings state
  const [suggestionEmbeddings, setSuggestionEmbeddings] = useState(new Map());
  const [selectedEmbedding, setSelectedEmbedding] = useState(null);
  const [dimensionIndices, setDimensionIndices] = useState(null);
  
  // Sorting state
  const [sortingBy, setSortingBy] = useState(null); // null, 'x', 'y', 'z'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc', 'desc'
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(0); // 0: idle, 1: getting ideas, 2: rating ideas
  const [progress, setProgress] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [completedItems, setCompletedItems] = useState(0);

  // Load saved suggestions and embeddings on mount
  useEffect(() => {
    logger.debug(MODULE, 'Component mounted or axisLabels prop updated', { axisLabels });
    // Load suggestions
    const savedSuggestions = loadAxisLabelIdeas();
    if (savedSuggestions && savedSuggestions.length > 0) {
      setSuggestions(savedSuggestions);
      setDisplayedSuggestions(savedSuggestions);
      suggestionsRef.current = savedSuggestions;
    }
    
    // Load embeddings
    const savedEmbeddings = loadAxisLabelEmbeddings();
    if (savedEmbeddings && savedEmbeddings.length > 0) {
      // Convert array to Map for quick lookup
      const embeddingsMap = new Map();
      savedEmbeddings.forEach(item => {
        if (item.text && item.embedding) {
          embeddingsMap.set(item.text, item.embedding);
        }
      });
      setSuggestionEmbeddings(embeddingsMap);
    }
    
    // Try to load dimension indices from localStorage
    try {
      const storedDimensionInfo = localStorage.getItem('current-dimension-info');
      if (storedDimensionInfo) {
        const parsedInfo = JSON.parse(storedDimensionInfo);
        if (parsedInfo.xDimension !== undefined && 
            parsedInfo.yDimension !== undefined && 
            parsedInfo.zDimension !== undefined) {
          setDimensionIndices({
            x: parsedInfo.xDimension,
            y: parsedInfo.yDimension,
            z: parsedInfo.zDimension
          });
        }
      }
    } catch (error) {
      console.error('Error loading dimension indices:', error);
    }
  }, []);

  // Keep suggestions ref in sync with state
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);
  
  // Update displayed suggestions when sorting changes
  useEffect(() => {
    sortSuggestions();
  }, [sortingBy, sortDirection, suggestions, suggestionEmbeddings]);

  // Save embeddings to localStorage when they change
  useEffect(() => {
    if (suggestionEmbeddings.size > 0) {
      // Convert Map to array for storage
      const embeddingsArray = Array.from(suggestionEmbeddings.entries()).map(
        ([text, embedding]) => ({ text, embedding })
      );
      saveAxisLabelEmbeddings(embeddingsArray);
    }
  }, [suggestionEmbeddings]);

  // Initialize with provided axis labels
  useEffect(() => {
    logger.debug(MODULE, 'Component mounted or axisLabels prop updated', { axisLabels });
    if (axisLabels) {
      setLabels(axisLabels);
    }
  }, [axisLabels]);

  // Handle changes to axis labels
  const handleLabelChange = useCallback((axis, value) => {
    logger.info(MODULE, `Manual label change for axis ${axis}: ${value}`);
    const newLabels = { ...labels, [axis]: value };
    setLabels(newLabels);
    saveAxisLabels(newLabels, labelsPerAxis);
    
    if (onAxisLabelsChange) {
      logger.debug(MODULE, 'Calling onAxisLabelsChange callback', newLabels);
      onAxisLabelsChange(newLabels, labelsPerAxis);
    }
  }, [labels, onAxisLabelsChange, labelsPerAxis]);

  // Save labels and labelsPerAxis to localStorage when they change
  useEffect(() => {
    logger.debug(MODULE, 'Labels state changed, saving to localStorage', { labels, labelsPerAxis });
    saveAxisLabels(labels, labelsPerAxis);
  }, [labelsPerAxis, labels]);

  // Check for embedding updates
  useEffect(() => {
    const checkForEmbeddingUpdates = () => {
      const embeddingsUpdated = localStorage.getItem('embeddings-updated');
      logger.debug(MODULE, 'Checking for embedding updates', { embeddingsUpdated });
      
      if (embeddingsUpdated === 'true' && suggestionsRef.current.length > 0 && !isProcessing) {
        // Clear the flag
        localStorage.removeItem('embeddings-updated');
        
        // If we have suggestions and algorithm ID, find best labels automatically
        if (algorithmId) {
          toast.info('Embeddings updated. Recalculating best axis labels...');
          setTimeout(() => {
            findBestLabels();
          }, 500);
        }
      }
    };
    
    // Check on mount and when processing state changes
    checkForEmbeddingUpdates();
    
    // Set up an interval to periodically check for updates
    const intervalId = setInterval(checkForEmbeddingUpdates, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isProcessing, algorithmId]);

  /**
   * Find the best axis labels based on current embeddings
   */
  const findBestLabels = useCallback(async () => {
    if (isProcessing || !algorithmId) {
      logger.warn(MODULE, 'findBestLabels called while processing or without algorithmId', { isProcessing, algorithmId });
      return false;
    }
    
    setIsProcessing(true);
    setProcessingStage(2);
    setProgress(0);
    
    // Get current suggestions
    const currentSuggestions = suggestionsRef.current;
    if (!currentSuggestions || currentSuggestions.length < 3) {
      toast.warning('Not enough suggestions. Generate suggestions first.');
      setIsProcessing(false);
      return false;
    }
    
    const toastId = toast.info(`Stage 2/2: Getting embeddings for ${currentSuggestions.length} suggestions...`, {
      autoClose: false,
      closeButton: false
    });
    
    try {
      // Make sure we have a valid algorithm ID
      if (!algorithmId) {
        toast.error('No dimension reduction algorithm specified');
        return false;
      }
      
      // Use the service to analyze embeddings
      const result = await analyzeEmbeddingsForAxisLabels({
        suggestions: currentSuggestions,
        algorithmId,
        labelsPerAxis,
        onProgress: (data) => {
          setCompletedItems(data.completed || 0);
          setProgress(data.progress || 0);
        }
      });
      
      if (!result) {
        toast.update(toastId, {
          render: 'Failed to analyze embeddings for axis labels',
          type: 'error',
          autoClose: 5000,
          closeButton: true
        });
        return false;
      }
      
      // Update toast to success
      toast.update(toastId, {
        render: 'Found optimal axis labels!',
        type: 'success',
        autoClose: 3000,
        closeButton: true
      });
      
      // Update axis labels
      if (onAxisLabelsChange) {
        logger.info(MODULE, 'Updating axis labels via onAxisLabelsChange', result.bestLabels);
        onAxisLabelsChange(result.bestLabels, labelsPerAxis);
      }
      
      // Force a DOM update by explicitly triggering the event
      import('../services/axisLabelService').then(module => {
        logger.debug(MODULE, 'Triggering axis labels update event');
        module.triggerAxisLabelsUpdate();
      });
      
      return true;
    } catch (error) {
      logger.error(MODULE, 'Error finding best labels:', error);
      
      // Update toast to error
      toast.update(toastId, {
        render: `Error: ${error.message}`,
        type: 'error',
        autoClose: 5000,
        closeButton: true
      });
      
      return false;
    } finally {
      setProcessingStage(0);
      setProgress(0);
      setIsProcessing(false);
    }
  }, [algorithmId, isProcessing, labelsPerAxis, onAxisLabelsChange]);

  // Simplify the dimension indices update
  useEffect(() => {
    if (!algorithmId) return;
    
    // Update dimension indices only when algorithm changes
    try {
      const storedDimensionInfo = localStorage.getItem('current-dimension-info');
      if (storedDimensionInfo) {
        const parsedInfo = JSON.parse(storedDimensionInfo);
        if (parsedInfo.algorithm === algorithmId && 
            parsedInfo.xDimension !== undefined && 
            parsedInfo.yDimension !== undefined && 
            parsedInfo.zDimension !== undefined) {
          setDimensionIndices({
            x: parsedInfo.xDimension,
            y: parsedInfo.yDimension,
            z: parsedInfo.zDimension
          });
        }
      }
    } catch (error) {
      console.error('Error updating dimension indices:', error);
    }
  }, [algorithmId]);

  /**
   * Sort suggestions based on current sortingBy and sortDirection
   */
  const sortSuggestions = useCallback(() => {
    if (!sortingBy || !suggestionEmbeddings.size) {
      setDisplayedSuggestions(suggestions);
      return;
    }

    // Use the externalized sorting function
    const sorted = sortSuggestionsByAxisDimension(
      suggestions,
      suggestionEmbeddings,
      sortingBy,
      sortDirection
    );
    
    setDisplayedSuggestions(sorted);
  }, [sortingBy, sortDirection, suggestions, suggestionEmbeddings]);
  
  /**
   * Handle clicking on a sort button
   */
  const handleSort = useCallback((axis) => {
    if (sortingBy === axis) {
      // Toggle direction if already sorting by this axis
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      // Set new axis and reset to descending
      setSortingBy(axis);
      setSortDirection('desc');
    }
  }, [sortingBy]);

  /**
   * Get embedding for a specific suggestion and show it in the viewer
   */
  const getAndShowEmbedding = useCallback(async (suggestion) => {
    try {
      // Check if we already have this embedding
      if (suggestionEmbeddings.has(suggestion)) {
        setSelectedEmbedding({
          word: suggestion,
          embedding: suggestionEmbeddings.get(suggestion)
        });
        return;
      }
      
      // Get API key
        const apiKey = localStorage.getItem('openai-api-key');
        if (!apiKey) {
          toast.error('Please add your OpenAI API key in settings first');
          return;
        }
        
      // Show loading toast
      toast.info(`Getting embedding for "${suggestion}"...`);
      
      // Get the embedding
      const embedding = await getEmbedding(suggestion, apiKey);
      
      // Store the embedding in component state
      setSuggestionEmbeddings(prev => {
        const newMap = new Map(prev);
        newMap.set(suggestion, embedding);
        return newMap;
      });
      
      // Show the embedding
      setSelectedEmbedding({
        word: suggestion,
        embedding
      });
      
      // The embedding will be saved to localStorage via the useEffect
      } catch (error) {
      console.error(`Error getting embedding for "${suggestion}":`, error);
        toast.error(`Error: ${error.message}`);
    }
  }, [suggestionEmbeddings]);
  
  /**
   * Close the embedding viewer
   */
  const closeEmbeddingViewer = useCallback(() => {
    setSelectedEmbedding(null);
  }, []);
  
  /**
   * Handle completion of the axis label generation workflow
   */
  const handleWorkflowComplete = useCallback((results) => {
    logger.info(MODULE, 'Axis label generation workflow completed', results);
    // Update axis labels in parent component
    if (onAxisLabelsChange && results && results.bestLabels) {
      logger.debug(MODULE, 'Updating axis labels via onAxisLabelsChange in workflow complete', results.bestLabels);
      onAxisLabelsChange(results.bestLabels, labelsPerAxis);
      
      // Explicitly force a DOM update
      import('../services/axisLabelService').then(module => {
        logger.debug(MODULE, 'Triggering axis labels update event in workflow complete');
        module.triggerAxisLabelsUpdate();
      });
      
      // Show success toast
      toast.success('Generated and applied optimal axis labels!');
    }
    
    // Load suggestions to update the UI
    const savedSuggestions = loadAxisLabelIdeas();
    logger.debug(MODULE, 'Loaded saved suggestions after workflow complete', { count: savedSuggestions?.length });
    if (savedSuggestions && savedSuggestions.length > 0) {
      setSuggestions(savedSuggestions);
      setDisplayedSuggestions(savedSuggestions);
      suggestionsRef.current = savedSuggestions;
    }
    
    // Load embeddings to update the UI
    const savedEmbeddings = loadAxisLabelEmbeddings();
    logger.debug(MODULE, 'Loaded saved embeddings after workflow complete', { count: savedEmbeddings?.length });
    if (savedEmbeddings && savedEmbeddings.length > 0) {
      const embeddingsMap = new Map();
      savedEmbeddings.forEach(item => {
        if (item.text && item.embedding) {
          embeddingsMap.set(item.text, item.embedding);
        }
      });
      setSuggestionEmbeddings(embeddingsMap);
    }
  }, [onAxisLabelsChange, labelsPerAxis]);
  
  /**
   * Process axis labels using the two-stage workflow with better error handling
   */
  const processAxisLabels = useCallback(async () => {
    if (isProcessing) {
      toast.info('Please wait, another operation is in progress');
      return;
    }
    
    if (!algorithmId) {
      toast.warning('Algorithm ID is required. Please select a dimension reduction algorithm.');
      return;
    }
    
    if (words.length < 3) {
      toast.warning('At least 3 words are required to generate axis labels');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      logger.info(MODULE, 'Starting axis label generation workflow', {
        wordCount: words.length,
        iterationCount,
        outputsPerPrompt
      });
      
      // Run the full workflow, which includes both stages
      await generateAxisLabelsWorkflow({
        words,
        algorithmId,
        iterationCount,
        outputsPerPrompt,
        labelsPerAxis,
        onProgress: (data) => {
          // Update UI based on stage
          setProcessingStage(data.stage);
          setProgress(data.progress);
          
          // Update item counts if available
          if (data.totalItems) {
            setTotalItems(data.totalItems);
          }
          if (data.completedItems !== undefined) {
            setCompletedItems(data.completedItems);
          }
          
          // Update current iteration if available
          if (data.currentIteration !== undefined) {
            setCurrentIteration(data.currentIteration);
          }
        },
        onComplete: handleWorkflowComplete
      });
      
    } catch (error) {
      logger.error(MODULE, 'Error in axis label generation workflow', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStage(0);
      setProgress(0);
      
      // Force UI refresh to ensure latest data is displayed
      setTimeout(() => {
        try {
          // Load suggestions to update the UI - with error handling
          const savedSuggestions = loadAxisLabelIdeas();
          if (savedSuggestions && savedSuggestions.length > 0) {
            logger.debug(MODULE, 'Refreshing UI with saved suggestions', { count: savedSuggestions.length });
            setSuggestions(savedSuggestions);
            setDisplayedSuggestions(savedSuggestions);
            suggestionsRef.current = savedSuggestions;
          } else {
            logger.warn(MODULE, 'No saved suggestions found for UI refresh');
          }
          
          // Make sure all buttons and UI elements are properly re-enabled
          setIsGeneratingLabels(false);
          setAutoDetectInProgress(false);
          
          // Trigger DOM and label updates - with error handling
          import('../services/axisLabelService').then(module => {
            try {
              module.triggerAxisLabelsUpdate();
              logger.debug(MODULE, 'Triggered axis labels update');
            } catch (updateError) {
              logger.error(MODULE, 'Error triggering axis labels update', updateError);
              // As a fallback, try to directly update label states
              try {
                const savedLabels = module.loadAxisLabels();
                if (savedLabels && onAxisLabelsChange) {
                  onAxisLabelsChange(savedLabels);
                  logger.debug(MODULE, 'Applied direct axis label update', savedLabels);
                }
              } catch (labelError) {
                logger.error(MODULE, 'Error in direct axis label update', labelError);
              }
            }
          }).catch(importError => {
            logger.error(MODULE, 'Error importing axisLabelService', importError);
          });
        } catch (refreshError) {
          logger.error(MODULE, 'Error in UI refresh after workflow', refreshError);
          // Final fallback - make sure UI is not stuck in loading state
          setIsGeneratingLabels(false);
          setAutoDetectInProgress(false);
        }
      }, 300);
    }
  }, [
    algorithmId, 
    handleWorkflowComplete, 
    isProcessing, 
    iterationCount, 
    labelsPerAxis, 
    outputsPerPrompt, 
    words.length
  ]);

  /**
   * Get appropriate button text based on current state
   */
  const getButtonText = useCallback(() => {
    if (isProcessing) {
      if (processingStage === 1) {
        return `Generating Ideas (${completedItems}/${totalItems})...`;
      } else if (processingStage === 2) {
        return `Finding Best Matches (${completedItems}/${totalItems})...`;
      }
      return 'Processing...';
    }
    return 'Generate Axis Labels';
  }, [isProcessing, processingStage, completedItems, totalItems]);

  /**
   * Get the button class for a sort button
   */
  const getSortButtonClass = useCallback((axis) => {
    if (sortingBy !== axis) return 'sort-button';
    return `sort-button active ${sortDirection}`;
  }, [sortingBy, sortDirection]);

  /**
   * Get the label for a sort button
   */
  const getSortButtonLabel = useCallback((axis) => {
    if (sortingBy !== axis) return `Sort by ${axis.toUpperCase()}`;
    return `Sort by ${axis.toUpperCase()} (${sortDirection === 'desc' ? 'High → Low' : 'Low → High'})`;
  }, [sortingBy, sortDirection]);

  /**
   * Refresh axis labels using cached data (no API calls)
   */
  const refreshFromCache = useCallback(async () => {
    if (isProcessing) {
      toast.info('Please wait, another operation is in progress');
      return false;
    }
    
    setIsProcessing(true);
    
    try {
      // Create toast for tracking progress
      const toastId = toast.info('Refreshing axis labels from cache...', {
        autoClose: false,
        closeButton: false
      });
      
      // Import the refreshLabelsFromCache function
      logger.info(MODULE, 'Calling refreshLabelsFromCache service');
      const result = await refreshLabelsFromCache(algorithmId, labelsPerAxis, (data) => {
        // This is the onComplete callback
        if (onAxisLabelsChange && data && data.bestLabels) {
          logger.debug(MODULE, 'Updating axis labels via onAxisLabelsChange from cache refresh', data.bestLabels);
          onAxisLabelsChange(data.bestLabels, labelsPerAxis);
        }
      });
      
      if (result) {
        // Update toast to success
        toast.update(toastId, {
          render: 'Axis labels refreshed from cache',
          type: 'success',
          autoClose: 2000,
          closeButton: true
        });
        
        // Force a DOM update by explicitly triggering the event
        import('../services/axisLabelService').then(module => {
          logger.debug(MODULE, 'Triggering axis labels update event after cache refresh');
          module.triggerAxisLabelsUpdate();
        });
        
        return true;
      } else {
        // Update toast to warning
        toast.update(toastId, {
          render: 'Could not refresh labels from cache. Try generating new suggestions.',
          type: 'warning',
          autoClose: 5000,
          closeButton: true
        });
        
        return false;
      }
    } catch (error) {
      logger.error(MODULE, 'Error refreshing from cache:', error);
      
      // Update toast to error
      toast.error(`Error refreshing labels: ${error.message}`);
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [algorithmId, isProcessing, labelsPerAxis, onAxisLabelsChange]);

  // Expose the refreshFromCache function to parent components via ref
  useImperativeHandle(ref, () => ({
    refreshLabelsFromCache: refreshFromCache,
    generateAxisLabels: processAxisLabels
  }), [refreshFromCache, processAxisLabels]);

  return (
    <div className="axis-labels-container">
      <div className="axis-label-description">
        <p>Set labels for each axis to give meaning to the 3D visualization.</p>
      </div>
      
      {/* AI-based axis label generation */}
      <div className="suggestions-section">
        {/* Show progress display when processing */}
        {isProcessing && (
          <div className={`progress-container stage-${processingStage}`}>
            <div className="progress-status">
              <div className="progress-stage">
                {processingStage === 1 && (
                  <span>Stage 1/2: Generating ideas (<span className="completion-count">{completedItems}</span>/<span className="total-count">{totalItems}</span>)</span>
                )}
                {processingStage === 2 && (
                  <span>Stage 2/2: Analyzing embeddings (<span className="completion-count">{completedItems}</span>/<span className="total-count">{totalItems}</span>)</span>
                )}
              </div>
              <div className="progress-percentage">{Math.floor(progress)}%</div>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${progress}%`,
                  background: processingStage === 1 
                    ? 'linear-gradient(90deg, #4a6fa5 0%, #6a8cc5 100%)' 
                    : 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)'
                }}
              ></div>
            </div>
            <div className="progress-description">
              {processingStage === 1 && (
                <span>Generating axis label ideas for your embeddings... ({completedItems} of {totalItems} completed)</span>
              )}
              {processingStage === 2 && (
                <span>
                  {completedItems < totalItems 
                    ? `Getting embeddings for suggestions... (${completedItems} of ${totalItems} completed)`
                    : `Analyzing embeddings to find optimal axis labels...`
                  }
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Only show controls if not currently processing */}
        {!isProcessing && (
          <div className="iteration-controls">
            <div className="iteration-description">
              <p>Generate axis label ideas based on the current word list:</p>
            </div>
            
            <div className="iteration-row">
              <div className="iteration-group">
                <label htmlFor="iteration-slider">API Requests:</label>
                <input
                  id="iteration-slider"
                  type="range"
                  min="1"
                  max="5"
                  value={iterationCount}
                  onChange={(e) => setIterationCount(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="iteration-slider"
                />
                <span className="iteration-value">{iterationCount}</span>
              </div>
              
              <div className="iteration-group">
                <label htmlFor="outputs-input">Ideas per request:</label>
                <input
                  id="outputs-input"
                  type="number"
                  min="5"
                  value={outputsPerPrompt}
                  onChange={(e) => setOutputsPerPrompt(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="outputs-input"
                />
              </div>
            </div>
            
            <div className="action-buttons">
              <button
                className="generate-axis-labels-button"
                onClick={processAxisLabels}
                disabled={isProcessing || words.length < 3}
              >
                {getButtonText()}
              </button>
            </div>
          </div>
        )}
        
        {/* Suggestions list with reorganized header */}
        {suggestions.length > 0 && (
          <div className="suggestions-list">
            <div className="suggestions-header-vertical">
              {/* Vertically stacked header elements */}
              <div className="header-label">Label Ideas</div>
              <div className="header-count">({suggestions.length})</div>
              {suggestionEmbeddings.size > 0 && 
                <div className="header-embedding-count">
                  {`${suggestionEmbeddings.size} cached`}
                </div>
              }
              
              {/* Sort controls moved below and left-aligned */}
              {suggestionEmbeddings.size > 0 && dimensionIndices && (
                <div className="sort-controls-vertical">
                  <div className="reflex-label">Reflex</div>
                  <div className="sort-buttons-container">
                    <button 
                      className={getSortButtonClass('x')}
                      onClick={() => handleSort('x')}
                      title={getSortButtonLabel('x')}
                    >
                      {sortingBy === 'x' ? (
                        sortDirection === 'desc' ? <FaSortAmountDown /> : <FaSortAmountUp />
                      ) : 'X'}
                    </button>
                    <button 
                      className={getSortButtonClass('y')}
                      onClick={() => handleSort('y')}
                      title={getSortButtonLabel('y')}
                    >
                      {sortingBy === 'y' ? (
                        sortDirection === 'desc' ? <FaSortAmountDown /> : <FaSortAmountUp />
                      ) : 'Y'}
                    </button>
                    <button 
                      className={getSortButtonClass('z')}
                      onClick={() => handleSort('z')}
                      title={getSortButtonLabel('z')}
                    >
                      {sortingBy === 'z' ? (
                        sortDirection === 'desc' ? <FaSortAmountDown /> : <FaSortAmountUp />
                      ) : 'Z'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="suggestion-items">
              {displayedSuggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-item-container">
                  <div className="suggestion-item">
                    <span 
                      className="suggestion-text"
                      onClick={() => {
                        const axis = window.prompt(`Set "${suggestion}" as which axis? (x/y/z)`, "x").toLowerCase();
                        if (axis === 'x' || axis === 'y' || axis === 'z') {
                          handleLabelChange(axis, suggestion);
                          toast.info(`Set "${suggestion}" as ${axis.toUpperCase()}-axis`);
                        }
                      }}
                    >
                      {suggestion}
                    </span>
                    <button 
                      onClick={() => getAndShowEmbedding(suggestion)}
                      className="view-embedding-button small"
                      title="View embedding vector"
                    >
                      <FaTable />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Add the Refresh from Cache button */}
        {suggestions.length > 0 && suggestionEmbeddings.size > 0 && (
          <div className="manual-control-buttons">
            <button
              className="refresh-from-cache-button"
              onClick={refreshFromCache}
              disabled={isProcessing}
            >
              <FaSync /> Refresh Labels from Cache
            </button>
          </div>
        )}
      </div>
      
      {/* Embedding viewer */}
      {selectedEmbedding && (
        <EmbeddingViewer
          embedding={selectedEmbedding.embedding}
          word={selectedEmbedding.word}
          onClose={closeEmbeddingViewer}
        />
      )}
    </div>
  );
});

export default AxisLabelManager; 