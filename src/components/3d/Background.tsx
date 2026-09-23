import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";
import * as THREE from "three";

const Background = () => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
            groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.1;
        }
    });

    return (
        <group ref={groupRef}>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Floating geometric shapes for depth */}
            <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
                <mesh position={[-15, 5, -20]} rotation={[0, 0, 0]}>
                    <icosahedronGeometry args={[2, 0]} />
                    <meshStandardMaterial color="#4c1d95" wireframe transparent opacity={0.3} />
                </mesh>
            </Float>

            <Float speed={2} rotationIntensity={1.5} floatIntensity={1.5}>
                <mesh position={[15, -5, -25]} rotation={[0, 0, 0]}>
                    <octahedronGeometry args={[3, 0]} />
                    <meshStandardMaterial color="#0ea5e9" wireframe transparent opacity={0.2} />
                </mesh>
            </Float>

            <Float speed={1} rotationIntensity={0.5} floatIntensity={1}>
                <mesh position={[0, 10, -30]} rotation={[0, 0, 0]}>
                    <torusGeometry args={[10, 0.1, 16, 100]} />
                    <meshStandardMaterial color="#ec4899" wireframe transparent opacity={0.1} />
                </mesh>
            </Float>
        </group>
    );
};

export default Background;
