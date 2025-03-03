import axios from 'axios';

/**
 * Fetches an embedding from OpenAI's API
 * 
 * @param {string} text - Text to get embedding for
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number[]>} The embedding vector
 */
const getEmbedding = async (text, apiKey) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('Valid text input is required');
  }

  try {
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
        timeout: 15000 // 15 second timeout
      }
    );

    return response.data.data[0].embedding;
  } catch (error) {
    // Handle specific error types
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const errorMessage = error.response.data?.error?.message || 
        `API error (${error.response.status}): ${error.response.statusText}`;
      throw new Error(errorMessage);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response from OpenAI API. Please check your internet connection.');
    } else {
      // Something happened in setting up the request
      throw error;
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