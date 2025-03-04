/**
 * Axis Label Generation Workflow Service
 * 
 * This service orchestrates the entire process of generating axis labels:
 * 1. Clearing existing cached labels and embeddings
 * 2. Stage 1: Generating label ideas
 * 3. Stage 2: Getting embeddings and analyzing for best fit
 * 4. Refreshing the UI with the new labels
 */

import { toast } from 'react-toastify';
import { generateAxisLabelIdeas, saveAxisLabelIdeas } from './axisLabelIdeasService';
import { 
  analyzeEmbeddingsForAxisLabels, 
  getSuggestionEmbeddings,
  saveAxisLabelEmbeddings,
  refreshLabelsFromCache
} from './embeddingAnalysisService';
import logger from '../utils/logger';

// Module name for logging
const MODULE = 'axisLabelGenerationWorkflow';

// Local storage keys for cleaning cache
const AXIS_LABEL_IDEAS_KEY = 'axis-label-ideas';
const AXIS_LABEL_EMBEDDINGS_KEY = 'axis-label-embeddings';
const AXIS_ADDITIONAL_LABELS_KEY = 'axis-additional-labels';

/**
 * Clear all cached axis label data
 * 
 * @returns {boolean} Success indicator
 */
export const clearAxisLabelCache = () => {
  logger.info(MODULE, 'Clearing axis label cache');
  try {
    localStorage.removeItem(AXIS_LABEL_IDEAS_KEY);
    localStorage.removeItem(AXIS_LABEL_EMBEDDINGS_KEY);
    localStorage.removeItem(AXIS_ADDITIONAL_LABELS_KEY);
    logger.debug(MODULE, 'Axis label cache cleared successfully');
    return true;
  } catch (error) {
    logger.error(MODULE, 'Error clearing axis label cache:', error);
    return false;
  }
};

/**
 * STAGE 1: Generate axis label ideas based on the provided words
 * 
 * @param {Object} options - Generation options
 * @param {Array} options.words - Words to generate ideas for 
 * @param {number} options.iterationCount - Number of iterations
 * @param {number} options.outputsPerPrompt - Ideas per prompt
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Array>} Generated label ideas
 */
export const stageOne_GenerateIdeas = async ({ 
  words, 
  iterationCount = 1, 
  outputsPerPrompt = 30,
  onProgress = () => {} 
}) => {
  logger.info(MODULE, 'Stage 1: Starting to generate axis label ideas', {
    wordCount: words?.length || 0,
    iterationCount,
    outputsPerPrompt
  });
  
  // Check for API key
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    logger.error(MODULE, 'No OpenAI API key found');
    toast.error('Please add your OpenAI API key in settings first');
    return null;
  }
  
  if (!words || !Array.isArray(words) || words.length === 0) {
    logger.error(MODULE, 'No words provided to generate ideas from');
    toast.warning('No words provided to generate ideas from');
    return null;
  }
  
  try {
    logger.debug(MODULE, 'Initializing Stage 1 progress tracking');
    // Create a counter for completed items - this will track actual completion
    let completedItems = 0;
    const totalItems = iterationCount;
    
    // Progress tracking for UI with item counts
    onProgress({ 
      stage: 1, 
      message: 'Generating axis label ideas...',
      progress: 0,
      currentIteration: 0,
      totalIterations: iterationCount,
      totalItems: totalItems,
      completedItems: completedItems
    });
    
    logger.info(MODULE, 'Calling generateAxisLabelIdeas service', {
      wordCount: words.length,
      iterationCount,
      outputsPerPrompt
    });
    
    // Generate ideas using the existing service
    const suggestions = await generateAxisLabelIdeas({
      words,
      iterationCount,
      outputsPerPrompt,
      onProgress: (progressData) => {
        logger.debug(MODULE, 'Stage 1 progress update received', progressData);
        
        // Instead of relying on currentIteration from the progress data
        // we'll increment our counter when an actual response comes back
        if (progressData.currentIteration > completedItems) {
          completedItems = progressData.currentIteration;
          logger.debug(MODULE, `Updated completedItems to ${completedItems}`);
        }
        
        const progressPercent = (completedItems / totalItems) * 100;
        logger.info(MODULE, `Stage 1 progress: ${completedItems}/${totalItems} (${progressPercent.toFixed(1)}%)`);
        
        // Map the progress to our two-stage workflow with detailed counts
        onProgress({
          stage: 1,
          message: `Generating ideas: ${completedItems}/${totalItems}`,
          progress: progressPercent,
          currentIteration: completedItems,
          totalIterations: totalItems,
          totalItems: totalItems,
          completedItems: completedItems
        });
      }
    });
    
    if (!suggestions || suggestions.length === 0) {
      logger.error(MODULE, 'Failed to generate label ideas');
      toast.error('Failed to generate label ideas');
      return null;
    }
    
    logger.info(MODULE, 'Successfully generated label ideas', {
      count: suggestions.length,
      samples: suggestions.slice(0, 3)
    });
    
    // Save the generated ideas
    logger.debug(MODULE, 'Saving generated ideas to localStorage');
    saveAxisLabelIdeas(suggestions);
    
    // Final progress update to ensure we show 100%
    onProgress({ 
      stage: 1, 
      message: `Generated ${suggestions.length} label ideas`,
      progress: 100,
      complete: true,
      currentIteration: iterationCount,
      totalIterations: iterationCount,
      totalItems: totalItems,
      completedItems: totalItems
    });
    
    logger.info(MODULE, 'Stage 1 completed successfully');
    return suggestions;
  } catch (error) {
    logger.error(MODULE, 'Error in Stage 1 (Generate Ideas):', error);
    toast.error(`Error generating ideas: ${error.message}`);
    return null;
  }
};

/**
 * STAGE 2: Analyze embeddings and find best axis labels
 * 
 * @param {Object} options - Analysis options
 * @param {Array} options.suggestions - Label suggestions to analyze
 * @param {string} options.algorithmId - Current algorithm ID
 * @param {number} options.labelsPerAxis - Number of labels per axis
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} Analysis results with best labels
 */
export const stageTwo_AnalyzeEmbeddings = async ({
  suggestions,
  algorithmId,
  labelsPerAxis = 1,
  onProgress = () => {}
}) => {
  logger.info(MODULE, 'Stage 2: Starting to analyze embeddings', {
    suggestionCount: suggestions?.length || 0,
    algorithmId,
    labelsPerAxis
  });
  
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    logger.error(MODULE, 'No OpenAI API key found');
    toast.error('Please add your OpenAI API key in settings first');
    return null;
  }
  
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    logger.error(MODULE, 'No suggestions available to analyze');
    toast.warning('No suggestions available to analyze');
    return null;
  }
  
  if (!algorithmId) {
    logger.error(MODULE, 'No algorithm ID provided');
    toast.error('No dimension reduction algorithm specified');
    return null;
  }
  
  try {
    logger.debug(MODULE, 'Initializing Stage 2 progress tracking');
    // Create a counter for tracking actual completions, not just expected order
    let completedItems = 0;
    const totalItems = suggestions.length;
    
    // Progress tracking for UI with detailed item counts
    onProgress({ 
      stage: 2, 
      message: 'Getting embeddings for suggestions...',
      progress: 0,
      totalItems: totalItems,
      completedItems: completedItems
    });
    
    logger.info(MODULE, 'Getting embeddings for all suggestions', {
      count: suggestions.length
    });
    
    // Get embeddings for all suggestions
    const suggestionEmbeddings = await getSuggestionEmbeddings(
      suggestions,
      apiKey,
      (progressData) => {
        logger.debug(MODULE, 'Embedding progress update received', progressData);
        
        // Instead of using the index-based progress data, use the actual completed count
        if (progressData.completed > completedItems) {
          completedItems = progressData.completed;
          logger.debug(MODULE, `Updated completedItems to ${completedItems}`);
        }
        
        const progressPercent = (completedItems / totalItems) * 50; // First half of stage 2
        logger.info(MODULE, `Stage 2 (embeddings): ${completedItems}/${totalItems} (${progressPercent.toFixed(1)}%)`);
        
        // Map progress to our two-stage workflow with accurate counts
        onProgress({
          stage: 2,
          message: `Getting embeddings: ${completedItems}/${totalItems}`,
          progress: progressPercent,
          totalItems: totalItems,
          completedItems: completedItems
        });
      }
    );
    
    if (!suggestionEmbeddings || suggestionEmbeddings.length === 0) {
      logger.error(MODULE, 'Failed to get embeddings for suggestions', {
        received: suggestionEmbeddings ? suggestionEmbeddings.length : 0,
        expected: suggestions.length
      });
      toast.error('Failed to get embeddings for suggestions');
      return null;
    }
    
    logger.info(MODULE, 'Successfully got embeddings for suggestions', {
      count: suggestionEmbeddings.length,
      firstFewSamples: suggestionEmbeddings.slice(0, 2).map(e => ({
        text: e.text,
        embeddingLength: e.embedding ? e.embedding.length : 0
      }))
    });
    
    // Save embeddings to cache
    logger.debug(MODULE, 'Saving embeddings to localStorage');
    saveAxisLabelEmbeddings(suggestionEmbeddings);
    
    // Analyze embeddings to find best axis labels
    logger.info(MODULE, 'Starting analysis phase to find best axis labels');
    onProgress({ 
      stage: 2, 
      message: 'Analyzing embeddings to find best axis labels...',
      progress: 50, // Second half of stage 2
      totalItems: totalItems,
      completedItems: totalItems
    });
    
    // For the second phase (analyzing embeddings), we'll track progress from 50% to 100%
    let analysisProgress = 0;
    logger.debug(MODULE, 'Calling analyzeEmbeddingsForAxisLabels', {
      algorithmId,
      labelsPerAxis,
      suggestionCount: suggestions.length
    });
    
    const result = await analyzeEmbeddingsForAxisLabels({
      suggestions,
      algorithmId,
      labelsPerAxis,
      onProgress: (data) => {
        logger.debug(MODULE, 'Analysis progress update received', data);
        
        // If the underlying function gives us progress data, use it
        if (data && typeof data.progress === 'number') {
          analysisProgress = data.progress;
          logger.debug(MODULE, `Updated analysisProgress to ${analysisProgress}`);
        } else {
          // Otherwise increment by a small amount to show activity
          analysisProgress = Math.min(100, analysisProgress + 5);
          logger.debug(MODULE, `Incremented analysisProgress to ${analysisProgress}`);
        }
        
        const progressPercent = 50 + (analysisProgress / 2);
        logger.info(MODULE, `Stage 2 (analysis): ${progressPercent.toFixed(1)}%`);
        
        onProgress({
          stage: 2,
          message: 'Finding optimal axis labels...',
          progress: progressPercent, // Second half maps to 50-100%
          totalItems: totalItems,
          completedItems: totalItems
        });
      }
    });
    
    if (!result) {
      logger.error(MODULE, 'Failed to analyze embeddings for axis labels');
      toast.error('Failed to analyze embeddings for axis labels');
      return null;
    }
    
    logger.info(MODULE, 'Successfully analyzed embeddings and found best labels', {
      bestLabels: result.bestLabels
    });
    
    // Final progress update to ensure we show 100%
    onProgress({ 
      stage: 2, 
      message: 'Analysis complete',
      progress: 100,
      complete: true,
      totalItems: totalItems,
      completedItems: totalItems
    });
    
    logger.info(MODULE, 'Stage 2 completed successfully');
    return result;
  } catch (error) {
    logger.error(MODULE, 'Error in Stage 2 (Analyze Embeddings):', error);
    toast.error(`Error analyzing embeddings: ${error.message}`);
    return null;
  }
};

/**
 * Final step: Refresh labels from cache
 * 
 * @param {string} algorithmId - Current algorithm ID
 * @param {number} labelsPerAxis - Number of labels per axis
 * @param {Function} onComplete - Callback when complete
 * @returns {Promise<Object>} Refreshed labels
 */
export const finishAndRefresh = async (algorithmId, labelsPerAxis, onComplete) => {
  logger.info(MODULE, 'Final step: Refreshing labels from cache', {
    algorithmId,
    labelsPerAxis
  });
  
  try {
    const result = await refreshLabelsFromCache(algorithmId, labelsPerAxis, onComplete);
    if (result) {
      logger.info(MODULE, 'Successfully refreshed labels from cache', {
        labels: result
      });
    } else {
      logger.warn(MODULE, 'refreshLabelsFromCache returned null');
    }
    return result;
  } catch (error) {
    logger.error(MODULE, 'Error refreshing labels from cache:', error);
    toast.error(`Error refreshing labels: ${error.message}`);
    return null;
  }
};

/**
 * The main entry point that orchestrates the entire workflow
 * 
 * @param {Object} options - All options
 * @param {Array} options.words - Words to generate ideas for
 * @param {string} options.algorithmId - Current algorithm ID
 * @param {number} options.iterationCount - Number of iterations
 * @param {number} options.outputsPerPrompt - Ideas per prompt
 * @param {number} options.labelsPerAxis - Number of labels per axis
 * @param {Function} options.onProgress - Progress callback
 * @param {Function} options.onComplete - Callback when complete
 * @returns {Promise<Object>} Final result
 */
export const generateAxisLabelsWorkflow = async ({
  words,
  algorithmId,
  iterationCount = 1,
  outputsPerPrompt = 30,
  labelsPerAxis = 1,
  onProgress = () => {},
  onComplete = () => {}
}) => {
  logger.info(MODULE, 'Starting complete axis label generation workflow', {
    wordCount: words?.length || 0,
    algorithmId,
    iterationCount,
    outputsPerPrompt,
    labelsPerAxis
  });
  
  try {
    // Step 1: Clear all cached data
    logger.debug(MODULE, 'Step 1: Clearing cached data');
    clearAxisLabelCache();
    
    // Step 2: Stage 1 - Generate ideas
    logger.debug(MODULE, 'Step 2: Starting Stage 1 - Generate ideas');
    const ideas = await stageOne_GenerateIdeas({
      words,
      iterationCount,
      outputsPerPrompt,
      onProgress
    });
    
    if (!ideas) {
      logger.error(MODULE, 'Stage 1 failed to generate ideas');
      return null;
    }
    
    logger.debug(MODULE, 'Stage 1 completed successfully', {
      ideaCount: ideas.length
    });
    
    // Step 3: Stage 2 - Analyze embeddings
    logger.debug(MODULE, 'Step 3: Starting Stage 2 - Analyze embeddings');
    const analysisResult = await stageTwo_AnalyzeEmbeddings({
      suggestions: ideas,
      algorithmId,
      labelsPerAxis,
      onProgress
    });
    
    if (!analysisResult) {
      logger.error(MODULE, 'Stage 2 failed to analyze embeddings');
      return null;
    }
    
    logger.debug(MODULE, 'Stage 2 completed successfully', {
      result: analysisResult.bestLabels
    });
    
    // Step 4: Refresh labels from cache
    logger.debug(MODULE, 'Step 4: Refreshing labels from cache');
    const refreshResult = await finishAndRefresh(algorithmId, labelsPerAxis, onComplete);
    
    logger.info(MODULE, 'Axis label generation workflow completed successfully', {
      result: refreshResult
    });
    
    return refreshResult;
  } catch (error) {
    logger.error(MODULE, 'Error in generate axis labels workflow:', error);
    toast.error(`Error generating axis labels: ${error.message}`);
    return null;
  }
}; 