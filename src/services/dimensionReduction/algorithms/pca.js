/**
 * Principal Component Analysis (PCA) Algorithm
 * 
 * A simplified implementation of PCA for dimension reduction.
 * 
 * 🔹 What it does:
 *    PCA finds the main patterns in your high-dimensional data and squishes it down 
 *    while keeping the most important information.
 *    It finds the directions (called principal components) where the data varies the most 
 *    and projects it onto those.
 * 
 * 🔹 Example:
 *    Imagine you have 100-dimensional data about different cars (like weight, engine size, 
 *    fuel consumption, etc.). PCA finds the most important 2 features that explain most of 
 *    the differences between cars and gives you a 2D version of the data.
 * 
 * 🔹 How to add your own algorithm:
 *    1. Create a new file in this directory (e.g., myAlgorithm.js)
 *    2. Copy this structure but implement your own reduction logic
 *    3. Export your algorithm as the default export
 *    4. That's it! The system will automatically discover and register your algorithm
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