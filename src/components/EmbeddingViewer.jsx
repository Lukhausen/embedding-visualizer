import { useState, useRef, useEffect } from 'react';
import { FaSortAmountDown, FaSortAmountUp, FaSearch, FaTimes } from 'react-icons/fa';
import './EmbeddingViewer.css';

/**
 * A reusable component for visualizing embeddings
 * 
 * @param {Object} props - Component props
 * @param {Array} props.embedding - The embedding vector to visualize
 * @param {string} props.word - The word associated with this embedding
 * @param {boolean} props.isMinimal - Whether to show minimal display (used for inline views)
 * @param {Function} props.onClose - Function to call when close button is clicked
 * @returns {JSX.Element} The component
 */
function EmbeddingViewer({ embedding, word, isMinimal = false, onClose }) {
  // State for sorting the embedding data
  const [selectedEmbedding, setSelectedEmbedding] = useState(null);
  const [sortMode, setSortMode] = useState('magnitude-desc'); // Default to showing highest magnitude first
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState(null);
  const [matchCount, setMatchCount] = useState(0);
  const searchInputRef = useRef(null);

  // Apply search filter when query changes
  useEffect(() => {
    if (!embedding || !searchQuery.trim()) {
      setFilteredData(null);
      setMatchCount(0);
      return;
    }

    // Determine which data to search through
    const dataToSearch = selectedEmbedding?.sortedData || 
      embedding.map((value, index) => ({ value, index, magnitude: Math.abs(value) }));
    
    // Parse search query
    const query = searchQuery.trim().toLowerCase();
    
    // Check for comparison operators
    if (query.startsWith('>') || query.startsWith('<')) {
      const isGreaterThan = query.startsWith('>');
      const valueStr = query.substring(1).trim();
      const threshold = parseFloat(valueStr);
      
      if (!isNaN(threshold)) {
        const matches = dataToSearch.filter(item => 
          isGreaterThan ? item.value > threshold : item.value < threshold
        );
        setFilteredData(matches);
        setMatchCount(matches.length);
        return;
      }
    }
    
    // Check for dimension number search (exact or partial)
    const dimensionMatches = dataToSearch.filter(item => 
      item.index.toString().includes(query)
    );
    
    // Check for value search
    const valueMatches = dataToSearch.filter(item => 
      item.value.toString().includes(query)
    );
    
    // Combine matches without duplicates
    const allMatches = [...new Set([...dimensionMatches, ...valueMatches])];
    
    setFilteredData(allMatches);
    setMatchCount(allMatches.length);
  }, [searchQuery, embedding, selectedEmbedding]);

  // Focus search input when in full view
  useEffect(() => {
    if (!isMinimal && searchInputRef.current) {
      // Use a slight delay to allow the modal to render
      const timer = setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMinimal]);

  // Handle sorting of the embedding data
  const handleSort = (mode) => {
    if (sortMode === mode) {
      // If already sorted in this mode, remove sorting
      setSelectedEmbedding({
        ...selectedEmbedding,
        sortedData: null
      });
      setSortMode(null);
    } else {
      // Apply the requested sorting
      const sortedData = sortEmbedding(embedding, mode);
      setSelectedEmbedding({
        values: embedding,
        sortedData
      });
      setSortMode(mode);
    }
  };

  // Sort embedding values based on sort mode
  const sortEmbedding = (embedding, mode) => {
    if (!mode) return null;
    
    // Create pairs of [value, index] to preserve original positions
    const pairs = embedding.map((value, index) => ({ 
      value, 
      index, 
      magnitude: Math.abs(value) 
    }));
    
    // Sort based on selected mode
    switch (mode) {
      case 'magnitude-desc':
        // Sort by magnitude (absolute value), highest first
        pairs.sort((a, b) => b.magnitude - a.magnitude);
        break;
      case 'value-desc':
        // Sort by actual value, highest first
        pairs.sort((a, b) => b.value - a.value);
        break;
      case 'value-asc':
        // Sort by actual value, lowest first
        pairs.sort((a, b) => a.value - b.value);
        break;
      default:
        // No sorting
        return null;
    }
    
    return pairs;
  };

  // Render visualization bars for embedding values
  const renderValueBar = (value, maxMagnitude) => {
    const absValue = Math.abs(value);
    const percentage = (absValue / maxMagnitude) * 50; // 50% of width (to allow for centering)
    const isPositive = value >= 0;
    
    return (
      <div className="value-visualization">
        <div className="value-text">{value.toFixed(6)}</div>
        <div className="value-bar-container">
          <div className="center-marker"></div>
          {isPositive ? (
            <div 
              className="value-bar positive" 
              style={{ width: `${percentage}%`, left: '50%' }} 
              title={`Positive: ${value.toFixed(6)}`}
            />
          ) : (
            <div 
              className="value-bar negative" 
              style={{ width: `${percentage}%`, right: '50%' }} 
              title={`Negative: ${value.toFixed(6)}`}
            />
          )}
        </div>
      </div>
    );
  };

  // Render the embedding data
  const renderEmbeddingData = () => {
    if (!embedding || embedding.length === 0) {
      return <div className="embedding-data">No embedding data available</div>;
    }

    // Apply sort on first render if not already sorted
    if (!selectedEmbedding && sortMode) {
      const sortedData = sortEmbedding(embedding, sortMode);
      setSelectedEmbedding({
        values: embedding,
        sortedData
      });
    }

    // Determine whether to use sorted or original data
    let dataToRender = selectedEmbedding?.sortedData || embedding.map((value, index) => ({ value, index }));
    
    // If we have filtered data from search, use that instead
    if (filteredData && filteredData.length > 0) {
      dataToRender = filteredData;
    }
    
    // Find the maximum absolute value for scaling the visualization
    const maxMagnitude = Math.max(...dataToRender.map(item => Math.abs(item.value)));
    
    if (embedding.length > 50 && !isMinimal) {
      // For large embeddings, show with pagination or limited view
      return (
        <div className="embedding-data">
          <div className="search-status">
            {searchQuery.trim() ? (
              <p>
                {matchCount} matching {matchCount === 1 ? 'dimension' : 'dimensions'} 
                {filteredData && filteredData.length > 100 ? ' (showing first 100)' : ''}
              </p>
            ) : (
              <p>Vector of {embedding.length} dimensions{dataToRender.length > 100 ? ' (showing first 100)' : ''}</p>
            )}
          </div>
          <div className="embedding-table">
            {dataToRender.slice(0, 100).map((item) => (
              <div key={`dim-${item.index}`} className="embedding-row">
                <span className="dimension">[{item.index}]:</span>
                {renderValueBar(item.value, maxMagnitude)}
              </div>
            ))}
            {dataToRender.length > 100 && (
              <div className="embedding-row">
                <div className="embedding-ellipsis">
                  ...and {dataToRender.length - 100} more values
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (isMinimal) {
      // Minimal view for inline display
      return (
        <div className="embedding-data minimal">
          <div className="embedding-table minimal">
            {dataToRender.slice(0, 10).map((item) => (
              <div key={`dim-${item.index}`} className="embedding-row">
                <div className="dimension">[{item.index}]:</div>
                {renderValueBar(item.value, maxMagnitude)}
              </div>
            ))}
            {dataToRender.length > 10 && (
              <div className="embedding-row">
                <div className="embedding-ellipsis">...</div>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      // Standard view for normal display
      return (
        <div className="embedding-data">
          <div className="embedding-table">
            {dataToRender.map((item) => (
              <div key={`dim-${item.index}`} className="embedding-row">
                <span className="dimension">[{item.index}]:</span>
                {renderValueBar(item.value, maxMagnitude)}
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  // Return different views based on isMinimal flag
  if (isMinimal) {
    return (
      <div className="embedding-viewer minimal">
        <div className="embedding-viewer-header minimal">
          <span>{word} vector</span>
          <button 
            className="embedding-viewer-expand" 
            onClick={() => onClose && onClose(embedding, word, false)} 
            title="View full embedding"
          >
            ⊕
          </button>
        </div>
        {renderEmbeddingData()}
      </div>
    );
  }

  return (
    <div className="embedding-modal-overlay-fullscreen" onClick={() => onClose && onClose()}>
      <div className="embedding-modal-fullscreen" onClick={e => e.stopPropagation()}>
        <div className="embedding-modal-header">
          <h3>Embedding for "{word}"</h3>
          
          <div className="embedding-search">
            <div className="search-input-container">
              <FaSearch className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dimension (e.g. 42, >0.5, <-0.3)"
                className="dimension-search-input"
              />
              {searchQuery && (
                <button 
                  className="clear-search-button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>
          
          <div className="embedding-controls">
            <button 
              className={`sort-button ${sortMode === 'magnitude-desc' ? 'active' : ''}`}
              onClick={() => handleSort('magnitude-desc')}
              title="Sort by highest absolute value"
            >
              <FaSortAmountDown />
              <span>Highest |x|</span>
            </button>
            <button 
              className={`sort-button ${sortMode === 'value-desc' ? 'active' : ''}`}
              onClick={() => handleSort('value-desc')}
              title="Sort by highest value"
            >
              <FaSortAmountDown />
              <span>Highest x</span>
            </button>
            <button 
              className={`sort-button ${sortMode === 'value-asc' ? 'active' : ''}`}
              onClick={() => handleSort('value-asc')}
              title="Sort by lowest value"
            >
              <FaSortAmountUp />
              <span>Lowest x</span>
            </button>
            <button className="close-modal-button" onClick={() => onClose && onClose()}>
              <FaTimes />
            </button>
          </div>
        </div>
        <div className="embedding-modal-content">
          {renderEmbeddingData()}
        </div>
      </div>
    </div>
  );
}

export default EmbeddingViewer; 