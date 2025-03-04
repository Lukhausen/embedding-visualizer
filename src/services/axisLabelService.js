/**
 * Axis Label Service
 * 
 * This service centralizes minimal axis label management functionality:
 * - Label persistence
 * - Label loading
 */

// Default labels when nothing else is available
const DEFAULT_LABELS = { x: "X", y: "Y", z: "Z" };

// Track the latest labels to prevent duplicate updates
let lastLabelsState = null;
let updateInProgress = false;
let updateDebounceTimer = null;

/**
 * Check if the new labels are different from the last saved state
 * 
 * @param {Object} newLabels - New labels object
 * @param {number} newLabelsPerAxis - New labels per axis value
 * @returns {boolean} True if different, false if same
 */
const isLabelsDifferent = (newLabels, newLabelsPerAxis) => {
  if (!lastLabelsState) return true;
  
  const { labels: oldLabels, labelsPerAxis: oldLabelsPerAxis } = lastLabelsState;
  
  // Check if labelsPerAxis has changed
  if (oldLabelsPerAxis !== newLabelsPerAxis) return true;
  
  // Check if label objects are different
  return (
    oldLabels.x !== newLabels.x ||
    oldLabels.y !== newLabels.y ||
    oldLabels.z !== newLabels.z
  );
};

/**
 * Load axis labels from localStorage
 * 
 * @returns {Object} Axis labels {x, y, z}
 */
export const loadAxisLabels = () => {
  try {
    const savedLabels = localStorage.getItem('axis-labels');
    if (savedLabels) {
      const parsed = JSON.parse(savedLabels);
      // Update our last labels state tracking
      lastLabelsState = { 
        labels: parsed, 
        labelsPerAxis: loadLabelsPerAxis() 
      };
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load axis labels:', error);
  }
  
  return DEFAULT_LABELS;
};

/**
 * Save axis labels to localStorage
 * 
 * @param {Object} labels - Axis labels {x, y, z}
 * @param {number} labelsPerAxis - Number of labels to show per axis
 */
export const saveAxisLabels = (labels, labelsPerAxis = 1) => {
  // Prevent duplicate updates and infinite loops
  if (updateInProgress) return;
  
  // Check if this update is actually changing anything
  if (!isLabelsDifferent(labels, labelsPerAxis)) return;
  
  try {
    updateInProgress = true;
    
    // Update tracking state
    lastLabelsState = { labels, labelsPerAxis };
    
    // Save to localStorage
    localStorage.setItem('axis-labels', JSON.stringify(labels));
    localStorage.setItem('labels-per-axis', labelsPerAxis.toString());
    
    // Trigger update event
    triggerAxisLabelsUpdate();
    
    // Release the update lock after a short delay
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = setTimeout(() => {
      updateInProgress = false;
    }, 100);
  } catch (error) {
    console.error('Failed to save axis labels:', error);
    updateInProgress = false;
  }
};

/**
 * Load the number of labels to show per axis
 * 
 * @returns {number} Number of labels per axis
 */
export const loadLabelsPerAxis = () => {
  try {
    const saved = localStorage.getItem('labels-per-axis');
    if (saved) {
      const parsed = parseInt(saved);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load labels per axis:', error);
  }
  
  return 1; // Default to 1 label per axis
};

/**
 * Clean replacement for the deprecated updateAxisLabelsFromEmbeddings
 * Simply sets a flag that embeddings were updated
 * 
 * @returns {null} Always returns null
 */
export const notifyEmbeddingsUpdated = () => {
  localStorage.setItem('embeddings-updated', 'true');
  return null;
};

// Enhance this function to be more reliable
export const triggerAxisLabelsUpdate = () => {
  // Set localStorage flag to indicate update is needed
  localStorage.setItem('axis-labels-updated', 'true');
  
  // Dispatch a custom event that components can listen for
  window.dispatchEvent(new CustomEvent('axis-labels-updated'));
  
  // Also dispatch after a short delay to ensure it's processed
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('axis-labels-updated'));
  }, 50);
}; 