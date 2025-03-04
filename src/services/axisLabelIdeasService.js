/**
 * Axis Label Ideas Service
 * 
 * This service handles the generation of axis label ideas using OpenAI,
 * as well as saving and loading ideas from localStorage.
 */
import { toast } from 'react-toastify';

// Local storage keys
const AXIS_LABEL_IDEAS_KEY = 'axis-label-ideas';

/**
 * Load saved axis label ideas from localStorage
 * 
 * @returns {Array} Array of axis label ideas
 */
export const loadAxisLabelIdeas = () => {
  try {
    const savedIdeas = localStorage.getItem(AXIS_LABEL_IDEAS_KEY);
    if (savedIdeas) {
      const parsed = JSON.parse(savedIdeas);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load axis label ideas:', error);
  }
  
  return [];
};

/**
 * Save axis label ideas to localStorage
 * 
 * @param {Array} ideas - Array of axis label ideas
 * @returns {boolean} Success status
 */
export const saveAxisLabelIdeas = (ideas) => {
  if (!ideas || !Array.isArray(ideas)) {
    console.error('Invalid ideas provided to saveAxisLabelIdeas');
    return false;
  }
  
  try {
    localStorage.setItem(AXIS_LABEL_IDEAS_KEY, JSON.stringify(ideas));
    return true;
  } catch (error) {
    console.error('Failed to save axis label ideas:', error);
    return false;
  }
};

/**
 * Ensure the word object has a valid text property
 * 
 * @param {Object|string} word - Word object or string
 * @returns {Object} Word object with text property
 */
const normalizeWord = (word) => {
  if (typeof word === 'string') {
    return { text: word };
  } else if (word && typeof word === 'object' && word.text) {
    return { text: word.text };
  } else {
    return { text: String(word) };
  }
};

/**
 * Fetch axis label suggestions from OpenAI
 * 
 * @param {Array} wordList - List of words to generate ideas for
 * @param {string} formattedWordList - Formatted string of words
 * @param {string} apiKey - OpenAI API key
 * @param {Array} existingSuggestions - Existing suggestions to avoid duplicates
 * @param {number} outputCount - Number of suggestions to generate
 * @returns {Promise<Array>} Array of new suggestions
 */
const fetchSuggestions = async (wordList, formattedWordList, apiKey, existingSuggestions = [], outputCount = 10) => {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!wordList || !Array.isArray(wordList) || wordList.length === 0) {
    throw new Error('Word list is required');
  }
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    // Make API request
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          "role": "system",
          "content": [
            {
              "type": "text",
              "text": `Your task is to find descriptive adjectives or characteristics that can describe the following words on a 3-dimensional coordinate system.\n\nWords to find characteristics for: ${formattedWordList}\n\nThe idea is to plot those words in a 3d coordinate system using those characteristics. Generate exactly ${outputCount} diverse and unique characteristics that are different from these: ${existingSuggestions.join(', ')}.`
            }
          ]
        },
        {
          "role": "assistant",
          "content": [],
          "tool_calls": [
            {
              "id": "call_RZNoQKpIXcdGX8sIyq5zCipa",
              "type": "function",
              "function": {
                "name": "input_unique_words",
                "arguments": `{\"words\": ${JSON.stringify(wordList)}}`
              }
            },
            {
              "id": "call_tkBcCT38lUCgfSVOMdReprua",
              "type": "function",
              "function": {
                "name": "input_unique_words",
                "arguments": `{\"words\": ${JSON.stringify(wordList)}}`
              }
            }
          ]
        },
        {
          "role": "tool",
          "content": [
            {
              "type": "text",
              "text": ""
            }
          ],
          "tool_call_id": "call_RZNoQKpIXcdGX8sIyq5zCipa"
        },
        {
          "role": "tool",
          "content": [
            {
              "type": "text",
              "text": ""
            }
          ],
          "tool_call_id": "call_tkBcCT38lUCgfSVOMdReprua"
        }
      ],
      response_format: {
        "type": "text"
      },
      tools: [
        {
          "type": "function",
          "function": {
            "name": "input_unique_words",
            "description": "Takes as input a list of unique words",
            "parameters": {
              "type": "object",
              "required": [
                "words"
              ],
              "properties": {
                "words": {
                  "type": "array",
                  "description": "List of unique words",
                  "items": {
                    "type": "string",
                    "description": "A unique word"
                  }
                }
              },
              "additionalProperties": false
            },
            "strict": true
          }
        }
      ],
      tool_choice: {
        "type": "function",
        "function": {
          "name": "input_unique_words"
        }
      },
      temperature: 1,
      max_completion_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });
    
    // Extract suggestions from response
    if (response.choices?.[0]?.message?.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      
      if (toolCalls.length > 0 && toolCalls[0].function?.arguments) {
        try {
          const parsedArguments = JSON.parse(toolCalls[0].function.arguments);
          if (Array.isArray(parsedArguments.words)) {
            return parsedArguments.words.filter(word => 
              word && typeof word === 'string' && word.trim() !== ''
            );
          }
        } catch (error) {
          console.error('Failed to parse function arguments JSON:', error);
          throw new Error('Failed to parse API response');
        }
      }
    }
    
    throw new Error('Invalid response format from API');
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    throw error;
  }
};

/**
 * Generate axis label ideas based on words and settings
 * 
 * @param {Object} options - Options for generating ideas
 * @param {Array} options.words - Words to generate ideas for
 * @param {number} options.iterationCount - Number of API requests to make
 * @param {number} options.outputsPerPrompt - Number of ideas per request
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onComplete - Callback when complete
 * @returns {Promise<Array>} Array of generated ideas
 */
export const generateAxisLabelIdeas = async ({
  words,
  iterationCount = 1,
  outputsPerPrompt = 30,
  onProgress = () => {},
  onComplete = () => {}
}) => {
  // Check requirements
  const apiKey = localStorage.getItem('openai-api-key');
  if (!apiKey) {
    toast.error('Please add your OpenAI API key in settings first');
    return [];
  }

  if (!words || !Array.isArray(words) || words.length === 0) {
    toast.warning('No words provided to generate ideas from');
    return [];
  }

  try {
    // Normalize words to ensure they all have a text property
    const normalizedWords = words.map(normalizeWord);
    
    // Extract text for API request
    const wordList = normalizedWords.map(w => w.text).filter(text => text && text.trim() !== '');
    
    if (wordList.length === 0) {
      toast.warning('No valid words found to generate ideas from');
      return [];
    }
    
    const formattedWordList = wordList.join(', ');
    
    // Initialize accumulated suggestions
    let allSuggestions = [];
    
    // Create an array of promises for concurrent execution
    const requestPromises = Array.from({ length: iterationCount }, async (_, i) => {
      try {
        // Each request gets its own copy of the current accumulated suggestions
        const newSuggestions = await fetchSuggestions(
          wordList, 
          formattedWordList, 
          apiKey, 
          [...allSuggestions],
          outputsPerPrompt
        );
        
        // Update progress
        onProgress({
          currentIteration: i + 1,
          totalIterations: iterationCount,
          progress: ((i + 1) / iterationCount) * 100
        });
        
        return newSuggestions;
      } catch (error) {
        console.error(`Error in request ${i + 1}:`, error);
        
        // Still update progress even on error
        onProgress({
          currentIteration: i + 1,
          totalIterations: iterationCount,
          progress: ((i + 1) / iterationCount) * 100
        });
        
        // If this is the first request and it failed with an API error, show helpful message
        if (i === 0 && error.message.includes('API')) {
          toast.error(`API Error: ${error.message}. Check your API key and connection.`);
        }
        
        return [];
      }
    });

    // Wait for all requests to complete concurrently
    const allResults = await Promise.all(requestPromises);
    
    // Process all results and combine unique suggestions
    allResults.forEach((newSuggestions) => {
      if (newSuggestions?.length > 0) {
        // Filter out duplicates (case-insensitive)
        const uniqueNewSuggestions = newSuggestions.filter(
          suggestion => !allSuggestions.some(
            existing => existing.toLowerCase() === suggestion.toLowerCase()
          )
        );
        
        allSuggestions = [...allSuggestions, ...uniqueNewSuggestions];
      }
    });

    // Save to localStorage
    saveAxisLabelIdeas(allSuggestions);
    
    // Call complete callback
    onComplete(allSuggestions);
    
    return allSuggestions;
  } catch (error) {
    console.error('Error generating axis label ideas:', error);
    toast.error(`Error: ${error.message}`);
    return [];
  }
}; 