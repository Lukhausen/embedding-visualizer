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
        labelsPerAxis: 2 // Always use 2 labels per axis
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
 * @param {number} labelsPerAxis - Number of labels to show per axis (ignored, always uses 2)
 */
export const saveAxisLabels = (labels, labelsPerAxis = 2) => {
  // Prevent duplicate updates and infinite loops
  if (updateInProgress) return;
  
  // Always use 2 labels per axis
  const fixedLabelsPerAxis = 2;
  
  // Check if this update is actually changing anything
  if (!isLabelsDifferent(labels, fixedLabelsPerAxis)) return;
  
  try {
    updateInProgress = true;
    
    // Update tracking state
    lastLabelsState = { labels, labelsPerAxis: fixedLabelsPerAxis };
    
    // Save to localStorage
    localStorage.setItem('axis-labels', JSON.stringify(labels));
    localStorage.setItem('labels-per-axis', fixedLabelsPerAxis.toString());
    
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
  // Always return 2 regardless of what's stored in localStorage
  return 2;
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
  
  // Create a custom event for more reliable communication
  const updateEvent = new CustomEvent('axis-labels-updated', {
    detail: {
      timestamp: Date.now(),
      source: 'axisLabelService'
    },
    bubbles: true
  });
  
  // Dispatch the custom event now
  window.dispatchEvent(updateEvent);
  
  // Also dispatch after delays to ensure it's picked up
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('axis-labels-updated'));
  }, 50);
  
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('axis-labels-updated'));
    // Also re-set the localStorage flag as a backup mechanism
    localStorage.setItem('axis-labels-updated', 'true');
  }, 500);
  
  // Try once more after UI should be fully rendered
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('axis-labels-updated'));
  }, 1000);
}; 