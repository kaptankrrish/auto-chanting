import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Generate random points in a sphere
const generateParticles = (count: number) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 15 * Math.cbrt(Math.random()); // Radius
    const theta = Math.random() * 2 * Math.PI; // Azimuthal angle
    const phi = Math.acos(2 * Math.random() - 1); // Polar angle

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return positions;
};

const ParticleField = ({ theme }: { theme: string }) => {
  const ref = useRef<THREE.Points>(null);
  
  // Theme color mapping
  const colorMap: Record<string, string> = {
    cosmic: '#a78bfa',
    dawn: '#fb7185',
    forest: '#34d399',
    sunset: '#fbbf24'
  };

  const particleColor = colorMap[theme] || colorMap.cosmic;
  
  // Create static positions once
  const positions = useMemo(() => generateParticles(2000), []);

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 20;
      ref.current.rotation.y -= delta / 30;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color={particleColor}
          size={0.05}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.6}
        />
      </Points>
    </group>
  );
};

interface CosmicDustProps {
  theme: string;
}

const CosmicDust: React.FC<CosmicDustProps> = ({ theme }) => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 8] }}>
        <fog attach="fog" args={['#000', 5, 20]} />
        <ParticleField theme={theme} />
      </Canvas>
    </div>
  );
};

export default CosmicDust;
