import axios from 'axios';
import logger from '../utils/logger';

const MODULE = 'openaiService';

/**
 * Fetches an embedding from OpenAI's API with retry capability
 * 
 * @param {string} text - Text to get embedding for
 * @param {string} apiKey - OpenAI API key
 * @param {number} retryCount - Number of retries on failure
 * @returns {Promise<number[]>} The embedding vector
 */
const getEmbedding = async (text, apiKey, retryCount = 1) => {
  logger.debug(MODULE, `Getting embedding for: "${text.substring(0, 30)}..."`, { retryCount });
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('Valid text input is required');
  }

  let lastError = null;
  
  // Try up to retryCount + 1 times (initial attempt + retries)
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      if (attempt > 0) {
        logger.warn(MODULE, `Retry attempt ${attempt}/${retryCount} for text: "${text.substring(0, 30)}..."`, { lastError });
        // Add exponential backoff delay before retry
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
      
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings', 
        {
          model: 'text-embedding-3-large',
          input: text,
          encoding_format: 'float'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 5000 // 5 second timeout as requested
        }
      );

      logger.debug(MODULE, `Successfully got embedding for: "${text.substring(0, 30)}..."`);
      return response.data.data[0].embedding;
    } catch (error) {
      lastError = error;
      
      // Log the error but continue if we have more retries
      if (attempt < retryCount) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        logger.warn(MODULE, `Error getting embedding (will retry): ${errorMsg}`, { attempt });
        continue;
      }
      
      // Handle specific error types
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const errorMessage = error.response.data?.error?.message || 
          `API error (${error.response.status}): ${error.response.statusText}`;
        logger.error(MODULE, `API error getting embedding: ${errorMessage}`, { text: text.substring(0, 30) });
        throw new Error(errorMessage);
      } else if (error.request) {
        // The request was made but no response was received
        logger.error(MODULE, 'No response from OpenAI API', { text: text.substring(0, 30) });
        throw new Error('No response from OpenAI API. Please check your internet connection.');
      } else {
        // Something happened in setting up the request
        logger.error(MODULE, `Error setting up request: ${error.message}`, { text: text.substring(0, 30) });
        throw error;
      }
    }
  }
};

/**
 * Normalizes an embedding vector to have unit length (L2 norm = 1)
 * 
 * @param {number[]} embedding - The embedding vector to normalize
 * @returns {number[]} Normalized embedding vector
 */
const normalizeEmbedding = (embedding) => {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Valid embedding array is required for normalization');
  }
  
  // Calculate L2 norm (Euclidean length)
  const sumOfSquares = embedding.reduce((sum, val) => sum + val * val, 0);
  const magnitude = Math.sqrt(sumOfSquares);
  
  // Prevent division by zero
  if (magnitude === 0) return embedding.map(() => 0);
  
  // Normalize each component
  return embedding.map(val => val / magnitude);
};

// Register for HMR
if (import.meta.hot) {
  import.meta.hot.accept();
}

export { getEmbedding, normalizeEmbedding }; 