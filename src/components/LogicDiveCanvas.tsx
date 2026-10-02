import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  LogicCourse,
  StageObstacle,
  STAGE_LENGTH,
  SPLIT_APPROACH_Z,
  SPLIT_GATE_Z,
  SPLIT_JUDGE_Z,
  SPLIT_MERGE_Z,
  generateCourseHazards,
} from '../data/courses';
import { sound } from '../utils/sound';

export type DeathReason = 'wrong_answer' | 'pitfall';

export interface TelemetryState {
  z: number;
  stageIndex: number;
  localZ: number;
  speedKmh: number;
  u: number;
  currentLane: 0 | 1 | 2;
  isBraking: boolean;
  isBoosting: boolean;
  isJumping: boolean;
  isHittingWall: boolean;
  approachingSplit: boolean;
  inSplitLock: boolean;
  upcomingHazard: string | null;
  safeZoneRemaining: number;
}

export interface ControlInputs {
  left: boolean;
  right: boolean;
  brake: boolean;
  boost: boolean;
  jump: boolean;
}

interface LogicDiveCanvasProps {
  course: LogicCourse;
  gameState: 'title' | 'briefing' | 'playing' | 'paused' | 'dead' | 'victory';
  startStageIndex: number;
  runId: number;
  touchInputs: ControlInputs;
  onTelemetry: (t: TelemetryState) => void;
  onLogicBreak: (stageIndex: number, choiceIndex: number) => void;
  onDeath: (reason: DeathReason, message: string, stageIndex: number, chosenIndex?: number) => void;
  onVictory: (clearTimeSec: number, maxSpeedKmh: number) => void;
}

const PIPE_RADIUS = 13.5;
const MAX_ANGLE = Math.PI * 0.42;

function getPipePoint(u: number, heightOffset = 0): {
  x: number;
  y: number;
  roll: number;
  nx: number;
  ny: number;
} {
  const clampedU = Math.max(-1.05, Math.min(1.05, u));
  const angle = clampedU * MAX_ANGLE;
  const baseX = Math.sin(angle) * PIPE_RADIUS;
  const baseY = (1 - Math.cos(angle)) * PIPE_RADIUS * 0.74;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  return {
    x: baseX + nx * heightOffset * 0.25,
    y: baseY + heightOffset,
    roll: -angle,
    nx,
    ny,
  };
}

function createTextTexture(
  title: string,
  subtitle: string,
  color: string,
  bg: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.fillStyle = color;
  ctx.fillRect(6, 6, canvas.width - 12, 54);

  ctx.fillStyle = '#060812';
  ctx.font = '700 20px "Chakra Petch", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 34);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '500 20px "Noto Sans JP", sans-serif';

  const maxChars = 14;
  const lines: string[] = [];
  for (let i = 0; i < subtitle.length; i += maxChars) {
    lines.push(subtitle.slice(i, i + maxChars));
  }
  const startY = lines.length === 1 ? 154 : 136;
  lines.forEach((l, idx) => {
    ctx.fillText(l, canvas.width / 2, startY + idx * 32);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const LogicDiveCanvas: React.FC<LogicDiveCanvasProps> = ({
  course,
  gameState,
  startStageIndex,
  runId,
  touchInputs,
  onTelemetry,
  onLogicBreak,
  onDeath,
  onVictory,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const touchInputsRef = useRef(touchInputs);
  touchInputsRef.current = touchInputs;

  const callbacksRef = useRef({ onTelemetry, onLogicBreak, onDeath, onVictory });
  callbacksRef.current = { onTelemetry, onLogicBreak, onDeath, onVictory };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050711');
    scene.fog = new THREE.FogExp2('#050711', 0.0055);

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      350
    );

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      setWebglLost(true);
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => setWebglLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight('#E2E8F0', 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 1.5);
    keyLight.position.set(15, 30, 20);
    scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight('#06B6D4', 1.2);
    cyanRim.position.set(-18, 12, -35);
    scene.add(cyanRim);

    // 3. Hazards Data
    const { pitfalls, obstacles } = generateCourseHazards();
    const totalLength = STAGE_LENGTH * 3;

    // Helper: is cell missing (pitfall or wrong-answer dead end)
    const isCellMissing = (zMid: number, uMid: number) => {
      const stageIdx = Math.min(2, Math.floor(zMid / STAGE_LENGTH));
      const localZ = zMid - stageIdx * STAGE_LENGTH;
      const question = course.questions[stageIdx];

      // Regular pitfalls
      for (const pit of pitfalls) {
        if (pit.stageIndex !== stageIdx) continue;
        if (uMid >= pit.uMin && uMid <= pit.uMax) {
          if (zMid >= pit.zStart && zMid <= pit.zEnd) {
            return { missing: true, warning: false, laneColor: null };
          }
          if (zMid >= pit.zStart - 12 && zMid < pit.zStart) {
            return { missing: false, warning: true, laneColor: null };
          }
        }
      }

      // Answer Split zone
      if (localZ >= SPLIT_APPROACH_Z && localZ <= SPLIT_MERGE_Z) {
        if ((uMid > -0.36 && uMid < -0.28) || (uMid > 0.28 && uMid < 0.36)) {
          if (localZ >= SPLIT_GATE_Z) {
            return { missing: true, warning: false, laneColor: null };
          }
        }

        const laneIdx = uMid < -0.32 ? 0 : uMid > 0.32 ? 2 : 1;
        const laneColors = ['#06B6D4', '#F59E0B', '#F43F5E'];

        // At SPLIT_JUDGE_Z, wrong answer paths drop off into abyss!
        if (localZ >= SPLIT_JUDGE_Z && localZ <= SPLIT_MERGE_Z - 6) {
          if (laneIdx !== question.correctIndex) {
            return { missing: true, warning: false, laneColor: null };
          }
        }

        return { missing: false, warning: false, laneColor: laneColors[laneIdx] };
      }

      return { missing: false, warning: false, laneColor: null };
    };

    // 4. Build Half-Pipe Mesh
    const zStep = 4;
    const uSlices = 18;
    const positions: number[] = [];
    const colors: number[] = [];
    const wirePositions: number[] = [];
    const wireColors: number[] = [];

    const cTileA = new THREE.Color('#0A1124');
    const cTileB = new THREE.Color('#0E1935');
    const cWarn = new THREE.Color('#F43F5E');
    const cLineCyan = new THREE.Color('#06B6D4');
    const cLineBlue = new THREE.Color('#3B82F6');

    for (let z = 0; z < totalLength + 60; z += zStep) {
      const z0 = z;
      const z1 = z + zStep;
      const zMid = (z0 + z1) * 0.5;

      for (let i = 0; i < uSlices; i++) {
        const u0 = -1 + (i / uSlices) * 2;
        const u1 = -1 + ((i + 1) / uSlices) * 2;
        const uMid = (u0 + u1) * 0.5;

        const cell = isCellMissing(zMid, uMid);
        if (cell.missing) continue;

        const p00 = getPipePoint(u0, 0);
        const p10 = getPipePoint(u1, 0);
        const p01 = getPipePoint(u0, 0);
        const p11 = getPipePoint(u1, 0);

        positions.push(
          p00.x, p00.y, -z0,
          p10.x, p10.y, -z0,
          p11.x, p11.y, -z1,

          p00.x, p00.y, -z0,
          p11.x, p11.y, -z1,
          p01.x, p01.y, -z1
        );

        let tColor = (Math.floor(z / zStep) + i) % 2 === 0 ? cTileA : cTileB;
        let lColor = Math.floor(z / 16) % 2 === 0 ? cLineCyan : cLineBlue;

        if (cell.warning) {
          tColor = cWarn.clone().multiplyScalar(0.45);
          lColor = cWarn;
        } else if (cell.laneColor) {
          const lc = new THREE.Color(cell.laneColor);
          tColor = lc.clone().multiplyScalar(0.28);
          lColor = lc;
        }

        for (let v = 0; v < 6; v++) {
          colors.push(tColor.r, tColor.g, tColor.b);
        }

        wirePositions.push(
          p00.x, p00.y + 0.02, -z0,
          p10.x, p10.y + 0.02, -z0,
          p00.x, p00.y + 0.02, -z0,
          p01.x, p01.y + 0.02, -z1
        );
        for (let w = 0; w < 4; w++) {
          wireColors.push(lColor.r, lColor.g, lColor.b);
        }
      }
    }

    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    trackGeo.computeVertexNormals();

    const trackMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.5,
      side: THREE.DoubleSide,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    scene.add(trackMesh);

    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));
    wireGeo.setAttribute('color', new THREE.Float32BufferAttribute(wireColors, 3));
    const wireMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });
    const wireLines = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(wireLines);

    // 5. Starfield / Synapse Points
    const starCount = 1000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const pCols = [new THREE.Color('#06B6D4'), new THREE.Color('#F59E0B'), new THREE.Color('#EC4899')];

    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 55;
      starPositions[i * 3] = Math.cos(a) * r;
      starPositions[i * 3 + 1] = Math.sin(a) * r + 8;
      starPositions[i * 3 + 2] = -Math.random() * (totalLength + 80);
      const c = pCols[i % pCols.length];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.75 });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // 6. Build Obstacle Walls (当たり判定のある壁)
    const obstacleMeshes: { data: StageObstacle; group: THREE.Group; mesh: THREE.Mesh }[] = [];
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#E11D48',
      emissive: '#881337',
      roughness: 0.3,
      metalness: 0.6,
    });
    const wallWireMat = new THREE.MeshBasicMaterial({ color: '#FDA4AF', wireframe: true });
    const movingWallMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      emissive: '#78350F',
      roughness: 0.3,
      metalness: 0.6,
    });

    obstacles.forEach((obs) => {
      const group = new THREE.Group();
      const worldWidth = obs.uWidth * PIPE_RADIUS * 1.15;
      const geo = new THREE.BoxGeometry(worldWidth, obs.height, obs.zDepth);
      const mesh = new THREE.Mesh(geo, obs.kind === 'moving' ? movingWallMat : wallMat);
      mesh.position.y = obs.height * 0.5;
      group.add(mesh);

      const wire = new THREE.Mesh(geo, wallWireMat);
      wire.position.y = obs.height * 0.5;
      wire.scale.setScalar(1.02);
      group.add(wire);

      const pt = getPipePoint(obs.uCenter, 0);
      group.position.set(pt.x, pt.y, -obs.z);
      group.rotation.z = pt.roll;
      scene.add(group);

      obstacleMeshes.push({ data: obs, group, mesh });
    });

    // 7. High Holographic Arches & Lane Guides at Split Gate (High enough not to block road!)
    const texturesToDispose: THREE.Texture[] = [];
    const laneInfo = [
      { u: -0.66, label: '← [A] 左の道', color: '#06B6D4', bg: '#082F49' },
      { u: 0.0, label: '▲ [中央] 真ん中の道', color: '#F59E0B', bg: '#451A03' },
      { u: 0.66, label: '[D] 右の道 →', color: '#F43F5E', bg: '#4C0519' },
    ];

    for (let stage = 0; stage < 3; stage++) {
      const baseZ = stage * STAGE_LENGTH;
      const gateZ = baseZ + SPLIT_GATE_Z;
      const judgeZ = baseZ + SPLIT_JUDGE_Z;
      const q = course.questions[stage];

      // Divider Energy walls
      [-0.32, 0.32].forEach((divU) => {
        const pt = getPipePoint(divU, 0);
        const wallLen = SPLIT_MERGE_Z - SPLIT_GATE_Z;
        const wallGeo = new THREE.BoxGeometry(0.35, 4.2, wallLen);
        const wMat = new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.3 });
        const wall = new THREE.Mesh(wallGeo, wMat);
        wall.position.set(pt.x, pt.y + 2.1, -(gateZ + wallLen * 0.5));
        wall.rotation.z = pt.roll;
        scene.add(wall);
      });

      // Overhead archways positioned high up (yOffset = 6.2) so player has clear view of track floor!
      laneInfo.forEach((info, laneIdx) => {
        const pt = getPipePoint(info.u, 6.2);
        const tex = createTextTexture(info.label, q.choices[laneIdx], info.color, info.bg);
        texturesToDispose.push(tex);

        const boardGeo = new THREE.PlaneGeometry(7.2, 3.6);
        const boardMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(pt.x, pt.y, -gateZ);
        board.rotation.z = pt.roll * 0.5;
        scene.add(board);

        // Ground arch ring
        const archG = new THREE.TorusGeometry(3.6, 0.16, 8, 24, Math.PI);
        const archM = new THREE.MeshBasicMaterial({ color: info.color });
        const arch = new THREE.Mesh(archG, archM);
        const groundPt = getPipePoint(info.u, 0);
        arch.position.set(groundPt.x, groundPt.y, -gateZ);
        arch.rotation.z = groundPt.roll;
        scene.add(arch);

        // At SPLIT_JUDGE_Z: truth ring or dead-end abyss marker
        const jPt = getPipePoint(info.u, 1.8);
        if (laneIdx === q.correctIndex) {
          const tRingG = new THREE.TorusGeometry(3.2, 0.22, 10, 32);
          const tRingM = new THREE.MeshBasicMaterial({ color: '#10B981' });
          const tRing = new THREE.Mesh(tRingG, tRingM);
          tRing.position.set(jPt.x, jPt.y, -judgeZ);
          tRing.rotation.z = jPt.roll;
          scene.add(tRing);
        } else {
          const edgeG = new THREE.BoxGeometry(5.2, 0.35, 0.5);
          const edgeM = new THREE.MeshBasicMaterial({ color: '#EF4444' });
          const edge = new THREE.Mesh(edgeG, edgeM);
          const fPt = getPipePoint(info.u, 0.1);
          edge.position.set(fPt.x, fPt.y, -judgeZ);
          edge.rotation.z = fPt.roll;
          scene.add(edge);
        }
      });
    }

    // Goal Gate
    const goalGeo = new THREE.TorusGeometry(PIPE_RADIUS * 1.05, 0.4, 12, 48, Math.PI);
    const goalMat = new THREE.MeshBasicMaterial({ color: '#F59E0B' });
    const goal = new THREE.Mesh(goalGeo, goalMat);
    goal.position.set(0, 0, -totalLength);
    scene.add(goal);

    // 8. Player Model
    const playerGroup = new THREE.Group();
    const riderGroup = new THREE.Group();
    playerGroup.add(riderGroup);

    // Hoverboard
    const boardGeo = new THREE.BoxGeometry(1.6, 0.16, 3.4);
    const boardMat = new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#0891B2',
      roughness: 0.2,
      metalness: 0.8,
    });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.y = 0.22;
    riderGroup.add(boardMesh);

    // Thrusters
    const thrusterGeo = new THREE.ConeGeometry(0.24, 1.2, 10);
    thrusterGeo.rotateX(Math.PI * 0.5);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: '#22D3EE' });
    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.position.set(-0.45, 0.22, 2.0);
    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.position.set(0.45, 0.22, 2.0);
    riderGroup.add(leftThruster, rightThruster);

    // Stylized rider
    const bodyGeo = new THREE.ConeGeometry(0.5, 1.35, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#1E293B', emissive: '#0F172A' });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 1.05, 0);
    riderGroup.add(body);

    const headGeo = new THREE.SphereGeometry(0.32, 14, 14);
    const headMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC' });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.88, -0.05);
    riderGroup.add(head);

    // Ground Shadow Ring (visual indicator of where player is above the floor)
    const shadowGeo = new THREE.RingGeometry(0.65, 1.1, 24);
    shadowGeo.rotateX(-Math.PI * 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#06B6D4',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const shadowRing = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(shadowRing);

    scene.add(playerGroup);

    // 9. Controls Keyboard Handling (A, D, S, Shift, Space)
    const keys = {
      left: false,
      right: false,
      brake: false,
      boost: false,
      jump: false,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') {
        keys.left = true;
      }
      if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') {
        keys.right = true;
      }
      if (code === 'KeyS' || key === 's' || code === 'ArrowDown') {
        if (!keys.brake && gameStateRef.current === 'playing') {
          sound.playBrake();
        }
        keys.brake = true;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight' || e.shiftKey) {
        if (!keys.boost && gameStateRef.current === 'playing') {
          sound.playBoost();
        }
        keys.boost = true;
      }
      if (code === 'Space' || key === ' ') {
        e.preventDefault();
        keys.jump = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') keys.left = false;
      if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') keys.right = false;
      if (code === 'KeyS' || key === 's' || code === 'ArrowDown') keys.brake = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || !e.shiftKey) keys.boost = false;
      if (code === 'Space' || key === ' ') keys.jump = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 10. Game Loop & Physics Parameters
    // Relaxed, enjoyable speed as requested by user ("素のスピードが速すぎる")
    const BASE_SPEED = 20.0; // was 46.0! Now nice and readable
    const BOOST_SPEED = 40.0; // Fast when desired
    const GRAVITY = 36.0;
    const JUMP_FORCE = 15.5;

    const initialZ = startStageIndex * STAGE_LENGTH + 8;
    let playerZ = initialZ;
    let playerU = 0;
    let playerVelU = 0;
    let jumpY = 0;
    let jumpVelY = 0;
    let isFallingIntoAbyss = false;
    let fallDepth = 0;
    let currentSpeed = BASE_SPEED;
    let maxSpeedRecorded = 72;
    let lockedLane: 0 | 1 | 2 | null = null;
    let isHittingWall = false;
    let lastBumpTime = 0;
    let stageElapsedTimer = 0;

    const clearedStages = new Set<number>();
    let lastNotifiedStage = -1;
    let elapsedRunSec = 0;

    let lastTime = performance.now();
    let animFrameId = 0;
    let telemetryTick = 0;

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const timeSec = now * 0.001;

      // Update moving obstacles
      obstacleMeshes.forEach(({ data, group }) => {
        if (data.kind === 'moving' && data.moveSpeed && data.moveRange) {
          const dynU = Math.sin(timeSec * data.moveSpeed + data.z) * data.moveRange;
          const pt = getPipePoint(dynU, 0);
          group.position.set(pt.x, pt.y, -data.z);
          group.rotation.z = pt.roll;
        }
      });

      const activeState = gameStateRef.current;

      if (activeState === 'title') {
        const demoZ = (timeSec * 16) % STAGE_LENGTH;
        const demoU = Math.sin(timeSec * 0.6) * 0.4;
        const p = getPipePoint(demoU, 0.2);
        playerGroup.position.set(p.x, p.y, -demoZ);
        playerGroup.rotation.z = p.roll;
        shadowRing.position.set(p.x, p.y + 0.05, -demoZ);
        shadowRing.rotation.z = p.roll;

        camera.position.set(p.x * 0.6, p.y + 5.5, -demoZ + 13.5);
        camera.lookAt(p.x * 0.25, p.y + 1.2, -demoZ - 30);
        renderer.render(scene, camera);
        return;
      }

      if (activeState === 'briefing') {
        const stageZ = startStageIndex * STAGE_LENGTH + 8;
        const p = getPipePoint(0, 0);
        playerGroup.position.set(p.x, p.y, -stageZ);
        playerGroup.rotation.z = p.roll;
        shadowRing.position.set(p.x, p.y + 0.05, -stageZ);
        shadowRing.rotation.z = p.roll;

        camera.position.set(p.x * 0.55, p.y + 5.8, -stageZ + 14.2);
        const lookAhead = getPipePoint(0, 0.9);
        camera.lookAt(lookAhead.x, lookAhead.y, -stageZ - 32);

        renderer.render(scene, camera);
        return;
      }

      if (activeState === 'paused' || activeState === 'victory') {
        renderer.render(scene, camera);
        return;
      }

      if (activeState === 'dead') {
        if (isFallingIntoAbyss) {
          fallDepth += 24 * dt;
          const p = getPipePoint(playerU, -fallDepth);
          playerGroup.position.set(p.x, p.y, -playerZ);
          playerGroup.rotation.x += 3.5 * dt;
          playerGroup.rotation.z += 2.5 * dt;
        }
        renderer.render(scene, camera);
        return;
      }

      // --- PLAYING STATE ---
      elapsedRunSec += dt;

      const stageIndex = Math.min(2, Math.floor(playerZ / STAGE_LENGTH));
      const localZ = playerZ - stageIndex * STAGE_LENGTH;

      if (stageIndex !== lastNotifiedStage) {
        lastNotifiedStage = stageIndex;
        stageElapsedTimer = 0;
        sound.playQuestionPrompt();
      }

      stageElapsedTimer += dt;
      const isGimmickActive = stageElapsedTimer >= 5.0;
      const safeZoneRemaining = Math.max(0, 5.0 - stageElapsedTimer);

      const tInputs = touchInputsRef.current;
      const moveLeft = keys.left || tInputs.left;
      const moveRight = keys.right || tInputs.right;
      const brakeHeld = keys.brake || tInputs.brake;
      const boostHeld = (keys.boost || tInputs.boost) && !brakeHeld;
      const jumpPressed = keys.jump || tInputs.jump;

      // 1. Forward Speed Control
      let targetSpeed = BASE_SPEED;
      if (brakeHeld) {
        targetSpeed = 0;
      } else if (boostHeld) {
        targetSpeed = BOOST_SPEED;
      }

      const accel = brakeHeld ? 14.0 : 6.0;
      currentSpeed += (targetSpeed - currentSpeed) * Math.min(1, accel * dt);
      if (currentSpeed < 0.3 && brakeHeld) currentSpeed = 0;

      const displayKmh = Math.round(currentSpeed * 3.6);
      if (displayKmh > maxSpeedRecorded) maxSpeedRecorded = displayKmh;

      // 2. Transverse Steering (A = Left, D = Right)
      const steerInput = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
      const steerAccel = 3.6;
      const steerDamping = 8.0;

      playerVelU += steerInput * steerAccel * dt;
      if (steerInput === 0) {
        playerVelU -= playerVelU * Math.min(1, steerDamping * dt);
      }
      playerVelU = Math.max(-1.5, Math.min(1.5, playerVelU));
      playerU += playerVelU * dt;

      // Check Split Zone lane locking
      const inSplitZone = localZ >= SPLIT_GATE_Z && localZ <= SPLIT_MERGE_Z;
      if (inSplitZone) {
        if (lockedLane === null) {
          lockedLane = playerU < -0.32 ? 0 : playerU > 0.32 ? 2 : 1;
        }
        const bounds: [number, number][] = [
          [-0.95, -0.38],
          [-0.26, 0.26],
          [0.38, 0.95],
        ];
        const [minU, maxU] = bounds[lockedLane];
        playerU = Math.max(minU, Math.min(maxU, playerU));
      } else {
        lockedLane = null;
        playerU = Math.max(-0.95, Math.min(0.95, playerU));
      }

      // 3. Jump Physics (Space key)
      if (jumpPressed && jumpY <= 0.08) {
        jumpY = 0.09;
        jumpVelY = JUMP_FORCE;
        sound.playJump();
      }

      if (jumpY > 0 || jumpVelY > 0) {
        jumpY += jumpVelY * dt;
        jumpVelY -= GRAVITY * dt;
        if (jumpY <= 0) {
          jumpY = 0;
          jumpVelY = 0;
        }
      }

      // 4. ADVANCE PLAYER Z & OBSTACLE WALL COLLISION (障害物は当たり判定のある壁！5秒後から出現・稼働)
      let nextZ = playerZ + currentSpeed * dt;
      isHittingWall = false;

      // Check collision against all obstacles in current stage (only active after 5 seconds!)
      if (isGimmickActive) {
        for (const { data: obs } of obstacleMeshes) {
          if (obs.stageIndex !== stageIndex) continue;

          const currentObsU =
            obs.kind === 'moving' && obs.moveSpeed && obs.moveRange
              ? Math.sin(timeSec * obs.moveSpeed + obs.z) * obs.moveRange
              : obs.uCenter;

          const halfDepth = obs.zDepth * 0.5 + 1.2;
          const halfWidth = obs.uWidth * 0.5 + 0.06;

          // Is player attempting to move through the wall?
          if (nextZ >= obs.z - halfDepth && playerZ <= obs.z + halfDepth) {
            // Check lateral overlap
            if (Math.abs(playerU - currentObsU) < halfWidth) {
              // Check height (can jump over low barrier)
              if (jumpY < obs.height - 0.15) {
                // SOLID WALL COLLISION: Stop player forward movement!
                isHittingWall = true;
                nextZ = Math.min(nextZ, obs.z - halfDepth);
                currentSpeed = 0;

                if (now - lastBumpTime > 350) {
                  lastBumpTime = now;
                  sound.playWallBump();
                }
              }
            }
          }
        }
      }

      playerZ = nextZ;

      // 5. CHECK PITFALL COLLISIONS (落とし穴: 5秒後から稼働、落ちたら死ぬ)
      if (isGimmickActive && jumpY <= 0.18) {
        for (const pit of pitfalls) {
          if (pit.stageIndex !== stageIndex) continue;
          if (
            playerZ >= pit.zStart + 1.0 &&
            playerZ <= pit.zEnd - 1.0 &&
            playerU >= pit.uMin + 0.04 &&
            playerU <= pit.uMax - 0.04
          ) {
            isFallingIntoAbyss = true;
            sound.playDeath();
            callbacksRef.current.onDeath(
              'pitfall',
              `${pit.label}に落下した！SPACEキーでジャンプするか、A/Dキーで安全な床へ回避しよう。`,
              stageIndex
            );
            return;
          }
        }
      }

      // 6. CHECK QUIZ ANSWER JUDGEMENT (正解なら次の問題へ、間違えたら死ぬ)
      if (localZ >= SPLIT_JUDGE_Z && localZ <= SPLIT_MERGE_Z - 8) {
        const activeLane = lockedLane ?? (playerU < -0.32 ? 0 : playerU > 0.32 ? 2 : 1);
        const question = course.questions[stageIndex];

        if (activeLane !== question.correctIndex) {
          // Wrong answer path -> abyss collapse & death!
          isFallingIntoAbyss = true;
          sound.playDeath();
          callbacksRef.current.onDeath(
            'wrong_answer',
            `「${question.choices[activeLane]}」は不正解！ルートが崩壊し、奈落へ落下した…`,
            stageIndex,
            activeLane
          );
          return;
        } else if (!clearedStages.has(stageIndex)) {
          // Correct answer -> LOGIC BREAK!! Seamless transition to next question
          clearedStages.add(stageIndex);
          sound.playCorrectBreak();
          callbacksRef.current.onLogicBreak(stageIndex, activeLane);
        }
      }

      // 7. Check Final Victory (All 3 questions completed)
      if (playerZ >= totalLength - 10) {
        sound.playVictory();
        callbacksRef.current.onVictory(elapsedRunSec, maxSpeedRecorded);
        return;
      }

      // 8. Visual Updates
      const surfacePt = getPipePoint(playerU, 0);
      const playerPt = getPipePoint(playerU, jumpY);

      playerGroup.position.set(playerPt.x, playerPt.y, -playerZ);
      playerGroup.rotation.z = playerPt.roll - playerVelU * 0.2;

      // Thruster scale
      const thrusterScale = brakeHeld ? 0.2 : boostHeld ? 2.0 : 1.0;
      leftThruster.scale.set(1, 1, thrusterScale);
      rightThruster.scale.set(1, 1, thrusterScale);
      thrusterMat.color.set(isHittingWall ? '#EF4444' : brakeHeld ? '#F43F5E' : boostHeld ? '#F59E0B' : '#22D3EE');

      // Shadow ring on track floor
      const cellBelow = isCellMissing(playerZ, playerU);
      shadowRing.visible = !cellBelow.missing;
      shadowRing.position.set(surfacePt.x, surfacePt.y + 0.05, -playerZ);
      shadowRing.rotation.z = surfacePt.roll;

      // 9. HIGH VISIBILITY CHASE CAMERA
      // Elevated camera looking clearly down the track so road ahead is NEVER blocked!
      const targetCamX = surfacePt.x * 0.55;
      const targetCamY = surfacePt.y + 7.2 + jumpY * 0.35;
      const targetCamZ = -playerZ + 15.5;

      camera.position.x += (targetCamX - camera.position.x) * Math.min(1, 10 * dt);
      camera.position.y += (targetCamY - camera.position.y) * Math.min(1, 10 * dt);
      camera.position.z = targetCamZ;

      // Look slightly ahead and down onto the road
      const lookAhead = getPipePoint(playerU * 0.2, 0.3);
      camera.lookAt(lookAhead.x, lookAhead.y, -playerZ - 36);

      // 10. Telemetry Output (~20Hz)
      telemetryTick++;
      if (telemetryTick % 3 === 0) {
        const currentLane: 0 | 1 | 2 =
          lockedLane ?? (playerU < -0.32 ? 0 : playerU > 0.32 ? 2 : 1);

        let upcomingHazard: string | null = null;
        for (const pit of pitfalls) {
          if (pit.stageIndex === stageIndex && pit.zStart > playerZ && pit.zStart - playerZ < 55) {
            upcomingHazard = `${pit.label}接近！ [SPACE]ジャンプ または [A/D]回避`;
            break;
          }
        }
        if (!upcomingHazard) {
          for (const obs of obstacles) {
            if (obs.stageIndex === stageIndex && obs.z > playerZ && obs.z - playerZ < 45) {
              upcomingHazard = '前方障害物壁！ 回避またはジャンプ';
              break;
            }
          }
        }

        callbacksRef.current.onTelemetry({
          z: playerZ,
          stageIndex,
          localZ,
          speedKmh: displayKmh,
          u: playerU,
          currentLane,
          isBraking: brakeHeld,
          isBoosting: boostHeld,
          isJumping: jumpY > 0.08,
          isHittingWall,
          approachingSplit: localZ >= SPLIT_APPROACH_Z - 60 && localZ < SPLIT_JUDGE_Z,
          inSplitLock: inSplitZone,
          upcomingHazard,
          safeZoneRemaining,
        });
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      texturesToDispose.forEach((t) => t.dispose());
      trackGeo.dispose();
      trackMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, [course, startStageIndex, runId]);

  if (webglLost) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-200 p-8 text-center">
        <div className="max-w-md space-y-3 border border-white/10 bg-slate-900/80 p-6 rounded-xl">
          <p className="text-lg font-bold text-cyan-400">3D WebGL レンダラーを再開します</p>
          <button
            onClick={() => setWebglLost(false)}
            className="px-4 py-2 bg-cyan-500 text-slate-950 font-semibold text-sm rounded-lg hover:bg-cyan-400 transition-colors"
          >
            3D画面を再開
          </button>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full relative overflow-hidden" />;
};
