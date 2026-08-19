import { useEffect, useRef } from "react";
import * as THREE from "three";

interface AarogyaBot3DProps {
  className?: string;
}

export function AarogyaBot3D({ className = "" }: AarogyaBot3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.4, 4.8);

    // 2. WebGL Renderer with Alpha & Antialiasing
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
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. Materials
    // Glossy White Ceramic Body
    const whiteCeramicMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
    });

    // Dark Visor Glass
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x050716,
      roughness: 0.05,
      metalness: 0.4,
      clearcoat: 1.0,
      reflectivity: 1.0,
    });

    // Glowing Cyan Visor Eyes
    const cyanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    // Glowing Purple Antenna & Accents
    const purpleGlowMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
    });

    // Neon Heart Monitor Material
    const heartGlowMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
    });

    // Hologram Ring Materials
    const holoCyanMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });

    const holoPurpleMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });

    const holoRingLineMat = new THREE.LineBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.8,
    });

    // 4. Hierarchical Bot Construction
    const botRoot = new THREE.Group();
    scene.add(botRoot);

    // --- Floating Body Group ---
    const botBodyGroup = new THREE.Group();
    botRoot.add(botBodyGroup);

    // Main Torso (Curved egg/capsule)
    const torsoGeo = new THREE.SphereGeometry(0.72, 32, 28);
    torsoGeo.scale(1, 1.15, 0.95);
    const torsoMesh = new THREE.Mesh(torsoGeo, whiteCeramicMat);
    torsoMesh.position.y = -0.35;
    botBodyGroup.add(torsoMesh);

    // Chest Screen Pod (Dark pill housing heart monitor)
    const chestScreenGeo = new THREE.BoxGeometry(0.68, 0.52, 0.22);
    const chestScreenMesh = new THREE.Mesh(chestScreenGeo, visorMat);
    chestScreenMesh.position.set(0, -0.32, 0.62);
    chestScreenMesh.rotation.x = -0.08;
    botBodyGroup.add(chestScreenMesh);

    // Chest Glowing Heart & Pulse EKG (Procedural Mesh)
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0.08);
    heartShape.bezierCurveTo(0, 0.16, -0.15, 0.22, -0.15, 0.08);
    heartShape.bezierCurveTo(-0.15, -0.05, 0, -0.16, 0, -0.22);
    heartShape.bezierCurveTo(0, -0.16, 0.15, -0.05, 0.15, 0.08);
    heartShape.bezierCurveTo(0.15, 0.22, 0, 0.16, 0, 0.08);

    const heartGeo = new THREE.ShapeGeometry(heartShape);
    const heartMesh = new THREE.Mesh(heartGeo, heartGlowMat);
    heartMesh.scale.set(0.9, 0.9, 0.9);
    heartMesh.position.set(0, -0.3, 0.74);
    botBodyGroup.add(heartMesh);

    // EKG Line across chest
    const ekgCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.24, -0.32, 0.75),
      new THREE.Vector3(-0.1, -0.32, 0.75),
      new THREE.Vector3(-0.05, -0.22, 0.75),
      new THREE.Vector3(0, -0.42, 0.75),
      new THREE.Vector3(0.06, -0.25, 0.75),
      new THREE.Vector3(0.1, -0.32, 0.75),
      new THREE.Vector3(0.24, -0.32, 0.75),
    ]);
    const ekgGeo = new THREE.TubeGeometry(ekgCurve, 32, 0.012, 8, false);
    const ekgMesh = new THREE.Mesh(ekgGeo, cyanGlowMat);
    botBodyGroup.add(ekgMesh);

    // --- Head Group ---
    const botHeadGroup = new THREE.Group();
    botHeadGroup.position.set(0, 0.68, 0);
    botBodyGroup.add(botHeadGroup);

    // Helmet (Curved squarish rounded box)
    const helmetGeo = new THREE.SphereGeometry(0.85, 32, 28);
    helmetGeo.scale(1.22, 0.98, 1.05);
    const helmetMesh = new THREE.Mesh(helmetGeo, whiteCeramicMat);
    botHeadGroup.add(helmetMesh);

    // Dark Visor Face Screen
    const visorGeo = new THREE.SphereGeometry(0.72, 32, 24);
    visorGeo.scale(1.15, 0.8, 0.9);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, -0.02, 0.28);
    botHeadGroup.add(visorMesh);

    // Glowing Happy Eyes (2 Curved arc meshes)
    const eyeCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, -0.06, 0.96),
      new THREE.Vector3(-0.25, 0.08, 0.97),
      new THREE.Vector3(-0.15, -0.06, 0.96),
    ]);
    const eyeGeoL = new THREE.TubeGeometry(eyeCurveL, 20, 0.038, 8, false);
    const eyeMeshL = new THREE.Mesh(eyeGeoL, cyanGlowMat);
    botHeadGroup.add(eyeMeshL);

    const eyeCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.15, -0.06, 0.96),
      new THREE.Vector3(0.25, 0.08, 0.97),
      new THREE.Vector3(0.35, -0.06, 0.96),
    ]);
    const eyeGeoR = new THREE.TubeGeometry(eyeCurveR, 20, 0.038, 8, false);
    const eyeMeshR = new THREE.Mesh(eyeGeoR, cyanGlowMat);
    botHeadGroup.add(eyeMeshR);

    // Glowing Cute Smile
    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, -0.22, 0.95),
      new THREE.Vector3(0, -0.28, 0.96),
      new THREE.Vector3(0.12, -0.22, 0.95),
    ]);
    const smileGeo = new THREE.TubeGeometry(smileCurve, 16, 0.024, 8, false);
    const smileMesh = new THREE.Mesh(smileGeo, cyanGlowMat);
    botHeadGroup.add(smileMesh);

    // Ear Sensors (Left & Right cylinders)
    const earGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 24);
    earGeo.rotateZ(Math.PI / 2);

    const earL = new THREE.Mesh(earGeo, whiteCeramicMat);
    earL.position.set(-1.05, 0, 0);
    botHeadGroup.add(earL);

    const earRingL = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 16, 32), cyanGlowMat);
    earRingL.position.set(-1.14, 0, 0);
    earRingL.rotation.y = Math.PI / 2;
    botHeadGroup.add(earRingL);

    const earR = new THREE.Mesh(earGeo, whiteCeramicMat);
    earR.position.set(1.05, 0, 0);
    botHeadGroup.add(earR);

    const earRingR = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 16, 32), cyanGlowMat);
    earRingR.position.set(1.14, 0, 0);
    earRingR.rotation.y = Math.PI / 2;
    botHeadGroup.add(earRingR);

    // Antennae (Dual curved stalks with purple glowing bulbs)
    const antStalkGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 12);
    const antBulbGeo = new THREE.SphereGeometry(0.13, 20, 20);

    // Left Antenna
    const antStalkL = new THREE.Mesh(antStalkGeo, whiteCeramicMat);
    antStalkL.position.set(-0.52, 0.92, 0);
    antStalkL.rotation.z = -0.38;
    botHeadGroup.add(antStalkL);

    const antBulbL = new THREE.Mesh(antBulbGeo, purpleGlowMat);
    antBulbL.position.set(-0.64, 1.15, 0);
    botHeadGroup.add(antBulbL);

    // Right Antenna
    const antStalkR = new THREE.Mesh(antStalkGeo, whiteCeramicMat);
    antStalkR.position.set(0.52, 0.92, 0);
    antStalkR.rotation.z = 0.38;
    botHeadGroup.add(antStalkR);

    const antBulbR = new THREE.Mesh(antBulbGeo, purpleGlowMat);
    antBulbR.position.set(0.64, 1.15, 0);
    botHeadGroup.add(antBulbR);

    // --- Floating Arms with Floating Joints ---
    const armGeo = new THREE.CapsuleGeometry(0.14, 0.36, 12, 16);
    armGeo.rotateZ(0.4);

    const armL = new THREE.Mesh(armGeo, whiteCeramicMat);
    armL.position.set(-0.96, -0.32, 0.15);
    armL.rotation.z = 0.4;
    botBodyGroup.add(armL);

    // Right Waving Arm (Friendly greeting gesture)
    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.96, -0.22, 0.15);
    botBodyGroup.add(armRGroup);

    const armR = new THREE.Mesh(armGeo, whiteCeramicMat);
    armR.rotation.z = -0.85;
    armR.rotation.x = -0.3;
    armRGroup.add(armR);

    // Palm glowing sensor
    const palmGlow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), cyanGlowMat);
    palmGlow.position.set(0.4, 0.18, 0.15);
    armRGroup.add(palmGlow);

    // --- 5. Holographic Floor Platform (Concentric Glowing Rings) ---
    const holoBaseGroup = new THREE.Group();
    holoBaseGroup.position.set(0, -1.55, 0);
    holoBaseGroup.rotation.x = Math.PI / 2.35;
    botRoot.add(holoBaseGroup);

    // Ring 1 (Outer Cyan Cyber Ring)
    const ring1Geo = new THREE.TorusGeometry(1.65, 0.035, 16, 64);
    const ring1Mesh = new THREE.Mesh(ring1Geo, holoCyanMat);
    holoBaseGroup.add(ring1Mesh);

    // Ring 2 (Middle Purple Ring)
    const ring2Geo = new THREE.TorusGeometry(1.25, 0.03, 16, 64);
    const ring2Mesh = new THREE.Mesh(ring2Geo, holoPurpleMat);
    holoBaseGroup.add(ring2Mesh);

    // Ring 3 (Inner Core Cyan Ring)
    const ring3Geo = new THREE.TorusGeometry(0.8, 0.032, 16, 48);
    const ring3Mesh = new THREE.Mesh(ring3Geo, holoCyanMat);
    holoBaseGroup.add(ring3Mesh);

    // Holographic Circular Disk Plane with cyber circle grid
    const diskGeo = new THREE.RingGeometry(0.2, 1.7, 48);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    holoBaseGroup.add(diskMesh);

    // Vertical Hologram Light Beam Cylinder
    const holoBeamGeo = new THREE.CylinderGeometry(1.4, 1.6, 2.2, 32, 1, true);
    const holoBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const holoBeam = new THREE.Mesh(holoBeamGeo, holoBeamMat);
    holoBeam.position.y = 0.9;
    holoBeam.rotation.x = -Math.PI / 2.35;
    holoBaseGroup.add(holoBeam);

    // Floating Hologram Particles around the base
    const particleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.4 + Math.random() * 1.2;
      particlePos[i * 3] = Math.cos(angle) * radius;
      particlePos[i * 3 + 1] = Math.sin(angle) * radius;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    holoBaseGroup.add(particlePoints);

    // 6. Lighting
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const cyanRimLight = new THREE.PointLight(0x38bdf8, 4.5, 8);
    cyanRimLight.position.set(-2.8, -1.2, 2.5);
    scene.add(cyanRimLight);

    const purpleRimLight = new THREE.PointLight(0xc084fc, 4.0, 8);
    purpleRimLight.position.set(2.8, 2.5, -2);
    scene.add(purpleRimLight);

    const chestPointLight = new THREE.PointLight(0xa855f7, 2.5, 3);
    chestPointLight.position.set(0, 0, 1.2);
    scene.add(chestPointLight);

    // 7. Interactive Mouse Tracking
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = x * 0.65;
      targetRotX = y * 0.45;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 8. Animation Render Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth Hovering on Y Axis
      botBodyGroup.position.y = Math.sin(time * 2.2) * 0.12;

      // Gentle wave animation on right arm
      armRGroup.rotation.z = Math.sin(time * 3.5) * 0.18 - 0.1;

      // Heartbeat pulse modulation
      const heartbeat = (Math.sin(time * 4.5) > 0.6 ? 1.35 : 1.0) + Math.sin(time * 9.0) * 0.08;
      heartMesh.scale.set(0.9 * heartbeat, 0.9 * heartbeat, 0.9);
      chestPointLight.intensity = 2.0 * heartbeat;

      // Hologram ring rotations (Counter-rotating cyber rings)
      ring1Mesh.rotation.z = time * 0.6;
      ring2Mesh.rotation.z = -time * 0.85;
      ring3Mesh.rotation.z = time * 1.2;
      particlePoints.rotation.z = time * 0.4;

      // Antenna bulb brightness oscillation
      const bulbGlow = 0.85 + Math.sin(time * 3.0) * 0.25;
      purpleGlowMat.color.setRGB(0.75 * bulbGlow, 0.52 * bulbGlow, 0.98 * bulbGlow);

      // Smooth Head Tracking towards cursor
      currentRotY += (targetRotY - currentRotY) * 0.08;
      currentRotX += (targetRotX - currentRotX) * 0.08;
      botHeadGroup.rotation.y = currentRotY;
      botHeadGroup.rotation.x = currentRotX;
      botBodyGroup.rotation.y = currentRotY * 0.4;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Handling
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 240;
      const newH = container.clientHeight || 240;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center relative select-none pointer-events-auto cursor-grab active:cursor-grabbing ${className}`}
    />
  );
}
