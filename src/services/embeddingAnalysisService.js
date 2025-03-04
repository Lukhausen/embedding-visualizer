/**
 * Embedding Analysis Service
 * 
 * This service handles the analysis of embeddings for axis labels,
 * including getting embeddings, analyzing them, and finding the best axis labels.
 */
import { toast } from 'react-toastify';
import { getEmbedding } from './openaiService';
import { loadAxisLabelIdeas } from './axisLabelIdeasService';

// Local storage keys
const AXIS_LABEL_EMBEDDINGS_KEY = 'axis-label-embeddings';
const AXIS_ADDITIONAL_LABELS_KEY = 'axis-additional-labels';

/**
 * Load saved axis label embeddings from localStorage
 * 
 * @returns {Array} Array of axis label embeddings
 */
export const loadAxisLabelEmbeddings = () => {
  try {
    const savedEmbeddings = localStorage.getItem(AXIS_LABEL_EMBEDDINGS_KEY);
    if (savedEmbeddings) {
      const parsed = JSON.parse(savedEmbeddings);
      if (Array.isArray(parsed)) {
        // Validate each item has text and embedding
        return parsed.filter(item => 
          item && 
          typeof item === 'object' && 
          item.text && 
          Array.isArray(item.embedding)
        );
      }
    }
  } catch (error) {
    console.error('Failed to load axis label embeddings:', error);
  }
  
  return [];
};

/**
 * Save axis label embeddings to localStorage
 * 
 * @param {Array} embeddings - Array of axis label embeddings
 * @returns {boolean} Success status
 */
export const saveAxisLabelEmbeddings = (embeddings) => {
  if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
    console.error('Invalid embeddings provided to saveAxisLabelEmbeddings');
    return false;
  }

  try {
    // Validate and filter embeddings to ensure they have text and embedding
    const validEmbeddings = embeddings.filter(item => 
      item && 
      typeof item === 'object' && 
      item.text && 
      Array.isArray(item.embedding)
    );

    // If we have any valid embeddings after filtering
    if (validEmbeddings.length > 0) {
      localStorage.setItem(AXIS_LABEL_EMBEDDINGS_KEY, JSON.stringify(validEmbeddings));
      return true;
    } else {
      console.warn('No valid embeddings to save');
      return false;
    }
  } catch (error) {
    console.error('Failed to save axis label embeddings:', error);
    return false;
  }
};

/**
 * Get dimension indices for the current algorithm
 * 
 * @param {Array} embeddings - Array of embeddings
 * @param {string} algorithmId - Algorithm ID
 * @returns {Promise<Object>} Object with xDimensionIndex, yDimensionIndex, zDimensionIndex
 */
const getDimensionIndices = async (embeddings, algorithmId) => {
  if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error('Embeddings array is required');
  }
  
  if (!algorithmId) {
    throw new Error('Algorithm ID is required');
  }
  
  // Try to use stored dimension info first
  const storedDimensionInfo = localStorage.getItem('current-dimension-info');
  if (storedDimensionInfo) {
    try {
      const parsedInfo = JSON.parse(storedDimensionInfo);
      // Validate that we have all the required dimensions
      if (typeof parsedInfo.xDimension === 'number' && 
          typeof parsedInfo.yDimension === 'number' && 
          typeof parsedInfo.zDimension === 'number') {
        return {
          xDimensionIndex: parsedInfo.xDimension,
          yDimensionIndex: parsedInfo.yDimension,
          zDimensionIndex: parsedInfo.zDimension
        };
      }
    } catch (e) {
      console.error('Error parsing stored dimension info:', e);
    }
  }
  
  // If no stored info, calculate from scratch
  try {
    const { applyDimensionReduction } = await import('./dimensionReduction');
    const reductionResult = applyDimensionReduction(embeddings, algorithmId);
    
    if (!reductionResult?.indices || !Array.isArray(reductionResult.indices) || reductionResult.indices.length < 3) {
      throw new Error('Could not analyze the current visualization dimensions');
    }
    
    return {
      xDimensionIndex: reductionResult.indices[0],
      yDimensionIndex: reductionResult.indices[1],
      zDimensionIndex: reductionResult.indices[2]
    };
  } catch (error) {
    console.error('Error getting dimension indices:', error);
    throw error;
  }
};

/**
 * Get embeddings for a list of suggestions
 * 
 * @param {Array} suggestions - Array of suggestions
 * @param {string} apiKey - OpenAI API key
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Array>} Array of suggestions with embeddings
 */
export const getSuggestionEmbeddings = async (suggestions, apiKey, onProgress = () => {}) => {
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('Suggestions array is required');
  }
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  // Check for cached embeddings
  const cachedEmbeddings = loadAxisLabelEmbeddings();
  const cachedMap = new Map(cachedEmbeddings.map(item => [item.text, item.embedding]));
  
  // Prepare promises array
  const suggestionPromises = suggestions.map(async (suggestion, index) => {
    try {
      // Check if we already have this embedding cached
      if (cachedMap.has(suggestion)) {
        // If cached, use it without making an API call
        const embedding = cachedMap.get(suggestion);
        
        // Update progress
        onProgress({
          completed: index + 1,
          total: suggestions.length,
          progress: ((index + 1) / suggestions.length) * 100
        });
        
        return { text: suggestion, embedding };
      }
      
      // Get embedding from API
      const embedding = await getEmbedding(suggestion, apiKey);
      
      // Update progress
      onProgress({
        completed: index + 1,
        total: suggestions.length,
        progress: ((index + 1) / suggestions.length) * 100
      });
      
      return { text: suggestion, embedding };
    } catch (error) {
      console.error(`Error getting embedding for "${suggestion}":`, error);
      
      // Still update progress even on error
      onProgress({
        completed: index + 1,
        total: suggestions.length,
        progress: ((index + 1) / suggestions.length) * 100
      });
      
      // If this is an API error, show helpful message
      if (error.message.includes('API')) {
        toast.error(`API Error: ${error.message}. Check your API key and connection.`);
      }
      
      return null;
    }
  });
  
  // Wait for all promises to complete
  const results = await Promise.all(suggestionPromises);
  
  // Filter out null results
  return results.filter(result => result !== null);
};

/**
 * Find the best axis labels from a list of suggestions with embeddings
 * 
 * @param {Array} suggestionEmbeddings - Array of suggestions with embeddings
 * @param {Object} dimensionIndices - Object with dimension indices
 * @param {number} labelsPerAxis - Number of labels per axis
 * @returns {Object} Object with best labels and additional labels
 */
const findBestAxisLabels = (suggestionEmbeddings, dimensionIndices, labelsPerAxis) => {
  if (!suggestionEmbeddings || !Array.isArray(suggestionEmbeddings) || suggestionEmbeddings.length === 0) {
    throw new Error('Suggestion embeddings array is required');
  }
  
  if (!dimensionIndices || typeof dimensionIndices !== 'object') {
    throw new Error('Dimension indices object is required');
  }
  
  const { xDimensionIndex, yDimensionIndex, zDimensionIndex } = dimensionIndices;
  
  // Validate dimension indices
  if (typeof xDimensionIndex !== 'number' || 
      typeof yDimensionIndex !== 'number' || 
      typeof zDimensionIndex !== 'number') {
    throw new Error('Invalid dimension indices');
  }
  
  // Ensure labelsPerAxis is a valid number
  const numLabelsPerAxis = parseInt(labelsPerAxis) || 1;
  
  // Sort suggestions by embedding values for each axis (highest to lowest)
  const xAxisSuggestionsSorted = [...suggestionEmbeddings].sort((a, b) => 
    b.embedding[xDimensionIndex] - a.embedding[xDimensionIndex]
  );
  
  const yAxisSuggestionsSorted = [...suggestionEmbeddings].sort((a, b) => 
    b.embedding[yDimensionIndex] - a.embedding[yDimensionIndex]
  );
  
  const zAxisSuggestionsSorted = [...suggestionEmbeddings].sort((a, b) => 
    b.embedding[zDimensionIndex] - a.embedding[zDimensionIndex]
  );
  
  // Get the positive (highest value) labels for each axis
  const positiveLabels = {
    x: xAxisSuggestionsSorted[0]?.text || 'X',
    y: yAxisSuggestionsSorted[0]?.text || 'Y',
    z: zAxisSuggestionsSorted[0]?.text || 'Z'
  };
  
  // Get the negative (lowest value) labels for each axis
  const negativeLabels = {
    x: xAxisSuggestionsSorted[xAxisSuggestionsSorted.length - 1]?.text || '-X',
    y: yAxisSuggestionsSorted[yAxisSuggestionsSorted.length - 1]?.text || '-Y',
    z: zAxisSuggestionsSorted[zAxisSuggestionsSorted.length - 1]?.text || '-Z'
  };
  
  // Combine into a single structure
  const bestLabels = {
    x: positiveLabels.x,
    y: positiveLabels.y,
    z: positiveLabels.z,
    negX: negativeLabels.x,
    negY: negativeLabels.y,
    negZ: negativeLabels.z
  };
  
  // Get additional labels for each axis (for intermediate points if needed)
  // Taking from both ends of the sorted arrays to represent the spectrum
  const additionalLabels = {
    x: xAxisSuggestionsSorted.slice(1, numLabelsPerAxis).map(item => item.text),
    y: yAxisSuggestionsSorted.slice(1, numLabelsPerAxis).map(item => item.text),
    z: zAxisSuggestionsSorted.slice(1, numLabelsPerAxis).map(item => item.text),
    negX: xAxisSuggestionsSorted.slice(-numLabelsPerAxis, -1).map(item => item.text).reverse(),
    negY: yAxisSuggestionsSorted.slice(-numLabelsPerAxis, -1).map(item => item.text).reverse(),
    negZ: zAxisSuggestionsSorted.slice(-numLabelsPerAxis, -1).map(item => item.text).reverse()
  };
  
  return { bestLabels, additionalLabels };
};

/**
 * Analyze embeddings to find the best axis labels
 * 
 * @param {Object} options - Options for analyzing embeddings
 * @param {Array} options.suggestions - Array of suggestions to analyze
 * @param {string} options.algorithmId - Algorithm ID
 * @param {number} options.labelsPerAxis - Number of labels per axis
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onComplete - Callback when complete
 * @returns {Promise<Object>} Object with best labels and additional labels
 */
export const analyzeEmbeddingsForAxisLabels = async ({
  suggestions,
  algorithmId,
  labelsPerAxis = 1,
  onProgress = () => {},
  onComplete = () => {}
}) => {
  // Input validation
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    toast.warning('No suggestions available. Generate suggestions first.');
    return null;
  }
  
  if (!algorithmId) {
    toast.error('No dimension reduction algorithm specified');
    return null;
  }
  
  // Get API key
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    toast.error('Please add your OpenAI API key in settings first');
    return null;
  }
  
  try {
    // Get saved embeddings for words
    const savedWords = localStorage.getItem('embedding-words');
    if (!savedWords) {
      toast.warning('No embeddings found. Add some words first.');
      return null;
    }
    
    const parsedWords = JSON.parse(savedWords);
    const wordsWithEmbeddings = parsedWords.filter(w => w.embedding);
    
    if (wordsWithEmbeddings.length < 3) {
      toast.error(`Not enough words with embeddings found (need at least 3, found ${wordsWithEmbeddings.length})`);
      return null;
    }
    
    // Get embeddings for all suggestions - with progress updates
    const suggestionEmbeddings = await getSuggestionEmbeddings(
      suggestions,
      apiKey,
      onProgress
    );
    
    if (suggestionEmbeddings.length === 0) {
      toast.error('Could not get embeddings for suggestions. Please try again.');
      return null;
    }
    
    // Get dimension indices
    const wordEmbeddings = wordsWithEmbeddings.map(w => w.embedding);
    const dimensionIndicesObj = await getDimensionIndices(wordEmbeddings, algorithmId);
    
    if (!dimensionIndicesObj) {
      toast.error('Could not determine dimension indices. Try a different algorithm.');
      return null;
    }
    
    // Convert dimension indices to a format easier for the UI to use
    const uiDimensionIndices = {
      x: dimensionIndicesObj.xDimensionIndex,
      y: dimensionIndicesObj.yDimensionIndex,
      z: dimensionIndicesObj.zDimensionIndex
    };
    
    // Find the best axis labels
    const result = findBestAxisLabels(
      suggestionEmbeddings,
      dimensionIndicesObj,
      labelsPerAxis
    );
    
    // Save additional labels to localStorage
    localStorage.setItem(AXIS_ADDITIONAL_LABELS_KEY, JSON.stringify(result.additionalLabels));
    
    // Include the suggestionEmbeddings and dimension indices in the result
    const finalResult = {
      ...result,
      suggestionEmbeddings,
      dimensionIndices: uiDimensionIndices
    };
    
    // Call complete callback
    if (onComplete) {
      onComplete(finalResult);
    }
    
    return finalResult;
  } catch (error) {
    console.error('Error analyzing embeddings for axis labels:', error);
    
    // Show different error messages depending on the error
    if (error.message.includes('dimension')) {
      toast.error('Could not analyze dimensions. Try a different algorithm.');
    } else if (error.message.includes('API')) {
      toast.error('API error. Check your API key and connection.');
    } else {
      toast.error(`Error: ${error.message}`);
    }
    
    return null;
  }
};

/**
 * Analyzes embeddings for axis labels with clearer flag handling
 * 
 * @param {string} algorithmId - Current algorithm ID
 * @param {number} labelsPerAxis - Number of labels per axis
 * @returns {Promise<Object|null>} Result object or null
 */
export const autoUpdateAxisLabels = async (algorithmId, labelsPerAxis = 1) => {
  // Check for update triggers
  const shouldUpdate = localStorage.getItem('force-axis-label-update') === 'true';
  const embedsUpdated = localStorage.getItem('embeddings-updated') === 'true';
  
  // Only proceed if explicitly requested
  if (!shouldUpdate && !embedsUpdated) {
    return null;
  }
  
  // Clear flags
  localStorage.removeItem('force-axis-label-update');
  localStorage.removeItem('embeddings-updated');
  
  if (!algorithmId) {
    console.warn('No algorithm ID provided for auto-updating axis labels');
    return null;
  }
  
  try {
    // Load cached axis label suggestions
    const cachedSuggestions = loadAxisLabelIdeas();
    
    // Get saved embeddings for words
    const savedWords = localStorage.getItem('embedding-words');
    if (!savedWords) {
      console.log('No word embeddings found for auto-updating axis labels');
      return null;
    }
    
    const parsedWords = JSON.parse(savedWords);
    const wordsWithEmbeddings = parsedWords.filter(w => w.embedding);
    
    if (wordsWithEmbeddings.length < 3) {
      console.log(`Not enough words with embeddings (${wordsWithEmbeddings.length}) for auto-updating axis labels`);
      return null;
    }
    
    // Check if we need to generate new label ideas (if we don't have enough suggestions or if suggestions exist but are too few)
    if (!cachedSuggestions || cachedSuggestions.length < 3) {
      console.log('Not enough cached suggestions for auto-updating axis labels, will generate new ones');
      
      // Get OpenAI API key
      const apiKey = localStorage.getItem('openai-api-key');
      if (!apiKey) {
        console.log('No API key found, cannot generate new suggestions');
        return null;
      }
      
      try {
        // Generate new label ideas based on the words
        const { generateAxisLabelIdeas, saveAxisLabelIdeas } = await import('./axisLabelIdeasService');
        const wordTexts = wordsWithEmbeddings.map(w => w.text);
        const newSuggestions = await generateAxisLabelIdeas(wordTexts, apiKey);
        
        if (newSuggestions && newSuggestions.length > 0) {
          // Save the new suggestions
          saveAxisLabelIdeas(newSuggestions);
          
          // Load the embeddings for the new suggestions
          const { getSuggestionEmbeddings } = await import('./embeddingAnalysisService');
          const suggestionEmbeddings = await getSuggestionEmbeddings(newSuggestions, apiKey);
          
          // Save the embeddings
          saveAxisLabelEmbeddings(suggestionEmbeddings);
          
          // Continue with the rest of the function using the new suggestions
          return continueWithAxisLabelUpdate(newSuggestions, wordsWithEmbeddings, algorithmId, labelsPerAxis);
        }
      } catch (error) {
        console.error('Error generating new label ideas:', error);
      }
      
      // If we can't generate new suggestions, continue with what we have if possible
      if (cachedSuggestions && cachedSuggestions.length >= 3) {
        return continueWithAxisLabelUpdate(cachedSuggestions, wordsWithEmbeddings, algorithmId, labelsPerAxis);
      }
      
      return null;
    }
    
    return continueWithAxisLabelUpdate(cachedSuggestions, wordsWithEmbeddings, algorithmId, labelsPerAxis);
  } catch (error) {
    console.error('Error in autoUpdateAxisLabels:', error);
    return null;
  }
};

// Helper function to continue with axis label update once we have suggestions
const continueWithAxisLabelUpdate = async (suggestions, wordsWithEmbeddings, algorithmId, labelsPerAxis) => {
  try {
    // Load cached embeddings
    const cachedEmbeddings = loadAxisLabelEmbeddings();
    
    // Fix the filtering of suggestion embeddings
    const suggestionEmbeddingsArray = cachedEmbeddings.filter(item => 
      item && item.text && suggestions.includes(item.text)
    );
    
    // Check if we have enough embeddings
    if (suggestionEmbeddingsArray.length < 3) {
      console.log('Not enough cached embeddings for auto-updating axis labels');
      return null;
    }
    
    // Get dimension indices
    const wordEmbeddings = wordsWithEmbeddings.map(w => w.embedding);
    const dimensionIndicesObj = await getDimensionIndices(wordEmbeddings, algorithmId);
    
    if (!dimensionIndicesObj) {
      console.log('Could not determine dimension indices for auto-updating axis labels');
      return null;
    }
    
    // Find the best axis labels
    const result = findBestAxisLabels(
      suggestionEmbeddingsArray,
      dimensionIndicesObj,
      labelsPerAxis
    );
    
    // Save additional labels to localStorage
    localStorage.setItem(AXIS_ADDITIONAL_LABELS_KEY, JSON.stringify(result.additionalLabels));
    
    // Save axis labels to localStorage
    const enhancedLabels = {
      x: result.bestLabels.x,
      y: result.bestLabels.y,
      z: result.bestLabels.z,
      negX: result.bestLabels.negX,
      negY: result.bestLabels.negY,
      negZ: result.bestLabels.negZ
    };
    
    // Import the saveAxisLabels function
    const { saveAxisLabels } = await import('./axisLabelService');
    saveAxisLabels(enhancedLabels, labelsPerAxis);
    
    // Set a flag to notify components that axis labels have been updated
    localStorage.setItem('axis-labels-updated', 'true');
    
    return enhancedLabels;
  } catch (error) {
    console.error('Error in continueWithAxisLabelUpdate:', error);
    return null;
  }
};

/**
 * Refreshes axis labels using only cached data (no API calls)
 * 
 * @param {string} algorithmId - Current dimension reduction algorithm ID
 * @param {number} labelsPerAxis - Number of labels to show per axis
 * @param {Function} onComplete - Callback when complete
 * @returns {Promise<Object>} Result object with best labels, or null if failed
 */
export const refreshLabelsFromCache = async (algorithmId, labelsPerAxis = 1, onComplete = () => {}) => {
  if (!algorithmId) {
    console.warn('No algorithm ID provided for refreshing axis labels');
    return null;
  }

  try {
    // Load cached axis label suggestions
    const cachedSuggestions = loadAxisLabelIdeas();
    if (!cachedSuggestions || cachedSuggestions.length < 3) {
      console.log('Not enough cached suggestions for refreshing axis labels');
      return null;
    }
    
    // Load cached embeddings
    const cachedEmbeddings = loadAxisLabelEmbeddings();
    
    // Filter suggestion embeddings to match cached suggestions
    const suggestionEmbeddingsArray = cachedEmbeddings.filter(item => 
      item && item.text && cachedSuggestions.includes(item.text)
    );
    
    // Check if we have enough embeddings
    if (suggestionEmbeddingsArray.length < 3) {
      console.log('Not enough cached embeddings for refreshing axis labels');
      return null;
    }
    
    // Get saved embeddings for words
    const savedWords = localStorage.getItem('embedding-words');
    if (!savedWords) {
      console.log('No word embeddings found for refreshing axis labels');
      return null;
    }
    
    const parsedWords = JSON.parse(savedWords);
    const wordsWithEmbeddings = parsedWords.filter(w => w.embedding);
    
    if (wordsWithEmbeddings.length < 3) {
      console.log(`Not enough words with embeddings (${wordsWithEmbeddings.length}) for refreshing axis labels`);
      return null;
    }
    
    // Get dimension indices
    const wordEmbeddings = wordsWithEmbeddings.map(w => w.embedding);
    const dimensionIndicesObj = await getDimensionIndices(wordEmbeddings, algorithmId);
    
    if (!dimensionIndicesObj) {
      console.log('Could not determine dimension indices for refreshing axis labels');
      return null;
    }
    
    // Find the best axis labels
    const result = findBestAxisLabels(
      suggestionEmbeddingsArray,
      dimensionIndicesObj,
      labelsPerAxis
    );
    
    // Save additional labels to localStorage
    localStorage.setItem(AXIS_ADDITIONAL_LABELS_KEY, JSON.stringify(result.additionalLabels));
    
    // Create enhanced labels object with negative axes
    const enhancedLabels = {
      x: result.bestLabels.x,
      y: result.bestLabels.y,
      z: result.bestLabels.z,
      negX: result.bestLabels.negX,
      negY: result.bestLabels.negY,
      negZ: result.bestLabels.negZ
    };
    
    // Import the saveAxisLabels function
    const { saveAxisLabels } = await import('./axisLabelService');
    saveAxisLabels(enhancedLabels, labelsPerAxis);
    
    // Set a flag to notify components that axis labels have been updated
    localStorage.setItem('axis-labels-updated', 'true');
    
    // Call onComplete callback with the result
    onComplete({
      bestLabels: enhancedLabels,
      additionalLabels: result.additionalLabels,
      dimensionIndices: {
        x: dimensionIndicesObj.xDimensionIndex,
        y: dimensionIndicesObj.yDimensionIndex,
        z: dimensionIndicesObj.zDimensionIndex
      }
    });
    
    return enhancedLabels;
  } catch (error) {
    console.error('Error refreshing axis labels from cache:', error);
    return null;
  }
}; 