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
  scaleValue
} from '../services/threeService'

const EmbeddingVisualizer = forwardRef(({ words = [], onFocusChanged }, ref) => {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const pointsRef = useRef({})
  const stopAnimationRef = useRef(null)
  const [showControls, setShowControls] = useState(true)
  const [principalDimensions, setPrincipalDimensions] = useState(null)
  
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

  // Hide controls info after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowControls(false)
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [])

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
      setupBasicScene(scene)
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
      controls.update()
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
      // Only fully clean up if not handling HMR
      if (!import.meta.hot) {
        window.removeEventListener('resize', handleResize)
        
        // Stop animation loop
        if (stopAnimationRef.current) {
          stopAnimationRef.current()
        }
        
        // Dispose renderer and remove from DOM
        if (rendererRef.current) {
          rendererRef.current.dispose()
          rendererRef.current.forceContextLoss()
        }
        
        if (containerRef.current && rendererRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement)
        }
      }
    }
  }, [onFocusChanged])

  // Find the most informative dimensions across all embeddings
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
    
    // If we have at least one embedding, compute the principal dimensions
    if (embeddings.length > 0) {
      // Find the dimensionality of embeddings
      const dimensions = embeddings[0].length
      
      // Calculate importance of each dimension
      // (sum of absolute values across all embeddings)
      const dimensionImportance = new Array(dimensions).fill(0)
      
      for (const embedding of embeddings) {
        for (let i = 0; i < dimensions; i++) {
          dimensionImportance[i] += Math.abs(embedding[i])
        }
      }
      
      // Find indices of the three most important dimensions
      const indexedDims = dimensionImportance.map((value, index) => ({ value, index }))
      indexedDims.sort((a, b) => b.value - a.value) // Sort in descending order
      
      const topDimensions = indexedDims.slice(0, 3).map(item => item.index)
      
      // Store the principal dimensions
      setPrincipalDimensions({
        indices: topDimensions,
        wordObjects: wordObjects
      })
    }
  }, [words])

  // Update points when principal dimensions change
  useEffect(() => {
    if (!sceneRef.current || !principalDimensions) return
    
    // Store all created geometries, materials, and textures for proper disposal
    const disposables = {
      geometries: [],
      materials: [],
      textures: []
    }

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

    const { indices, wordObjects } = principalDimensions
    
    // Calculate min/max values for each principal dimension to normalize
    const minValues = [Infinity, Infinity, Infinity]
    const maxValues = [-Infinity, -Infinity, -Infinity]
    
    for (const wordObj of wordObjects) {
      for (let i = 0; i < 3; i++) {
        const dimIndex = indices[i]
        const value = wordObj.embedding[dimIndex]
        minValues[i] = Math.min(minValues[i], value)
        maxValues[i] = Math.max(maxValues[i], value)
      }
    }
    
    // Add points for each word
    wordObjects.forEach((wordObj) => {
      // Map the three principal dimensions to x, y, z
      const position = new THREE.Vector3(
        scaleValue(wordObj.embedding[indices[0]], minValues[0], maxValues[0]),
        scaleValue(wordObj.embedding[indices[1]], minValues[1], maxValues[1]),
        scaleValue(wordObj.embedding[indices[2]], minValues[2], maxValues[2])
      )

      // Create point with color based on position
      const geometry = new THREE.SphereGeometry(0.05, 32, 32)
      disposables.geometries.push(geometry)
      
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
      disposables.materials.push(material)
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(position)

      // Create label
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 256
      canvas.height = 32
      
      const textColor = color.clone().multiplyScalar(1.5).getStyle()
      context.fillStyle = textColor
      context.font = '24px Arial'
      context.fillText(wordObj.text, 4, 24)
      
      const texture = new THREE.CanvasTexture(canvas)
      disposables.textures.push(texture)
      
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true 
      })
      disposables.materials.push(spriteMaterial)
      
      const label = new THREE.Sprite(spriteMaterial)
      label.position.copy(position)
      label.position.y += 0.1
      label.scale.set(0.5, 0.0625, 1)

      sceneRef.current.add(mesh)
      sceneRef.current.add(label)

      pointsRef.current[wordObj.text] = { mesh, label }
    })

    // If we have no embeddings but have words, add default positions for words without embeddings
    if (wordObjects.length === 0 && words.length > 0) {
      words.forEach((word) => {
        // Create random positions for words without embeddings
        const position = new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        )

        // Create point with color based on position
        const geometry = new THREE.SphereGeometry(0.05, 32, 32)
        disposables.geometries.push(geometry)
        
        const hue = (position.x + 1.5) / 3 * 0.33 + (position.z + 1.5) / 3 * 0.67
        const color = new THREE.Color().setHSL(hue, 0.8, 0.6)
        
        const material = new THREE.MeshStandardMaterial({ 
          color: color,
          emissive: color.clone().multiplyScalar(0.3),
          metalness: 0.3,
          roughness: 0.7
        })
        disposables.materials.push(material)
        
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.copy(position)

        // Create label
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.width = 256
        canvas.height = 32
        
        const textColor = color.clone().multiplyScalar(1.5).getStyle()
        context.fillStyle = textColor
        context.font = '24px Arial'
        context.fillText(word, 4, 24)
        
        const texture = new THREE.CanvasTexture(canvas)
        disposables.textures.push(texture)
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
          map: texture,
          transparent: true 
        })
        disposables.materials.push(spriteMaterial)
        
        const label = new THREE.Sprite(spriteMaterial)
        label.position.copy(position)
        label.position.y += 0.1
        label.scale.set(0.5, 0.0625, 1)

        sceneRef.current.add(mesh)
        sceneRef.current.add(label)

        pointsRef.current[word] = { mesh, label }
      })
    }
    
    // Setup disposal for HMR
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        disposeResources(disposables)
        
        // Clear points from scene if it still exists
        if (sceneRef.current) {
          Object.values(pointsRef.current).forEach(point => {
            if (point.mesh) sceneRef.current.remove(point.mesh)
            if (point.label) sceneRef.current.remove(point.label)
          })
        }
      })
    }
    
    return () => {
      // Only clean up if not handling HMR
      if (!import.meta.hot) {
        disposeResources(disposables)
      }
    }
  }, [principalDimensions, words])

  return (
    <div className="embedding-visualizer" ref={containerRef}>
      {showControls && (
        <div className="visualizer-overlay">
          <p>
            <strong>Controls:</strong> Click and drag to rotate. Scroll to zoom.
            Right-click and drag to pan.
          </p>
        </div>
      )}
    </div>
  )
})

export default EmbeddingVisualizer