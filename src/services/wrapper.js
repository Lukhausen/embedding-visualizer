/**
 * Import Forwarding Module
 * 
 * This file forwards imports from legacy paths to the new module structure.
 * It ensures backward compatibility with any code still importing from the old locations.
 */

// Re-export the main functionality from the new location
import * as dimensionReduction from './dimensionReduction';
export default dimensionReduction;

// Re-export everything individually for named imports
export const {
  // From the main API
  getAvailableAlgorithms,
  applyDimensionReduction,
  getCoordinatesFromEmbedding,
  getDimensionInfo,
  registerAlgorithm,
  
  // From the registry
  algorithmRegistry
} = dimensionReduction; 