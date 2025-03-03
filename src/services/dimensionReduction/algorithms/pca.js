/**
 * EMBEDDING VISUALIZER PLUGIN SYSTEM
 * ==================================
 * 
 * This file demonstrates how to create a dimension reduction algorithm plugin.
 * The embedding visualizer uses a plugin system that makes it easy to add new
 * dimension reduction algorithms with zero configuration.
 * 
 * ## HOW THE PLUGIN SYSTEM WORKS
 * 
 * 1. Each plugin is a single JavaScript file in the algorithms/ directory
 * 2. The system automatically discovers and registers all plugins in this directory
 * 3. Each plugin must export an object as its default export with the required interface
 * 4. Once registered, the algorithm appears in the UI dropdown for users to select
 * 
 * ## CREATING A NEW PLUGIN
 * 
 * To create a new dimension reduction algorithm:
 * 
 * 1. Create a new file in the src/services/dimensionReduction/algorithms/ directory
 *    Example: myNewAlgorithm.js
 * 
 * 2. Copy this template and modify it with your algorithm implementation:
 * 
 *    ```javascript
 *    const myAlgorithm = {
 *      // A unique identifier (no spaces, use camelCase)
 *      id: 'myUniqueAlgorithmId',
 *      
 *      // Display name shown in the UI
 *      name: 'My New Algorithm',
 *      
 *      // Brief description of how your algorithm works (shown in UI)
 *      description: 'This algorithm maps embeddings to 3D space by...',
 *      
 *      // The main algorithm implementation
 *      reduce: function(embeddings) {
 *        if (!embeddings || embeddings.length === 0) {
 *          return null;
 *        }
 *        
 *        // Your algorithm logic goes here
 *        // ...
 *        
 *        // Return required data structure
 *        return {
 *          // Three dimension indices to use for x, y, z coordinates
 *          indices: [0, 1, 2],
 *          
 *          // Min values for each selected dimension (for scaling)
 *          minValues: [min1, min2, min3],
 *          
 *          // Max values for each selected dimension (for scaling)
 *          maxValues: [max1, max2, max3],
 *          
 *          // Metadata (automatically added but good to include explicitly)
 *          name: this.name,
 *          description: this.description
 *        };
 *      }
 *    };
 *    
 *    export default myAlgorithm;
 *    ```
 * 
 * 3. That's it! Your algorithm will be automatically discovered and registered.
 *    No manual registration is required.
 * 
 * ## IMPLEMENTATION REQUIREMENTS
 * 
 * Your algorithm must:
 * 
 * - Have a unique `id` property (string, no spaces)
 * - Have a user-friendly `name` property (shown in the UI)
 * - Have a `description` property explaining how it works
 * - Implement a `reduce(embeddings)` function that:
 *   - Takes an array of embedding vectors as input
 *   - Returns an object with indices, minValues, maxValues properties
 * 
 * ## HOW PLUGINS ARE DISCOVERED
 * 
 * The system uses Vite's import.meta.glob feature to automatically find and
 * register all algorithm files in the algorithms/ directory. This dynamic
 * import means you don't need to manually register your algorithm anywhere.
 */

const pcaAlgorithm = {
  id: 'pca',
  
  name: 'Principal Component Analysis (PCA)',
  
  description: 'Identifies the dimensions with most variation and projects data onto them',
  
  reduce: function(embeddings) {
    if (!embeddings || embeddings.length === 0) {
      return null;
    }

    // Find the dimensionality of embeddings
    const dimensions = embeddings[0].length;
    
    // Calculate importance of each dimension
    // (sum of absolute values across all embeddings)
    // This is a simplified approach - true PCA would compute eigenvectors
    const dimensionImportance = new Array(dimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        dimensionImportance[i] += Math.abs(embedding[i]);
      }
    }
    
    // Find indices of the three most important dimensions
    const indexedDims = dimensionImportance.map((value, index) => ({ value, index }));
    indexedDims.sort((a, b) => b.value - a.value); // Sort in descending order
    
    const topDimensions = indexedDims.slice(0, 3).map(item => item.index);
    
    // Calculate min/max values for each principal dimension to normalize
    const minValues = [Infinity, Infinity, Infinity];
    const maxValues = [-Infinity, -Infinity, -Infinity];
    
    for (const embedding of embeddings) {
      for (let i = 0; i < 3; i++) {
        const dimIndex = topDimensions[i];
        const value = embedding[dimIndex];
        minValues[i] = Math.min(minValues[i], value);
        maxValues[i] = Math.max(maxValues[i], value);
      }
    }
    
    return {
      indices: topDimensions,
      minValues,
      maxValues,
      name: this.name,
      description: this.description
    };
  }
};

export default pcaAlgorithm; 