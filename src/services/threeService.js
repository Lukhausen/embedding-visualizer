/**
 * Centralized Three.js service for managing scene and rendering
 * This file helps maintain a single instance of Three.js across HMR updates
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// HMR cache objects
let sceneCache = null;
let cameraCache = null;
let rendererCache = null;
let controlsCache = null;
let animationIdCache = null;

/**
 * Creates or retrieves a cached scene instance
 * @returns {THREE.Scene} The Three.js scene
 */
export const getScene = () => {
  if (import.meta.hot && sceneCache) {
    return sceneCache;
  }
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);
  
  // Cache for HMR
  if (import.meta.hot) {
    sceneCache = scene;
  }
  
  return scene;
};

/**
 * Creates or retrieves a cached camera instance
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @returns {THREE.PerspectiveCamera} The Three.js camera
 */
export const getCamera = (width, height) => {
  if (import.meta.hot && cameraCache) {
    return cameraCache;
  }
  
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 5;
  camera.position.y = 2;
  camera.position.x = 2;
  
  // Cache for HMR
  if (import.meta.hot) {
    cameraCache = camera;
  }
  
  return camera;
};

/**
 * Creates a new renderer (always fresh, not cached)
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @returns {THREE.WebGLRenderer} The Three.js renderer
 */
export const createRenderer = (width, height) => {
  // Always create a new renderer to avoid WebGL context loss issues
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  return renderer;
};

/**
 * Gets or creates orbit controls
 * @param {THREE.Camera} camera - The camera to control
 * @param {HTMLElement} domElement - The DOM element for control events
 * @returns {OrbitControls} The orbit controls
 */
export const getControls = (camera, domElement) => {
  if (import.meta.hot && controlsCache) {
    controlsCache.domElement = domElement;
    controlsCache.enabled = true;
    return controlsCache;
  }
  
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enablePan = true;
  
  // Cache for HMR
  if (import.meta.hot) {
    controlsCache = controls;
  }
  
  return controls;
};

/**
 * Creates a text label sprite
 * @param {string} text - The text to display
 * @param {THREE.Vector3} position - Position in 3D space
 * @param {string} color - CSS color string
 * @param {number} [textSize=1] - Text size multiplier
 * @returns {THREE.Sprite} The text sprite
 */
export const createTextSprite = (text, position, color = '#ffffff', textSize = 1) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // Scale canvas based on text size with a more generous allocation for larger sizes
  const baseWidth = 128;
  const baseHeight = 32;
  
  // Use a non-linear scaling for very large text sizes to prevent excessive canvas sizes
  const effectiveScale = textSize <= 2 ? textSize : 2 + (textSize - 2) * 0.7;
  
  canvas.width = Math.ceil(baseWidth * effectiveScale * (1 + text.length * 0.03));
  canvas.height = Math.ceil(baseHeight * effectiveScale);
  
  context.fillStyle = color;
  // Apply text size to the font
  const fontSize = Math.round(24 * effectiveScale);
  context.font = `${fontSize}px Arial`;
  
  // Clear canvas with transparent background
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  // Calculate better text position to prevent cut-off
  // Center text horizontally in the canvas
  const textMetrics = context.measureText(text);
  const textX = (canvas.width - textMetrics.width) / 2;
  const textY = canvas.height / 2 + fontSize / 3;
  context.fillText(text, textX, textY);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true 
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  // Use the effective scale to maintain appropriate visible size
  const widthRatio = effectiveScale * (1 + text.length * 0.03);
  const heightRatio = effectiveScale;
  sprite.scale.set(0.5 * widthRatio, 0.125 * heightRatio, 1);
  
  return sprite;
};

/**
 * Sets up a basic scene with axes, labels, grid and lighting
 * 
 * @param {THREE.Scene} scene - The scene to set up
 * @param {Object} axisLabels - Custom labels for axes {x, y, z}
 * @param {number} textSize - Adjusts the size of text elements
 * @param {number} labelsPerAxis - Number of labels to show per axis (default: 1)
 * @returns {void}
 */
export const setupBasicScene = (scene, axisLabels = { x: 'X', y: 'Y', z: 'Z' }, textSize = 1, labelsPerAxis = 1) => {
  if (!scene) return;
  
  // Store the text size for later updates
  scene.userData.textSize = textSize;
  
  // Create coordinate axes
  const axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);
  
  // Add grid helper
  const gridHelper = new THREE.GridHelper(4, 10, 0x555555, 0x333333);
  scene.add(gridHelper);
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  // Position labels above the axis ends
  const xLabelPos = new THREE.Vector3(2.2, 0.15, 0);
  const yLabelPos = new THREE.Vector3(0, 2.2 + 0.15, 0);
  const zLabelPos = new THREE.Vector3(0, 0.15, 2.2);
  
  // Create axis labels
  const xLabel = createTextSprite(axisLabels.x, xLabelPos, '#ff5555', textSize);
  const yLabel = createTextSprite(axisLabels.y, yLabelPos, '#55ff55', textSize);
  const zLabel = createTextSprite(axisLabels.z, zLabelPos, '#5555ff', textSize);
  
  // Add labels to the scene
  scene.add(xLabel);
  scene.add(yLabel);
  scene.add(zLabel);
  
  // Store the labels in scene userData for later updates
  scene.userData.axisLabels = {
    x: xLabel,
    y: yLabel,
    z: zLabel
  };
  
  // Setup for additional labels
  scene.userData.additionalLabels = [];
};

/**
 * Updates the axis labels in the scene
 * 
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {Object} axisLabels - Object containing labels for x, y, and z axes
 * @param {Number} textSize - The size of the text
 * @param {Number} labelsPerAxis - Number of labels to show per axis (default: 1)
 * @param {Object} dimensionInfo - Information about the dimensions being displayed
 * @param {Object} dimensionReduction - The dimension reduction result containing embeddings
 * @returns {Boolean} - Whether the update was successful
 */
export const updateAxisLabels = (scene, axisLabels = { x: 'X', y: 'Y', z: 'Z' }, textSize, labelsPerAxis = 1, dimensionInfo, dimensionReduction) => {
  if (!scene || !scene.userData.axisLabels) {
    return false;
  }
  
  // Use stored text size if not provided
  const fontSize = textSize !== undefined ? textSize : (scene.userData.textSize || 1);
  
  // Get the stored label sprites
  const { x: xLabel, y: yLabel, z: zLabel } = scene.userData.axisLabels;
  
  // Remove old sprites
  scene.remove(xLabel);
  scene.remove(yLabel);
  scene.remove(zLabel);
  
  // Remove any additional labels that might have been added previously
  if (scene.userData.additionalLabels) {
    scene.userData.additionalLabels.forEach(label => {
      scene.remove(label);
    });
  }
  
  // Initialize or reset the additional labels array
  scene.userData.additionalLabels = [];
  
  // Position primary labels above the axis ends
  const xLabelPos = new THREE.Vector3(2.2, 0.15, 0);
  const yLabelPos = new THREE.Vector3(0, 2.2 + 0.15, 0);
  const zLabelPos = new THREE.Vector3(0, 0.15, 2.2);
  
  // Create and add new primary sprites
  const newXLabel = createTextSprite(axisLabels.x, xLabelPos, '#ff5555', fontSize);
  const newYLabel = createTextSprite(axisLabels.y, yLabelPos, '#55ff55', fontSize);
  const newZLabel = createTextSprite(axisLabels.z, zLabelPos, '#5555ff', fontSize);
  
  scene.add(newXLabel);
  scene.add(newYLabel);
  scene.add(newZLabel);
  
  // Add additional labels if requested and if we have dimension info and reduction data
  if (labelsPerAxis > 1 && dimensionInfo && dimensionReduction) {
    try {
      // Find the most representative words for each dimension
      const additionalLabels = findTopWordsForDimensions(dimensionReduction, dimensionInfo, labelsPerAxis);
      
      // Add X axis additional labels
      if (additionalLabels.x && additionalLabels.x.length) {
        additionalLabels.x.forEach((label, index) => {
          if (index === 0) return; // Skip the first one as it's already the primary label
          const position = new THREE.Vector3(2.2 - (index * 0.4), 0.15, 0);
          const sprite = createTextSprite(label, position, '#ff5555', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add Y axis additional labels
      if (additionalLabels.y && additionalLabels.y.length) {
        additionalLabels.y.forEach((label, index) => {
          if (index === 0) return; // Skip the first one as it's already the primary label
          const position = new THREE.Vector3(0, 2.2 + 0.15 - (index * 0.4), 0);
          const sprite = createTextSprite(label, position, '#55ff55', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add Z axis additional labels
      if (additionalLabels.z && additionalLabels.z.length) {
        additionalLabels.z.forEach((label, index) => {
          if (index === 0) return; // Skip the first one as it's already the primary label
          const position = new THREE.Vector3(0, 0.15, 2.2 - (index * 0.4));
          const sprite = createTextSprite(label, position, '#5555ff', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
    } catch (error) {
      console.error('Error adding additional axis labels:', error);
    }
  }
  
  // Store the new labels in scene userData
  scene.userData.axisLabels = { x: newXLabel, y: newYLabel, z: newZLabel };
  scene.userData.textSize = fontSize;
  
  return true;
}

/**
 * Finds the most representative words for each dimension
 * 
 * @param {Object} dimensionReduction - The dimension reduction result
 * @param {Object} dimensionInfo - Information about the dimensions being displayed
 * @param {Number} count - Number of words to find per dimension
 * @returns {Object} - Object containing arrays of top words for each axis
 */
const findTopWordsForDimensions = (dimensionReduction, dimensionInfo, count) => {
  if (!dimensionReduction || !dimensionReduction.wordObjects || !dimensionInfo) {
    return { x: [], y: [], z: [] };
  }
  
  const { wordObjects } = dimensionReduction;
  const { xDimension, yDimension, zDimension } = dimensionInfo;
  
  // Sort words by their value in each dimension to find the most representative ones
  const xWords = [...wordObjects].sort((a, b) => {
    return Math.abs(b.embedding[xDimension]) - Math.abs(a.embedding[xDimension]);
  }).slice(0, count).map(obj => obj.text);
  
  const yWords = [...wordObjects].sort((a, b) => {
    return Math.abs(b.embedding[yDimension]) - Math.abs(a.embedding[yDimension]);
  }).slice(0, count).map(obj => obj.text);
  
  const zWords = [...wordObjects].sort((a, b) => {
    return Math.abs(b.embedding[zDimension]) - Math.abs(a.embedding[zDimension]);
  }).slice(0, count).map(obj => obj.text);
  
  return { x: xWords, y: yWords, z: zWords };
}

/**
 * Safely dispose Three.js objects to prevent memory leaks
 * @param {Object} object - Object containing arrays of disposable resources
 */
export const disposeResources = (object) => {
  if (!object) return;
  
  // Dispose geometries
  if (object.geometries && Array.isArray(object.geometries)) {
    object.geometries.forEach(geometry => {
      if (geometry && typeof geometry.dispose === 'function') {
        geometry.dispose();
      }
    });
  }
  
  // Dispose materials
  if (object.materials && Array.isArray(object.materials)) {
    object.materials.forEach(material => {
      if (material && typeof material.dispose === 'function') {
        material.dispose();
      }
    });
  }
  
  // Dispose textures
  if (object.textures && Array.isArray(object.textures)) {
    object.textures.forEach(texture => {
      if (texture && typeof texture.dispose === 'function') {
        texture.dispose();
      }
    });
  }
  
  // Dispose renderers
  if (object.renderer && typeof object.renderer.dispose === 'function') {
    object.renderer.dispose();
    if (typeof object.renderer.forceContextLoss === 'function') {
      object.renderer.forceContextLoss();
    }
  }
};

/**
 * Registers HMR cleanup handlers
 * @param {Function} cleanupFunction - Function to run on HMR update
 */
export const registerHMRHandlers = (cleanupFunction) => {
  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
      if (typeof cleanupFunction === 'function') {
        cleanupFunction();
      }
      
      // Cancel any active animation frames
      if (animationIdCache) {
        cancelAnimationFrame(animationIdCache);
        animationIdCache = null;
      }
    });
  }
};

/**
 * Start animation loop with proper HMR handling
 * @param {Function} renderFunction - Function that performs the rendering
 * @returns {Function} Function to stop the animation
 */
export const startAnimationLoop = (renderFunction) => {
  if (!renderFunction || typeof renderFunction !== 'function') {
    throw new Error('Animation loop requires a render function');
  }
  
  const animate = () => {
    animationIdCache = requestAnimationFrame(animate);
    if (controlsCache) {
      controlsCache.update();
    }
    renderFunction();
  };
  
  animate();
  
  return () => {
    if (animationIdCache) {
      cancelAnimationFrame(animationIdCache);
      animationIdCache = null;
    }
  };
};

/**
 * Scales a value from one range to another
 * @param {number} value - The input value to scale
 * @param {number} min - Minimum input range
 * @param {number} max - Maximum input range
 * @param {number} targetMin - Minimum output range
 * @param {number} targetMax - Maximum output range
 * @returns {number} The scaled value
 */
export const scaleValue = (value, min, max, targetMin = -2, targetMax = 2) => {
  // Handle edge case where min equals max
  if (min === max) return (targetMin + targetMax) / 2;
  return targetMin + (value - min) * (targetMax - targetMin) / (max - min);
}; 