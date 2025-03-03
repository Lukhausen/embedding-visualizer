import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaTable } from 'react-icons/fa';
import { getEmbedding } from '../services/openaiService';
import { getDimensionInfo } from '../services/dimensionReduction';
import EmbeddingViewer from './EmbeddingViewer';
import './AxisLabelManager.css';

/**
 * Component for managing the labels of the X, Y, and Z axes
 * 
 * @param {Object} props - Component props
 * @param {Object} props.axisLabels - Current axis labels object {x, y, z}
 * @param {Function} props.onAxisLabelsChange - Callback when axis labels change
 * @param {String} props.algorithmId - The current dimension reduction algorithm ID
 * @param {Array} props.words - The current words being visualized
 * @returns {JSX.Element} The component
 */
function AxisLabelManager({ axisLabels = { x: "X", y: "Y", z: "Z" }, onAxisLabelsChange, algorithmId, words = [] }) {
  const [labels, setLabels] = useState(axisLabels);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsWithEmbeddings, setSuggestionsWithEmbeddings] = useState([]);
  const [iterationCount, setIterationCount] = useState(1);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [findingBestLabels, setFindingBestLabels] = useState(false);
  const [findingProgress, setFindingProgress] = useState(0);
  const [totalSuggestions, setTotalSuggestions] = useState(0);
  const [suggestionsProgress, setSuggestionsProgress] = useState(0);
  const [selectedEmbedding, setSelectedEmbedding] = useState(null);
  const [outputsPerPrompt, setOutputsPerPrompt] = useState(30);

  // Apply default labels on first render if none provided
  useEffect(() => {
    if (!axisLabels) {
      setLabels({ x: "X", y: "Y", z: "Z" });
    } else {
      setLabels(axisLabels);
    }
  }, [axisLabels]);

  const handleLabelChange = (axis, value) => {
    const newLabels = { ...labels, [axis]: value };
    setLabels(newLabels);
    if (onAxisLabelsChange) {
      onAxisLabelsChange(newLabels);
    }
  };

  const fetchSuggestions = async (wordList, formattedWordList, apiKey, existingSuggestions = [], outputCount = 10) => {
    // Create OpenAI client
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

    // Log the response for debugging - only in development mode
    if (process.env.NODE_ENV === 'development' && false) { // Disabled by default
      console.log(`Iteration ${currentIteration + 1} response:`, response);
    }
    
    // Extract suggestions from response
    if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      
      if (toolCalls.length > 0 && toolCalls[0].function && toolCalls[0].function.arguments) {
        try {
          const argumentsJSON = toolCalls[0].function.arguments;
          const parsedArguments = JSON.parse(argumentsJSON);
          const suggestionWords = parsedArguments.words;

          if (Array.isArray(suggestionWords)) {
            return suggestionWords;
          }
        } catch (error) {
          console.error('Failed to parse function arguments JSON:', error);
        }
      }
    }
    
    return []; // Return empty array if something went wrong
  };

  const getWordSuggestions = async () => {
    // Get API key from localStorage
    const apiKey = localStorage.getItem('openai-api-key');
    if (!apiKey) {
      toast.error('Please add your OpenAI API key in settings first');
      return;
    }

    // Get words from localStorage
    const savedWords = localStorage.getItem('embedding-words');
    if (!savedWords) {
      toast.warning('No words found. Please add some words first.');
      return;
    }

    try {
      setLoadingSuggestions(true);
      setCurrentIteration(0);
      setSuggestionsProgress(0);
      // Set the total number of suggestion requests
      setTotalSuggestions(iterationCount);
      
      // Parse words from localStorage
      const parsedWords = JSON.parse(savedWords);
      const wordList = parsedWords.map(w => w.text);
      const formattedWordList = wordList.join(', ');
      
      // Initialize accumulated suggestions
      let allSuggestions = [];
      
      // Create a single toast ID for tracking progress
      const toastId = toast.info(`Getting suggestions (0/${iterationCount} requests completed)...`, {
        autoClose: false,
        closeButton: false
      });
      
      // Create an array of promises for concurrent execution
      const requestPromises = Array.from({ length: iterationCount }, async (_, i) => {
        try {
          // Each request gets its own copy of the current accumulated suggestions
          // to avoid duplicates across concurrent requests
          const newSuggestions = await fetchSuggestions(
            wordList, 
            formattedWordList, 
            apiKey, 
            [...allSuggestions], // Pass a copy to prevent race conditions
            outputsPerPrompt
          );
          
          // Update progress
          const newProgress = ((i + 1) / iterationCount) * 100;
          setSuggestionsProgress(newProgress);
          setCurrentIteration(i + 1);
          
          // Update the progress toast
          toast.update(toastId, {
            render: `Getting suggestions (${i + 1}/${iterationCount} requests completed)...`
          });
          
          return newSuggestions;
        } catch (error) {
          console.error(`Error in request ${i + 1}:`, error);
          // Still update progress even on error
          const newProgress = ((i + 1) / iterationCount) * 100;
          setSuggestionsProgress(newProgress);
          setCurrentIteration(i + 1);
          return [];
        }
      });

      // Wait for all requests to complete concurrently
      const allResults = await Promise.all(requestPromises);
      
      // Process all results and combine unique suggestions
      let totalNewSuggestions = 0;
      
      allResults.forEach((newSuggestions) => {
        if (newSuggestions && newSuggestions.length > 0) {
          // Filter out duplicates (case-insensitive)
          const uniqueNewSuggestions = newSuggestions.filter(
            suggestion => !allSuggestions.some(
              existing => existing.toLowerCase() === suggestion.toLowerCase()
            )
          );
          
          allSuggestions = [...allSuggestions, ...uniqueNewSuggestions];
          totalNewSuggestions += uniqueNewSuggestions.length;
        }
      });

      // Update the UI with all accumulated suggestions
      setSuggestions(allSuggestions);
      setSuggestionsWithEmbeddings(allSuggestions.map(text => ({ text, embedding: null })));
      
      // Final update with total count
      toast.update(toastId, {
        render: `Found ${allSuggestions.length} unique axis label suggestions!`,
        type: 'success',
        autoClose: 3000,
        closeButton: true
      });
      
    } catch (error) {
      console.error('Error getting suggestions:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoadingSuggestions(false);
      setCurrentIteration(0);
      setSuggestionsProgress(0);
      setTotalSuggestions(0);
    }
  };

  const findBestLabels = async () => {
    // Check if we have suggestions
    if (suggestions.length === 0) {
      toast.warning('No suggestions available. Generate suggestions first.');
      return;
    }

    // Check if we have words with embeddings
    const savedWords = localStorage.getItem('embedding-words');
    if (!savedWords) {
      toast.warning('No embeddings found. Add some words first.');
      return;
    }

    // Get API key
    const apiKey = localStorage.getItem('openai-api-key');
    if (!apiKey) {
      toast.error('Please add your OpenAI API key in settings first');
      return;
    }

    setFindingBestLabels(true);
    setFindingProgress(0);
    toast.info('Analyzing embeddings to find best axis labels...');

    try {
      // Get saved embeddings
      const parsedWords = JSON.parse(savedWords);
      const wordsWithEmbeddings = parsedWords.filter(w => w.embedding);
      
      if (wordsWithEmbeddings.length === 0) {
        toast.error('No words with embeddings found');
        return;
      }

      // Get dimension info to find out which dimensions are used for which axis
      const embeddings = wordsWithEmbeddings.map(w => w.embedding);
      
      const { applyDimensionReduction } = await import('../services/dimensionReduction');
      const reductionResult = applyDimensionReduction(embeddings, algorithmId);
      
      if (!reductionResult || !reductionResult.indices) {
        toast.error('Could not analyze the current visualization dimensions');
        return;
      }
      
      const [xDimensionIndex, yDimensionIndex, zDimensionIndex] = reductionResult.indices;
      console.log(`Using dimensions: X=${xDimensionIndex}, Y=${yDimensionIndex}, Z=${zDimensionIndex}`);
      
      // Process all suggestions without limiting
      setTotalSuggestions(suggestions.length);
      let completedRequests = 0;
      
      // Show initial progress
      toast.info(`Getting embeddings for ${suggestions.length} suggestions...`);
      
      // Send all embedding requests in parallel
      const suggestionPromises = suggestions.map(async (suggestion) => {
        try {
          const embedding = await getEmbedding(suggestion, apiKey);
          completedRequests++;
          setFindingProgress((completedRequests / suggestions.length) * 100);
          return { text: suggestion, embedding };
        } catch (error) {
          console.error(`Error getting embedding for "${suggestion}":`, error);
          completedRequests++;
          setFindingProgress((completedRequests / suggestions.length) * 100);
          return null;
        }
      });
      
      // Wait for all requests to complete
      const suggestionResults = await Promise.all(suggestionPromises);
      const suggestionEmbeddings = suggestionResults.filter(result => result !== null);
      
      if (suggestionEmbeddings.length === 0) {
        toast.error('Could not get embeddings for suggestions');
        return;
      }
      
      // Update our state with the embeddings so we can visualize them
      setSuggestionsWithEmbeddings(suggestionEmbeddings);
      
      // Find the suggestions with the highest value in each dimension
      let bestXLabelScore = -Infinity;
      let bestYLabelScore = -Infinity;
      let bestZLabelScore = -Infinity;
      let bestXLabel = null;
      let bestYLabel = null;
      let bestZLabel = null;
      
      // Find the best labels
      for (const { text, embedding } of suggestionEmbeddings) {
        const xScore = embedding[xDimensionIndex];
        const yScore = embedding[yDimensionIndex];
        const zScore = embedding[zDimensionIndex];
        
        const absXScore = Math.abs(xScore);
        const absYScore = Math.abs(yScore);
        const absZScore = Math.abs(zScore);
        
        if (absXScore > bestXLabelScore) {
          bestXLabelScore = absXScore;
          bestXLabel = text;
        }
        
        if (absYScore > bestYLabelScore) {
          bestYLabelScore = absYScore;
          bestYLabel = text;
        }
        
        if (absZScore > bestZLabelScore) {
          bestZLabelScore = absZScore;
          bestZLabel = text;
        }
      }
      
      // Update the labels
      const newLabels = {
        x: bestXLabel || labels.x,
        y: bestYLabel || labels.y,
        z: bestZLabel || labels.z
      };
      
      setLabels(newLabels);
      if (onAxisLabelsChange) {
        onAxisLabelsChange(newLabels);
      }
      
      toast.success('Found the best axis labels based on embeddings!');
      
    } catch (error) {
      console.error('Error finding best labels:', error);
      toast.error(`Error finding best labels: ${error.message}`);
    } finally {
      setFindingBestLabels(false);
      setFindingProgress(0);
      setTotalSuggestions(0);
    }
  };

  // Show embedding viewer for a suggestion
  const showEmbedding = async (text) => {
    // Check if we already have the embedding
    const suggestion = suggestionsWithEmbeddings.find(s => s.text === text);
    
    if (suggestion && suggestion.embedding) {
      // If we already have the embedding, show the full-screen view directly
      setSelectedEmbedding({ text, embedding: suggestion.embedding });
    } else {
      // Otherwise, fetch it and then show full-screen view
      try {
        const apiKey = localStorage.getItem('openai-api-key');
        if (!apiKey) {
          toast.error('Please add your OpenAI API key in settings first');
          return;
        }
        
        toast.info(`Getting embedding for "${text}"...`);
        const embedding = await getEmbedding(text, apiKey);
        
        // Update our state with the new embedding
        setSuggestionsWithEmbeddings(prev => {
          const newState = [...prev];
          const index = newState.findIndex(s => s.text === text);
          if (index >= 0) {
            newState[index] = { ...newState[index], embedding };
          } else {
            newState.push({ text, embedding });
          }
          return newState;
        });
        
        // Show the full-screen embedding viewer
        setSelectedEmbedding({ text, embedding });
      } catch (error) {
        console.error(`Error getting embedding for "${text}":`, error);
        toast.error(`Error: ${error.message}`);
      }
    }
  };
  
  // Close the embedding viewer
  const closeEmbeddingView = () => {
    setSelectedEmbedding(null);
  };

  return (
    <div className="axis-labels-container">
      <div className="axis-label-description">
        <p>Customize the labels for each dimension axis in the 3D visualization.</p>
      </div>
      
      <div className="axis-label-inputs">
        <div className="axis-label-group">
          <label htmlFor="x-axis-label">X:</label>
          <input
            id="x-axis-label"
            type="text"
            value={labels.x}
            onChange={(e) => handleLabelChange('x', e.target.value)}
            placeholder="X-Axis"
            className="axis-label-input"
          />
        </div>
        
        <div className="axis-label-group">
          <label htmlFor="y-axis-label">Y:</label>
          <input
            id="y-axis-label"
            type="text"
            value={labels.y}
            onChange={(e) => handleLabelChange('y', e.target.value)}
            placeholder="Y-Axis"
            className="axis-label-input"
          />
        </div>
        
        <div className="axis-label-group">
          <label htmlFor="z-axis-label">Z:</label>
          <input
            id="z-axis-label"
            type="text"
            value={labels.z}
            onChange={(e) => handleLabelChange('z', e.target.value)}
            placeholder="Z-Axis"
            className="axis-label-input"
          />
        </div>
      </div>
      
      <div className="suggestions-section">
        <div className="iteration-controls">
          <div className="iteration-row">
            <div className="iteration-group">
              <label htmlFor="iteration-slider">
                Number of AI requests: <span className="iteration-value">{iterationCount}</span>
              </label>
              <input
                id="iteration-slider"
                type="range"
                min="1"
                max="20"
                value={iterationCount}
                onChange={(e) => setIterationCount(parseInt(e.target.value))}
                className="iteration-slider"
                disabled={loadingSuggestions || findingBestLabels}
              />
            </div>
            
            <div className="iteration-group">
              <label htmlFor="outputs-per-prompt">
                Outputs per prompt:
              </label>
              <input
                id="outputs-per-prompt"
                type="number"
                min="1"
                value={outputsPerPrompt}
                onChange={(e) => setOutputsPerPrompt(parseInt(e.target.value))}
                className="outputs-input"
                disabled={loadingSuggestions || findingBestLabels}
              />
            </div>
          </div>
          
          <div className="iteration-description">
            More requests = more diverse suggestions (but takes longer)
          </div>
        </div>
        
        <div className="action-buttons">
          <button 
            className="get-suggestions-button"
            onClick={getWordSuggestions}
            disabled={loadingSuggestions || findingBestLabels}
          >
            {loadingSuggestions 
              ? `Processing Suggestions... (${currentIteration}/${totalSuggestions})` 
              : `Get AI Suggestions (${iterationCount} ${iterationCount === 1 ? 'request' : 'requests'})`
            }
          </button>
          
          {suggestions.length > 0 && (
            <button 
              className="find-best-labels-button"
              onClick={findBestLabels}
              disabled={loadingSuggestions || findingBestLabels}
            >
              {findingBestLabels 
                ? `Finding Best Labels... (${Math.floor(findingProgress / 100 * totalSuggestions)}/${totalSuggestions})` 
                : 'Find Best Labels'
              }
            </button>
          )}
        </div>
        
        {(loadingSuggestions || findingBestLabels) && (
          <>
            <div className="progress-bar-container">
              <div 
                className={`progress-bar ${findingBestLabels || loadingSuggestions ? '' : 'pulsing-progress'}`} 
                style={{ 
                  width: findingBestLabels 
                    ? `${findingProgress}%` 
                    : loadingSuggestions
                      ? `${suggestionsProgress}%`
                      : undefined 
                }}
              ></div>
            </div>
            {findingBestLabels && (
              <div className="progress-status">
                Processing embeddings: {Math.floor(findingProgress / 100 * totalSuggestions)} of {totalSuggestions} requests completed
              </div>
            )}
            {loadingSuggestions && !findingBestLabels && (
              <div className="progress-status">
                Processing suggestions: {currentIteration} of {totalSuggestions} requests completed
              </div>
            )}
          </>
        )}
        
        {suggestions.length > 0 && (
          <div className="suggestions-list">
            <h4>Suggested Axis Labels: <span className="suggestion-count">({suggestions.length})</span></h4>
            <div className="suggestion-controls">
              <button 
                className="suggestion-control-button"
                onClick={() => setSuggestions([...suggestions].sort())}
                disabled={loadingSuggestions || findingBestLabels}
              >
                Sort A-Z
              </button>
            </div>
            <div className="suggestion-items">
              {suggestions.map((suggestion, index) => {
                // Find if this suggestion has an embedding
                const suggestionData = suggestionsWithEmbeddings.find(s => s.text === suggestion);
                
                return (
                  <div key={index} className="suggestion-item-container">
                    <div 
                      className="suggestion-item"
                      onClick={() => {
                        // Show a menu to select which axis
                        const axis = window.prompt(`Apply "${suggestion}" to which axis? (x, y, z)`, "x").toLowerCase();
                        if (axis === 'x' || axis === 'y' || axis === 'z') {
                          handleLabelChange(axis, suggestion);
                          toast.info(`Applied "${suggestion}" to ${axis.toUpperCase()}-axis`);
                        }
                      }}
                    >
                      <span className="suggestion-text">{suggestion}</span>
                      <button 
                        className="view-embedding-button small"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the parent's onClick
                          showEmbedding(suggestion);
                        }}
                        title="View embedding vector"
                      >
                        <FaTable />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Full embedding viewer modal */}
      {selectedEmbedding && (
        <EmbeddingViewer
          embedding={selectedEmbedding.embedding}
          word={selectedEmbedding.text}
          onClose={closeEmbeddingView}
        />
      )}
    </div>
  );
}

export default AxisLabelManager; 