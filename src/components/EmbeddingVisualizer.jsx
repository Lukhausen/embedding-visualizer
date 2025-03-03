import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import './EmbeddingVisualizer.css'
import { 
  getScene,
  getCamera,
  createRenderer,
  getControls,
  setupBasicScene,
  disposeResources,
  registerHMRHandlers,
  startAnimationLoop,
  scaleValue,
  updateAxisLabels
} from '../services/threeService'
import {
  applyDimensionReduction,
  getCoordinatesFromEmbedding,
  getDimensionInfo
} from '../services/dimensionReduction'

const EmbeddingVisualizer = forwardRef(({ 
  words = [], 
  onFocusChanged, 
  algorithmId = 'pca', 
  axisLabels = { x: "X", y: "Y", z: "Z" },
  textSize = 1
}, ref) => {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const pointsRef = useRef({})
  const stopAnimationRef = useRef(null)
  const [dimensionReduction, setDimensionReduction] = useState(null)
  const [dimensionInfo, setDimensionInfo] = useState(null)
  // Store disposable resources
  const disposablesRef = useRef({
    geometries: [],
    materials: [],
    textures: []
  });
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    focusOnPoint: (point) => {
      if (!cameraRef.current || !point) return
      
      // Calculate position to focus on
      const targetPosition = new THREE.Vector3(
        parseFloat(point.x) || 0,
        parseFloat(point.y) || 0,
        parseFloat(point.z) || 0
      )
      
      // Animate camera to focus on this point
      const currentPosition = cameraRef.current.position.clone()
      const newPosition = currentPosition.clone().lerp(
        targetPosition.clone().add(new THREE.Vector3(1, 1, 1)), 
        0.5
      )
      
      cameraRef.current.position.copy(newPosition)
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetPosition)
        controlsRef.current.update()
      }
    }
  }), []);

  // Initialize the 3D scene
  useEffect(() => {
    if (!containerRef.current) return
    
    // Initialize scene, camera, renderer using the service
    const scene = getScene()
    const camera = getCamera(window.innerWidth, window.innerHeight)
    const renderer = createRenderer(window.innerWidth, window.innerHeight)
    
    // Store references
    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    
    // Add renderer to DOM
    containerRef.current.appendChild(renderer.domElement)
    
    // Set up controls
    const controls = getControls(camera, renderer.domElement)
    controlsRef.current = controls
    
    // Set up the scene if it hasn't been set up yet (first load)
    if (scene.children.length === 0) {
      setupBasicScene(scene, axisLabels, textSize)
    } else {
      // If the scene already exists, update the axis labels
      updateAxisLabels(scene, axisLabels, textSize)
    }

    // Handle window resize
    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    
    // Set up the animation loop
    const renderFunction = () => {
      if (controls) {
        controls.update() // Make sure controls are updated every frame
      }
      renderer.render(scene, camera)
    }
    
    const stopAnimation = startAnimationLoop(renderFunction)
    stopAnimationRef.current = stopAnimation
    
    // Register HMR handlers
    registerHMRHandlers(() => {
      // Clean up animation
      if (stopAnimationRef.current) {
        stopAnimationRef.current()
      }
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize)
      
      // Dispose renderer resources
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.forceContextLoss()
        rendererRef.current.domElement.remove()
      }
    })

    // Expose API to parent
    if (onFocusChanged) {
      onFocusChanged({
        focusOnPoint: (point) => {
          if (!camera || !point) return
          
          // Calculate position to focus on
          const targetPosition = new THREE.Vector3(
            parseFloat(point.x) || 0,
            parseFloat(point.y) || 0,
            parseFloat(point.z) || 0
          )
          
          // Animate camera to focus on this point
          const currentPosition = camera.position.clone()
          const newPosition = currentPosition.clone().lerp(
            targetPosition.clone().add(new THREE.Vector3(1, 1, 1)), 
            0.5
          )
          
          camera.position.copy(newPosition)
          if (controls) {
            controls.target.copy(targetPosition)
            controls.update()
          }
        }
      })
    }

    return () => {
      // Clean up on unmount
      if (stopAnimationRef.current) {
        stopAnimationRef.current()
      }
      
      window.removeEventListener('resize', handleResize)
      
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.forceContextLoss()
        rendererRef.current.domElement.remove()
      }

      // Make sure to dispose of controls
      if (controlsRef.current) {
        controlsRef.current.dispose()
      }
    }
  }, [onFocusChanged]) // Only re-run on onFocusChanged change

  // Make sure controls are updated when axisLabels change
  useEffect(() => {
    if (sceneRef.current && controlsRef.current) {
      updateAxisLabels(sceneRef.current, axisLabels)
      controlsRef.current.update() // Update controls after changing labels
    }
  }, [axisLabels])

  // Load and reduce embeddings when words change
  useEffect(() => {
    // First, collect all embeddings that are available
    const embeddings = []
    const wordObjects = []
    
    for (let i = 0; i < words.length; i++) {
      // Get the word data from localStorage if available
      const savedWords = localStorage.getItem('embedding-words')
      if (savedWords) {
        try {
          const parsedWords = JSON.parse(savedWords)
          const wordObj = parsedWords.find(w => w.text === words[i])
          if (wordObj && wordObj.embedding) {
            embeddings.push(wordObj.embedding)
            wordObjects.push(wordObj)
          }
        } catch (error) {
          console.error('Error parsing saved words:', error)
        }
      }
    }
    
    // If we have at least one embedding, apply dimension reduction
    if (embeddings.length > 0) {
      // Apply the selected dimension reduction algorithm
      const result = applyDimensionReduction(embeddings, algorithmId)
      
      // Store the dimension reduction result
      setDimensionReduction({
        ...result,
        wordObjects
      })
      
      // Get information about the dimensions being used
      setDimensionInfo(getDimensionInfo(result))
    } else {
      setDimensionReduction(null)
      setDimensionInfo(null)
    }
  }, [words, algorithmId])

  // Regenerate points when embeddings change
  useEffect(() => {
    // Skip if no scene or no dimension reduction
    if (!sceneRef.current || !dimensionReduction) return
    
    // Clear any existing points
    clearPoints()
    
    // Get the word objects with embeddings
    const { wordObjects } = dimensionReduction
    
    // Add points for each word with an embedding
    wordObjects.forEach((wordObj) => {
      // Get 3D coordinates for this embedding
      const coordinates = getCoordinatesFromEmbedding(wordObj.embedding, dimensionReduction)
      addPointWithLabel(wordObj.text, coordinates, wordObj.embedding)
    })
    
    // Handle words without embeddings
    handleWordsWithoutEmbeddings(wordObjects)
    
  }, [dimensionReduction, words, textSize]) // Re-run when textSize changes

  // Update axis labels when they change
  useEffect(() => {
    if (!sceneRef.current) return
    
    updateAxisLabels(sceneRef.current, axisLabels, textSize)
  }, [axisLabels, textSize]);

  // Helper function to create word labels with adjustable size
  const createWordLabel = (text, position, color, textSizeMultiplier) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 32
    
    const textColor = color.clone().multiplyScalar(1.5).getStyle()
    context.fillStyle = textColor
    // Apply text size scaling
    const fontSize = Math.round(24 * textSizeMultiplier)
    context.font = `${fontSize}px Arial`
    context.fillText(text, 4, Math.min(24, fontSize))
    
    const texture = new THREE.CanvasTexture(canvas)
    disposablesRef.current.textures.push(texture)
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true 
    })
    disposablesRef.current.materials.push(spriteMaterial)
    
    const label = new THREE.Sprite(spriteMaterial)
    label.position.copy(position)
    label.position.y += 0.1
    // Scale the sprite based on text size
    label.scale.set(0.5 * textSizeMultiplier, 0.0625 * textSizeMultiplier, 1)

    return label
  }

  // Clear all points from the scene
  const clearPoints = () => {
    // Remove old points
    Object.values(pointsRef.current).forEach(point => {
      if (point.mesh) {
        sceneRef.current.remove(point.mesh)
        if (point.mesh.geometry) point.mesh.geometry.dispose()
        if (point.mesh.material) {
          if (Array.isArray(point.mesh.material)) {
            point.mesh.material.forEach(m => m.dispose())
          } else {
            point.mesh.material.dispose()
          }
        }
      }
      if (point.label) {
        sceneRef.current.remove(point.label)
        if (point.label.material && point.label.material.map) {
          point.label.material.map.dispose()
        }
        if (point.label.material) point.label.material.dispose()
      }
    })
    pointsRef.current = {}
    
    // Reset disposables
    disposablesRef.current = {
      geometries: [],
      materials: [],
      textures: []
    };
  }

  // Add a point with label to the scene
  const addPointWithLabel = (text, coordinates, embedding) => {
    const position = new THREE.Vector3(coordinates.x, coordinates.y, coordinates.z)

    // Create point with color based on position
    const geometry = new THREE.SphereGeometry(0.05, 32, 32)
    disposablesRef.current.geometries.push(geometry)
    
    // Generate a color based on position to help differentiate points
    const hue = (position.x + 2) / 4
    const saturation = 0.7 + (position.y + 2) / 16
    const lightness = 0.5 + (position.z + 2) / 16
    const color = new THREE.Color().setHSL(hue, saturation, lightness)
    
    const material = new THREE.MeshStandardMaterial({ 
      color: color,
      emissive: color.clone().multiplyScalar(0.3),
      metalness: 0.3,
      roughness: 0.7
    })
    disposablesRef.current.materials.push(material)
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)

    // Create label
    const label = createWordLabel(text, position, color, textSize)

    sceneRef.current.add(mesh)
    sceneRef.current.add(label)

    pointsRef.current[text] = { mesh, label }
  }

  // Handle words without embeddings
  const handleWordsWithoutEmbeddings = (wordObjectsWithEmbeddings) => {
    // If we have no embeddings but have words, add default positions for words without embeddings
    if (wordObjectsWithEmbeddings.length === 0 && words.length > 0) {
      words.forEach((word) => {
        // Create random positions for words without embeddings
        const position = new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        )

        // Create point with color based on position
        const geometry = new THREE.SphereGeometry(0.05, 32, 32)
        disposablesRef.current.geometries.push(geometry)
        
        const hue = (position.x + 1.5) / 3 * 0.33 + (position.z + 1.5) / 3 * 0.67
        const color = new THREE.Color().setHSL(hue, 0.8, 0.6)
        
        const material = new THREE.MeshStandardMaterial({ 
          color: color,
          emissive: color.clone().multiplyScalar(0.3),
          metalness: 0.3,
          roughness: 0.7
        })
        disposablesRef.current.materials.push(material)
        
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.copy(position)

        // Create label
        const label = createWordLabel(word, position, color, textSize)

        sceneRef.current.add(mesh)
        sceneRef.current.add(label)

        pointsRef.current[word] = { mesh, label }
      })
    }
  }

  return (
    <div className="embedding-visualizer" ref={containerRef}>
      {dimensionInfo && (
        <div className="visualizer-info">
          <p>
            <strong>Algorithm:</strong> {dimensionInfo.algorithm}<br />
            <strong>{axisLabels.x}-axis:</strong> Dimension #{dimensionInfo.xDimension}<br />
            <strong>{axisLabels.y}-axis:</strong> Dimension #{dimensionInfo.yDimension}<br />
            <strong>{axisLabels.z}-axis:</strong> Dimension #{dimensionInfo.zDimension}
          </p>
        </div>
      )}
    </div>
  )
})

export default EmbeddingVisualizer