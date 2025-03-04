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
 * Creates a custom axes helper with both positive and negative directions
 * @param {number} size - Length of each axis
 * @returns {THREE.Group} Group containing all axis lines
 */
const createBidirectionalAxesHelper = (size = 2) => {
  const group = new THREE.Group();
  
  // Materials for each axis
  const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red for X
  const yAxisMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green for Y
  const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue for Z
  
  // Create positive X axis
  const posXGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(size, 0, 0)
  ]);
  const posXLine = new THREE.Line(posXGeometry, xAxisMaterial);
  group.add(posXLine);
  
  // Create negative X axis
  const negXGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-size, 0, 0)
  ]);
  const negXLine = new THREE.Line(negXGeometry, xAxisMaterial);
  group.add(negXLine);
  
  // Create positive Y axis
  const posYGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, size, 0)
  ]);
  const posYLine = new THREE.Line(posYGeometry, yAxisMaterial);
  group.add(posYLine);
  
  // Create negative Y axis
  const negYGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -size, 0)
  ]);
  const negYLine = new THREE.Line(negYGeometry, yAxisMaterial);
  group.add(negYLine);
  
  // Create positive Z axis
  const posZGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, size)
  ]);
  const posZLine = new THREE.Line(posZGeometry, zAxisMaterial);
  group.add(posZLine);
  
  // Create negative Z axis
  const negZGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -size)
  ]);
  const negZLine = new THREE.Line(negZGeometry, zAxisMaterial);
  group.add(negZLine);
  
  return group;
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
  
  // Create bidirectional coordinate axes instead of standard AxesHelper
  const axesHelper = createBidirectionalAxesHelper(2);
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
  const negXLabelPos = new THREE.Vector3(-2.2, 0.15, 0);
  const yLabelPos = new THREE.Vector3(0, 2.2 + 0.15, 0);
  const negYLabelPos = new THREE.Vector3(0, -2.2 + 0.15, 0);
  const zLabelPos = new THREE.Vector3(0, 0.15, 2.2);
  const negZLabelPos = new THREE.Vector3(0, 0.15, -2.2);
  
  // Create axis labels
  const xLabel = createTextSprite(axisLabels.x, xLabelPos, '#ff5555', textSize);
  const negXLabel = createTextSprite('-' + axisLabels.x, negXLabelPos, '#ff5555', textSize);
  const yLabel = createTextSprite(axisLabels.y, yLabelPos, '#55ff55', textSize);
  const negYLabel = createTextSprite('-' + axisLabels.y, negYLabelPos, '#55ff55', textSize);
  const zLabel = createTextSprite(axisLabels.z, zLabelPos, '#5555ff', textSize);
  const negZLabel = createTextSprite('-' + axisLabels.z, negZLabelPos, '#5555ff', textSize);
  
  // Add labels to the scene
  scene.add(xLabel);
  scene.add(negXLabel);
  scene.add(yLabel);
  scene.add(negYLabel);
  scene.add(zLabel);
  scene.add(negZLabel);
  
  // Store the labels in scene userData for later updates
  scene.userData.axisLabels = {
    x: xLabel,
    negX: negXLabel,
    y: yLabel,
    negY: negYLabel,
    z: zLabel,
    negZ: negZLabel
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
export const updateAxisLabels = (scene, axisLabels = { x: "X", y: "Y", z: "Z" }, textSize, labelsPerAxis = 1, dimensionInfo, dimensionReduction) => {
  if (!scene || !scene.userData.axisLabels) {
    return false;
  }
  
  // Check if anything has actually changed before doing work
  const hasLabelsChanged = !scene.userData.currentAxisLabels ||
    scene.userData.currentAxisLabels.x !== axisLabels.x ||
    scene.userData.currentAxisLabels.y !== axisLabels.y ||
    scene.userData.currentAxisLabels.z !== axisLabels.z ||
    scene.userData.currentAxisLabels.negX !== axisLabels.negX ||
    scene.userData.currentAxisLabels.negY !== axisLabels.negY ||
    scene.userData.currentAxisLabels.negZ !== axisLabels.negZ;
  
  const hasSettingsChanged = 
    scene.userData.textSize !== textSize ||
    scene.userData.labelsPerAxis !== labelsPerAxis;
  
  // Skip update if nothing changed
  if (!hasLabelsChanged && !hasSettingsChanged && !dimensionInfo) {
    return false;
  }
  
  // Store current values for future reference
  scene.userData.currentAxisLabels = {...axisLabels};
  
  // Use stored text size if not provided
  const fontSize = textSize !== undefined ? textSize : (scene.userData.textSize || 1);
  
  // Get the stored label sprites
  const { x: xLabel, negX: negXLabel, y: yLabel, negY: negYLabel, z: zLabel, negZ: negZLabel } = scene.userData.axisLabels;
  
  // Remove old sprites
  scene.remove(xLabel);
  scene.remove(negXLabel);
  scene.remove(yLabel);
  scene.remove(negYLabel);
  scene.remove(zLabel);
  scene.remove(negZLabel);
  
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
  const negXLabelPos = new THREE.Vector3(-2.2, 0.15, 0);
  const yLabelPos = new THREE.Vector3(0, 2.2 + 0.15, 0);
  const negYLabelPos = new THREE.Vector3(0, -2.2 + 0.15, 0);
  const zLabelPos = new THREE.Vector3(0, 0.15, 2.2);
  const negZLabelPos = new THREE.Vector3(0, 0.15, -2.2);
  
  // Get negative labels (either from the passed labels or by prefixing the regular labels)
  const negXText = axisLabels.negX || ('-' + axisLabels.x);
  const negYText = axisLabels.negY || ('-' + axisLabels.y);
  const negZText = axisLabels.negZ || ('-' + axisLabels.z);
  
  // Create and add new primary sprites
  const newXLabel = createTextSprite(axisLabels.x, xLabelPos, '#ff5555', fontSize);
  const newNegXLabel = createTextSprite(negXText, negXLabelPos, '#ff5555', fontSize);
  const newYLabel = createTextSprite(axisLabels.y, yLabelPos, '#55ff55', fontSize);
  const newNegYLabel = createTextSprite(negYText, negYLabelPos, '#55ff55', fontSize);
  const newZLabel = createTextSprite(axisLabels.z, zLabelPos, '#5555ff', fontSize);
  const newNegZLabel = createTextSprite(negZText, negZLabelPos, '#5555ff', fontSize);
  
  scene.add(newXLabel);
  scene.add(newNegXLabel);
  scene.add(newYLabel);
  scene.add(newNegYLabel);
  scene.add(newZLabel);
  scene.add(newNegZLabel);
  
  // Add additional labels if requested
  if (labelsPerAxis > 1) {
    try {
      // Get additional labels from localStorage (these are the sorted suggestions)
      const savedAdditionalLabels = localStorage.getItem('axis-additional-labels');
      let additionalLabels = { 
        x: [], y: [], z: [], 
        negX: [], negY: [], negZ: [] 
      };
      
      if (savedAdditionalLabels) {
        try {
          additionalLabels = JSON.parse(savedAdditionalLabels);
        } catch (e) {
          console.error('Error parsing additional labels:', e);
        }
      }
      
      // Add X axis additional labels (positive direction)
      if (additionalLabels.x && additionalLabels.x.length) {
        additionalLabels.x.slice(0, Math.max(0, labelsPerAxis - 1)).forEach((label, index) => {
          const position = new THREE.Vector3(2.2 - ((index+1) * 0.4), 0.15, 0);
          const sprite = createTextSprite(label, position, '#ff5555', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add X axis additional labels (negative direction)
      if (additionalLabels.negX && additionalLabels.negX.length) {
        additionalLabels.negX.slice(0, Math.max(0, labelsPerAxis - 1)).forEach((label, index) => {
          const position = new THREE.Vector3(-2.2 + ((index+1) * 0.4), 0.15, 0);
          const sprite = createTextSprite(label, position, '#ff5555', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add Y axis additional labels (positive direction)
      if (additionalLabels.y && additionalLabels.y.length) {
        additionalLabels.y.slice(0, Math.max(0, labelsPerAxis - 1)).forEach((label, index) => {
          const position = new THREE.Vector3(0, 2.2 + 0.15 - ((index+1) * 0.4), 0);
          const sprite = createTextSprite(label, position, '#55ff55', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add Y axis additional labels (negative direction)
      if (additionalLabels.negY && additionalLabels.negY.length) {
        additionalLabels.negY.slice(0, Math.max(0, labelsPerAxis - 1)).forEach((label, index) => {
          const position = new THREE.Vector3(0, -2.2 + 0.15 + ((index+1) * 0.4), 0);
          const sprite = createTextSprite(label, position, '#55ff55', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add Z axis additional labels (positive direction)
      if (additionalLabels.z && additionalLabels.z.length) {
        additionalLabels.z.slice(0, Math.max(0, labelsPerAxis - 1)).forEach((label, index) => {
          const position = new THREE.Vector3(0, 0.15, 2.2 - ((index+1) * 0.4));
          const sprite = createTextSprite(label, position, '#5555ff', fontSize * 0.8);
          scene.add(sprite);
          scene.userData.additionalLabels.push(sprite);
        });
      }
      
      // Add Z axis additional labels (negative direction)
      if (additionalLabels.negZ && additionalLabels.negZ.length) {
        additionalLabels.negZ.slice(0, Math.max(0, labelsPerAxis - 1)).forEach((label, index) => {
          const position = new THREE.Vector3(0, 0.15, -2.2 + ((index+1) * 0.4));
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
  scene.userData.axisLabels = { 
    x: newXLabel, 
    negX: newNegXLabel,
    y: newYLabel, 
    negY: newNegYLabel,
    z: newZLabel, 
    negZ: newNegZLabel 
  };
  scene.userData.textSize = fontSize;
  
  return true;
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