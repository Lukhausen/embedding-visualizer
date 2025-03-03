import { useState, useEffect } from 'react';
import { FaCog } from 'react-icons/fa';
import './SettingsManager.css';

/**
 * Component for application-wide settings
 * 
 * @param {Object} props - Component props
 * @param {number} props.textSize - Current text size scale factor
 * @param {Function} props.onTextSizeChange - Callback when text size changes
 * @returns {JSX.Element} The component
 */
function SettingsManager({ textSize = 1, onTextSizeChange }) {
  const [localTextSize, setLocalTextSize] = useState(textSize);

  // Update local state when props change
  useEffect(() => {
    setLocalTextSize(textSize);
  }, [textSize]);

  // Handle slider change
  const handleTextSizeChange = (e) => {
    const newSize = parseFloat(e.target.value);
    setLocalTextSize(newSize);
    
    // Use localStorage to persist settings
    localStorage.setItem('app-text-size', newSize.toString());
    
    // Notify parent component
    if (onTextSizeChange) {
      onTextSizeChange(newSize);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-group">
        <h4 className="settings-section-title">
          <FaCog /> Visual Settings
        </h4>
        
        <div className="settings-item">
          <label htmlFor="text-size-input">Label Size:</label>
          <div className="settings-control">
            <input
              id="text-size-input"
              type="range"
              min="0.5"
              max="5"
              step="0.2"
              value={localTextSize}
              onChange={handleTextSizeChange}
              className="settings-slider"
            />
            <span className="settings-value">{localTextSize.toFixed(1)}x</span>
          </div>
          <div className="settings-description">
            Adjust the size of text labels in the 3D view
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsManager; 