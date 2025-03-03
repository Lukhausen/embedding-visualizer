const getEmbedding = async (text, apiKey) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: text,
        encoding_format: 'float'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get embedding');
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    throw error;
  }
};

export { getEmbedding }; 