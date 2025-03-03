# Dimension Reduction Module

This module provides a modular and extensible system for reducing high-dimensional embedding vectors to 3D coordinates for visualization purposes.

## Architecture

The dimension reduction module is organized as follows:

- `index.js`: Main entry point that exports the public API
- `algorithmRegistry.js`: Manages the automatic discovery and registration of algorithms
- `algorithmBase.js`: Defines the interface that all algorithms should implement
- `algorithms/`: Directory containing individual algorithm implementations
  - Each algorithm is in its own file with a consistent structure

## Available Algorithm

Currently, the system includes one algorithm:

### Principal Component Analysis (PCA)

🔹 **What it does:**
- PCA finds the main patterns in your high-dimensional data and squishes it down while keeping the most important information
- It finds the directions (called principal components) where the data varies the most and projects the data onto those

🔹 **Example:**
Imagine you have 100-dimensional data about different cars (like weight, engine size, fuel consumption, etc.).
PCA finds the most important 2 features that explain most of the differences between cars and gives you a 2D version of the data.

## Adding Your Own Algorithm

Adding a new dimension reduction algorithm is extremely simple:

1. Create a new file in the `algorithms/` directory (e.g., `algorithms/myNewAlgorithm.js`)
2. Implement the algorithm following the structure in the existing PCA file
3. Export it as the default export

**That's it!** The algorithm registry will automatically discover and register your algorithm.

### Example Algorithm Structure

```javascript
const myNewAlgorithm = {
  // Unique identifier for the algorithm
  id: 'myUniqueAlgorithmId',
  
  // Display name shown in UI
  name: 'My New Algorithm',
  
  // Description of what the algorithm does
  description: 'This algorithm does something cool with embeddings',
  
  // The actual reduction function
  reduce: function(embeddings) {
    if (!embeddings || embeddings.length === 0) {
      return null;
    }

    // Your algorithm implementation here
    // ...

    // Return required values
    return {
      indices: [0, 1, 2], // The three dimension indices to map to x, y, z
      minValues: [min1, min2, min3], // Min values for each dimension for scaling
      maxValues: [max1, max2, max3], // Max values for each dimension for scaling
      name: this.name,
      description: this.description
    };
  }
};

export default myNewAlgorithm;
```

## How Auto-Discovery Works

The system uses Vite's `import.meta.glob` feature to automatically scan the `algorithms/` directory for all JavaScript files. Each file is expected to export an algorithm object as its default export. The registry automatically imports and registers all algorithms it finds.

This means you can add new algorithms simply by adding new files to the directory - no manual registration required!

## API Reference

### Main Exports

- `getAvailableAlgorithms()`: Returns an array of all registered algorithms
- `applyDimensionReduction(embeddings, algorithmId)`: Applies a specific algorithm to embeddings
- `getCoordinatesFromEmbedding(embedding, reductionResult)`: Maps an embedding to 3D coordinates
- `getDimensionInfo(reductionResult)`: Gets info about which dimensions are being used
- `registerAlgorithm(algorithm)`: Registers a new algorithm at runtime (rarely needed since auto-discovery handles this)

### Algorithm Interface

Each algorithm should implement:

- `id`: String identifier (required)
- `name`: Display name (required)
- `description`: Short description of the algorithm (required)
- `reduce(embeddings)`: Function that implements the dimension reduction (required) 