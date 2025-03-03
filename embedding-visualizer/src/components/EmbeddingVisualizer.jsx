import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import './EmbeddingVisualizer.css'

function EmbeddingVisualizer({ words = [] }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const pointsRef = useRef({})
  const [showControls, setShowControls] = useState(true)

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

    // Initialize scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.z = 5
    camera.position.y = 2
    camera.position.x = 2
    cameraRef.current = camera

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Create coordinate axes
    const axesHelper = new THREE.AxesHelper(2)
    scene.add(axesHelper)

    // Add axis labels
    const createLabel = (text, position, color = '#ffffff') => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 128
      canvas.height = 32
      context.fillStyle = color
      context.font = '24px Arial'
      context.fillText(text, 4, 24)
      
      const texture = new THREE.CanvasTexture(canvas)
      const material = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(material)
      sprite.position.copy(position)
      sprite.scale.set(0.5, 0.125, 1)
      return sprite
    }

    scene.add(createLabel('X', new THREE.Vector3(2.2, 0, 0), '#ff5555'))
    scene.add(createLabel('Y', new THREE.Vector3(0, 2.2, 0), '#55ff55'))
    scene.add(createLabel('Z', new THREE.Vector3(0, 0, 2.2), '#5555ff'))

    // Add grid helper
    const gridHelper = new THREE.GridHelper(4, 10, 0x555555, 0x333333)
    scene.add(gridHelper)

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Update points when words change
  useEffect(() => {
    if (!sceneRef.current) return

    // Remove old points
    Object.values(pointsRef.current).forEach(point => {
      sceneRef.current.remove(point.mesh)
      sceneRef.current.remove(point.label)
    })
    pointsRef.current = {}

    // Add new points
    words.forEach((word) => {
      // Create random positions (to be replaced with actual embeddings)
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
      )

      // Create point with unique color
      const geometry = new THREE.SphereGeometry(0.05, 32, 32)
      const hue = (position.x + 1.5) / 3 * 0.33 + (position.z + 1.5) / 3 * 0.67
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6)
      
      const material = new THREE.MeshStandardMaterial({ 
        color: color,
        emissive: color.clone().multiplyScalar(0.3),
        metalness: 0.3,
        roughness: 0.7
      })
      
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
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true 
      })
      const label = new THREE.Sprite(spriteMaterial)
      label.position.copy(position)
      label.position.y += 0.1
      label.scale.set(0.5, 0.0625, 1)

      sceneRef.current.add(mesh)
      sceneRef.current.add(label)

      pointsRef.current[word] = { mesh, label }
    })
  }, [words])

  return (
    <>
      <div ref={containerRef} className="embedding-visualizer" />
      {showControls && (
        <div className="visualizer-overlay">
          Controls:<br />
          Left-click + drag: Rotate<br />
          Right-click + drag: Pan<br />
          Scroll: Zoom
        </div>
      )}
    </>
  )
}

export default EmbeddingVisualizer