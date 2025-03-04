/**
 * Sorting Service
 * 
 * Provides utilities for sorting embeddings and suggestions based on specific dimensions
 */

/**
 * Gets the current dimension index for a specific axis
 * 
 * @param {string} axis - The axis (x, y, or z)
 * @param {Object} localDimensionIndices - Local dimension indices from component state
 * @returns {number|null} - The dimension index, or null if not found
 */
export const getDimensionIndexForAxis = (axis) => {
  try {
    const storedDimensionInfo = localStorage.getItem('current-dimension-info');
    if (storedDimensionInfo) {
      const parsedInfo = JSON.parse(storedDimensionInfo);
      if (axis === 'x' && parsedInfo.xDimension !== undefined) {
        return parsedInfo.xDimension;
      } else if (axis === 'y' && parsedInfo.yDimension !== undefined) {
        return parsedInfo.yDimension;
      } else if (axis === 'z' && parsedInfo.zDimension !== undefined) {
        return parsedInfo.zDimension;
      }
    }
  } catch (error) {
    console.error('Error getting dimension index for axis:', error);
  }
  return null;
};

/**
 * Sorts suggestions based on their embedding values for a specific axis dimension
 * 
 * @param {Array} suggestions - Array of suggestion strings
 * @param {Map} suggestionEmbeddings - Map of suggestion strings to embedding vectors
 * @param {string} sortingAxis - Which axis to sort by ('x', 'y', 'z')
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} - Sorted suggestions array
 */
export const sortSuggestionsByAxisDimension = (suggestions, suggestionEmbeddings, sortingAxis, direction) => {
  if (!sortingAxis || !suggestionEmbeddings || !suggestionEmbeddings.size || !suggestions?.length) {
    return suggestions;
  }

  // Get the dimension index for the selected axis
  const dimensionIndex = getDimensionIndexForAxis(sortingAxis);
  
  if (typeof dimensionIndex !== 'number') {
    return suggestions;
  }

  // Filter to suggestions that have embeddings
  const sortableSuggestions = suggestions.filter(sugg => suggestionEmbeddings.has(sugg));
  const unsortableSuggestions = suggestions.filter(sugg => !suggestionEmbeddings.has(sugg));
  
  // Sort the suggestions with embeddings
  const sortedSuggestions = [...sortableSuggestions].sort((a, b) => {
    const embeddingA = suggestionEmbeddings.get(a);
    const embeddingB = suggestionEmbeddings.get(b);
    
    if (!embeddingA || !embeddingB) return 0;
    
    const valueA = embeddingA[dimensionIndex];
    const valueB = embeddingB[dimensionIndex];
    
    return direction === 'desc' ? valueB - valueA : valueA - valueB;
  });
  
  // Combine sorted suggestions with unsortable ones
  return [...sortedSuggestions, ...unsortableSuggestions];
}; 