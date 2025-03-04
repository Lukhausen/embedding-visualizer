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
  try {
    localStorage.removeItem(AXIS_LABEL_IDEAS_KEY);
    localStorage.removeItem(AXIS_LABEL_EMBEDDINGS_KEY);
    localStorage.removeItem(AXIS_ADDITIONAL_LABELS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing axis label cache:', error);
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
  // Check for API key
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    toast.error('Please add your OpenAI API key in settings first');
    return null;
  }
  
  if (!words || !Array.isArray(words) || words.length === 0) {
    toast.warning('No words provided to generate ideas from');
    return null;
  }
  
  try {
    // Progress tracking for UI
    onProgress({ 
      stage: 1, 
      message: 'Generating axis label ideas...',
      progress: 0
    });
    
    // Generate ideas using the existing service
    const suggestions = await generateAxisLabelIdeas({
      words,
      iterationCount,
      outputsPerPrompt,
      onProgress: (progressData) => {
        // Map the progress to our two-stage workflow
        onProgress({
          stage: 1,
          message: `Generating ideas: ${progressData.currentIteration}/${progressData.totalIterations}`,
          progress: progressData.progress
        });
      }
    });
    
    if (!suggestions || suggestions.length === 0) {
      toast.error('Failed to generate label ideas');
      return null;
    }
    
    // Save the generated ideas
    saveAxisLabelIdeas(suggestions);
    
    onProgress({ 
      stage: 1, 
      message: `Generated ${suggestions.length} label ideas`,
      progress: 100,
      complete: true
    });
    
    return suggestions;
  } catch (error) {
    console.error('Error in Stage 1 (Generate Ideas):', error);
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
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    toast.error('Please add your OpenAI API key in settings first');
    return null;
  }
  
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    toast.warning('No suggestions available to analyze');
    return null;
  }
  
  try {
    // Progress tracking for UI
    onProgress({ 
      stage: 2, 
      message: 'Getting embeddings for suggestions...',
      progress: 0
    });
    
    // Get embeddings for all suggestions
    const suggestionEmbeddings = await getSuggestionEmbeddings(
      suggestions,
      apiKey,
      (progressData) => {
        // Map progress to our two-stage workflow
        onProgress({
          stage: 2,
          message: `Getting embeddings: ${progressData.completed}/${progressData.total}`,
          progress: progressData.progress / 2 // First half of stage 2
        });
      }
    );
    
    if (!suggestionEmbeddings || suggestionEmbeddings.length === 0) {
      toast.error('Failed to get embeddings for suggestions');
      return null;
    }
    
    // Save embeddings to cache
    saveAxisLabelEmbeddings(suggestionEmbeddings);
    
    // Analyze embeddings to find best axis labels
    onProgress({ 
      stage: 2, 
      message: 'Analyzing embeddings to find best axis labels...',
      progress: 50 // Second half of stage 2
    });
    
    const result = await analyzeEmbeddingsForAxisLabels({
      suggestions,
      algorithmId,
      labelsPerAxis,
      // The progress here is not as important since we've already got embeddings
      onProgress: () => {
        onProgress({
          stage: 2,
          message: 'Finding optimal axis labels...',
          progress: 75
        });
      }
    });
    
    if (!result) {
      toast.error('Failed to analyze embeddings for axis labels');
      return null;
    }
    
    onProgress({ 
      stage: 2, 
      message: 'Analysis complete',
      progress: 100,
      complete: true
    });
    
    return result;
  } catch (error) {
    console.error('Error in Stage 2 (Analyze Embeddings):', error);
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
  try {
    return await refreshLabelsFromCache(algorithmId, labelsPerAxis, onComplete);
  } catch (error) {
    console.error('Error refreshing labels from cache:', error);
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
  try {
    // Step 1: Clear all cached data
    clearAxisLabelCache();
    
    // Step 2: Stage 1 - Generate ideas
    const ideas = await stageOne_GenerateIdeas({
      words,
      iterationCount,
      outputsPerPrompt,
      onProgress
    });
    
    if (!ideas) {
      return null;
    }
    
    // Step 3: Stage 2 - Analyze embeddings
    const analysisResult = await stageTwo_AnalyzeEmbeddings({
      suggestions: ideas,
      algorithmId,
      labelsPerAxis,
      onProgress
    });
    
    if (!analysisResult) {
      return null;
    }
    
    // Step 4: Refresh labels from cache
    const refreshResult = await finishAndRefresh(algorithmId, labelsPerAxis, onComplete);
    
    return refreshResult;
  } catch (error) {
    console.error('Error in generate axis labels workflow:', error);
    toast.error(`Error generating axis labels: ${error.message}`);
    return null;
  }
}; 