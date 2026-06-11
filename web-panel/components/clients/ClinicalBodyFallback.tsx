'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { BodyProfile } from './BodyCompositionClinicalPanel';

type ClinicalBodyFallbackProps = {
  profile: BodyProfile;
  standby: boolean;
};

function makeScanMaterial(standby: boolean) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b9dec6'),
    transparent: true,
    opacity: standby ? 0.32 : 0.46,
    roughness: 0.9,
    metalness: 0,
    transmission: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function ClinicalBodyFallback({ profile, standby }: ClinicalBodyFallbackProps) {
  const material = useMemo(() => makeScanMaterial(standby), [standby]);
  const shoulderScale = profile === 'male' ? 1.1 : profile === 'female' ? 0.94 : 1;
  const hipScale = profile === 'female' ? 1.12 : profile === 'male' ? 0.94 : 1;

  return (
    <group name="clinical-body-fallback" position={[0, -0.95, 0]}>
      <mesh position={[0, 2.32, 0]} material={material}>
        <sphereGeometry args={[0.26, 36, 24]} />
      </mesh>

      <mesh position={[0, 1.88, 0]} scale={[0.34, 0.22, 0.28]} material={material}>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>

      <mesh position={[0, 1.45, 0]} scale={[0.6 * shoulderScale, 0.84, 0.34]} material={material}>
        <sphereGeometry args={[1, 48, 28]} />
      </mesh>

      <mesh position={[0, 0.62, 0]} scale={[0.42, 0.62, 0.28]} material={material}>
        <sphereGeometry args={[1, 48, 28]} />
      </mesh>

      <mesh position={[0, 0.05, 0]} scale={[0.58 * hipScale, 0.34, 0.32]} material={material}>
        <sphereGeometry args={[1, 48, 24]} />
      </mesh>

      <mesh position={[-0.72 * shoulderScale, 1.05, 0]} rotation={[0, 0, -0.18]} material={material}>
        <cylinderGeometry args={[0.12, 0.17, 1.55, 28, 1, true]} />
      </mesh>
      <mesh position={[0.72 * shoulderScale, 1.05, 0]} rotation={[0, 0, 0.18]} material={material}>
        <cylinderGeometry args={[0.12, 0.17, 1.55, 28, 1, true]} />
      </mesh>

      <mesh position={[-0.28 * hipScale, -0.78, 0]} rotation={[0, 0, -0.04]} material={material}>
        <cylinderGeometry args={[0.17, 0.22, 1.65, 32, 1, true]} />
      </mesh>
      <mesh position={[0.28 * hipScale, -0.78, 0]} rotation={[0, 0, 0.04]} material={material}>
        <cylinderGeometry args={[0.17, 0.22, 1.65, 32, 1, true]} />
      </mesh>
    </group>
  );
}
