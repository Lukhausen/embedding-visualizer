/**
 * Embedding Analysis Service
 * 
 * This service handles the analysis of embeddings for axis labels,
 * including getting embeddings, analyzing them, and finding the best axis labels.
 */
import { toast } from 'react-toastify';
import { getEmbedding } from './openaiService';
import { loadAxisLabelIdeas } from './axisLabelIdeasService';
import logger from '../utils/logger';

// Module name for logging
const MODULE = 'embeddingAnalysisService';

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
  logger.debug(MODULE, 'Saving axis label embeddings to localStorage', {
    count: embeddings?.length || 0
  });

  if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
    logger.warn(MODULE, 'Invalid or empty embeddings array provided to saveAxisLabelEmbeddings');
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
      logger.debug(MODULE, 'Successfully saved axis label embeddings', {
        savedCount: validEmbeddings.length,
        originalCount: embeddings.length
      });
      return true;
    } else {
      logger.warn(MODULE, 'No valid embeddings to save after filtering');
      return false;
    }
  } catch (error) {
    logger.error(MODULE, 'Failed to save axis label embeddings:', error);
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
 * Get embeddings for a list of suggestions with true parallel processing and robust error handling
 * 
 * @param {Array} suggestions - Array of suggestions
 * @param {string} apiKey - OpenAI API key
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Array>} Array of suggestions with embeddings
 */
export const getSuggestionEmbeddings = async (suggestions, apiKey, onProgress = () => {}) => {
  logger.info(MODULE, 'Getting embeddings for suggestions', {
    count: suggestions?.length || 0
  });
  
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    logger.warn(MODULE, 'Empty suggestions array provided');
    throw new Error('Suggestions array is required');
  }
  
  if (!apiKey) {
    logger.error(MODULE, 'No API key provided');
    throw new Error('API key is required');
  }
  
  // Check for cached embeddings
  const cachedEmbeddings = loadAxisLabelEmbeddings();
  const cachedMap = new Map(cachedEmbeddings.map(item => [item.text, item.embedding]));
  logger.debug(MODULE, 'Loaded cached embeddings', { 
    cachedCount: cachedEmbeddings.length 
  });
  
  // Separate suggestions into cached and uncached
  const cachedSuggestions = [];
  const uncachedSuggestions = [];
  
  suggestions.forEach(suggestion => {
    if (cachedMap.has(suggestion)) {
      cachedSuggestions.push({
        text: suggestion,
        embedding: cachedMap.get(suggestion)
      });
    } else {
      uncachedSuggestions.push(suggestion);
    }
  });
  
  // Track progress
  const totalSuggestions = suggestions.length;
  let completed = cachedSuggestions.length;
  
  // Report initial progress with cached items
  onProgress({
    completed,
    total: totalSuggestions,
    progress: (completed / totalSuggestions) * 100,
    successful: cachedSuggestions.length,
    failures: 0
  });
  
  // If all are cached, return immediately
  if (uncachedSuggestions.length === 0) {
    logger.info(MODULE, 'All embeddings found in cache, no API calls needed');
    return cachedSuggestions;
  }
  
  // Process uncached items in truly parallel batches
  const batchSize = 10; // Process 10 at a time to avoid rate limits
  const results = [...cachedSuggestions];
  const failures = [];
  
  // Split uncached suggestions into batches
  const batches = [];
  for (let i = 0; i < uncachedSuggestions.length; i += batchSize) {
    batches.push(uncachedSuggestions.slice(i, i + batchSize));
  }
  
  // Process each batch in parallel
  for (const batch of batches) {
    logger.debug(MODULE, `Processing batch of ${batch.length} suggestions`);
    
    // Create a promise for each suggestion in the batch with timeout
    const batchPromises = batch.map(suggestion => {
      return Promise.race([
        // The embedding request
        (async () => {
          try {
            logger.debug(MODULE, `Fetching embedding for: "${suggestion.substring(0, 30)}..."`);
            const embedding = await getEmbedding(suggestion, apiKey, 1);
            return { success: true, text: suggestion, embedding };
          } catch (error) {
            logger.error(MODULE, `Failed to get embedding for "${suggestion}": ${error.message}`);
            return { success: false, text: suggestion, error: error.message };
          }
        })(),
        
        // The timeout after 5 seconds
        new Promise(resolve => {
          setTimeout(() => {
            logger.warn(MODULE, `Timeout fetching embedding for: "${suggestion.substring(0, 30)}..."`);
            resolve({ success: false, text: suggestion, error: 'Request timed out after 5 seconds' });
          }, 5000);
        })
      ]);
    });
    
    // Wait for all promises in this batch to resolve
    const batchResults = await Promise.all(batchPromises);
    
    // Process the results
    batchResults.forEach(result => {
      completed++;
      
      if (result.success) {
        results.push({ 
          text: result.text, 
          embedding: result.embedding 
        });
      } else {
        failures.push({ 
          text: result.text, 
          error: result.error 
        });
      }
      
      // Update progress after each item
      onProgress({
        completed,
        total: totalSuggestions,
        progress: (completed / totalSuggestions) * 100,
        successful: results.length,
        failures: failures.length
      });
    });
  }
  
  // Log the final results
  logger.info(MODULE, 'Completed getting embeddings', {
    total: totalSuggestions,
    successful: results.length - cachedSuggestions.length,
    fromCache: cachedSuggestions.length,
    failed: failures.length
  });
  
  // Save successful results to cache
  if (results.length > cachedSuggestions.length) {
    logger.debug(MODULE, 'Saving new embeddings to cache');
    saveAxisLabelEmbeddings(results);
  }
  
  // As long as we have at least 3 embeddings, consider it a success
  if (results.length >= 3) {
    logger.info(MODULE, `Returning ${results.length} embeddings (${failures.length} failed)`);
    return results;
  } else {
    logger.error(MODULE, `Not enough embeddings obtained: ${results.length} (need at least 3)`);
    throw new Error(`Not enough embeddings: got ${results.length}, need at least 3`);
  }
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
 * @param {number} options.labelsPerAxis - Number of labels per axis (ignored, always uses 2)
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onComplete - Callback when complete
 * @returns {Promise<Object>} Object with best labels and additional labels
 */
export const analyzeEmbeddingsForAxisLabels = async ({
  suggestions,
  algorithmId,
  labelsPerAxis = 2, // Parameter is ignored, always uses 2
  onProgress = () => {},
  onComplete = () => {}
}) => {
  // Input validation with softer errors
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    logger.warn(MODULE, 'No suggestions available for analysis');
    toast.warning('No suggestions available. Generate suggestions first.');
    return null;
  }
  
  if (!algorithmId) {
    logger.warn(MODULE, 'No algorithm ID provided');
    toast.warning('No dimension reduction algorithm specified');
    return null;
  }
  
  // Get API key
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    logger.warn(MODULE, 'No API key found');
    toast.warning('Please add your OpenAI API key in settings');
    return null;
  }
  
  try {
    // Get saved embeddings for words
    const savedWords = localStorage.getItem('embedding-words');
    if (!savedWords) {
      logger.warn(MODULE, 'No word embeddings found');
      toast.warning('No embeddings found. Add some words first.');
      return null;
    }
    
    // Parse word embeddings with error handling
    let parsedWords = [];
    try {
      parsedWords = JSON.parse(savedWords);
    } catch (error) {
      logger.error(MODULE, 'Error parsing saved words', error);
      toast.error('Error reading saved words');
      // Continue with empty array
    }
    
    const wordsWithEmbeddings = parsedWords.filter(w => w && w.embedding);
    
    if (wordsWithEmbeddings.length < 3) {
      logger.warn(MODULE, `Only ${wordsWithEmbeddings.length} words with embeddings found (need at least 3)`);
      toast.warning(`Not enough words with embeddings (need at least 3, found ${wordsWithEmbeddings.length})`);
      return null;
    }
    
    // Get embeddings for all suggestions - with progress updates
    let suggestionEmbeddings = [];
    try {
      logger.info(MODULE, 'Getting embeddings for suggestions', { count: suggestions.length });
      suggestionEmbeddings = await getSuggestionEmbeddings(
        suggestions,
        apiKey,
        onProgress
      );
    } catch (error) {
      // Check if we have cached embeddings that might be usable
      logger.error(MODULE, 'Error getting suggestion embeddings, checking cache', error);
      const cachedEmbeddings = loadAxisLabelEmbeddings();
      
      if (cachedEmbeddings.length >= 3) {
        // If we have enough cached embeddings, use those instead of failing
        logger.info(MODULE, `Using ${cachedEmbeddings.length} cached embeddings as fallback`);
        toast.info(`Using cached embeddings as fallback (${cachedEmbeddings.length} available)`);
        suggestionEmbeddings = cachedEmbeddings;
      } else {
        // Really not enough embeddings to continue
        logger.error(MODULE, 'Not enough cached embeddings to continue', { 
          count: cachedEmbeddings.length 
        });
        toast.error('Could not get enough embeddings. Please try again.');
        return null;
      }
    }
    
    if (suggestionEmbeddings.length < 3) {
      logger.error(MODULE, `Only ${suggestionEmbeddings.length} suggestion embeddings found (need at least 3)`);
      toast.error('Not enough suggestion embeddings to analyze.');
      return null;
    }
    
    // Get dimension indices
    let dimensionIndicesObj = null;
    try {
      const wordEmbeddings = wordsWithEmbeddings.map(w => w.embedding);
      dimensionIndicesObj = await getDimensionIndices(wordEmbeddings, algorithmId);
    } catch (error) {
      logger.error(MODULE, 'Error getting dimension indices', error);
      toast.error('Could not analyze dimensions. Try a different algorithm.');
      return null;
    }
    
    if (!dimensionIndicesObj) {
      logger.warn(MODULE, 'No dimension indices obtained');
      toast.warning('Could not determine dimension indices. Try a different algorithm.');
      return null;
    }
    
    // Convert dimension indices to a format easier for the UI to use
    const uiDimensionIndices = {
      x: dimensionIndicesObj.xDimensionIndex,
      y: dimensionIndicesObj.yDimensionIndex,
      z: dimensionIndicesObj.zDimensionIndex
    };
    
    // Find the best axis labels - always use 2 labels per axis
    let result = null;
    try {
      result = findBestAxisLabels(
        suggestionEmbeddings,
        dimensionIndicesObj,
        2 // Always use 2 labels per axis
      );
    } catch (error) {
      logger.error(MODULE, 'Error finding best axis labels', error);
      
      // Create fallback labels as a last resort
      const fallbackLabels = {
        bestLabels: {
          x: 'X',
          y: 'Y',
          z: 'Z',
          negX: '-X',
          negY: '-Y',
          negZ: '-Z'
        },
        additionalLabels: {
          x: [], y: [], z: [],
          negX: [], negY: [], negZ: []
        }
      };
      
      // Try to populate with some data if possible
      if (suggestionEmbeddings.length > 0) {
        if (suggestionEmbeddings[0]) fallbackLabels.bestLabels.x = suggestionEmbeddings[0].text;
        if (suggestionEmbeddings[1]) fallbackLabels.bestLabels.y = suggestionEmbeddings[1].text;
        if (suggestionEmbeddings[2]) fallbackLabels.bestLabels.z = suggestionEmbeddings[2].text;
        
        const lastIndex = suggestionEmbeddings.length - 1;
        if (suggestionEmbeddings[lastIndex]) fallbackLabels.bestLabels.negZ = suggestionEmbeddings[lastIndex].text;
        if (suggestionEmbeddings[lastIndex-1]) fallbackLabels.bestLabels.negY = suggestionEmbeddings[lastIndex-1].text;
        if (suggestionEmbeddings[lastIndex-2]) fallbackLabels.bestLabels.negX = suggestionEmbeddings[lastIndex-2].text;
      }
      
      toast.warning('Using basic axis labels due to analysis error');
      result = fallbackLabels;
    }
    
    // Save additional labels to localStorage
    try {
      localStorage.setItem(AXIS_ADDITIONAL_LABELS_KEY, JSON.stringify(result.additionalLabels));
    } catch (error) {
      logger.error(MODULE, 'Error saving additional labels', error);
      // Non-fatal error, continue
    }
    
    // Include the suggestionEmbeddings and dimension indices in the result
    const finalResult = {
      ...result,
      suggestionEmbeddings,
      dimensionIndices: uiDimensionIndices
    };
    
    // Call complete callback
    if (onComplete) {
      try {
        onComplete(finalResult);
      } catch (error) {
        logger.error(MODULE, 'Error in onComplete callback', error);
        // Non-fatal error, continue
      }
    }
    
    return finalResult;
  } catch (error) {
    logger.error(MODULE, 'Unexpected error in analyzeEmbeddingsForAxisLabels', error);
    
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
 * @param {number} labelsPerAxis - Number of labels per axis (ignored, always uses 2)
 * @returns {Promise<Object|null>} Result object or null
 */
export const autoUpdateAxisLabels = async (algorithmId, labelsPerAxis = 2) => {
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
          return continueWithAxisLabelUpdate(newSuggestions, wordsWithEmbeddings, algorithmId, 2);
        }
      } catch (error) {
        console.error('Error generating new label ideas:', error);
      }
      
      // If we can't generate new suggestions, continue with what we have if possible
      if (cachedSuggestions && cachedSuggestions.length >= 3) {
        return continueWithAxisLabelUpdate(cachedSuggestions, wordsWithEmbeddings, algorithmId, 2);
      }
      
      return null;
    }
    
    return continueWithAxisLabelUpdate(cachedSuggestions, wordsWithEmbeddings, algorithmId, 2);
  } catch (error) {
    console.error('Error in autoUpdateAxisLabels:', error);
    return null;
  }
};

// Helper function to continue with axis label update once we have suggestions
const continueWithAxisLabelUpdate = async (suggestions, wordsWithEmbeddings, algorithmId, labelsPerAxis = 2) => {
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
    
    // Find the best axis labels - always use 2 labels per axis
    const result = findBestAxisLabels(
      suggestionEmbeddingsArray,
      dimensionIndicesObj,
      2 // Always use 2 labels per axis
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
    saveAxisLabels(enhancedLabels, 2);
    
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
 * With improved error handling and fallback capabilities
 * 
 * @param {string} algorithmId - Current dimension reduction algorithm ID
 * @param {number} labelsPerAxis - Number of labels per axis (ignored, always uses 2)
 * @param {Function} onComplete - Callback when complete
 * @returns {Promise<Object>} Result object with best labels, or default labels if failed
 */
export const refreshLabelsFromCache = async (algorithmId, labelsPerAxis = 2, onComplete = () => {}) => {
  logger.info(MODULE, 'Refreshing axis labels from cache', { algorithmId });
  
  // Always have default labels as fallback
  const defaultLabels = {
    x: 'X',
    y: 'Y',
    z: 'Z',
    negX: '-X',
    negY: '-Y',
    negZ: '-Z'
  };
  
  try {
    if (!algorithmId) {
      logger.warn(MODULE, 'No algorithm ID provided for refreshing axis labels');
      return defaultLabels; // Return default labels instead of null
    }

    // Load cached axis label suggestions
    logger.debug(MODULE, 'Loading cached axis label suggestions');
    const cachedSuggestions = loadAxisLabelIdeas();
    logger.debug(MODULE, 'Cached suggestions loaded', { count: cachedSuggestions?.length });
    
    // Load cached embeddings
    logger.debug(MODULE, 'Loading cached embeddings');
    const cachedEmbeddings = loadAxisLabelEmbeddings();
    logger.debug(MODULE, 'Cached embeddings loaded', { count: cachedEmbeddings?.length });

    // If we don't have enough cached data, use defaults but don't fail
    if (!cachedSuggestions || cachedSuggestions.length < 3 || !cachedEmbeddings || cachedEmbeddings.length < 3) {
      logger.warn(MODULE, 'Not enough cached data for axis label refresh', { 
        suggestionsCount: cachedSuggestions?.length || 0,
        embeddingsCount: cachedEmbeddings?.length || 0
      });
      
      // Try to use whatever we have
      if (cachedEmbeddings && cachedEmbeddings.length > 0) {
        let result = {};
        
        // Use the first few embeddings for basic label assignment
        if (cachedEmbeddings[0]) result.x = cachedEmbeddings[0].text;
        if (cachedEmbeddings[1]) result.y = cachedEmbeddings[1].text;
        if (cachedEmbeddings[2]) result.z = cachedEmbeddings[2].text;
        
        // If we have more, use them for negative axes
        const lastIndex = cachedEmbeddings.length - 1;
        if (cachedEmbeddings[lastIndex]) result.negZ = cachedEmbeddings[lastIndex].text;
        if (cachedEmbeddings.length > 1 && cachedEmbeddings[lastIndex-1]) result.negY = cachedEmbeddings[lastIndex-1].text;
        if (cachedEmbeddings.length > 2 && cachedEmbeddings[lastIndex-2]) result.negX = cachedEmbeddings[lastIndex-2].text;
        
        // Fill in any missing values with defaults
        const enhancedLabels = {
          ...defaultLabels,
          ...result
        };
        
        // Call onComplete with the partial result
        if (onComplete) {
          onComplete({
            bestLabels: enhancedLabels,
            additionalLabels: {
              x: [], y: [], z: [],
              negX: [], negY: [], negZ: []
            },
            dimensionIndices: { x: 0, y: 1, z: 2 }
          });
        }
        
        return enhancedLabels;
      }
      
      // If we can't even create partial labels, return defaults
      if (onComplete) {
        onComplete({
          bestLabels: defaultLabels,
          additionalLabels: {
            x: [], y: [], z: [],
            negX: [], negY: [], negZ: []
          },
          dimensionIndices: { x: 0, y: 1, z: 2 }
        });
      }
      
      return defaultLabels;
    }

    // Filter suggestion embeddings to match cached suggestions
    logger.debug(MODULE, 'Filtering suggestion embeddings to match cached suggestions');
    const suggestionEmbeddingsArray = cachedEmbeddings.filter(item =>
      item && item.text && cachedSuggestions.includes(item.text)
    );
    
    // Check if we have enough embeddings after filtering
    if (suggestionEmbeddingsArray.length < 3) {
      logger.warn(MODULE, 'Not enough matching embeddings after filtering', { 
        filteredCount: suggestionEmbeddingsArray.length 
      });
      
      // Use whatever embeddings we have, even if they don't match suggestions
      const usableEmbeddings = cachedEmbeddings.length >= 3 ? cachedEmbeddings : suggestionEmbeddingsArray;
      
      let result = {};
      
      // Use the first few embeddings for basic label assignment
      if (usableEmbeddings[0]) result.x = usableEmbeddings[0].text;
      if (usableEmbeddings[1]) result.y = usableEmbeddings[1].text;
      if (usableEmbeddings[2]) result.z = usableEmbeddings[2].text;
      
      // If we have more, use them for negative axes
      const lastIndex = usableEmbeddings.length - 1;
      if (usableEmbeddings[lastIndex]) result.negZ = usableEmbeddings[lastIndex].text;
      if (usableEmbeddings.length > 1 && usableEmbeddings[lastIndex-1]) result.negY = usableEmbeddings[lastIndex-1].text;
      if (usableEmbeddings.length > 2 && usableEmbeddings[lastIndex-2]) result.negX = usableEmbeddings[lastIndex-2].text;
      
      // Fill in any missing values with defaults
      const enhancedLabels = {
        ...defaultLabels,
        ...result
      };
      
      // Call onComplete with the partial result
      if (onComplete) {
        onComplete({
          bestLabels: enhancedLabels,
          additionalLabels: {
            x: [], y: [], z: [],
            negX: [], negY: [], negZ: []
          },
          dimensionIndices: { x: 0, y: 1, z: 2 }
        });
      }
      
      return enhancedLabels;
    }

    // Get saved embeddings for words
    logger.debug(MODULE, 'Loading saved word embeddings');
    const savedWords = localStorage.getItem('embedding-words');
    
    if (!savedWords) {
      logger.warn(MODULE, 'No word embeddings found, using filtered suggestion embeddings directly');
      
      // Use suggestion embeddings directly for labels
      let result = {};
      
      if (suggestionEmbeddingsArray[0]) result.x = suggestionEmbeddingsArray[0].text;
      if (suggestionEmbeddingsArray[1]) result.y = suggestionEmbeddingsArray[1].text;
      if (suggestionEmbeddingsArray[2]) result.z = suggestionEmbeddingsArray[2].text;
      
      const lastIndex = suggestionEmbeddingsArray.length - 1;
      if (suggestionEmbeddingsArray[lastIndex]) result.negZ = suggestionEmbeddingsArray[lastIndex].text;
      if (suggestionEmbeddingsArray.length > 1 && suggestionEmbeddingsArray[lastIndex-1]) result.negY = suggestionEmbeddingsArray[lastIndex-1].text;
      if (suggestionEmbeddingsArray.length > 2 && suggestionEmbeddingsArray[lastIndex-2]) result.negX = suggestionEmbeddingsArray[lastIndex-2].text;
      
      const enhancedLabels = {
        ...defaultLabels,
        ...result
      };
      
      // Call onComplete with the basic result
      if (onComplete) {
        onComplete({
          bestLabels: enhancedLabels,
          additionalLabels: {
            x: [], y: [], z: [],
            negX: [], negY: [], negZ: []
          },
          dimensionIndices: { x: 0, y: 1, z: 2 }
        });
      }
      
      return enhancedLabels;
    }

    // Parse word embeddings with error handling
    let parsedWords = [];
    try {
      parsedWords = JSON.parse(savedWords);
    } catch (error) {
      logger.error(MODULE, 'Error parsing saved words', error);
      // Continue with empty array
    }
    
    const wordsWithEmbeddings = parsedWords.filter(w => w && w.embedding);
    
    if (wordsWithEmbeddings.length < 3) {
      logger.warn(MODULE, `Not enough words with embeddings (${wordsWithEmbeddings.length}), using suggestion embeddings`);
      
      // Use suggestion embeddings directly for labels
      let result = {};
      
      if (suggestionEmbeddingsArray[0]) result.x = suggestionEmbeddingsArray[0].text;
      if (suggestionEmbeddingsArray[1]) result.y = suggestionEmbeddingsArray[1].text;
      if (suggestionEmbeddingsArray[2]) result.z = suggestionEmbeddingsArray[2].text;
      
      const lastIndex = suggestionEmbeddingsArray.length - 1;
      if (suggestionEmbeddingsArray[lastIndex]) result.negZ = suggestionEmbeddingsArray[lastIndex].text;
      if (suggestionEmbeddingsArray.length > 1 && suggestionEmbeddingsArray[lastIndex-1]) result.negY = suggestionEmbeddingsArray[lastIndex-1].text;
      if (suggestionEmbeddingsArray.length > 2 && suggestionEmbeddingsArray[lastIndex-2]) result.negX = suggestionEmbeddingsArray[lastIndex-2].text;
      
      const enhancedLabels = {
        ...defaultLabels,
        ...result
      };
      
      // Call onComplete with the basic result
      if (onComplete) {
        onComplete({
          bestLabels: enhancedLabels,
          additionalLabels: {
            x: [], y: [], z: [],
            negX: [], negY: [], negZ: []
          },
          dimensionIndices: { x: 0, y: 1, z: 2 }
        });
      }
      
      return enhancedLabels;
    }

    // Get dimension indices with error handling
    let dimensionIndicesObj = null;
    try {
      logger.debug(MODULE, 'Getting dimension indices');
      const wordEmbeddings = wordsWithEmbeddings.map(w => w.embedding);
      dimensionIndicesObj = await getDimensionIndices(wordEmbeddings, algorithmId);
    } catch (error) {
      logger.error(MODULE, 'Error getting dimension indices', error);
      
      // Use basic dimension indices as fallback
      dimensionIndicesObj = {
        xDimensionIndex: 0,
        yDimensionIndex: 1,
        zDimensionIndex: 2
      };
    }

    if (!dimensionIndicesObj) {
      logger.warn(MODULE, 'Could not determine dimension indices, using defaults');
      dimensionIndicesObj = {
        xDimensionIndex: 0,
        yDimensionIndex: 1,
        zDimensionIndex: 2
      };
    }
    
    // Find the best axis labels
    let bestLabelsResult = null;
    try {
      logger.debug(MODULE, 'Finding best axis labels');
      bestLabelsResult = findBestAxisLabels(
        suggestionEmbeddingsArray,
        dimensionIndicesObj,
        2 // Always use 2 labels per axis
      );
    } catch (error) {
      logger.error(MODULE, 'Error finding best axis labels', error);
      
      // Create basic result as fallback
      bestLabelsResult = {
        bestLabels: {
          ...defaultLabels
        },
        additionalLabels: {
          x: [], y: [], z: [],
          negX: [], negY: [], negZ: []
        }
      };
      
      // Try to populate with some meaningful data
      if (suggestionEmbeddingsArray.length > 0) {
        if (suggestionEmbeddingsArray[0]) bestLabelsResult.bestLabels.x = suggestionEmbeddingsArray[0].text;
        if (suggestionEmbeddingsArray[1]) bestLabelsResult.bestLabels.y = suggestionEmbeddingsArray[1].text;
        if (suggestionEmbeddingsArray[2]) bestLabelsResult.bestLabels.z = suggestionEmbeddingsArray[2].text;
        
        const lastIndex = suggestionEmbeddingsArray.length - 1;
        if (suggestionEmbeddingsArray[lastIndex]) bestLabelsResult.bestLabels.negZ = suggestionEmbeddingsArray[lastIndex].text;
        if (suggestionEmbeddingsArray.length > 1 && suggestionEmbeddingsArray[lastIndex-1]) bestLabelsResult.bestLabels.negY = suggestionEmbeddingsArray[lastIndex-1].text;
        if (suggestionEmbeddingsArray.length > 2 && suggestionEmbeddingsArray[lastIndex-2]) bestLabelsResult.bestLabels.negX = suggestionEmbeddingsArray[lastIndex-2].text;
      }
    }

    // Save additional labels to localStorage
    try {
      logger.debug(MODULE, 'Saving additional labels to localStorage');
      localStorage.setItem(AXIS_ADDITIONAL_LABELS_KEY, JSON.stringify(bestLabelsResult.additionalLabels));
    } catch (error) {
      logger.error(MODULE, 'Error saving additional labels', error);
      // Non-fatal error, continue
    }

    // Create enhanced labels object with negative axes
    const enhancedLabels = {
      ...defaultLabels, // Include defaults as fallback
      ...bestLabelsResult.bestLabels
    };

    // Import the saveAxisLabels function
    try {
      logger.debug(MODULE, 'Importing saveAxisLabels service');
      const { saveAxisLabels } = await import('./axisLabelService');
      saveAxisLabels(enhancedLabels, 2);
      logger.debug(MODULE, 'Axis labels saved', enhancedLabels);
    } catch (error) {
      logger.error(MODULE, 'Error saving axis labels', error);
      // Non-fatal error, continue
    }

    // Set a flag to notify components that axis labels have been updated
    try {
      logger.debug(MODULE, 'Setting axis-labels-updated flag');
      localStorage.setItem('axis-labels-updated', 'true');
    } catch (error) {
      logger.error(MODULE, 'Error setting axis-labels-updated flag', error);
      // Non-fatal error, continue
    }

    // Call onComplete callback with the result
    if (onComplete) {
      try {
        logger.debug(MODULE, 'Calling onComplete callback');
        onComplete({
          bestLabels: enhancedLabels,
          additionalLabels: bestLabelsResult.additionalLabels,
          dimensionIndices: {
            x: dimensionIndicesObj.xDimensionIndex,
            y: dimensionIndicesObj.yDimensionIndex,
            z: dimensionIndicesObj.zDimensionIndex
          }
        });
      } catch (error) {
        logger.error(MODULE, 'Error in onComplete callback', error);
        // Non-fatal error, continue
      }
    }
    
    logger.info(MODULE, 'Axis labels refreshed from cache successfully', enhancedLabels);
    return enhancedLabels;
  } catch (error) {
    logger.error(MODULE, 'Unexpected error refreshing axis labels from cache:', error);
    
    // Return default labels instead of null on error
    if (onComplete) {
      try {
        onComplete({
          bestLabels: defaultLabels,
          additionalLabels: {
            x: [], y: [], z: [],
            negX: [], negY: [], negZ: []
          },
          dimensionIndices: { x: 0, y: 1, z: 2 }
        });
      } catch (innerError) {
        logger.error(MODULE, 'Error in onComplete callback during error handling', innerError);
      }
    }
    
    return defaultLabels;
  }
}; 