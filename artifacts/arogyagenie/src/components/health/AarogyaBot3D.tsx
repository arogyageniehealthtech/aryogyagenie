import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface AarogyaBot3DProps {
  className?: string;
}

/**
 * Generates a high-resolution 2048x2048 procedural Cyber-Medical HUD Texture
 * matching the rich futuristic holographic projection disc in Reference Image 2.
 */
function createCyberHudCanvasTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Helper function for radial drawing
  const drawCircle = (radius: number, color: string, lineWidth: number, dash: number[] = []) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  };

  const drawArc = (
    radius: number,
    startAngle: number,
    endAngle: number,
    color: string,
    lineWidth: number,
    dash: number[] = []
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  };

  // 1. Soft Radial Glow Background Under Base
  const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 980);
  bgGrad.addColorStop(0, "rgba(56, 189, 248, 0.22)");
  bgGrad.addColorStop(0.35, "rgba(168, 85, 247, 0.14)");
  bgGrad.addColorStop(0.70, "rgba(14, 165, 233, 0.08)");
  bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 980, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outermost Primary Perimeter Track (Radius ~960)
  drawCircle(960, "#00f5ff", 4);
  drawCircle(946, "rgba(56, 189, 248, 0.4)", 1.5);

  // 120 Radial Millimeter / Degree Tick Marks around outer ring
  const numTicks = 120;
  for (let i = 0; i < numTicks; i++) {
    const angle = (i * Math.PI * 2) / numTicks;
    const isMajor = i % 10 === 0;
    const isMid = i % 5 === 0;
    const len = isMajor ? 32 : isMid ? 20 : 10;
    const innerR = 946 - len;
    const outerR = 946;

    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isMajor ? "#00f5ff" : isMid ? "#a855f7" : "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = isMajor ? 3 : isMid ? 2 : 1.2;
    ctx.shadowColor = isMajor ? "#00f5ff" : "#a855f7";
    ctx.shadowBlur = isMajor ? 8 : 4;
    ctx.stroke();
    ctx.restore();
  }

  // 4 Cardinal HUD Text Badges
  const labels = [
    { text: "SYS:ONLINE", angle: 0 },
    { text: "AAROGYA:AI", angle: Math.PI / 2 },
    { text: "VITAL:SYNC", angle: Math.PI },
    { text: "FREQ:98.4", angle: (Math.PI * 3) / 2 },
  ];
  ctx.font = "bold 20px 'Inter', sans-serif";
  ctx.fillStyle = "#38bdf8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  labels.forEach(({ text, angle }) => {
    const r = 905;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 10;
    ctx.fillText(text, x, y);
    ctx.restore();
  });

  // 3. Segmented Outer Neon Shield Brackets (Radius ~880)
  for (let i = 0; i < 4; i++) {
    const start = (i * Math.PI) / 2 + 0.18;
    const end = (i * Math.PI) / 2 + Math.PI / 2 - 0.18;
    drawArc(880, start, end, "#d946ef", 5);
    drawArc(868, start + 0.05, end - 0.05, "#38bdf8", 2, [14, 8]);
  }

  // 4. Middle Track - Circular Data Orbit & Medical Glyphs (Radius ~780)
  drawCircle(780, "#00f5ff", 3);
  drawCircle(764, "rgba(168, 85, 247, 0.7)", 2, [18, 12]);

  // Small Glowing Circular Tech Nodes & Crosses
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16;
    const r = 746;
    const nx = cx + Math.cos(angle) * r;
    const ny = cy + Math.sin(angle) * r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(nx, ny, 6, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? "#00f5ff" : "#a855f7";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fill();

    // Radial bracket lines between nodes
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 746, angle - 0.12, angle + 0.12);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 5. Middle Dense Telemetry Rail (Radius ~650)
  drawCircle(650, "#38bdf8", 3.5);
  drawCircle(635, "#a855f7", 2, [6, 6]);

  // Embedded ECG Waveform etched radially
  for (let i = 0; i < 4; i++) {
    const baseAngle = (i * Math.PI) / 2 + 0.35;
    ctx.save();
    ctx.beginPath();
    for (let step = 0; step < 40; step++) {
      const a = baseAngle + (step * 0.45) / 40;
      let wave = 0;
      if (step === 15) wave = 18;
      else if (step === 18) wave = -24;
      else if (step === 22) wave = 28;
      else if (step === 25) wave = -12;

      const r = 600 + wave;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Inner Fast Orbital Rings (Radius ~480 & ~360)
  drawCircle(480, "#d946ef", 4);
  drawCircle(462, "#00f5ff", 2, [10, 10]);
  drawCircle(360, "#00f5ff", 4.5);
  drawCircle(345, "rgba(56, 189, 248, 0.6)", 2, [4, 6]);

  // 7. Center Radiant Energy Core (Radius ~220)
  const coreGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 220);
  coreGrad.addColorStop(0, "rgba(0, 245, 255, 0.85)");
  coreGrad.addColorStop(0.4, "rgba(168, 85, 247, 0.65)");
  coreGrad.addColorStop(0.8, "rgba(14, 165, 233, 0.3)");
  coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 220, 0, Math.PI * 2);
  ctx.fill();

  drawCircle(220, "#00f5ff", 4);
  drawCircle(140, "#a855f7", 3, [8, 8]);
  drawCircle(70, "#00f5ff", 3);

  // Center Medical Cross
  ctx.save();
  ctx.fillStyle = "#00f5ff";
  ctx.shadowColor = "#00f5ff";
  ctx.shadowBlur = 15;
  ctx.fillRect(cx - 6, cy - 32, 12, 64);
  ctx.fillRect(cx - 32, cy - 6, 64, 12);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Generates floating mini holographic HUD data panels (left & right widgets)
 */
function createFloatingHudPanelTexture(type: "ecg" | "metrics"): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, w, h);

  // Semi-transparent glowing card background
  ctx.fillStyle = "rgba(6, 12, 38, 0.75)";
  ctx.roundRect(8, 8, w - 16, h - 16, 16);
  ctx.fill();

  ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "#00f5ff";
  ctx.shadowBlur = 10;
  ctx.roundRect(8, 8, w - 16, h - 16, 16);
  ctx.stroke();

  if (type === "ecg") {
    // Header
    ctx.font = "bold 22px 'Inter', sans-serif";
    ctx.fillStyle = "#00f5ff";
    ctx.fillText("LIVE VITAL STATUS", 28, 44);

    ctx.font = "16px 'Inter', sans-serif";
    ctx.fillStyle = "#a855f7";
    ctx.fillText("HEART PULSE: 72 BPM • OPTIMAL", 28, 72);

    // EKG Graph
    ctx.beginPath();
    ctx.moveTo(28, 150);
    ctx.lineTo(80, 150);
    ctx.lineTo(110, 140);
    ctx.lineTo(130, 190);
    ctx.lineTo(160, 90);
    ctx.lineTo(190, 180);
    ctx.lineTo(210, 150);
    ctx.lineTo(260, 150);
    ctx.lineTo(290, 130);
    ctx.lineTo(310, 200);
    ctx.lineTo(340, 80);
    ctx.lineTo(370, 175);
    ctx.lineTo(390, 150);
    ctx.lineTo(480, 150);

    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Bottom telemetry bar
    ctx.fillStyle = "rgba(56, 189, 248, 0.3)";
    ctx.roundRect(28, 210, 450, 14, 6);
    ctx.fill();
    ctx.fillStyle = "#00f5ff";
    ctx.roundRect(28, 210, 360, 14, 6);
    ctx.fill();
  } else {
    // Metrics
    ctx.font = "bold 22px 'Inter', sans-serif";
    ctx.fillStyle = "#a855f7";
    ctx.fillText("AI NEURAL DIAGNOSTIC", 28, 44);

    ctx.font = "16px 'Inter', sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("CLINICAL RAG: ACTIVE (100%)", 28, 72);

    // Progress Bars
    const items = [
      { label: "Symptom Accuracy", val: 380, color: "#00f5ff" },
      { label: "Safety Triaging", val: 420, color: "#a855f7" },
      { label: "Biometric Sync", val: 340, color: "#38bdf8" },
    ];

    items.forEach((item, idx) => {
      const y = 110 + idx * 40;
      ctx.font = "14px 'Inter', sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(item.label, 28, y);

      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.roundRect(210, y - 12, 260, 14, 6);
      ctx.fill();

      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 8;
      ctx.roundRect(210, y - 12, item.val - 210, 14, 6);
      ctx.fill();
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function AarogyaBot3D({ className = "" }: AarogyaBot3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMotionActive, setIsMotionActive] = useState(true);
  const isTrackingRef = useRef(true);

  useEffect(() => {
    isTrackingRef.current = isMotionActive;
  }, [isMotionActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Elevated Camera (~20 deg top-down angle)
    const width = container.clientWidth || 260;
    const height = container.clientHeight || 290;

    const scene = new THREE.Scene();
    
    // 40-degree top-down elevated perspective camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 2.8, 5.2);
    camera.lookAt(0, -0.2, 0);

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
    renderer.toneMappingExposure = 1.30;
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

    // Hologram Additive Glowing Materials
    const holoCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const holoMagentaMat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    // 4. Hierarchical Bot Construction
    const botRoot = new THREE.Group();
    // Positioned with ample headroom for top horns
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

    // Ear Sensor Hubs
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

    // Antennae / Horns (Dual angled stalks with glowing purple bulbs - 100% visible inside frame)
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

    // Left Arm
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
    // 5. HIGH-TECH HOLOGRAPHIC CYBER-MEDICAL HUD PEDESTAL (Reference Image 2)
    // =========================================================================
    const holoBaseGroup = new THREE.Group();
    holoBaseGroup.position.set(0, -1.35, 0);
    holoBaseGroup.rotation.x = Math.PI / 2.35; // 40-deg top-down angle revealing complete HUD surface
    botRoot.add(holoBaseGroup);

    // High-Resolution Procedural HUD Texture Disc (Plane geometry)
    const hudTexture = createCyberHudCanvasTexture();
    const hudPlaneGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const hudPlaneMat = new THREE.MeshBasicMaterial({
      map: hudTexture,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const hudPlaneMesh = new THREE.Mesh(hudPlaneGeo, hudPlaneMat);
    holoBaseGroup.add(hudPlaneMesh);

    // Secondary Counter-Rotating HUD Texture Disc
    const hudPlaneGeo2 = new THREE.PlaneGeometry(2.4, 2.4);
    const hudPlaneMesh2 = new THREE.Mesh(hudPlaneGeo2, hudPlaneMat);
    hudPlaneMesh2.position.z = 0.01;
    holoBaseGroup.add(hudPlaneMesh2);

    // Layer 1: Outermost 3D Glowing Neon Cyan Perimeter Ring
    const outerRingGeo = new THREE.TorusGeometry(1.72, 0.024, 16, 90);
    const outerRingMesh = new THREE.Mesh(outerRingGeo, holoCyanMat);
    holoBaseGroup.add(outerRingMesh);

    // Layer 2: Fast Counter-Rotating Segmented Magenta Arc Ring
    const segmentGroup = new THREE.Group();
    const segCount = 12;
    for (let i = 0; i < segCount; i++) {
      if (i % 2 === 0) {
        const segGeo = new THREE.TorusGeometry(1.42, 0.020, 12, 20, Math.PI / 7);
        const segMesh = new THREE.Mesh(segGeo, holoMagentaMat);
        segMesh.rotation.z = (i * Math.PI * 2) / segCount;
        segmentGroup.add(segMesh);
      }
    }
    holoBaseGroup.add(segmentGroup);

    // Layer 3: Orbiting Middle Track with 4 Glowing Energy Beacons
    const midRingGeo = new THREE.TorusGeometry(1.15, 0.022, 16, 64);
    const midRingMesh = new THREE.Mesh(midRingGeo, holoCyanMat);
    holoBaseGroup.add(midRingMesh);

    const nodeGroup = new THREE.Group();
    const nodeGeo = new THREE.SphereGeometry(0.048, 12, 12);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const node = new THREE.Mesh(nodeGeo, cyanGlowMat);
      node.position.set(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 0.02);
      nodeGroup.add(node);
    }
    holoBaseGroup.add(nodeGroup);

    // Layer 4: Inner High-Intensity Neon Core Ring
    const coreRingGeo = new THREE.TorusGeometry(0.65, 0.026, 16, 48);
    const coreRingMesh = new THREE.Mesh(coreRingGeo, holoMagentaMat);
    coreRingMesh.position.z = 0.02;
    holoBaseGroup.add(coreRingMesh);

    // =========================================================================
    // 6. Floating Holographic Telemetry Panels (Left & Right - As in Image 2)
    // =========================================================================
    const hudCardsGroup = new THREE.Group();
    botRoot.add(hudCardsGroup);

    // Left Floating Live Vital Panel
    const leftCardTex = createFloatingHudPanelTexture("ecg");
    const leftCardGeo = new THREE.PlaneGeometry(0.92, 0.46);
    const leftCardMat = new THREE.MeshBasicMaterial({
      map: leftCardTex,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const leftCardMesh = new THREE.Mesh(leftCardGeo, leftCardMat);
    leftCardMesh.position.set(-1.18, -0.72, 0.38);
    leftCardMesh.rotation.y = 0.28;
    leftCardMesh.rotation.x = -0.42; // Tilted toward 40 deg camera
    hudCardsGroup.add(leftCardMesh);

    // Right Floating Diagnostics Panel
    const rightCardTex = createFloatingHudPanelTexture("metrics");
    const rightCardGeo = new THREE.PlaneGeometry(0.92, 0.46);
    const rightCardMat = new THREE.MeshBasicMaterial({
      map: rightCardTex,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rightCardMesh = new THREE.Mesh(rightCardGeo, rightCardMat);
    rightCardMesh.position.set(1.18, -0.72, 0.38);
    rightCardMesh.rotation.y = -0.28;
    rightCardMesh.rotation.x = -0.42; // Tilted toward 40 deg camera
    hudCardsGroup.add(rightCardMesh);

    // Layer 7: Upward-Floating Levitation Energy Embers
    const particleCount = 65;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.30 + Math.random() * 1.35;
      particlePos[i * 3] = Math.cos(angle) * radius;
      particlePos[i * 3 + 1] = Math.sin(angle) * radius;
      particlePos[i * 3 + 2] = Math.random() * 0.95; // Floating upwards
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f5ff,
      size: 0.052,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    holoBaseGroup.add(particlePoints);

    // 7. Cyber Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const cyanFloorLight = new THREE.PointLight(0x00f5ff, 4.8, 7);
    cyanFloorLight.position.set(0, -1.2, 1.2);
    scene.add(cyanFloorLight);

    const purpleSideLight = new THREE.PointLight(0xc084fc, 4.0, 8);
    purpleSideLight.position.set(2.8, 1.8, 1.5);
    scene.add(purpleSideLight);

    const chestPointLight = new THREE.PointLight(0xa855f7, 2.2, 3);
    chestPointLight.position.set(0, 0.2, 1.0);
    scene.add(chestPointLight);

    // 8. Interactive Mouse / Touch Tracking
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

    // 9. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth Levitation Floating in Mid-Air
      botBodyGroup.position.y = 0.45 + Math.sin(time * 2.2) * 0.08;

      // Gentle wave on right arm
      armRGroup.rotation.z = Math.sin(time * 3.2) * 0.16 - 0.10;

      // Pulsing Heartbeat on Chest
      const heartbeat = (Math.sin(time * 4.5) > 0.6 ? 1.30 : 1.0) + Math.sin(time * 9.0) * 0.06;
      heartMesh.scale.set(0.85 * heartbeat, 0.85 * heartbeat, 0.85);
      chestPointLight.intensity = 1.8 * heartbeat;

      // High-Tech Concentric HUD Rotations
      hudPlaneMesh.rotation.z = time * 0.25;
      hudPlaneMesh2.rotation.z = -time * 0.40;
      outerRingMesh.rotation.z = time * 0.45;
      segmentGroup.rotation.z = -time * 0.65;
      midRingMesh.rotation.z = time * 0.80;
      nodeGroup.rotation.z = time * 0.80;
      coreRingMesh.rotation.z = -time * 1.20;
      particlePoints.rotation.z = time * 0.25;

      // Floating HUD cards hover bobbing
      leftCardMesh.position.y = -0.72 + Math.sin(time * 2.0 + 1) * 0.03;
      rightCardMesh.position.y = -0.72 + Math.sin(time * 2.0 + 2) * 0.03;

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

    // 10. Resize Observer
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
      hudTexture.dispose();
      leftCardTex.dispose();
      rightCardTex.dispose();
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
