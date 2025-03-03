/**
 * Dimension Reduction Module
 * 
 * This is the main entry point for the dimension reduction functionality.
 * It provides a unified API for accessing and using dimension reduction algorithms.
 */

import algorithmRegistry from './algorithmRegistry';

// Default algorithm to use if none is specified
const DEFAULT_ALGORITHM_ID = 'pca';

/**
 * Gets a list of all available algorithms
 * 
 * @returns {Array} Array of algorithm objects with id, name, and description
 */
export const getAvailableAlgorithms = () => {
  const algorithms = algorithmRegistry.getAllAlgorithms();
  
  return Object.values(algorithms).map(algorithm => ({
    id: algorithm.id,
    name: algorithm.name,
    description: algorithm.description
  }));
};

/**
 * Apply a dimension reduction algorithm to embeddings
 * 
 * @param {Array<Array<number>>} embeddings - Array of embedding vectors
 * @param {string} algorithmId - ID of the algorithm to use
 * @returns {Object} The result of the dimension reduction algorithm
 */
export const applyDimensionReduction = (embeddings, algorithmId = DEFAULT_ALGORITHM_ID) => {
  if (!embeddings || embeddings.length === 0) {
    return null;
  }
  
  // Get the algorithm
  const algorithm = algorithmRegistry.getAlgorithmById(algorithmId) || 
                    algorithmRegistry.getAlgorithmById(DEFAULT_ALGORITHM_ID);
  
  if (!algorithm) {
    console.error(`Algorithm "${algorithmId}" not found and default algorithm not available`);
    return null;
  }
  
  // Apply the algorithm to the embeddings
  return algorithm.reduce(embeddings);
};

/**
 * Get coordinates in 3D space for an embedding based on reduction result
 * 
 * @param {Array<number>} embedding - The embedding vector
 * @param {Object} reductionResult - The result from a dimension reduction algorithm
 * @returns {Object} x, y, z coordinates for the embedding
 */
export const getCoordinatesFromEmbedding = (embedding, reductionResult) => {
  if (!embedding || !reductionResult) {
    return { x: 0, y: 0, z: 0 };
  }
  
  const { indices, minValues, maxValues } = reductionResult;
  
  // Scale function to map embedding values to 3D space
  const scale = (value, min, max, targetMin = -2, targetMax = 2) => {
    if (min === max) return (targetMin + targetMax) / 2;
    return targetMin + (value - min) * (targetMax - targetMin) / (max - min);
  };
  
  return {
    x: scale(embedding[indices[0]], minValues[0], maxValues[0]),
    y: scale(embedding[indices[1]], minValues[1], maxValues[1]),
    z: scale(embedding[indices[2]], minValues[2], maxValues[2])
  };
};

/**
 * Gets the dimension information for the current reduction
 * 
 * @param {Object} reductionResult - The result from a dimension reduction algorithm
 * @returns {Object} Information about which dimensions are being used
 */
export const getDimensionInfo = (reductionResult) => {
  if (!reductionResult) {
    return {
      algorithm: 'None',
      xDimension: 'N/A',
      yDimension: 'N/A',
      zDimension: 'N/A'
    };
  }
  
  return {
    algorithm: reductionResult.name || 'Unknown',
    xDimension: reductionResult.indices[0],
    yDimension: reductionResult.indices[1],
    zDimension: reductionResult.indices[2]
  };
};

/**
 * Registers a new algorithm at runtime
 * 
 * @param {Object} algorithm - Algorithm object with id, name, description, and reduce function
 * @returns {boolean} True if registration was successful
 */
export const registerAlgorithm = (algorithm) => {
  return algorithmRegistry.registerNewAlgorithm(algorithm);
};

// Export everything from the registry as well
export { algorithmRegistry }; 