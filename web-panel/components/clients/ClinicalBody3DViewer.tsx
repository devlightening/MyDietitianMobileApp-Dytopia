'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ClinicalBodyFallback } from './ClinicalBodyFallback';
import type { BodyProfile, RegionId, RegionMetric } from './BodyCompositionClinicalPanel';
import { cn } from '@/lib/utils';

type ClinicalBody3DViewerProps = {
  activeRegion: RegionId;
  metrics: Record<RegionId, RegionMetric>;
  onRegionChange: (region: RegionId) => void;
  profile: BodyProfile;
  standby: boolean;
  expanded?: boolean;
};

type RingConfig = {
  id: Extract<RegionId, 'chest' | 'waist' | 'hips'>;
  position: [number, number, number];
  radius: number;
  scale: [number, number, number];
  labelPosition: [number, number, number];
};

const MODEL_PATHS: Record<BodyProfile, string> = {
  neutral: '/models/clinical-body-neutral.glb',
  male: '/models/clinical-body-male.glb',
  female: '/models/clinical-body-female.glb',
};

const FALLBACK_MODEL_PATH = MODEL_PATHS.neutral;

const RINGS: RingConfig[] = [
  {
    id: 'chest',
    position: [0, 1.18, 0],
    radius: 0.58,
    scale: [1.06, 0.7, 1],
    labelPosition: [0.28, 1.32, 0.24],
  },
  {
    id: 'waist',
    position: [0, 0.62, 0],
    radius: 0.44,
    scale: [1.06, 0.64, 1],
    labelPosition: [0.25, 0.7, 0.22],
  },
  {
    id: 'hips',
    position: [0, 0.2, 0],
    radius: 0.62,
    scale: [1.08, 0.68, 1],
    labelPosition: [0.28, 0.12, 0.22],
  },
];

function stopAndSelect(
  event: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>,
  region: RegionId,
  onRegionChange: (region: RegionId) => void,
) {
  event.stopPropagation();
  onRegionChange(region);
}

function ClinicalBodyModel({
  modelPath,
  profile,
  standby,
}: {
  modelPath: string;
  profile: BodyProfile;
  standby: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelPath) as { scene: THREE.Group };

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#b8dfc7'),
        transparent: true,
        opacity: standby ? 0.34 : 0.48,
        roughness: 0.88,
        metalness: 0,
        transmission: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [standby],
  );

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene, material]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const idle = Math.sin(clock.elapsedTime * 0.48) * 0.018;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, idle, 0.04);
  });

  const scale = profile === 'male' ? 1.08 : profile === 'female' ? 1.03 : 1.05;

  return (
    <group ref={groupRef} position={[0, -1.08, 0]} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

function BodyScanRig({
  activeRegion,
  expanded,
  metrics,
  modelPath,
  onRegionChange,
  profile,
  standby,
}: ClinicalBody3DViewerProps & {
  modelPath: string | null;
}) {
  const rigRef = useRef<THREE.Group>(null);
  const rigScale = expanded ? 0.78 : 0.66;
  const rigY = expanded ? -0.04 : -0.08;

  useFrame(({ clock, pointer }) => {
    if (!rigRef.current) return;
    const pointerYaw = THREE.MathUtils.clamp(pointer.x, -0.8, 0.8) * 0.08;
    const idleYaw = Math.sin(clock.elapsedTime * 0.38) * (standby ? 0.035 : 0.018);
    const targetY = pointerYaw + idleYaw;
    rigRef.current.rotation.y = THREE.MathUtils.lerp(rigRef.current.rotation.y, targetY, 0.055);
    rigRef.current.rotation.x = THREE.MathUtils.lerp(rigRef.current.rotation.x, -pointer.y * 0.025, 0.045);
  });

  return (
    <group ref={rigRef} position={[0, rigY, 0]} scale={rigScale}>
      <Suspense fallback={<ClinicalBodyFallback profile={profile} standby={standby} />}>
        {modelPath ? (
          <ClinicalBodyModel modelPath={modelPath} profile={profile} standby={standby} />
        ) : (
          <ClinicalBodyFallback profile={profile} standby={standby} />
        )}
      </Suspense>

      <group name="measurement-rings">
        {RINGS.map((ring) => {
          const metric = metrics[ring.id];
          const active = activeRegion === ring.id;
          const opacity = active ? 0.92 : 0.48;
          const tubeRadius = active ? 0.018 : 0.012;

          return (
            <group key={ring.id}>
              {active && (
                <mesh position={ring.position} rotation={[Math.PI / 2, 0, 0]} scale={ring.scale}>
                  <torusGeometry args={[ring.radius, 0.034, 18, 112]} />
                  <meshBasicMaterial color={metric.color} transparent opacity={0.14} depthWrite={false} />
                </mesh>
              )}
              <mesh
                position={ring.position}
                rotation={[Math.PI / 2, 0, 0]}
                scale={ring.scale}
                onPointerOver={(event) => stopAndSelect(event, ring.id, onRegionChange)}
                onClick={(event) => stopAndSelect(event, ring.id, onRegionChange)}
              >
                <torusGeometry args={[ring.radius, tubeRadius, 18, 128]} />
                <meshBasicMaterial color={metric.color} transparent opacity={opacity} depthWrite={false} />
              </mesh>
              <mesh
                position={ring.position}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[ring.scale[0] * 1.14, ring.scale[1] * 1.2, ring.scale[2]]}
                onPointerOver={(event) => stopAndSelect(event, ring.id, onRegionChange)}
                onClick={(event) => stopAndSelect(event, ring.id, onRegionChange)}
              >
                <torusGeometry args={[ring.radius, 0.075, 16, 64]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <Html position={ring.labelPosition} center distanceFactor={4.5} zIndexRange={[20, 0]}>
                <button
                  type="button"
                  onMouseEnter={() => onRegionChange(ring.id)}
                  onClick={() => onRegionChange(ring.id)}
                  className={cn(
                    'min-w-[108px] rounded-2xl border bg-white/85 px-3 py-2 text-left shadow-[0_12px_32px_rgba(24,74,45,0.14)] backdrop-blur transition',
                    active ? 'scale-105 border-primary/45 ring-2 ring-primary/15' : 'border-white/70',
                  )}
                >
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.08em]" style={{ color: metric.color }}>
                    {metric.shortLabel}
                  </span>
                  <span className="mt-0.5 block text-sm font-extrabold text-slate-800">
                    {metric.value === 'Veri yok' ? '-' : metric.value}
                  </span>
                </button>
              </Html>
            </group>
          );
        })}
      </group>

      <mesh
        position={[0, 0.65, 0.03]}
        scale={[0.55 + metrics.fat.intensity * 0.18, 0.7 + metrics.fat.intensity * 0.25, 0.22]}
        onPointerOver={(event) => stopAndSelect(event, 'fat', onRegionChange)}
        onClick={(event) => stopAndSelect(event, 'fat', onRegionChange)}
      >
        <sphereGeometry args={[1, 48, 24]} />
        <meshBasicMaterial
          color={metrics.fat.color}
          transparent
          opacity={(activeRegion === 'fat' ? 0.28 : 0.16) + metrics.fat.intensity * 0.14}
          depthWrite={false}
        />
      </mesh>

      <mesh
        position={[0, 0.72, 0]}
        scale={[0.46, 1.05, 0.16]}
        onPointerOver={(event) => stopAndSelect(event, 'water', onRegionChange)}
        onClick={(event) => stopAndSelect(event, 'water', onRegionChange)}
      >
        <sphereGeometry args={[1, 48, 24]} />
        <meshBasicMaterial
          color={metrics.water.color}
          transparent
          opacity={(activeRegion === 'water' ? 0.22 : 0.1) + metrics.water.intensity * 0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function ClinicalBody3DViewer({
  activeRegion,
  expanded,
  metrics,
  onRegionChange,
  profile,
  standby,
}: ClinicalBody3DViewerProps) {
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [assetChecked, setAssetChecked] = useState(false);
  const heightClass = expanded ? 'h-[680px] min-h-[620px]' : 'h-[560px]';

  useEffect(() => {
    let cancelled = false;
    const paths = profile === 'neutral' ? [MODEL_PATHS.neutral] : [MODEL_PATHS[profile], FALLBACK_MODEL_PATH];

    async function findModel() {
      setAssetChecked(false);
      for (const path of paths) {
        try {
          const response = await fetch(path, { method: 'HEAD' });
          if (!cancelled && response.ok) {
            setModelPath(path);
            useGLTF.preload(path);
            setAssetChecked(true);
            return;
          }
        } catch {
          // The fallback mannequin will render when the GLB is not present.
        }
      }

      if (!cancelled) {
        setModelPath(null);
        setAssetChecked(true);
      }
    }

    void findModel();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <div className={cn('relative overflow-hidden rounded-[1.75rem]', heightClass)}>
      <Canvas
        camera={{ position: [0, 1.25, 4.2], fov: 34 }}
        dpr={[1, 1.8]}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        shadows={false}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} color="#f7fff9" />
        <directionalLight position={[-3, 1.2, -2]} intensity={0.9} color="#9be8c2" />
        <pointLight position={[0, 1.6, 2.6]} intensity={8} color="#effff5" distance={7} />

        <BodyScanRig
          activeRegion={activeRegion}
          expanded={expanded}
          metrics={metrics}
          modelPath={modelPath}
          onRegionChange={onRegionChange}
          profile={profile}
          standby={standby}
        />

        <OrbitControls
          enablePan={false}
          enableZoom={expanded}
          minDistance={3.45}
          maxDistance={5}
          minPolarAngle={Math.PI / 2.75}
          maxPolarAngle={Math.PI / 1.82}
          rotateSpeed={0.48}
          zoomSpeed={0.36}
        />
      </Canvas>

      {assetChecked && !modelPath && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/70 bg-white/65 px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
          3D model asset&apos;i bekleniyor: public/models/clinical-body-neutral.glb
        </div>
      )}
    </div>
  );
}
