/**
 * Algorithm Registry
 * 
 * This module manages loading and registering dimension reduction algorithms.
 * It dynamically discovers and imports all algorithms from the algorithms directory.
 */

// Registry of all available algorithms
const algorithms = {};

/**
 * Auto-discovery of algorithm modules using Vite's import.meta.glob
 * This automatically imports all .js files from the algorithms directory
 */
const algorithmsContext = import.meta.glob('./algorithms/*.js', { eager: true });

// Register each algorithm by its ID
const registerAlgorithm = (algorithm) => {
  if (!algorithm || !algorithm.id) {
    console.error('Attempted to register invalid algorithm:', algorithm);
    return;
  }
  
  if (algorithms[algorithm.id]) {
    console.warn(`Algorithm with ID "${algorithm.id}" is already registered. Overwriting.`);
  }
  
  algorithms[algorithm.id] = algorithm;
};

// Process all discovered algorithm modules and register them
Object.values(algorithmsContext).forEach(module => {
  // Each module should export an algorithm object as default
  if (module.default && module.default.id && typeof module.default.reduce === 'function') {
    registerAlgorithm(module.default);
    console.log(`Registered algorithm: ${module.default.name} (${module.default.id})`);
  } else {
    console.warn('Found algorithm module without proper default export:', module);
  }
});

/**
 * Gets all registered algorithms
 * 
 * @returns {Object} Map of algorithm ID to algorithm object
 */
export const getAllAlgorithms = () => {
  return { ...algorithms };
};

/**
 * Gets an algorithm by ID
 * 
 * @param {string} id - The algorithm ID
 * @returns {Object|null} The algorithm object or null if not found
 */
export const getAlgorithmById = (id) => {
  return algorithms[id] || null;
};

/**
 * Registers a new algorithm at runtime
 * 
 * @param {Object} algorithm - The algorithm object to register
 * @returns {boolean} True if registration was successful
 */
export const registerNewAlgorithm = (algorithm) => {
  if (!algorithm || typeof algorithm !== 'object' || !algorithm.id || typeof algorithm.reduce !== 'function') {
    console.error('Invalid algorithm format:', algorithm);
    return false;
  }
  
  registerAlgorithm(algorithm);
  return true;
};

// Export the public API
export default {
  getAllAlgorithms,
  getAlgorithmById,
  registerNewAlgorithm
}; 