import { useState } from 'react';
import { FaSortAmountDown, FaSortAmountUp, FaTh, FaTimes } from 'react-icons/fa';
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
  const [sortDirection, setSortDirection] = useState('desc'); // Default to showing highest magnitude first

  // Handle sorting of the embedding data
  const handleSort = (direction) => {
    if (sortDirection === direction) {
      // If already sorted in this direction, remove sorting
      setSelectedEmbedding({
        ...selectedEmbedding,
        sortedData: null
      });
      setSortDirection(null);
    } else {
      // Apply the requested sorting
      const sortedData = sortEmbedding(embedding, direction);
      setSelectedEmbedding({
        values: embedding,
        sortedData
      });
      setSortDirection(direction);
    }
  };

  // Sort embedding values based on direction
  const sortEmbedding = (embedding, direction) => {
    if (!direction) return null;
    
    // Create pairs of [value, index] to preserve original positions
    const pairs = embedding.map((value, index) => ({ 
      value, 
      index, 
      magnitude: Math.abs(value) 
    }));
    
    // Sort by magnitude (absolute value)
    pairs.sort((a, b) => {
      if (direction === 'asc') {
        return a.magnitude - b.magnitude; // Smallest absolute value first
      } else {
        return b.magnitude - a.magnitude; // Largest absolute value first
      }
    });
    
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
    if (!selectedEmbedding && sortDirection) {
      const sortedData = sortEmbedding(embedding, sortDirection);
      setSelectedEmbedding({
        values: embedding,
        sortedData
      });
    }

    // Determine whether to use sorted or original data
    const dataToRender = selectedEmbedding?.sortedData || embedding.map((value, index) => ({ value, index }));
    
    // Find the maximum absolute value for scaling the visualization
    const maxMagnitude = Math.max(...dataToRender.map(item => Math.abs(item.value)));
    
    if (embedding.length > 50 && !isMinimal) {
      // For large embeddings, show with pagination or limited view
      return (
        <div className="embedding-data">
          <p>Vector of {embedding.length} dimensions</p>
          <div className="embedding-table">
            {dataToRender.slice(0, 100).map((item) => (
              <div key={`dim-${item.index}`} className="embedding-row">
                <span className="dimension">[{item.index}]:</span>
                {renderValueBar(item.value, maxMagnitude)}
              </div>
            ))}
            {embedding.length > 100 && (
              <div className="embedding-row">
                <div className="embedding-ellipsis">
                  ...and {embedding.length - 100} more values
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
            {embedding.length > 10 && (
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