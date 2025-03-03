/**
 * Base structure for dimension reduction algorithms
 * 
 * This file defines the interface that all dimension reduction algorithms should implement.
 * Each algorithm file should export an object following this structure.
 */

/**
 * Example algorithm structure - each algorithm file should export an object like this
 */
export const algorithmExample = {
  /**
   * Unique identifier for the algorithm
   * Should be a string with no spaces, using camelCase
   */
  id: 'uniqueAlgorithmId',

  /**
   * Display name for the algorithm shown in the UI
   */
  name: 'Algorithm Display Name',

  /**
   * Brief description of how the algorithm works
   */
  description: 'Description of what this algorithm does',

  /**
   * The reduce function that implements the dimension reduction logic
   * 
   * @param {Array<Array<number>>} embeddings - Array of embedding vectors
   * @returns {Object} Object containing indices, minValues, maxValues, name, and description
   */
  reduce: function(embeddings) {
    if (!embeddings || embeddings.length === 0) {
      return null;
    }

    // Algorithm implementation goes here
    // ...

    // Return structure should include:
    return {
      // The three dimension indices to use (required)
      indices: [0, 1, 2],
      
      // Min values for each dimension for scaling (required)
      minValues: [0, 0, 0],
      
      // Max values for each dimension for scaling (required)
      maxValues: [1, 1, 1],
      
      // Algorithm name and description (automatically added by the registry)
      name: this.name,
      description: this.description
    };
  }
}; 