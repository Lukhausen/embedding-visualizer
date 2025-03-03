/**
 * EMBEDDING VISUALIZER ALGORITHM TEMPLATE
 * =======================================
 * 
 * This file provides a template interface for creating new dimension reduction algorithms.
 * Use this as a reference when implementing your own algorithms.
 */

/**
 * ALGORITHM TEMPLATE - Copy this structure when creating a new algorithm
 */
export const algorithmTemplate = {
  /**
   * REQUIRED: Unique identifier for the algorithm
   * - Use camelCase
   * - No spaces or special characters
   * - This ID is used in URLs and for persistent storage
   */
  id: 'myUniqueAlgorithmId',

  /**
   * REQUIRED: Display name shown in the UI
   * - User-friendly name that appears in the dropdown
   * - Can include spaces and special characters
   */
  name: 'My Algorithm Name',

  /**
   * REQUIRED: Brief description explaining how the algorithm works
   * - Shown in the UI when the algorithm is selected
   * - Should be concise but informative
   * - Can include markdown formatting
   */
  description: 'This algorithm reduces dimensions by...',

  /**
   * REQUIRED: The core algorithm implementation
   * 
   * @param {Array<Array<number>>} embeddings - Array of embedding vectors to process
   * @returns {Object} Object with required dimension mapping properties
   */
  reduce: function(embeddings) {
    // Input validation (always include this)
    if (!embeddings || embeddings.length === 0) {
      return null;
    }

    // --------------------------------------------------
    // YOUR ALGORITHM IMPLEMENTATION GOES HERE
    // --------------------------------------------------
    
    // Just a placeholder example - replace with your logic
    const dimensions = embeddings[0].length;
    const selectedIndices = [0, 1, 2]; // Select which dimensions to use for X, Y, Z
    
    // Find min/max values for normalization
    const minValues = [Infinity, Infinity, Infinity];
    const maxValues = [-Infinity, -Infinity, -Infinity];
    
    // Calculate min/max for each selected dimension
    for (const embedding of embeddings) {
      for (let i = 0; i < 3; i++) {
        const value = embedding[selectedIndices[i]];
        minValues[i] = Math.min(minValues[i], value);
        maxValues[i] = Math.max(maxValues[i], value);
      }
    }

    // --------------------------------------------------
    // REQUIRED RETURN FORMAT:
    // --------------------------------------------------
    return {
      // REQUIRED: Which dimensions to map to X, Y, Z (indices into the embedding vectors)
      indices: selectedIndices,
      
      // REQUIRED: Minimum values for each selected dimension (for scaling)
      minValues: minValues,
      
      // REQUIRED: Maximum values for each selected dimension (for scaling) 
      maxValues: maxValues,
      
      // REQUIRED: Algorithm metadata (automatically included by registry)
      name: this.name,
      description: this.description
      
      // OPTIONAL: You can include additional metadata if needed
      // customData: { ... }
    };
  }
}; 