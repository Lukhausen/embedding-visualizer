import { useState, useEffect } from 'react';
import { getAvailableAlgorithms } from '../services/dimensionReduction';
import './DimensionReductionSelector.css';

/**
 * A component that allows the user to select a dimension reduction algorithm
 * 
 * @param {Object} props - Component props
 * @param {String} props.selectedAlgorithm - Currently selected algorithm ID
 * @param {Function} props.onChange - Function called when algorithm changes
 * @returns {JSX.Element} The component
 */
function DimensionReductionSelector({ selectedAlgorithm, onChange }) {
  const [algorithms, setAlgorithms] = useState([]);

  // Load available algorithms
  useEffect(() => {
    const availableAlgorithms = getAvailableAlgorithms();
    setAlgorithms(availableAlgorithms);
  }, []);

  const handleAlgorithmSelect = (algorithmId) => {
    onChange(algorithmId);
  };

  return (
    <div className="dimension-selector">
      <div className="dimension-selector-header">
        <h3>Dimension Reduction</h3>
      </div>
      
      <div className="algorithm-list">
        {algorithms.map(algorithm => (
          <div
            key={algorithm.id}
            className={`algorithm-option ${selectedAlgorithm === algorithm.id ? 'selected' : ''}`}
            onClick={() => handleAlgorithmSelect(algorithm.id)}
          >
            <div className="algorithm-name">{algorithm.name}</div>
            <div className="algorithm-description">{algorithm.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DimensionReductionSelector; 