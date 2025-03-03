# Embedding Visualizer Plugin System

This module provides a flexible plugin system for creating dimension reduction algorithms in the Embedding Visualizer. The system is designed to be as straightforward as possible, allowing you to add new visualization algorithms with minimal effort.

## Plugin System Overview

The plugin system follows these principles:

- **Zero Configuration**: Add a new plugin by simply creating a file in the correct directory
- **Auto-Discovery**: Plugins are automatically discovered and registered
- **Modular Design**: Each algorithm is isolated in its own file
- **Simple Interface**: Implement a single function and export an object

## How to Create a New Plugin

Creating a new dimension reduction algorithm is simple:

### Step 1: Create a New File

Create a new JavaScript file in the `src/services/dimensionReduction/algorithms/` directory:

```
src/services/dimensionReduction/algorithms/myNewAlgorithm.js
```

### Step 2: Implement Your Algorithm

Copy and paste this template into your new file and customize it:

```javascript
const myAlgorithm = {
  // Required: Unique identifier (camelCase, no spaces)
  id: 'myAlgorithmId',
  
  // Required: Display name shown in UI
  name: 'My New Algorithm',
  
  // Required: Description shown in UI
  description: 'This algorithm works by... [brief explanation]',
  
  // Required: The core implementation
  reduce: function(embeddings) {
    if (!embeddings || embeddings.length === 0) {
      return null;
    }
    
    // Your algorithm logic here
    // ...
    
    // For example, select dimensions 0, 1, 2 for visualization
    const selectedDimensions = [0, 1, 2];
    
    // Calculate min/max values for scaling
    const minValues = [Infinity, Infinity, Infinity];
    const maxValues = [-Infinity, -Infinity, -Infinity];
    
    for (const embedding of embeddings) {
      for (let i = 0; i < 3; i++) {
        const value = embedding[selectedDimensions[i]];
        minValues[i] = Math.min(minValues[i], value);
        maxValues[i] = Math.max(maxValues[i], value);
      }
    }
    
    // Return required structure
    return {
      indices: selectedDimensions,  // Which dimensions to use for X, Y, Z
      minValues,                    // Min values for scaling
      maxValues,                    // Max values for scaling
      name: this.name,              // Algorithm name
      description: this.description // Algorithm description
    };
  }
};

export default myAlgorithm;
```

### Step 3: That's It!

Your algorithm will be automatically discovered and will appear in the dropdown in the UI. No manual registration is required.

## Example Algorithm Types

Here are some examples of algorithms you might implement:

### 1. Fixed Dimension Selection

Map specific embedding dimensions to X, Y, Z coordinates:

```javascript
reduce: function(embeddings) {
  // Always use dimensions 5, 10, 15 for visualization
  const indices = [5, 10, 15];
  // ...calculate min/max values
  return { indices, minValues, maxValues, name: this.name, description: this.description };
}
```

### 2. Statistical Selection

Select dimensions based on statistical properties:

```javascript
reduce: function(embeddings) {
  // Find dimensions with highest variance
  const variances = calculateVariances(embeddings);
  const indices = findTopThreeIndices(variances);
  // ...calculate min/max values
  return { indices, minValues, maxValues, name: this.name, description: this.description };
}
```

### 3. Mathematical Transformations

Apply mathematical transformations to create new dimensions:

```javascript
reduce: function(embeddings) {
  // Create weighted combinations of dimensions
  const transformed = embeddings.map(e => [
    calculateWeightedCombination(e, weights1),
    calculateWeightedCombination(e, weights2),
    calculateWeightedCombination(e, weights3)
  ]);
  // ...calculate indices, min/max values
  return { indices: [0, 1, 2], minValues, maxValues, name: this.name, description: this.description };
}
```

## Plugin API Reference

### Required Properties

Every algorithm must provide:

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Unique identifier (camelCase, no spaces) |
| `name` | String | User-friendly display name |
| `description` | String | Brief explanation of how it works |
| `reduce` | Function | Implementation function |

### Reduce Function

The `reduce` function must:

1. Accept an array of embedding vectors as its only parameter
2. Return an object with the following properties:
   - `indices`: Array of 3 indices mapping to X, Y, Z dimensions
   - `minValues`: Array of 3 min values for scaling
   - `maxValues`: Array of 3 max values for scaling
   - `name`: Algorithm name
   - `description`: Algorithm description

## Under the Hood

The auto-discovery mechanism uses Vite's `import.meta.glob` to scan the algorithms directory and import all JS files. Each algorithm is registered with the `algorithmRegistry` in `algorithmRegistry.js`.

When users select an algorithm in the UI, the system:

1. Looks up the algorithm by ID
2. Calls its `reduce` function with the current embeddings
3. Uses the returned dimensions to render the visualization

## Need Help?

- Check out the example in `pca.js`
- See the interface template in `algorithmBase.js`
- Contact the project maintainers for assistance 