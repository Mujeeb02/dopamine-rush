import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Preload } from "@react-three/drei";

interface SceneContainerProps {
    children: React.ReactNode;
    className?: string;
}

const SceneContainer = ({ children, className = "" }: SceneContainerProps) => {
    return (
        <div className={`absolute inset-0 z-0 ${className}`}>
            <Canvas
                camera={{ position: [0, 0, 10], fov: 50 }}
                dpr={[1, 2]} // Handle high DPI screens
                gl={{ antialias: true, alpha: true }}
            >
                <Suspense fallback={null}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff00ff" />

                    {children}

                    <Preload all />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default SceneContainer;
