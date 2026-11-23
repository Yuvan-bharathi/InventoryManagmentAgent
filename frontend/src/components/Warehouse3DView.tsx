import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export interface MaterialBinData {
  id: string
  code: string
  name: string
  category: string
  aisle: number
  bay: number
  level: number
  usable_qty: number
  uom: string
  status: 'healthy' | 'at_risk' | 'critical'
  days_of_cover: number
  limiting_capacity?: number
  burn_rate: number
}

interface Warehouse3DViewProps {
  materials?: any[]
  selectedMaterialId?: string | null
  onSelectMaterial?: (materialId: string) => void
  onAskAgent?: (query: string) => void
}

// Procedural high-resolution concrete floor texture with saw-cut joints and grid
function makeFloorTexture(isDark: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  const size = 512
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // Base tile fill
  ctx.fillStyle = isDark ? '#1a222e' : '#b8c3ce'
  ctx.fillRect(0, 0, size, size)

  // 1-metre pitch grid saw-cuts
  ctx.strokeStyle = isDark ? 'rgba(140, 170, 200, 0.12)' : 'rgba(50, 70, 90, 0.16)'
  ctx.lineWidth = 1
  const steps = 6
  const perStep = size / steps
  for (let i = 1; i < steps; i++) {
    const pos = Math.round(i * perStep) + 0.5
    ctx.beginPath()
    ctx.moveTo(pos, 0)
    ctx.lineTo(pos, size)
    ctx.moveTo(0, pos)
    ctx.lineTo(size, pos)
    ctx.stroke()
  }

  // Saw-cut expansion joint border
  ctx.strokeStyle = isDark ? 'rgba(180, 210, 240, 0.28)' : 'rgba(30, 48, 68, 0.38)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(1.5, 0)
  ctx.lineTo(1.5, size)
  ctx.moveTo(0, 1.5)
  ctx.lineTo(size, 1.5)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(15, 12)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function Warehouse3DView({
  materials = [],
  selectedMaterialId = null,
  onSelectMaterial,
  onAskAgent,
}: Warehouse3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [selectedBin, setSelectedBin] = useState<MaterialBinData | null>(null)
  const [hoveredBin, setHoveredBin] = useState<MaterialBinData | null>(null)
  const [viewPreset, setViewPreset] = useState<'iso' | 'dock' | 'aisle' | 'smt' | 'top'>('iso')
  const [themeMode, setThemeMode] = useState<'daylight' | 'dark'>('daylight')
  const [animatingAGV, setAnimatingAGV] = useState(true)

  const binMapRef = useRef<Map<string, MaterialBinData>>(new Map())
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const binMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const agvMeshRef = useRef<THREE.Group | null>(null)

  // Sync real materials from database
  useEffect(() => {
    const defaultMaterials = [
      { id: 'MAT-PCB-001', name: '6-layer Main PCB', category: 'Semiconductor', status: 'critical', days: 1, usable: 2087, uom: 'EA', burn: 200 },
      { id: 'MAT-ANT-012', name: 'RF Antenna Flex', category: 'Connectivity', status: 'critical', days: 22, usable: 10855, uom: 'EA', burn: 500 },
      { id: 'MAT-CAM-008', name: 'Front Camera Module', category: 'Optics', status: 'critical', days: 1, usable: 1140, uom: 'EA', burn: 114 },
      { id: 'MAT-DSP-005', name: '6.5in AMOLED Display', category: 'Display', status: 'critical', days: 1, usable: 750, uom: 'EA', burn: 75 },
      { id: 'MAT-MEM-002', name: 'LPDDR Memory IC', category: 'Semiconductor', status: 'at_risk', days: 20, usable: 14400, uom: 'EA', burn: 720 },
      { id: 'MAT-BAT-009', name: '4500mAh Li-ion Battery', category: 'Power', status: 'at_risk', days: 15, usable: 18000, uom: 'EA', burn: 1200 },
      { id: 'MAT-SOLDER-01', name: 'Lead-Free Solder Wire', category: 'Consumable', status: 'healthy', days: 45, usable: 19000, uom: 'GRAM', burn: 400 },
      { id: 'MAT-SCR-016', name: 'Precision Screw Set', category: 'Hardware', status: 'critical', days: 1, usable: 690, uom: 'EA', burn: 69 },
      { id: 'MAT-BOX-014', name: 'Retail Packaging Box', category: 'Packaging', status: 'critical', days: 1, usable: 1140, uom: 'BOX', burn: 114 },
      { id: 'MAT-CON-013', name: 'USB-C Connector Port', category: 'Connectivity', status: 'critical', days: 1, usable: 840, uom: 'EA', burn: 84 },
      { id: 'MAT-CAM-007', name: 'Rear Dual Camera Module', category: 'Optics', status: 'critical', days: 1, usable: 630, uom: 'EA', burn: 63 },
      { id: 'MAT-NAND-003', name: 'UFS Storage IC 128GB', category: 'Semiconductor', status: 'critical', days: 1, usable: 1080, uom: 'EA', burn: 108 },
      { id: 'MAT-CAS-010', name: 'Aluminum Midframe Housing', category: 'Mechanics', status: 'healthy', days: 38, usable: 8500, uom: 'EA', burn: 220 },
      { id: 'MAT-GLS-011', name: 'Gorilla Glass 6 Cover', category: 'Optics', status: 'at_risk', days: 18, usable: 4200, uom: 'EA', burn: 230 },
      { id: 'MAT-SPK-015', name: 'Stereo Speaker Unit', category: 'Audio', status: 'healthy', days: 40, usable: 12000, uom: 'EA', burn: 300 },
      { id: 'MAT-MIC-017', name: 'Dual MEMS Microphone', category: 'Audio', status: 'healthy', days: 50, usable: 16000, uom: 'EA', burn: 320 },
      { id: 'MAT-COIL-019', name: 'Qi Wireless Charging Coil', category: 'Power', status: 'at_risk', days: 14, usable: 3500, uom: 'EA', burn: 250 },
      { id: 'MAT-THM-020', name: 'Vapor Chamber Heat Sink', category: 'Thermal', status: 'critical', days: 4, usable: 1200, uom: 'EA', burn: 280 },
    ]

    const list = materials.length > 0 ? materials : defaultMaterials
    const map = new Map<string, MaterialBinData>()

    list.forEach((m: any, idx: number) => {
      const aisle = (idx % 6) + 1
      const bay = (Math.floor(idx / 6) % 6) + 1
      const level = (idx % 5) + 1
      const matId = m.material_id || m.id
      const bData: MaterialBinData = {
        id: matId,
        code: `A0${aisle}-B0${bay}-L${level}`,
        name: m.material_name || m.name,
        category: m.category || m.material_category || 'Raw Material',
        aisle,
        bay,
        level,
        usable_qty: Number(m.usable_qty ?? m.usable ?? 5000),
        uom: m.uom || 'EA',
        status: (m.status === 'CRITICAL' ? 'critical' : m.status === 'AT_RISK' ? 'at_risk' : 'healthy') as any,
        days_of_cover: Number(m.days_of_cover ?? m.days ?? 30),
        burn_rate: Number(m.daily_rate ?? m.burn ?? 150),
      }
      map.set(matId, bData)
    })

    binMapRef.current = map
    if (selectedMaterialId && map.has(selectedMaterialId)) {
      setSelectedBin(map.get(selectedMaterialId)!)
    }
  }, [materials, selectedMaterialId])

  // Mount Three.js with RoomEnvironment & Photorealistic Lighting
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight || 580
    const isDark = themeMode === 'dark'

    // Colors matching digital-twin-retail themes
    const bgColor = isDark ? 0x0a0e17 : 0xe4ebf2
    const fogColor = isDark ? 0x0a0e17 : 0xe4ebf2
    const floorColor = isDark ? 0x18202c : 0xb4c0cc
    const uprightColor = isDark ? 0x3d4a5c : 0x475569
    const beamColor = 0xd97706 // Safety industrial orange
    const shelfColor = isDark ? 0x253040 : 0x8a97a6

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(bgColor)
    scene.fog = new THREE.Fog(fogColor, 70, 320)
    sceneRef.current = scene

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 500)
    camera.position.set(42, 32, 42)
    cameraRef.current = camera

    // 3. Renderer with ACES Tone Mapping & Soft Shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = isDark ? 1.25 : 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // 4. Photorealistic IBL (Image-Based Radiance) via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    scene.environment = envTexture
    scene.environmentIntensity = isDark ? 0.35 : 0.65

    // 5. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI * 0.495
    controls.minDistance = 6
    controls.maxDistance = 160
    controls.target.set(0, 3.5, 0)
    controlsRef.current = controls

    // 6. Direct Lighting Rig (Sun + Hemisphere + Ambient Fill)
    const hemiLight = new THREE.HemisphereLight(
      isDark ? 0x3b4a60 : 0xffffff,
      isDark ? 0x101824 : 0xb4c0ce,
      isDark ? 0.7 : 1.15
    )
    scene.add(hemiLight)

    const sunLight = new THREE.DirectionalLight(0xfff8ee, isDark ? 1.0 : 1.7)
    sunLight.position.set(38, 48, 28)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(2048, 2048)
    sunLight.shadow.camera.near = 1
    sunLight.shadow.camera.far = 160
    const d = 45
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    sunLight.shadow.bias = -0.0003
    sunLight.shadow.normalBias = 0.035
    sunLight.shadow.radius = 2.0
    scene.add(sunLight)

    const fillLight = new THREE.DirectionalLight(0xc8dcfa, isDark ? 0.4 : 0.6)
    fillLight.position.set(-35, 24, -30)
    scene.add(fillLight)

    // 7. Concrete Warehouse Floor Slab with Procedural Saw-Cuts
    const floorTexture = makeFloorTexture(isDark)
    const floorGeo = new THREE.PlaneGeometry(96, 76)
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      map: floorTexture,
      roughness: 0.48,
      metalness: 0.08,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Yellow Pedestrian & AGV Transit Corridors
    const laneGeo = new THREE.PlaneGeometry(3.6, 70)
    const laneMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      transparent: true,
      opacity: isDark ? 0.45 : 0.55,
    })
    const centralAisle = new THREE.Mesh(laneGeo, laneMat)
    centralAisle.rotation.x = -Math.PI / 2
    centralAisle.position.set(0, 0.02, 0)
    centralAisle.receiveShadow = true
    scene.add(centralAisle)

    // Cross-corridor lane
    const crossGeo = new THREE.PlaneGeometry(90, 3.2)
    const crossAisle = new THREE.Mesh(crossGeo, laneMat)
    crossAisle.rotation.x = -Math.PI / 2
    crossAisle.position.set(0, 0.02, 17)
    crossAisle.receiveShadow = true
    scene.add(crossAisle)

    // 8. Inbound Receiving Docks (North End: z = -33)
    const dockGroup = new THREE.Group()
    dockGroup.position.set(0, 0, -33)

    for (let i = -1; i <= 1; i++) {
      // Concrete dock pit frame
      const frameGeo = new THREE.BoxGeometry(7.2, 8.2, 0.5)
      const frameMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x222c3a : 0x7c8a99,
        metalness: 0.3,
        roughness: 0.5,
      })
      const frame = new THREE.Mesh(frameGeo, frameMat)
      frame.position.set(i * 13, 4.1, 0)
      frame.castShadow = true
      dockGroup.add(frame)

      // Roll-up industrial door (Blue steel)
      const doorGeo = new THREE.PlaneGeometry(6.4, 7.4)
      const doorMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        metalness: 0.4,
        roughness: 0.35,
      })
      const door = new THREE.Mesh(doorGeo, doorMat)
      door.position.set(i * 13, 3.7, 0.26)
      dockGroup.add(door)

      // Warning hazard stripes above dock door
      const stripeCanvas = document.createElement('canvas')
      stripeCanvas.width = 256
      stripeCanvas.height = 32
      const sCtx = stripeCanvas.getContext('2d')
      if (sCtx) {
        for (let s = 0; s < 16; s++) {
          sCtx.fillStyle = s % 2 === 0 ? '#F59E0B' : '#1E293B'
          sCtx.beginPath()
          sCtx.moveTo(s * 20, 0)
          sCtx.lineTo(s * 20 + 20, 0)
          sCtx.lineTo(s * 20, 32)
          sCtx.lineTo(s * 20 - 20, 32)
          sCtx.fill()
        }
      }
      const stripeTex = new THREE.CanvasTexture(stripeCanvas)
      const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTex })
      const stripeBanner = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.8), stripeMat)
      stripeBanner.position.set(i * 13, 7.8, 0.28)
      dockGroup.add(stripeBanner)

      // Yellow safety bollards
      const bollardGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.5, 16)
      const bollardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 })
      const b1 = new THREE.Mesh(bollardGeo, bollardMat)
      b1.position.set(i * 13 - 3.7, 0.75, 1.3)
      b1.castShadow = true
      dockGroup.add(b1)

      const b2 = new THREE.Mesh(bollardGeo, bollardMat)
      b2.position.set(i * 13 + 3.7, 0.75, 1.3)
      b2.castShadow = true
      dockGroup.add(b2)
    }
    scene.add(dockGroup)

    // 9. Steel Industrial Pallet Racking (Aisles 1–4)
    const racksGroup = new THREE.Group()
    const uprightMat = new THREE.MeshStandardMaterial({
      color: uprightColor,
      metalness: 0.65,
      roughness: 0.35,
    })
    const beamMat = new THREE.MeshStandardMaterial({
      color: beamColor,
      metalness: 0.5,
      roughness: 0.4,
    })
    const shelfMat = new THREE.MeshStandardMaterial({
      color: shelfColor,
      metalness: 0.55,
      roughness: 0.5,
    })

    const aisleXPositions = [-30, -18, -6, 6, 18, 30]
    const bayZPositions = [-20, -13, -6, 1, 8, 15]
    const levelYPositions = [1.1, 2.5, 3.9, 5.3, 6.7]

    aisleXPositions.forEach((aisleX, aIdx) => {
      bayZPositions.forEach((bayZ) => {
        // 4 upright columns per bay (8.5m high for 5 tiers)
        const colGeo = new THREE.BoxGeometry(0.14, 8.2, 0.14)
        ;[-1.5, 1.5].forEach((dx) => {
          ;[-1.2, 1.2].forEach((dz) => {
            const col = new THREE.Mesh(colGeo, uprightMat)
            col.position.set(aisleX + dx, 4.1, bayZ + dz)
            col.castShadow = true
            racksGroup.add(col)
          })
        })

        // Shelf load beams (Safety Orange) for all 5 vertical floors
        levelYPositions.forEach((levelY) => {
          const beamGeoX = new THREE.BoxGeometry(3.1, 0.14, 0.08)
          ;[-1.2, 1.2].forEach((dz) => {
            const b = new THREE.Mesh(beamGeoX, beamMat)
            b.position.set(aisleX, levelY, bayZ + dz)
            b.castShadow = true
            racksGroup.add(b)
          })

          // Wire mesh decking shelf
          const shelfGeo = new THREE.BoxGeometry(3.0, 0.04, 2.3)
          const shelf = new THREE.Mesh(shelfGeo, shelfMat)
          shelf.position.set(aisleX, levelY + 0.06, bayZ)
          shelf.receiveShadow = true
          racksGroup.add(shelf)
        })
      })

      // Overhead High-Contrast Aisle Billboard
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 128
      const aCtx = canvas.getContext('2d')
      if (aCtx) {
        aCtx.fillStyle = '#0F172A'
        aCtx.fillRect(0, 0, 512, 128)
        aCtx.strokeStyle = '#38BDF8'
        aCtx.lineWidth = 8
        aCtx.strokeRect(4, 4, 504, 120)
        aCtx.fillStyle = '#38BDF8'
        aCtx.font = 'bold 54px Inter, sans-serif'
        aCtx.textAlign = 'center'
        aCtx.textBaseline = 'middle'
        aCtx.fillText(`AISLE 0${aIdx + 1}`, 256, 64)
      }
      const labelTex = new THREE.CanvasTexture(canvas)
      const labelMat = new THREE.SpriteMaterial({ map: labelTex })
      const sprite = new THREE.Sprite(labelMat)
      sprite.position.set(aisleX, 9.4, -22)
      sprite.scale.set(5.8, 1.5, 1)
      racksGroup.add(sprite)
    })

    // Elevated Mezzanine Second Floor Walkway (Level 3 Cross-Bridge at y = 3.9)
    const mezzGeo = new THREE.BoxGeometry(68, 0.12, 2.8)
    const mezzMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e293b : 0x94a3b8,
      metalness: 0.6,
      roughness: 0.35,
      transparent: true,
      opacity: 0.88,
    })
    const mezzBridge = new THREE.Mesh(mezzGeo, mezzMat)
    mezzBridge.position.set(0, 3.92, -2.5)
    mezzBridge.receiveShadow = true
    racksGroup.add(mezzBridge)

    // Mezzanine safety railings
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
    ;[-1.3, 1.3].forEach((dz) => {
      const railGeo = new THREE.BoxGeometry(68, 0.08, 0.08)
      const rail = new THREE.Mesh(railGeo, railMat)
      rail.position.set(0, 4.95, -2.5 + dz)
      racksGroup.add(rail)
    })
    scene.add(racksGroup)

    // 10. Color-Coded Material Cargo Pallets
    const binsGroup = new THREE.Group()
    const meshesMap = new Map<string, THREE.Mesh>()
    const binMap = binMapRef.current

    Array.from(binMap.values()).forEach((bData) => {
      const aisleX = aisleXPositions[(bData.aisle - 1) % aisleXPositions.length]
      const bayZ = bayZPositions[(bData.bay - 1) % bayZPositions.length]
      const levelY = levelYPositions[(bData.level - 1) % levelYPositions.length] + 0.6

      // Hardwood pallet
      const palletGeo = new THREE.BoxGeometry(1.6, 0.16, 1.4)
      const palletMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x6d4c41 : 0xa1887f,
        roughness: 0.85,
      })
      const pallet = new THREE.Mesh(palletGeo, palletMat)
      pallet.position.set(aisleX, levelY - 0.42, bayZ)
      pallet.castShadow = true
      pallet.receiveShadow = true
      binsGroup.add(pallet)

      // Storage Box with vibrant status hue
      const boxColor =
        bData.status === 'critical'
          ? 0xdc2626 // Vibrant Red
          : bData.status === 'at_risk'
          ? 0xf59e0b // Vibrant Amber
          : 0x16a34a // Vibrant Green

      const cargoGeo = new THREE.BoxGeometry(1.5, 0.95, 1.3)
      const cargoMat = new THREE.MeshStandardMaterial({
        color: boxColor,
        roughness: 0.35,
        metalness: 0.15,
        emissive: isDark ? boxColor : 0x000000,
        emissiveIntensity: isDark ? 0.15 : 0.0,
      })
      const cargo = new THREE.Mesh(cargoGeo, cargoMat)
      cargo.position.set(aisleX, levelY, bayZ)
      cargo.castShadow = true
      cargo.receiveShadow = true
      cargo.userData = { materialId: bData.id, binData: bData }

      meshesMap.set(bData.id, cargo)
      binsGroup.add(cargo)
    })
    binMeshesRef.current = meshesMap
    scene.add(binsGroup)

    // 11. SMT PCB Assembly Line & Workbenches (South End: z = 24)
    const smtGroup = new THREE.Group()
    smtGroup.position.set(0, 0, 24)

    for (let l = -1; l <= 1; l += 2) {
      // Conveyor track
      const convGeo = new THREE.BoxGeometry(28, 0.9, 2.2)
      const convMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x2e3846 : 0x475569,
        metalness: 0.6,
        roughness: 0.35,
      })
      const conveyor = new THREE.Mesh(convGeo, convMat)
      conveyor.position.set(l * 17, 0.45, 0)
      conveyor.castShadow = true
      smtGroup.add(conveyor)

      // SMT Placement Machine Blocks
      for (let s = -2; s <= 2; s++) {
        const smtGeo = new THREE.BoxGeometry(3.4, 2.6, 2.6)
        const smtMat = new THREE.MeshStandardMaterial({
          color: isDark ? 0x94a3b8 : 0xf1f5f9,
          metalness: 0.7,
          roughness: 0.25,
        })
        const smtMachine = new THREE.Mesh(smtGeo, smtMat)
        smtMachine.position.set(l * 17 + s * 5.2, 1.7, 0)
        smtMachine.castShadow = true
        smtGroup.add(smtMachine)

        // Status beacon pole & lamp
        const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8)
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155 })
        const pole = new THREE.Mesh(poleGeo, poleMat)
        pole.position.set(l * 17 + s * 5.2, 3.6, 1.1)
        smtGroup.add(pole)

        const beaconGeo = new THREE.SphereGeometry(0.14, 12, 12)
        const beaconMat = new THREE.MeshBasicMaterial({ color: s === 0 ? 0xef4444 : 0x10b981 })
        const beacon = new THREE.Mesh(beaconGeo, beaconMat)
        beacon.position.set(l * 17 + s * 5.2, 4.3, 1.1)
        smtGroup.add(beacon)
      }
    }
    scene.add(smtGroup)

    // 12. Animated Autonomous Guided Vehicle (AGV)
    const agv = new THREE.Group()
    const agvBaseGeo = new THREE.BoxGeometry(1.6, 0.45, 2.2)
    const agvBaseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.35 })
    const agvBase = new THREE.Mesh(agvBaseGeo, agvBaseMat)
    agvBase.position.y = 0.35
    agvBase.castShadow = true
    agv.add(agvBase)

    // Pallet on AGV
    const agvPalletGeo = new THREE.BoxGeometry(1.4, 0.85, 1.8)
    const agvPalletMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45 })
    const agvPallet = new THREE.Mesh(agvPalletGeo, agvPalletMat)
    agvPallet.position.y = 1.0
    agvPallet.castShadow = true
    agv.add(agvPallet)

    // Laser lidar sensor
    const laserGeo = new THREE.SphereGeometry(0.1, 8, 8)
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    const laser = new THREE.Mesh(laserGeo, laserMat)
    laser.position.set(0, 0.65, 1.1)
    agv.add(laser)

    agv.position.set(0, 0, -20)
    agvMeshRef.current = agv
    scene.add(agv)

    // 13. Raycasting Click & Hover Interaction
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(binsGroup.children, false)

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh
        if (hit.userData?.binData) {
          container.style.cursor = 'pointer'
          setHoveredBin(hit.userData.binData)
          return
        }
      }
      container.style.cursor = 'grab'
      setHoveredBin(null)
    }

    const onPointerDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(binsGroup.children, false)

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh
        if (hit.userData?.binData) {
          const b = hit.userData.binData as MaterialBinData
          setSelectedBin(b)
          if (onSelectMaterial) {
            onSelectMaterial(b.id)
          }
        }
      }
    }

    container.addEventListener('mousemove', onPointerMove)
    container.addEventListener('click', onPointerDown)

    // 14. Render Loop with AGV Animation
    let animId = 0
    let clock = new THREE.Clock()
    let agvProgress = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const rawDelta = clock.getDelta()
      if (rawDelta > 0.35) return
      const delta = Math.min(rawDelta, 0.05)

      controls.update()

      if (animatingAGV && agvMeshRef.current) {
        agvProgress += delta * 0.28
        const zPos = Math.sin(agvProgress) * 22
        agvMeshRef.current.position.z = zPos
        agvMeshRef.current.rotation.y = Math.cos(agvProgress) >= 0 ? 0 : Math.PI
      }

      renderer.render(scene, camera)
    }
    animate()

    // 15. Window Resize Handler
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight || 580
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', onPointerMove)
      container.removeEventListener('click', onPointerDown)
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [themeMode, animatingAGV, onSelectMaterial])

  // Camera preset transitions
  const applyCameraPreset = (preset: 'iso' | 'dock' | 'aisle' | 'smt' | 'top') => {
    setViewPreset(preset)
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    switch (preset) {
      case 'iso':
        camera.position.set(42, 32, 42)
        controls.target.set(0, 3.5, 0)
        break
      case 'dock':
        camera.position.set(0, 11, -17)
        controls.target.set(0, 4, -33)
        break
      case 'aisle':
        camera.position.set(-16, 8, 6)
        controls.target.set(-11, 3.5, -4)
        break
      case 'smt':
        camera.position.set(0, 14, 11)
        controls.target.set(0, 2.5, 24)
        break
      case 'top':
        camera.position.set(0, 72, 0.1)
        controls.target.set(0, 0, 0)
        break
    }
    controls.update()
  }

  // Highlight selected mesh when selectedBin changes
  useEffect(() => {
    if (!selectedBin) return
    const mesh = binMeshesRef.current.get(selectedBin.id)
    if (mesh && (mesh.material as THREE.MeshStandardMaterial)) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissive = new THREE.Color('#FACC15')
      mat.emissiveIntensity = 0.8
      setTimeout(() => {
        mat.emissive = new THREE.Color('#000000')
        mat.emissiveIntensity = 0.0
      }, 1600)
    }
  }, [selectedBin])

  return (
    <div style={{ position: 'relative', width: '100%', height: '580px', borderRadius: 10, overflow: 'hidden', background: themeMode === 'dark' ? '#0A0E17' : '#E4EBF2', border: '1px solid var(--border)' }}>
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} style={{ width: '100%', height: '100%', outline: 'none' }} />

      {/* Top Left HUD: Camera Presets & Theme Switcher */}
      <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 6, background: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(8px)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.25)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: themeMode === 'dark' ? '#94A3B8' : '#475569', alignSelf: 'center', marginRight: 4 }}>CAMERA:</span>
          <button
            className={`btn sm ${viewPreset === 'iso' ? 'primary' : 'ghost'}`}
            style={{ padding: '3px 9px', fontSize: 11 }}
            onClick={() => applyCameraPreset('iso')}
          >
            Isometric
          </button>
          <button
            className={`btn sm ${viewPreset === 'dock' ? 'primary' : 'ghost'}`}
            style={{ padding: '3px 9px', fontSize: 11 }}
            onClick={() => applyCameraPreset('dock')}
          >
            Receiving Docks
          </button>
          <button
            className={`btn sm ${viewPreset === 'aisle' ? 'primary' : 'ghost'}`}
            style={{ padding: '3px 9px', fontSize: 11 }}
            onClick={() => applyCameraPreset('aisle')}
          >
            Racks Aisle
          </button>
          <button
            className={`btn sm ${viewPreset === 'smt' ? 'primary' : 'ghost'}`}
            style={{ padding: '3px 9px', fontSize: 11 }}
            onClick={() => applyCameraPreset('smt')}
          >
            SMT Assembly
          </button>
          <button
            className={`btn sm ${viewPreset === 'top' ? 'primary' : 'ghost'}`}
            style={{ padding: '3px 9px', fontSize: 11 }}
            onClick={() => applyCameraPreset('top')}
          >
            Top-Down Plan
          </button>
        </div>

        {/* Legend Indicator & Theme Toggle */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(8px)', padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.25)', fontSize: 11, color: themeMode === 'dark' ? '#E2E8F0' : '#1E293B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <span style={{ fontWeight: 700 }}>STOCK HEALTH:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#16A34A' }} /> Healthy
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B' }} /> At Risk
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#DC2626' }} /> Critical (Bottleneck)
          </span>

          <span style={{ margin: '0 4px', color: '#CBD5E1' }}>|</span>

          {/* Theme Toggle Button */}
          <button
            className="btn sm"
            style={{ padding: '2px 8px', fontSize: 11, background: themeMode === 'daylight' ? '#F1F5F9' : '#1E293B' }}
            onClick={() => setThemeMode(themeMode === 'daylight' ? 'dark' : 'daylight')}
          >
            {themeMode === 'daylight' ? '☀️ Daylight Studio' : '🌙 Night Shift'}
          </button>

          <span style={{ marginLeft: 6, color: '#3B82F6', cursor: 'pointer', fontWeight: 600 }} onClick={() => setAnimatingAGV(!animatingAGV)}>
            AGV: {animatingAGV ? 'RUNNING 🟢' : 'PAUSED ⏸'}
          </span>
        </div>
      </div>

      {/* Top Right HUD: Live Telemetry Summary */}
      <div style={{ position: 'absolute', top: 14, right: 14, background: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.28)', color: themeMode === 'dark' ? '#FFFFFF' : '#0F172A', minWidth: 220, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', marginBottom: 4 }}>
          3D Facility Telemetry
        </div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Bengaluru Plant (IN-KA-01)</div>
        <div style={{ fontSize: 11, color: themeMode === 'dark' ? '#94A3B8' : '#64748B', marginBottom: 8 }}>4 Storage Aisles • 3 Dock Doors • 2 SMT Lines</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: 6 }}>
          <span style={{ color: themeMode === 'dark' ? '#94A3B8' : '#64748B' }}>Active Storage Bays:</span>
          <b>12 Pallet Locations</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: themeMode === 'dark' ? '#94A3B8' : '#64748B' }}>Corridor AGVs:</span>
          <b style={{ color: '#16A34A' }}>1 Automated Robot</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
          <span style={{ color: themeMode === 'dark' ? '#94A3B8' : '#64748B' }}>Click Any Pallet:</span>
          <span style={{ color: '#D97706', fontSize: 11, fontWeight: 600 }}>Inspect Stock</span>
        </div>
      </div>

      {/* Hover Tooltip (Mouse Tracker) */}
      {hoveredBin && !selectedBin && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #38BDF8',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            zIndex: 15,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 700, color: '#38BDF8' }}>{hoveredBin.code}</span>
          <span>{hoveredBin.name} ({hoveredBin.id})</span>
          <span className={`status ${hoveredBin.status}`} style={{ fontSize: 10, padding: '2px 6px' }}>
            {hoveredBin.status.toUpperCase()}
          </span>
          <span style={{ color: '#FACC15' }}>Click to inspect</span>
        </div>
      )}

      {/* Selected Material Inspector Drawer / Card */}
      {selectedBin && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            right: 14,
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(12px)',
            border: `2px solid ${selectedBin.status === 'critical' ? '#EF4444' : selectedBin.status === 'at_risk' ? '#F59E0B' : '#10B981'}`,
            borderRadius: 10,
            padding: '14px 18px',
            color: '#FFFFFF',
            zIndex: 20,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pill" style={{ background: '#1E3A8A', color: '#93C5FD', fontWeight: 700 }}>
                {selectedBin.code}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{selectedBin.name}</span>
              <span style={{ fontSize: 13, color: '#94A3B8' }}>({selectedBin.id})</span>
              <span
                className="status"
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  background: selectedBin.status === 'critical' ? '#7F1D1D' : selectedBin.status === 'at_risk' ? '#78350F' : '#064E3B',
                  color: selectedBin.status === 'critical' ? '#FCA5A5' : selectedBin.status === 'at_risk' ? '#FDE68A' : '#A7F3D0',
                }}
              >
                {selectedBin.status.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: 12, color: '#E2E8F0' }}>
              <span>Category: <b>{selectedBin.category}</b></span>
              <span>Usable Stock: <b style={{ color: '#38BDF8' }}>{selectedBin.usable_qty.toLocaleString()} {selectedBin.uom}</b></span>
              <span>Days of Cover: <b style={{ color: selectedBin.days_of_cover < 7 ? '#F87171' : '#34D399' }}>{selectedBin.days_of_cover} Days</b></span>
              <span>Daily Burn Rate: <b>{selectedBin.burn_rate} {selectedBin.uom}/day</b></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onAskAgent && (
              <button
                className="btn sm primary"
                onClick={() => onAskAgent(`What is the stock and bottleneck risk for ${selectedBin.id} (${selectedBin.name})?`)}
              >
                Ask Agent about {selectedBin.id}
              </button>
            )}
            <button
              className="btn sm"
              style={{ background: '#334155', color: '#FFFFFF', border: '1px solid #475569' }}
              onClick={() => setSelectedBin(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
