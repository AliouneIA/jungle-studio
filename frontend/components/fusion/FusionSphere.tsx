'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, Trail, Float, Sparkles, Environment } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

interface FusionSphereProps {
    status: 'idle' | 'analyzing' | 'fusing' | 'complete'
}

// Orbital ring with electron
function OrbitalRing({ radius = 2.5, rotation = [0, 0, 0], speed = 1, ringColor = '#fffaf0', thickness = 0.015 }: any) {
    const electronRef = useRef<THREE.Mesh>(null!)
    const ringRef = useRef<THREE.Mesh>(null!)

    useFrame((state) => {
        const t = state.clock.getElapsedTime() * speed
        // Electron orbiting on the ring path
        electronRef.current.position.set(
            Math.cos(t) * radius,
            Math.sin(t) * radius,
            0
        )
    })

    return (
        <group rotation={rotation}>
            {/* Visible Ring Path */}
            <mesh ref={ringRef}>
                <torusGeometry args={[radius, thickness, 16, 100]} />
                <meshBasicMaterial color={ringColor} transparent opacity={0.6} toneMapped={false} />
            </mesh>

            {/* Orbiting Electron with Trail */}
            <Trail
                width={6}
                length={12}
                color={new THREE.Color(ringColor).multiplyScalar(5)}
                attenuation={(t) => t * t}
            >
                <mesh ref={electronRef}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshBasicMaterial color={ringColor} toneMapped={false} />
                </mesh>
            </Trail>
        </group>
    )
}

// Spark/Lightning point
function Spark({ position }: { position: [number, number, number] }) {
    const ref = useRef<THREE.PointLight>(null!)

    useFrame((state) => {
        // Flicker effect
        ref.current.intensity = 2 + Math.random() * 3
    })

    return (
        <group position={position}>
            <pointLight ref={ref} distance={3} intensity={3} color="#fffaf0" />
            <mesh>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
        </group>
    )
}

function AtomCore({ status }: { status: string }) {
    const groupRef = useRef<THREE.Group>(null!)
    const coreRef = useRef<THREE.Mesh>(null!)

    const baseSpeed = status === 'fusing' ? 2 : status === 'analyzing' ? 1 : 0.3

    useFrame((state) => {
        const t = state.clock.getElapsedTime()
        groupRef.current.rotation.y = t * 0.1 * baseSpeed
        groupRef.current.rotation.x = t * 0.05 * baseSpeed

        // Core pulse
        const scale = 1 + Math.sin(t * 2) * 0.05
        coreRef.current.scale.setScalar(scale)
    })

    const coreColor = useMemo(() => {
        switch (status) {
            case 'analyzing': return '#00dfff'
            case 'fusing': return '#ffcc00'
            case 'complete': return '#4ade80'
            default: return '#fffaf0' // Warm white
        }
    }, [status])

    // 6 orbital rings: 3 white (#fffaf0) and 3 brown/taupe (#c1b2a2)
    const orbitals = [
        { rotation: [0, 0, 0], speed: 0.8, color: '#fffaf0' }, // White
        { rotation: [Math.PI / 3, 0, 0], speed: 1.0, color: '#c1b2a2' }, // Taupe
        { rotation: [0, Math.PI / 3, 0], speed: 0.9, color: '#fffaf0' }, // White
        { rotation: [Math.PI / 4, Math.PI / 4, 0], speed: 1.1, color: '#c1b2a2' }, // Taupe
        { rotation: [-Math.PI / 3, 0, Math.PI / 6], speed: 0.7, color: '#fffaf0' }, // White
        { rotation: [0, -Math.PI / 4, Math.PI / 3], speed: 1.2, color: '#c1b2a2' }, // Taupe
    ]

    // Spark positions (on the rings)
    const sparkPositions: [number, number, number][] = [
        [2.5, 0, 0],
        [-1.2, 2.2, 0],
        [0, -2.5, 0],
        [1.8, 1.8, 0],
    ]

    return (
        <group ref={groupRef} scale={0.6}>
            {/* Central Glowing Core - multiple layers for soft glow */}
            <Float speed={3} rotationIntensity={0.5} floatIntensity={0.5}>
                {/* Inner bright core */}
                <Sphere ref={coreRef} args={[0.4, 64, 64]}>
                    <meshBasicMaterial color="#ffffff" toneMapped={false} />
                </Sphere>
                {/* Outer glow layer - Additive Blending for natural glow */}
                <Sphere args={[0.6, 32, 32]}>
                    <meshBasicMaterial
                        color={coreColor}
                        transparent
                        opacity={0.5}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </Sphere>
                {/* Haze layer - Larger soft aura */}
                <Sphere args={[1.2, 32, 32]}>
                    <meshBasicMaterial
                        color={coreColor}
                        transparent
                        opacity={0.2}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                        toneMapped={false}
                    />
                </Sphere>
            </Float>

            {/* Orbital Rings */}
            {orbitals.map((orbital, i) => (
                <OrbitalRing
                    key={i}
                    radius={2.5 + (i % 2) * 0.3}
                    rotation={orbital.rotation}
                    speed={orbital.speed * baseSpeed}
                    ringColor={orbital.color}
                />
            ))}

            {/* Sparks at intersection points */}
            {sparkPositions.map((pos, i) => (
                <Spark key={i} position={pos} />
            ))}

            {/* Ambient sparkles */}
            <Sparkles count={100} scale={6} size={2} speed={0.5} color="#fffaf0" />
        </group>
    )
}

export default function FusionSphere({ status }: FusionSphereProps) {
    const isActive = status === 'analyzing' || status === 'fusing'

    return (
        <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${isActive ? 'z-[60] opacity-100' : 'z-0 opacity-40'}`}>
            <Canvas
                camera={{ position: [0, 0, 8], fov: 50 }}
                gl={{ antialias: false, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.3} />

                <AtomCore status={status} />

                {/* EffectComposer removed to prevent flash - using natural material glow */}
            </Canvas>
        </div>
    )
}
