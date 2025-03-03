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
    return controlsCache;
  }
  
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
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
 * @returns {THREE.Sprite} The text sprite
 */
export const createTextSprite = (text, position, color = '#ffffff') => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 32;
  context.fillStyle = color;
  context.font = '24px Arial';
  context.fillText(text, 4, 24);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(0.5, 0.125, 1);
  
  return sprite;
};

/**
 * Sets up the basic scene with axes, grid, and lighting
 * @param {THREE.Scene} scene - The scene to set up
 */
export const setupBasicScene = (scene) => {
  // Add coordinate axes
  const axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);
  
  // Add axis labels
  scene.add(createTextSprite('X', new THREE.Vector3(2.2, 0, 0), '#ff5555'));
  scene.add(createTextSprite('Y', new THREE.Vector3(0, 2.2, 0), '#55ff55'));
  scene.add(createTextSprite('Z', new THREE.Vector3(0, 0, 2.2), '#5555ff'));
  
  // Add grid helper
  const gridHelper = new THREE.GridHelper(4, 10, 0x555555, 0x333333);
  scene.add(gridHelper);
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
};

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