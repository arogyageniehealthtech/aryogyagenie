import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface AarogyaBot3DProps {
  className?: string;
}

export function AarogyaBot3D({ className = "" }: AarogyaBot3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMotionActive, setIsMotionActive] = useState(true);
  const isTrackingRef = useRef(true);

  // Keep ref synchronized with state
  useEffect(() => {
    isTrackingRef.current = isMotionActive;
  }, [isMotionActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const width = container.clientWidth || 260;
    const height = container.clientHeight || 290;

    const scene = new THREE.Scene();
    
    // Perspective camera with elevated position looking down (~18-20 deg below eye level)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0.75, 6.2);
    camera.lookAt(0, 0.05, 0);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Materials
    // Glossy Pearlescent White Ceramic Shell
    const whiteCeramicMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95,
    });

    // Dark Glossy Visor Screen
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x050716,
      roughness: 0.04,
      metalness: 0.3,
      clearcoat: 1.0,
      reflectivity: 1.0,
    });

    // Vibrant Glowing Cyan Neon
    const cyanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
    });

    // Vibrant Glowing Electric Violet / Magenta
    const purpleGlowMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
    });

    const heartGlowMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
    });

    // Hologram Ring Materials (Additive & Glowing)
    const holoCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const holoPurpleMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const holoBlueMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    // 4. Hierarchical Bot Construction
    const botRoot = new THREE.Group();
    // Lowered slightly to provide ample headroom for the top horns/antennae
    botRoot.position.set(0, -0.15, 0);
    scene.add(botRoot);

    // --- Floating Robot Body Group ---
    const botBodyGroup = new THREE.Group();
    botBodyGroup.position.set(0, 0.45, 0);
    botRoot.add(botBodyGroup);

    // Main Torso (Curved egg/capsule shape)
    const torsoGeo = new THREE.SphereGeometry(0.68, 32, 28);
    torsoGeo.scale(1, 1.18, 0.95);
    const torsoMesh = new THREE.Mesh(torsoGeo, whiteCeramicMat);
    torsoMesh.position.y = -0.32;
    botBodyGroup.add(torsoMesh);

    // Circular Chest Vital Screen (Embedded flush badge - no sharp box edges)
    const chestBadgeGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.08, 32);
    chestBadgeGeo.rotateX(Math.PI / 2);
    const chestBadgeMesh = new THREE.Mesh(chestBadgeGeo, visorMat);
    chestBadgeMesh.position.set(0, -0.30, 0.60);
    chestBadgeMesh.rotation.x = 0.08;
    botBodyGroup.add(chestBadgeMesh);

    // Glowing Purple Border Ring around Chest Screen
    const chestRingGeo = new THREE.TorusGeometry(0.33, 0.022, 16, 40);
    const chestRingMesh = new THREE.Mesh(chestRingGeo, purpleGlowMat);
    chestRingMesh.position.set(0, -0.30, 0.64);
    chestRingMesh.rotation.x = 0.08;
    botBodyGroup.add(chestRingMesh);

    // Glowing Heart Inside Chest Screen
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.07);
    heartShape.bezierCurveTo(0, 0.14, -0.13, 0.20, -0.13, 0.07);
    heartShape.bezierCurveTo(-0.13, -0.04, 0, -0.14, 0, -0.19);
    heartShape.bezierCurveTo(0, -0.14, 0.13, -0.04, 0.13, 0.07);
    heartShape.bezierCurveTo(0.13, 0.20, 0, 0.14, 0, 0.07);

    const heartGeo = new THREE.ShapeGeometry(heartShape);
    const heartMesh = new THREE.Mesh(heartGeo, heartGlowMat);
    heartMesh.scale.set(0.85, 0.85, 0.85);
    heartMesh.position.set(0, -0.29, 0.66);
    botBodyGroup.add(heartMesh);

    // EKG Pulse Line across chest heart
    const ekgCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.20, -0.30, 0.67),
      new THREE.Vector3(-0.08, -0.30, 0.67),
      new THREE.Vector3(-0.04, -0.22, 0.67),
      new THREE.Vector3(0, -0.38, 0.67),
      new THREE.Vector3(0.05, -0.24, 0.67),
      new THREE.Vector3(0.08, -0.30, 0.67),
      new THREE.Vector3(0.20, -0.30, 0.67),
    ]);
    const ekgGeo = new THREE.TubeGeometry(ekgCurve, 32, 0.012, 8, false);
    const ekgMesh = new THREE.Mesh(ekgGeo, cyanGlowMat);
    botBodyGroup.add(ekgMesh);

    // --- Robot Head Group ---
    const botHeadGroup = new THREE.Group();
    botHeadGroup.position.set(0, 0.65, 0);
    botBodyGroup.add(botHeadGroup);

    // Helmet (Curved pearlescent ceramic shell)
    const helmetGeo = new THREE.SphereGeometry(0.80, 32, 28);
    helmetGeo.scale(1.20, 0.96, 1.05);
    const helmetMesh = new THREE.Mesh(helmetGeo, whiteCeramicMat);
    botHeadGroup.add(helmetMesh);

    // Dark Visor Face Screen
    const visorGeo = new THREE.SphereGeometry(0.70, 32, 24);
    visorGeo.scale(1.12, 0.78, 0.88);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, -0.02, 0.28);
    botHeadGroup.add(visorMesh);

    // Glowing Happy Eyes (Curved arc tubes)
    const eyeCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.33, -0.06, 0.94),
      new THREE.Vector3(-0.23, 0.07, 0.95),
      new THREE.Vector3(-0.13, -0.06, 0.94),
    ]);
    const eyeGeoL = new THREE.TubeGeometry(eyeCurveL, 20, 0.036, 8, false);
    const eyeMeshL = new THREE.Mesh(eyeGeoL, cyanGlowMat);
    botHeadGroup.add(eyeMeshL);

    const eyeCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.13, -0.06, 0.94),
      new THREE.Vector3(0.23, 0.07, 0.95),
      new THREE.Vector3(0.33, -0.06, 0.94),
    ]);
    const eyeGeoR = new THREE.TubeGeometry(eyeCurveR, 20, 0.036, 8, false);
    const eyeMeshR = new THREE.Mesh(eyeGeoR, cyanGlowMat);
    botHeadGroup.add(eyeMeshR);

    // Glowing Cute Smile
    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.11, -0.20, 0.93),
      new THREE.Vector3(0, -0.26, 0.94),
      new THREE.Vector3(0.11, -0.20, 0.93),
    ]);
    const smileGeo = new THREE.TubeGeometry(smileCurve, 16, 0.022, 8, false);
    const smileMesh = new THREE.Mesh(smileGeo, cyanGlowMat);
    botHeadGroup.add(smileMesh);

    // Ear Sensor Hubs (Left & Right cylinders with neon rings)
    const earGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 24);
    earGeo.rotateZ(Math.PI / 2);

    const earL = new THREE.Mesh(earGeo, whiteCeramicMat);
    earL.position.set(-0.98, 0, 0);
    botHeadGroup.add(earL);

    const earRingL = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 16, 32), cyanGlowMat);
    earRingL.position.set(-1.06, 0, 0);
    earRingL.rotation.y = Math.PI / 2;
    botHeadGroup.add(earRingL);

    const earR = new THREE.Mesh(earGeo, whiteCeramicMat);
    earR.position.set(0.98, 0, 0);
    botHeadGroup.add(earR);

    const earRingR = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 16, 32), cyanGlowMat);
    earRingR.position.set(1.06, 0, 0);
    earRingR.rotation.y = Math.PI / 2;
    botHeadGroup.add(earRingR);

    // Antennae / Horns (Dual angled stalks with glowing purple bulbs - fully within camera view)
    const antStalkGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.38, 12);
    const antBulbGeo = new THREE.SphereGeometry(0.12, 20, 20);

    // Left Antenna
    const antStalkL = new THREE.Mesh(antStalkGeo, whiteCeramicMat);
    antStalkL.position.set(-0.48, 0.88, 0);
    antStalkL.rotation.z = -0.34;
    botHeadGroup.add(antStalkL);

    const antBulbL = new THREE.Mesh(antBulbGeo, purpleGlowMat);
    antBulbL.position.set(-0.58, 1.08, 0);
    botHeadGroup.add(antBulbL);

    // Right Antenna
    const antStalkR = new THREE.Mesh(antStalkGeo, whiteCeramicMat);
    antStalkR.position.set(0.48, 0.88, 0);
    antStalkR.rotation.z = 0.34;
    botHeadGroup.add(antStalkR);

    const antBulbR = new THREE.Mesh(antBulbGeo, purpleGlowMat);
    antBulbR.position.set(0.58, 1.08, 0);
    botHeadGroup.add(antBulbR);

    // --- Floating Arms ---
    const armGeo = new THREE.CapsuleGeometry(0.13, 0.34, 12, 16);

    // Left Resting Arm
    const armL = new THREE.Mesh(armGeo, whiteCeramicMat);
    armL.position.set(-0.92, -0.30, 0.12);
    armL.rotation.z = 0.35;
    botBodyGroup.add(armL);

    // Right Waving Arm
    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.92, -0.20, 0.12);
    botBodyGroup.add(armRGroup);

    const armR = new THREE.Mesh(armGeo, whiteCeramicMat);
    armR.rotation.z = -0.82;
    armR.rotation.x = -0.25;
    armRGroup.add(armR);

    // Right Palm Glowing Beacon
    const palmGlow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), cyanGlowMat);
    palmGlow.position.set(0.38, 0.16, 0.14);
    armRGroup.add(palmGlow);

    // =========================================================================
    // 5. Multi-Layer Concentric Hologram Pedestal Platform (Reference Image 1)
    // Placed on the floor below the floating robot with clean clearance gap
    // =========================================================================
    const holoBaseGroup = new THREE.Group();
    holoBaseGroup.position.set(0, -1.35, 0);
    holoBaseGroup.rotation.x = Math.PI / 2.85; // ~20 deg below eye level perspective tilt
    botRoot.add(holoBaseGroup);

    // Layer 1: Outermost Cyan Glowing Perimeter Ring
    const outerRingGeo = new THREE.TorusGeometry(1.68, 0.032, 16, 80);
    const outerRingMesh = new THREE.Mesh(outerRingGeo, holoCyanMat);
    holoBaseGroup.add(outerRingMesh);

    // Layer 2: Outer Dashed / Segmented Purple Cyber Ring
    const segmentGroup = new THREE.Group();
    const segCount = 16;
    for (let i = 0; i < segCount; i++) {
      if (i % 2 === 0) {
        const segGeo = new THREE.TorusGeometry(1.52, 0.022, 12, 16, Math.PI / 10);
        const segMesh = new THREE.Mesh(segGeo, holoPurpleMat);
        segMesh.rotation.z = (i * Math.PI * 2) / segCount;
        segmentGroup.add(segMesh);
      }
    }
    holoBaseGroup.add(segmentGroup);

    // Layer 3: Middle Rotating Electric Purple Track Ring
    const midRingGeo = new THREE.TorusGeometry(1.24, 0.028, 16, 64);
    const midRingMesh = new THREE.Mesh(midRingGeo, holoPurpleMat);
    holoBaseGroup.add(midRingMesh);

    // 4 Orbiting Neon Nodes on Middle Ring
    const nodeGroup = new THREE.Group();
    const nodeGeo = new THREE.SphereGeometry(0.055, 12, 12);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const node = new THREE.Mesh(nodeGeo, cyanGlowMat);
      node.position.set(Math.cos(angle) * 1.24, Math.sin(angle) * 1.24, 0);
      nodeGroup.add(node);
    }
    holoBaseGroup.add(nodeGroup);

    // Layer 4: Inner Cyan Fast Ring with Medical Ticks
    const innerRingGeo = new THREE.TorusGeometry(0.82, 0.026, 16, 48);
    const innerRingMesh = new THREE.Mesh(innerRingGeo, holoCyanMat);
    holoBaseGroup.add(innerRingMesh);

    // Layer 5: Concentric Glowing Holographic Disk Rings (Flat planar glow rings)
    const disk1Geo = new THREE.RingGeometry(0.35, 0.75, 48);
    const disk1Mat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const disk1Mesh = new THREE.Mesh(disk1Geo, disk1Mat);
    holoBaseGroup.add(disk1Mesh);

    const disk2Geo = new THREE.RingGeometry(0.95, 1.15, 48);
    const disk2Mat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const disk2Mesh = new THREE.Mesh(disk2Geo, disk2Mat);
    holoBaseGroup.add(disk2Mesh);

    // Layer 6: Center Radiant Medical Pulse Core Ring
    const coreRingGeo = new THREE.TorusGeometry(0.42, 0.030, 16, 36);
    const coreRingMesh = new THREE.Mesh(coreRingGeo, holoCyanMat);
    holoBaseGroup.add(coreRingMesh);

    // Layer 7: Radiant Upward Levitation Sparkles / Energy Particles
    const particleCount = 55;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.35 + Math.random() * 1.25;
      particlePos[i * 3] = Math.cos(angle) * radius;
      particlePos[i * 3 + 1] = Math.sin(angle) * radius;
      particlePos[i * 3 + 2] = Math.random() * 0.9; // Floating upwards
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f5ff,
      size: 0.055,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    holoBaseGroup.add(particlePoints);

    // 6. Cyber Medical Stage Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const cyanFloorLight = new THREE.PointLight(0x00f5ff, 4.2, 7);
    cyanFloorLight.position.set(0, -1.2, 1.2);
    scene.add(cyanFloorLight);

    const purpleSideLight = new THREE.PointLight(0xc084fc, 3.8, 8);
    purpleSideLight.position.set(2.8, 1.8, 1.5);
    scene.add(purpleSideLight);

    const chestPointLight = new THREE.PointLight(0xa855f7, 2.2, 3);
    chestPointLight.position.set(0, 0.2, 1.0);
    scene.add(chestPointLight);

    // 7. Interactive Mouse / Touch Tracking
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!isTrackingRef.current || !container) {
        targetRotY = 0;
        targetRotX = 0;
        return;
      }
      const rect = container.getBoundingClientRect();
      const x = (clientX - rect.left) / (rect.width || 260) - 0.5;
      const y = (clientY - rect.top) / (rect.height || 290) - 0.5;
      targetRotY = x * 0.60;
      targetRotX = y * 0.40;
    };

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    // 8. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth Levitation Floating in Mid-Air
      botBodyGroup.position.y = 0.45 + Math.sin(time * 2.2) * 0.08;

      // Friendly Waving Right Arm
      armRGroup.rotation.z = Math.sin(time * 3.2) * 0.16 - 0.10;

      // Pulsing Heartbeat on Chest
      const heartbeat = (Math.sin(time * 4.5) > 0.6 ? 1.30 : 1.0) + Math.sin(time * 9.0) * 0.06;
      heartMesh.scale.set(0.85 * heartbeat, 0.85 * heartbeat, 0.85);
      chestPointLight.intensity = 1.8 * heartbeat;

      // Concentric Cyber Hologram Platform Rotations
      outerRingMesh.rotation.z = time * 0.45;
      segmentGroup.rotation.z = -time * 0.35;
      midRingMesh.rotation.z = time * 0.80;
      nodeGroup.rotation.z = time * 0.80;
      innerRingMesh.rotation.z = -time * 1.10;
      coreRingMesh.rotation.z = time * 1.40;
      particlePoints.rotation.z = time * 0.25;

      // Pulsing Antenna Bulbs ("Horns")
      const bulbGlow = 0.88 + Math.sin(time * 3.2) * 0.22;
      purpleGlowMat.color.setRGB(0.75 * bulbGlow, 0.52 * bulbGlow, 0.98 * bulbGlow);

      // Smooth Head Tracking toward pointer
      if (!isTrackingRef.current) {
        targetRotY = 0;
        targetRotX = 0;
      }
      currentRotY += (targetRotY - currentRotY) * 0.08;
      currentRotX += (targetRotX - currentRotX) * 0.08;
      botHeadGroup.rotation.y = currentRotY;
      botHeadGroup.rotation.x = currentRotX;
      botBodyGroup.rotation.y = currentRotY * 0.35;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer
    const updateSize = () => {
      if (!container) return;
      const newW = container.clientWidth || 260;
      const newH = container.clientHeight || 290;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", updateSize);
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const handleToggleMotion = () => {
    setIsMotionActive((prev) => !prev);
  };

  return (
    <div
      onClick={handleToggleMotion}
      title={isMotionActive ? "Click to lock / pause tracking" : "Click to resume tracking"}
      className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer group select-none"
    >
      <div
        ref={containerRef}
        className={`w-full h-full flex items-center justify-center relative pointer-events-auto ${className}`}
      />
      {/* Interaction Pill Indicator below platform */}
      <div className="absolute -bottom-1 px-2.5 py-0.5 rounded-full bg-slate-900/85 border border-indigo-500/30 text-[10px] text-slate-300 font-semibold opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md shadow-lg pointer-events-none z-20">
        {isMotionActive ? "Tap to lock gaze 🔒" : "Tap to follow cursor 👀"}
      </div>
    </div>
  );
}
