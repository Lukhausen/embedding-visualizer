import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)
    sceneRef.current = scene

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5
    camera.position.y = 2
    camera.position.x = 2
    cameraRef.current = camera

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
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
    const createLabel = (text, position) => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 128
      canvas.height = 32
      context.fillStyle = '#000000'
      context.font = '24px Arial'
      context.fillText(text, 4, 24)
      
      const texture = new THREE.CanvasTexture(canvas)
      const material = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(material)
      sprite.position.copy(position)
      sprite.scale.set(0.5, 0.125, 1)
      return sprite
    }

    scene.add(createLabel('X', new THREE.Vector3(2.2, 0, 0)))
    scene.add(createLabel('Y', new THREE.Vector3(0, 2.2, 0)))
    scene.add(createLabel('Z', new THREE.Vector3(0, 0, 2.2)))

    // Add grid helper
    const gridHelper = new THREE.GridHelper(4, 10)
    scene.add(gridHelper)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
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
    words.forEach((word, index) => {
      // For now, create random positions (you'll replace this with actual embedding coordinates)
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
      )

      // Create point geometry
      const geometry = new THREE.SphereGeometry(0.05, 32, 32)
      const material = new THREE.MeshBasicMaterial({ color: 0x0088ff })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(position)

      // Create label
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 256
      canvas.height = 32
      context.fillStyle = '#000000'
      context.font = '24px Arial'
      context.fillText(word, 4, 24)
      
      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const label = new THREE.Sprite(spriteMaterial)
      label.position.copy(position)
      label.position.y += 0.1
      label.scale.set(0.5, 0.0625, 1)

      sceneRef.current.add(mesh)
      sceneRef.current.add(label)

      pointsRef.current[word] = { mesh, label }
    })
  }, [words])

  return <div ref={containerRef} className="embedding-visualizer" />
}

export default EmbeddingVisualizer 