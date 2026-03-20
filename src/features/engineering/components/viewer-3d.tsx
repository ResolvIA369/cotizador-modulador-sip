"use client";

import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, PerspectiveCamera, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Camera, Check } from 'lucide-react';

type FacadeMaterialType = 'osb' | 'chapa_negra' | 'galvanizada' | 'cementicia';

const FACADE_MATERIALS: Record<FacadeMaterialType, { color: string; metalness?: number; roughness?: number; label: string }> = {
    osb: { color: '#e2b17a', label: 'OSB' },
    chapa_negra: { color: '#1a1a1a', label: 'Chapa Negra' },
    galvanizada: { color: '#a8b0b8', metalness: 0.8, roughness: 0.3, label: 'Galvanizada' },
    cementicia: { color: '#9ca3af', roughness: 0.9, label: 'Cementicia' },
};
import { useStore } from '@/shared/store/useStore';

const OSB_COLOR = '#e2b17a';
const INT_WALL_COLOR = '#f3e5ab'; // Light wood / machimbre color
const BEAM_COLOR = '#8b5a2b';
const ROOF_PLATE_COLOR = '#334155';

const getWallHeight = (x: number, wallLen: number, config: any): number => {
    if (!config) return 2.44; // Default height
    const type = config.type || 'recto';
    const hBase = Number(config.hBase) || 2.44;
    const hMax = Number(config.hMax) || 2.44;

    if (type === 'recto') return hBase;
    if (type === 'inclinado') return hBase + (hMax - hBase) * (x / (wallLen || 1));
    if (type === '2-aguas') {
        const mid = (wallLen || 1) / 2;
        if (x <= mid) return hBase + (hMax - hBase) * (x / mid);
        return hMax - (hMax - hBase) * ((x - mid) / mid);
    }
    return hBase;
};

interface Opening3DProps {
    opening: any;
    dimensions: any;
    project: any;
}

const Opening3D = ({ opening, dimensions, project }: Opening3DProps) => {
    const W = Number(dimensions.width) || 0;
    const L = Number(dimensions.length) || 0;
    const x = Number(opening.x) || 0;
    const y = Number(opening.y) || 0;
    const w = Number(opening.width) || 0;
    const h = Number(opening.height) || 0;
    const { side, type, recessId, recessWall } = opening;
    const recesses = project?.recesses || [];
    let pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0];
    const offset = 0.01;

    // Find if this opening falls within any recess/irregular shape on this side
    const centerX = x + w / 2;
    // Hide opening if facade is hidden
    if (project?.perimeterVisibility?.[side] === false) return null;

    const r = (recesses || []).find((rc: any) => rc.id === recessId) ||
        (recesses || []).find((rc: any) => rc.side === side && centerX >= (rc.x - 0.1) && centerX <= (rc.x + rc.width + 0.1));

    // ONLY move to back wall if r exists AND hideBase is true (wall is actually gone)
    if (!r || (r && !r.hideBase)) {
        // Position on the standard perimeter wall
        if (side === 'Norte') pos = [x + w / 2, y + h / 2, -offset];
        else if (side === 'Sur') { pos = [W - (x + w / 2), y + h / 2, L + offset]; rot = [0, Math.PI, 0]; }
        else if (side === 'Este') { pos = [W + offset, y + h / 2, x + w / 2]; rot = [0, -Math.PI / 2, 0]; }
        else if (side === 'Oeste') { pos = [-offset, y + h / 2, L - (x + w / 2)]; rot = [0, Math.PI / 2, 0]; }

        const frameThickness = 0.06;
        return (
            <group position={pos} rotation={rot}>
                {/* Frame border */}
                <mesh castShadow>
                    <boxGeometry args={[w + frameThickness * 2, h + frameThickness * 2, 0.15]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                {/* Inner fill */}
                <mesh position={[0, 0, 0.005]} castShadow>
                    <boxGeometry args={[w, h, 0.14]} />
                    <meshStandardMaterial
                        color={type === 'window' ? '#bae6fd' : '#334155'}
                        transparent
                        opacity={type === 'window' ? 0.5 : 1}
                        metalness={type === 'window' ? 0.1 : 0}
                        roughness={type === 'window' ? 0.1 : 0.8}
                    />
                </mesh>
                {type === 'window' && (
                    <>
                        {/* Horizontal mullion */}
                        <mesh position={[0, 0, 0.02]}>
                            <boxGeometry args={[w, 0.03, 0.04]} />
                            <meshStandardMaterial color="#1e293b" />
                        </mesh>
                        {/* Vertical mullion */}
                        <mesh position={[0, 0, 0.02]}>
                            <boxGeometry args={[0.03, h, 0.04]} />
                            <meshStandardMaterial color="#1e293b" />
                        </mesh>
                    </>
                )}
            </group>
        );
    }

    // Automatic mapping to recess if within bounds
    const targetWall = recessWall || 'back';

    if (targetWall === 'back') {
        const rd = Number(r.depth);
        if (side === 'Norte') { pos = [x + w / 2, y + h / 2, rd - offset]; rot = [0, 0, 0]; }
        else if (side === 'Sur') { pos = [W - (x + w / 2), y + h / 2, L - rd + offset]; rot = [0, Math.PI, 0]; }
        else if (side === 'Este') { pos = [W - rd + offset, y + h / 2, x + w / 2]; rot = [0, -Math.PI / 2, 0]; }
        else if (side === 'Oeste') { pos = [rd - offset, y + h / 2, L - (x + w / 2)]; rot = [0, Math.PI / 2, 0]; }
    } else if (targetWall === 'left') {
        const rx = Number(r.x);
        const rd = Number(r.depth);
        const rw = Number(r.width);
        if (side === 'Norte') { pos = [rx - offset, y + h / 2, x + w / 2]; rot = [0, -Math.PI / 2, 0]; }
        else if (side === 'Sur') { pos = [W - (rx + rw) + offset, y + h / 2, L - x - w / 2]; rot = [0, Math.PI / 2, 0]; }
        else if (side === 'Este') { pos = [W - rd / 2, y + h / 2, rx - offset]; rot = [0, Math.PI, 0]; }
        else if (side === 'Oeste') { pos = [rd / 2, y + h / 2, L - rx + offset]; rot = [0, 0, 0]; }
    } else if (targetWall === 'right') {
        const rx = Number(r.x);
        const rd = Number(r.depth);
        const rw = Number(r.width);
        if (side === 'Norte') { pos = [rx + rw + offset, y + h / 2, x + w / 2]; rot = [0, Math.PI / 2, 0]; }
        else if (side === 'Sur') { pos = [W - rx - offset, y + h / 2, L - x - w / 2]; rot = [0, -Math.PI / 2, 0]; }
        else if (side === 'Este') { pos = [W - rd / 2, y + h / 2, rx + rw + offset]; rot = [0, 0, 0]; }
        else if (side === 'Oeste') { pos = [rd / 2, y + h / 2, L - (rx + rw) - offset]; rot = [0, Math.PI, 0]; }
    }

    const frameThickness = 0.06;
    return (
        <group position={pos} rotation={rot}>
            {/* Frame border */}
            <mesh castShadow>
                <boxGeometry args={[w + frameThickness * 2, h + frameThickness * 2, 0.15]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>
            {/* Inner fill */}
            <mesh position={[0, 0, 0.005]} castShadow>
                <boxGeometry args={[w, h, 0.14]} />
                <meshStandardMaterial
                    color={type === 'window' ? '#bae6fd' : '#334155'}
                    transparent
                    opacity={type === 'window' ? 0.5 : 1}
                    metalness={type === 'window' ? 0.1 : 0}
                    roughness={type === 'window' ? 0.1 : 0.8}
                />
            </mesh>
            {type === 'window' && (
                <>
                    <mesh position={[0, 0, 0.02]}>
                        <boxGeometry args={[w, 0.03, 0.04]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[0, 0, 0.02]}>
                        <boxGeometry args={[0.03, h, 0.04]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                </>
            )}
        </group>
    );
};

interface GenericBeamProps {
    l: number;
    w: number;
    h: number;
    pos: [number, number, number];
    rot: [number, number, number];
    color?: string;
}

const GenericBeam = ({ l, w, h, pos, rot, color = BEAM_COLOR }: GenericBeamProps) => (
    <mesh position={pos} rotation={rot} castShadow receiveShadow>
        <boxGeometry args={[l, h, w]} />
        <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
);

interface WallSegmentProps {
    xStart: number;
    xEnd: number;
    h1: number;
    h2: number;
    material: THREE.MeshStandardMaterial;
    position: [number, number, number];
    rotation: [number, number, number];
}

const WallSegment = ({ xStart, xEnd, h1, h2, material, position, rotation }: WallSegmentProps) => {
    const w = Math.abs(xEnd - xStart);
    const thickness = 0.09;

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h2);
    shape.lineTo(-w / 2, h1);
    shape.lineTo(-w / 2, 0);

    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: false
    };

    return (
        <mesh position={position} rotation={rotation} material={material} castShadow receiveShadow>
            <extrudeGeometry args={[shape, extrudeSettings]} />
        </mesh>
    );
};

interface HouseModelProps {
    dimensions: any;
    openings: any[];
    facadeConfigs: any;
    interiorWalls: any[];
    showBeams: boolean;
    showRoofPlates: boolean;
    project: any;
    beamOffset?: number;
    facadeMaterial?: FacadeMaterialType;
}

const HouseModel = ({ dimensions, openings, facadeConfigs, interiorWalls, showBeams, showRoofPlates, project, beamOffset = 0, facadeMaterial = 'osb' }: HouseModelProps) => {
    // CRITICAL SAFETY GUARD
    if (!facadeConfigs || !dimensions) return null;

    const width = Number(dimensions.width) || 1;
    const length = Number(dimensions.length) || 1;
    const recesses = project?.recesses || [];
    const facadeMatConfig = FACADE_MATERIALS[facadeMaterial] || FACADE_MATERIALS.osb;
    const mat = new THREE.MeshStandardMaterial({
        color: facadeMatConfig.color,
        side: THREE.DoubleSide,
        ...(facadeMatConfig.metalness !== undefined && { metalness: facadeMatConfig.metalness }),
        ...(facadeMatConfig.roughness !== undefined && { roughness: facadeMatConfig.roughness }),
    });
    const intMat = new THREE.MeshStandardMaterial({ color: INT_WALL_COLOR, side: THREE.DoubleSide });

    const minBaseH = Math.min(...Object.values(facadeConfigs).map((c: any) => Number(c.hBase) || 2.44));
    const fixedIntH = Math.min(2.44, minBaseH);

    const is2AguasNS = facadeConfigs?.Norte?.type === '2-aguas' || facadeConfigs?.Sur?.type === '2-aguas';
    const is2AguasEW = facadeConfigs?.Este?.type === '2-aguas' || facadeConfigs?.Oeste?.type === '2-aguas';
    const is2Aguas = is2AguasNS || is2AguasEW;

    // Helper to get interpolated height at any x, z on the house plan using facadeConfigs
    const getPointHeight = (px: number, pz: number): number => {
        // Correct height mapping to match UI (h1=Left, h2=Right)
        const hN = getWallHeight(px, width, facadeConfigs?.Norte);
        const hS = getWallHeight(width - px, width, facadeConfigs?.Sur);
        const hW = getWallHeight(length - pz, length, facadeConfigs?.Oeste);
        const hE = getWallHeight(pz, length, facadeConfigs?.Este);

        const tz = Math.max(0, Math.min(1, pz / (length || 1)));
        const tx = Math.max(0, Math.min(1, px / (width || 1)));

        // Interpolation between facades
        // Check if any facade is hidden to potentially exclude its height contribution
        const isN = project?.perimeterVisibility?.Norte !== false;
        const isS = project?.perimeterVisibility?.Sur !== false;
        const isW = project?.perimeterVisibility?.Oeste !== false;
        const isE = project?.perimeterVisibility?.Este !== false;

        let profileNS = 0;
        if (isN && isS) profileNS = hN * (1 - tz) + hS * tz;
        else if (isN) profileNS = hN;
        else if (isS) profileNS = hS;
        else profileNS = Math.max(hN, hS);

        let profileEW = 0;
        if (isW && isE) profileEW = hW * (1 - tx) + hE * tx;
        else if (isW) profileEW = hW;
        else if (isE) profileEW = hE;
        else profileEW = Math.max(hW, hE);

        // The roof/wall height at this point is the highest dictated by any facade
        return Math.max(profileNS, profileEW, 2.44);
    };

    const floorShape = useMemo(() => {
        const s = new THREE.Shape(); s.moveTo(0, 0);
        const nr = recesses.filter((r: any) => r.side === 'Norte').sort((a: any, b: any) => a.x - b.x);
        nr.forEach((r: any) => { s.lineTo(r.x, 0); s.lineTo(r.x, r.depth); s.lineTo(r.x + r.width, r.depth); s.lineTo(r.x + r.width, 0); });
        s.lineTo(width, 0);
        const er = recesses.filter((r: any) => r.side === 'Este').sort((a: any, b: any) => a.x - b.x);
        er.forEach((r: any) => { s.lineTo(width, r.x); s.lineTo(width - r.depth, r.x); s.lineTo(width - r.depth, r.x + r.width); s.lineTo(width, r.x + r.width); });
        s.lineTo(width, length);
        const sr = recesses.filter((r: any) => r.side === 'Sur').sort((a: any, b: any) => a.x - b.x);
        sr.forEach((r: any) => { s.lineTo(width - r.x, length); s.lineTo(width - r.x, length - r.depth); s.lineTo(width - (r.x + r.width), length - r.depth); s.lineTo(width - (r.x + r.width), length); });
        s.lineTo(0, length);
        const or = recesses.filter((r: any) => r.side === 'Oeste').sort((a: any, b: any) => a.x - b.x);
        or.forEach((r: any) => { s.lineTo(0, length - r.x); s.lineTo(r.depth, length - r.x); s.lineTo(r.depth, length - (r.x + r.width)); s.lineTo(0, length - (r.x + r.width)); });
        s.lineTo(0, 0); return s;
    }, [width, length, recesses]);

    const roofConfig = facadeConfigs?.Norte || facadeConfigs?.Sur || {};
    const hBase = Number(roofConfig.hBase) || 2.44;
    const hMax = Number(roofConfig.hMax) || 2.44;
    const roofType = roofConfig.type || 'recto';
    const angle = Math.atan2(hMax - hBase, roofType === '2-aguas' ? width / 2 : width);

    return (
        <group position={[-width / 2, 0, -length / 2]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.05, length / 2]} receiveShadow>
                <planeGeometry args={[100, 100]} /><meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                <shapeGeometry args={[floorShape]} /><meshStandardMaterial color="#ffffff" />
            </mesh>

            {Object.entries(facadeConfigs).map(([side, conf]: [string, any]) => {
                const isNS = side === 'Norte' || side === 'Sur';
                const wallLen = isNS ? width : length;
                const rList = recesses.filter((r: any) => r.side === side).sort((a: any, b: any) => a.x - b.x);
                const mid = wallLen / 2;

                // Build segment boundaries with hideSideWall support (L-Shape clipping)
                let segments: Array<{ xStart: number; xEnd: number }> = [{ xStart: 0, xEnd: wallLen }];

                // 1. Apply hideSideWall clipping from adjacent recesses (L-Shape Logic)
                recesses.filter((r: any) => r.hideSideWall).forEach((r: any) => {
                    const isAtStart = r.x < 0.1;
                    const isAtEnd = r.x + r.width > (r.side === 'Norte' || r.side === 'Sur' ? width : length) - 0.1;

                    // North Start (Oeste corner) clips Oeste End (near North)
                    if (r.side === 'Norte' && isAtStart && side === 'Oeste') {
                        segments = segments.map(s => s.xEnd > length - r.depth ? (s.xStart >= length - r.depth ? null : { ...s, xEnd: length - r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // North End (Este corner) clips Este Start (near North)
                    if (r.side === 'Norte' && isAtEnd && side === 'Este') {
                        segments = segments.map(s => s.xStart < r.depth ? (s.xEnd <= r.depth ? null : { ...s, xStart: r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // South Start (Este corner) clips Este End (near South)
                    if (r.side === 'Sur' && isAtStart && side === 'Este') {
                        segments = segments.map(s => s.xEnd > length - r.depth ? (s.xStart >= length - r.depth ? null : { ...s, xEnd: length - r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // South End (Oeste corner) clips Oeste Start (near South)
                    if (r.side === 'Sur' && isAtEnd && side === 'Oeste') {
                        segments = segments.map(s => s.xStart < r.depth ? (s.xEnd <= r.depth ? null : { ...s, xStart: r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // West Start (Sur corner) clips South End (near West)
                    if (r.side === 'Oeste' && isAtStart && side === 'Sur') {
                        segments = segments.map(s => s.xEnd > width - r.depth ? (s.xStart >= width - r.depth ? null : { ...s, xEnd: width - r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // West End (North corner) clips North Start (near West)
                    if (r.side === 'Oeste' && isAtEnd && side === 'Norte') {
                        segments = segments.map(s => s.xStart < r.depth ? (s.xEnd <= r.depth ? null : { ...s, xStart: r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // East Start (North corner) clips North End (near East)
                    if (r.side === 'Este' && isAtStart && side === 'Norte') {
                        segments = segments.map(s => s.xEnd > width - r.depth ? (s.xStart >= width - r.depth ? null : { ...s, xEnd: width - r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                    // East End (South corner) clips South Start (near East)
                    if (r.side === 'Este' && isAtEnd && side === 'Sur') {
                        segments = segments.map(s => s.xStart < r.depth ? (s.xEnd <= r.depth ? null : { ...s, xStart: r.depth }) : s).filter(Boolean) as Array<{ xStart: number; xEnd: number }>;
                    }
                });

                // 2. Identify segments affected by the actual recesses on this side
                let finalSegments: Array<{ type: string; xStart: number; xEnd: number; recess?: any }> = [];
                segments.forEach(seg => {
                    let currentX = seg.xStart;
                    const rOnSide = rList.filter((ridx: any) => ridx.x < seg.xEnd && ridx.x + ridx.width > seg.xStart);

                    rOnSide.forEach((r: any) => {
                        const rStart = Math.max(seg.xStart, r.x);
                        const rEnd = Math.min(seg.xEnd, r.x + r.width);

                        if (rStart > currentX) {
                            finalSegments.push({ type: 'main', xStart: currentX, xEnd: rStart });
                        }

                        // If hideBase is false, the main wall remains
                        if (!r.hideBase) {
                            finalSegments.push({ type: 'main', xStart: rStart, xEnd: rEnd });
                        }

                        finalSegments.push({ type: 'hall', recess: r, xStart: rStart, xEnd: rEnd });
                        currentX = rEnd;
                    });
                    if (currentX < seg.xEnd) {
                        finalSegments.push({ type: 'main', xStart: currentX, xEnd: seg.xEnd });
                    }
                });

                return (
                    <group key={side} visible={project?.perimeterVisibility?.[side] !== false}>
                        {finalSegments.map((seg, i) => {
                            if (seg.type === 'main') {
                                // Split at peak for 2-aguas roofs
                                let subSegs = [seg];
                                if (conf.type === '2-aguas' && seg.xStart < mid && seg.xEnd > mid) {
                                    subSegs = [
                                        { ...seg, xStart: seg.xStart, xEnd: mid },
                                        { ...seg, xStart: mid, xEnd: seg.xEnd }
                                    ];
                                }

                                return subSegs.map((s, j) => {
                                    let h1_top: number, h2_top: number;
                                    if (side === 'Norte') {
                                        h1_top = getPointHeight(s.xStart, 0);
                                        h2_top = getPointHeight(s.xEnd, 0);
                                    } else if (side === 'Sur') {
                                        h1_top = getPointHeight(width - s.xStart, length);
                                        h2_top = getPointHeight(width - s.xEnd, length);
                                    } else if (side === 'Oeste') {
                                        h1_top = getPointHeight(0, length - s.xStart);
                                        h2_top = getPointHeight(0, length - s.xEnd);
                                    } else { // Este
                                        h1_top = getPointHeight(width, s.xStart);
                                        h2_top = getPointHeight(width, s.xEnd);
                                    }

                                    const hWallBaseConfig = Number(conf.hBase) || 2.44;
                                    const effectiveHBase = Math.min(h1_top, h2_top, hWallBaseConfig);

                                    const sLen = Math.abs(s.xEnd - s.xStart);
                                    let p: [number, number, number] = [0, 0, 0];
                                    let rot: [number, number, number] = [0, 0, 0];

                                    if (side === 'Norte') { p = [s.xStart + sLen / 2, 0, 0]; rot = [0, 0, 0]; }
                                    else if (side === 'Sur') { p = [width - (s.xStart + sLen / 2), 0, length]; rot = [0, Math.PI, 0]; }
                                    else if (side === 'Oeste') { p = [0, 0, length - (s.xStart + sLen / 2)]; rot = [0, Math.PI / 2, 0]; }
                                    else if (side === 'Este') { p = [width, 0, s.xStart + sLen / 2]; rot = [0, -Math.PI / 2, 0]; }

                                    return (
                                        <group key={`group-main-${i}-${j}`}>
                                            {/* Rectangular SIP Wall (Base) */}
                                            <WallSegment xStart={0} xEnd={sLen} h1={effectiveHBase} h2={effectiveHBase} material={mat} position={p} rotation={rot} />
                                            {/* Gable End / Cutout - follows the roof profile exactly */}
                                            {(h1_top > effectiveHBase || h2_top > effectiveHBase) && (
                                                <WallSegment xStart={0} xEnd={sLen} h1={h1_top - effectiveHBase} h2={h2_top - effectiveHBase}
                                                    material={mat} position={[p[0], effectiveHBase, p[2]]} rotation={rot} />
                                            )}
                                        </group>
                                    );
                                });
                            } else if (seg.type === 'hall') {
                                const r = seg.recess;
                                let pB: [number, number, number] = [0, 0, 0], rB: [number, number, number] = [0, 0, 0], pL: [number, number, number] = [0, 0, 0], rL: [number, number, number] = [0, 0, 0], pR: [number, number, number] = [0, 0, 0], rR: [number, number, number] = [0, 0, 0];
                                if (side === 'Norte') {
                                    pB = [r.x + r.width / 2, 0, r.depth]; rB = [0, 0, 0];
                                    pL = [r.x, 0, r.depth / 2]; rL = [0, Math.PI / 2, 0];
                                    pR = [r.x + r.width, 0, r.depth / 2]; rR = [0, -Math.PI / 2, 0];
                                } else if (side === 'Sur') {
                                    pB = [width - (r.x + r.width / 2), 0, length - r.depth]; rB = [0, Math.PI, 0];
                                    pL = [width - (r.x + r.width), 0, length - r.depth / 2]; rL = [0, -Math.PI / 2, 0];
                                    pR = [width - r.x, 0, length - r.depth / 2]; rR = [0, Math.PI / 2, 0];
                                } else if (side === 'Oeste') {
                                    pB = [r.depth, 0, length - (r.x + r.width / 2)]; rB = [0, Math.PI / 2, 0];
                                    pR = [r.depth / 2, 0, length - r.x]; rR = [0, 0, 0];
                                    pL = [r.depth / 2, 0, length - (r.x + r.width)]; rL = [0, Math.PI, 0];
                                } else if (side === 'Este') {
                                    pB = [width - r.depth, 0, r.x + r.width / 2]; rB = [0, -Math.PI / 2, 0];
                                    pR = [width - r.depth / 2, 0, r.x]; rR = [0, Math.PI, 0];
                                    pL = [width - r.depth / 2, 0, r.x + r.width]; rL = [0, 0, 0];
                                }

                                const isAtStart = r.x < 0.1;
                                const isAtEnd = r.x + r.width > wallLen - 0.1;

                                let hideL = false;
                                let hideR = false;

                                const hHall = Number(dimensions.height) || 2.44;

                                if (r.hideSideWall) {
                                    if (side === 'Norte') { if (isAtStart) hideL = true; if (isAtEnd) hideR = true; }
                                    else if (side === 'Sur') { if (isAtStart) hideR = true; if (isAtEnd) hideL = true; }
                                    else if (side === 'Este') { if (isAtStart) hideR = true; if (isAtEnd) hideL = true; }
                                    else if (side === 'Oeste') { if (isAtStart) hideR = true; if (isAtEnd) hideL = true; }
                                }

                                // Calculate heights for hall walls using global point projector
                                let hB1_top: number, hB2_top: number, hL1_top: number, hL2_top: number, hR1_top: number, hR2_top: number;
                                if (side === 'Norte') {
                                    hB1_top = getPointHeight(r.x, r.depth); hB2_top = getPointHeight(r.x + r.width, r.depth);
                                    hL1_top = getPointHeight(r.x, 0); hL2_top = getPointHeight(r.x, r.depth);
                                    hR1_top = getPointHeight(r.x + r.width, r.depth); hR2_top = getPointHeight(r.x + r.width, 0);
                                } else if (side === 'Sur') {
                                    hB1_top = getPointHeight(width - r.x, length - r.depth); hB2_top = getPointHeight(width - (r.x + r.width), length - r.depth);
                                    hL1_top = getPointHeight(width - (r.x + r.width), length); hL2_top = getPointHeight(width - (r.x + r.width), length - r.depth);
                                    hR1_top = getPointHeight(width - r.x, length - r.depth); hR2_top = getPointHeight(width - r.x, length);
                                } else if (side === 'Oeste') {
                                    hB1_top = getPointHeight(r.depth, length - r.x); hB2_top = getPointHeight(r.depth, length - (r.x + r.width));
                                    hL1_top = getPointHeight(r.depth, length - (r.x + r.width)); hL2_top = getPointHeight(0, length - (r.x + r.width));
                                    hR1_top = getPointHeight(0, length - r.x); hR2_top = getPointHeight(r.depth, length - r.x);
                                } else { // Este
                                    hB1_top = getPointHeight(width - r.depth, r.x); hB2_top = getPointHeight(width - r.depth, r.x + r.width);
                                    hL1_top = getPointHeight(width - r.depth, r.x + r.width); hL2_top = getPointHeight(width, r.x + r.width);
                                    hR1_top = getPointHeight(width, r.x); hR2_top = getPointHeight(width - r.depth, r.x);
                                }

                                const hWallBaseConfig = Number(facadeConfigs[side]?.hBase) || 2.44;

                                const renderSlopedWall = (xStart: number, xEnd: number, h1: number, h2: number, pos: [number, number, number], rot: [number, number, number]) => {
                                    const effBase = Math.min(h1, h2, hWallBaseConfig);
                                    return (
                                        <group>
                                            <WallSegment xStart={xStart} xEnd={xEnd} h1={effBase} h2={effBase} material={mat} position={pos} rotation={rot} />
                                            {(h1 > effBase || h2 > effBase) && (
                                                <WallSegment xStart={xStart} xEnd={xEnd} h1={h1 - effBase} h2={h2 - effBase} material={mat} position={[pos[0], effBase, pos[2]]} rotation={rot} />
                                            )}
                                        </group>
                                    );
                                };

                                return (
                                    <group key={`hall-${i}`}>
                                        {r.hideBase && renderSlopedWall(0, r.width, hB1_top, hB2_top, pB, rB)}
                                        {!hideL && renderSlopedWall(0, r.depth, hL1_top, hL2_top, pL, rL)}
                                        {!hideR && renderSlopedWall(0, r.depth, hR1_top, hR2_top, pR, rR)}
                                    </group>
                                );
                            }
                            return null;
                        })}
                    </group>
                );
            })}

            {interiorWalls && interiorWalls.map((w: any) => {
                const W = Number(width);
                const L = Number(length);
                const thick = 0.09;

                // Robust coordinate extraction matching FloorPlan logic
                const startX = w.x !== undefined ? w.x : (w.x1 !== undefined ? w.x1 : 0);
                const startZ = w.y !== undefined ? w.y : (w.y1 !== undefined ? w.y1 : 0);

                const innerXMin = 0.09;
                const innerXMax = W - 0.09;
                const innerZMin = 0.09;
                const innerZMax = L - 0.09;

                let sX = startX;
                let sZ = startZ;
                let eX: number, eZ: number;
                if (w.length !== undefined) {
                    const wallLenAttr = Number(w.length);
                    eX = w.isVertical ? startX : startX + wallLenAttr;
                    eZ = w.isVertical ? startZ + wallLenAttr : startZ;
                } else {
                    eX = w.x2 !== undefined ? w.x2 : startX;
                    eZ = w.y2 !== undefined ? w.y2 : startZ;
                }

                if (sX < innerXMin) sX = innerXMin;
                if (sX > innerXMax) sX = innerXMax;
                if (eX < innerXMin) eX = innerXMin;
                if (eX > innerXMax) eX = innerXMax;
                if (sZ < innerZMin) sZ = innerZMin;
                if (sZ > innerZMax) sZ = innerZMax;
                if (eZ < innerZMin) eZ = innerZMin;
                if (eZ > innerZMax) eZ = innerZMax;

                const lWall = Math.sqrt(Math.pow(eX - sX, 2) + Math.pow(eZ - sZ, 2));
                if (!lWall || isNaN(lWall) || lWall < 0.01) return null;

                // INTERIOR WALLS SYNC: Match roof profile exactly
                const hStart = getPointHeight(sX, sZ);
                const hEnd = getPointHeight(eX, eZ);

                // Keep them within a reasonable minimum if ridge is very low
                const h1 = Math.max(2.44, hStart);
                const h2 = Math.max(2.44, hEnd);

                let posI: [number, number, number] = [0, 0, 0], rotI: [number, number, number] = [0, 0, 0];
                const isVert = w.isVertical || Math.abs(eX - sX) < 0.01;

                if (isVert) {
                    posI = [sX, 0, sZ + lWall / 2];
                    rotI = [0, Math.PI / 2, 0];
                } else {
                    posI = [sX + lWall / 2, 0, sZ];
                    rotI = [0, 0, 0];
                }

                // Render interior wall with same slope support as exterior walls
                const effBase = 2.44; // Default interior wall panel height
                return (
                    <group key={w.id}>
                        <WallSegment xStart={0} xEnd={lWall} h1={Math.min(h1, effBase)} h2={Math.min(h2, effBase)} material={intMat} position={posI} rotation={rotI} />
                        {(h1 > effBase || h2 > effBase) && (
                            <WallSegment xStart={0} xEnd={lWall} h1={Math.max(0, h1 - effBase)} h2={Math.max(0, h2 - effBase)} material={intMat} position={[posI[0], effBase, posI[2]]} rotation={rotI} />
                        )}
                    </group>
                );
            })}

            {/* OVERHAULED ROOF AND BEAMS SYSTEM */}
            {(() => {
                // Ensure dimensional values are numbers to prevent string concatenation
                const W = Number(width);
                const L = Number(length);
                const offset = Number(beamOffset);
                const roofMeshes: React.ReactNode[] = [];
                const structuralBeams: React.ReactNode[] = [];

                const hasSlopeNS = is2AguasNS || (facadeConfigs?.Norte?.type === 'inclinado' || facadeConfigs?.Sur?.type === 'inclinado');
                const hasSlopeEW = is2AguasEW || (facadeConfigs?.Este?.type === 'inclinado' || facadeConfigs?.Oeste?.type === 'inclinado');

                // If East/West has the slope control, beams should run North-South and iterate along Width
                const axisEW = hasSlopeEW && !hasSlopeNS;

                const BEAM_H = 0.16;
                const BEAM_W = 0.08;

                const isInside = (ax: number, az: number): boolean => {
                    if (ax < -0.01 || ax > W + 0.01 || az < -0.01 || az > L + 0.01) return false;
                    for (const r of recesses) {
                        if (!r.hideBase) continue;
                        let insideR = false;
                        const rw = r.width;
                        const rd = r.depth;
                        if (r.side === 'Norte') insideR = (ax >= r.x - 0.1 && ax <= r.x + rw + 0.1 && az >= -0.1 && az <= rd + 0.1);
                        else if (r.side === 'Sur') insideR = (ax >= W - (r.x + rw) - 0.1 && ax <= W - r.x + 0.1 && az >= L - rd - 0.1 && az <= L + 0.1);
                        else if (r.side === 'Este') insideR = (ax >= W - rd - 0.1 && ax <= W + 0.1 && az >= r.x - 0.1 && az <= r.x + rw + 0.1);
                        else if (r.side === 'Oeste') insideR = (ax >= -0.1 && ax <= rd + 0.1 && az >= L - (r.x + rw) - 0.1 && az <= L - r.x + 0.1);
                        if (insideR) return false;
                    }
                    return true;
                };

                if (showRoofPlates) {
                    // ROBUST GRID-BASED ROOF that follows any irregular shape
                    const resolution = 0.1; // 10cm precision
                    const rows = Math.ceil(L / resolution);
                    const cols = Math.ceil(W / resolution);

                    // Compute inner corners of recesses for roof hip effect
                    const innerCorners: Array<{ cx: number; cz: number; fade: number }> = [];
                    for (const r of recesses) {
                        if (!r.hideBase) continue;
                        const rd = Number(r.depth), rw = Number(r.width), rx = Number(r.x);
                        const isAtStart = rx < 0.1;
                        const isAtEnd = rx + rw > (r.side === 'Norte' || r.side === 'Sur' ? W : L) - 0.1;
                        const fade = Math.min(rd, rw) * 0.6;

                        if (r.side === 'Este') {
                            const bx = W - rd;
                            if (!isAtStart || !r.hideSideWall) innerCorners.push({ cx: bx, cz: rx, fade });
                            if (!isAtEnd || !r.hideSideWall) innerCorners.push({ cx: bx, cz: rx + rw, fade });
                        } else if (r.side === 'Oeste') {
                            const bx = rd;
                            if (!isAtStart || !r.hideSideWall) innerCorners.push({ cx: bx, cz: L - rx, fade });
                            if (!isAtEnd || !r.hideSideWall) innerCorners.push({ cx: bx, cz: L - (rx + rw), fade });
                        } else if (r.side === 'Norte') {
                            const bz = rd;
                            if (!isAtStart || !r.hideSideWall) innerCorners.push({ cx: rx, cz: bz, fade });
                            if (!isAtEnd || !r.hideSideWall) innerCorners.push({ cx: rx + rw, cz: bz, fade });
                        } else if (r.side === 'Sur') {
                            const bz = L - rd;
                            if (!isAtStart || !r.hideSideWall) innerCorners.push({ cx: W - (rx + rw), cz: bz, fade });
                            if (!isAtEnd || !r.hideSideWall) innerCorners.push({ cx: W - rx, cz: bz, fade });
                        }
                    }

                    const vertices: number[] = [];
                    const indices: number[] = [];

                    for (let j = 0; j <= rows; j++) {
                        for (let i = 0; i <= cols; i++) {
                            const gx = Math.min(W, i * resolution);
                            const gz = Math.min(L, j * resolution);
                            let h = getPointHeight(gx, gz);

                            if (!isInside(gx, gz)) {
                                h = minBaseH;
                            } else {
                                // Hip effect: slope roof down near inner corners of recesses
                                for (const corner of innerCorners) {
                                    const dx = gx - corner.cx;
                                    const dz = gz - corner.cz;
                                    const dist = Math.sqrt(dx * dx + dz * dz);
                                    if (dist < corner.fade) {
                                        const t = dist / corner.fade;
                                        h = Math.min(h, minBaseH + (h - minBaseH) * t);
                                    }
                                }
                            }

                            vertices.push(gx, h, gz);
                        }
                    }

                    for (let j = 0; j < rows; j++) {
                        for (let i = 0; i < cols; i++) {
                            const x0 = Math.min(W, i * resolution);
                            const x1 = Math.min(W, (i + 1) * resolution);
                            const z0 = Math.min(L, j * resolution);
                            const z1 = Math.min(L, (j + 1) * resolution);
                            if (isInside(x0, z0) && isInside(x1, z0) && isInside(x0, z1) && isInside(x1, z1)) {
                                const a = j * (cols + 1) + i;
                                const b = j * (cols + 1) + (i + 1);
                                const c = (j + 1) * (cols + 1) + i;
                                const d = (j + 1) * (cols + 1) + (i + 1);
                                indices.push(a, c, b);
                                indices.push(b, c, d);
                            }
                        }
                    }

                    const roofGeom = new THREE.BufferGeometry();
                    roofGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
                    roofGeom.setIndex(indices);
                    roofGeom.computeVertexNormals();

                    roofMeshes.push(
                        <mesh key="roof-clipped" geometry={roofGeom} position={[0, offset + BEAM_H, 0]} castShadow receiveShadow>
                            <meshStandardMaterial color={ROOF_PLATE_COLOR} side={THREE.DoubleSide} roughness={0.7} />
                        </mesh>
                    );
                }

                if (showBeams) {
                    const step = 1.22;

                    if (axisEW) {
                        // Beams run along Z (North-South), distributed along X (Width)
                        const countX = Math.ceil(W / step) + 1;
                        for (let i = 0; i < countX; i++) {
                            const x = Math.min(i * step, W);
                            if (isInside(x, L / 2)) {
                                if (is2Aguas) {
                                    const midL = L / 2;
                                    const hStart = getPointHeight(x, 0);
                                    const hMid = getPointHeight(x, midL);
                                    const hEnd = getPointHeight(x, L);

                                    const lenL = Math.sqrt(Math.pow(midL, 2) + Math.pow(hMid - hStart, 2));
                                    const angL = Math.atan2(hMid - hStart, midL);
                                    structuralBeams.push(
                                        <GenericBeam key={`beam-x-l-${i}`} l={lenL} w={BEAM_W} h={BEAM_H}
                                            pos={[x, (hStart + hMid) / 2 + offset + BEAM_H / 2, midL / 2]}
                                            rot={[angL, Math.PI / 2, 0]} />
                                    );
                                    const lenR = Math.sqrt(Math.pow(midL, 2) + Math.pow(hMid - hEnd, 2));
                                    const angR = Math.atan2(hMid - hEnd, midL);
                                    structuralBeams.push(
                                        <GenericBeam key={`beam-x-r-${i}`} l={lenR} w={BEAM_W} h={BEAM_H}
                                            pos={[x, (hEnd + hMid) / 2 + offset + BEAM_H / 2, midL + midL / 2]}
                                            rot={[-angR, Math.PI / 2, 0]} />
                                    );
                                } else {
                                    const h0 = getPointHeight(x, 0);
                                    const hL = getPointHeight(x, L);
                                    const len = Math.sqrt(Math.pow(L, 2) + Math.pow(hL - h0, 2));
                                    const ang = Math.atan2(hL - h0, L);
                                    structuralBeams.push(
                                        <GenericBeam key={`beam-x-s-${i}`} l={len} w={BEAM_W} h={BEAM_H}
                                            pos={[x, (h0 + hL) / 2 + offset + BEAM_H / 2, L / 2]}
                                            rot={[ang, Math.PI / 2, 0]} />
                                    );
                                }
                            }
                        }
                    } else {
                        // Default: Beams run along X (East-West), distributed along Z (Length)
                        const countZ = Math.ceil(L / step) + 1;
                        for (let i = 0; i < countZ; i++) {
                            const z = Math.min(i * step, L);
                            if (isInside(W / 2, z)) {
                                if (is2Aguas) {
                                    const midW = W / 2;
                                    const hStart = getPointHeight(0, z);
                                    const hMid = getPointHeight(midW, z);
                                    const hEnd = getPointHeight(W, z);

                                    const lenL = Math.sqrt(Math.pow(midW, 2) + Math.pow(hMid - hStart, 2));
                                    const angL = Math.atan2(hMid - hStart, midW);
                                    structuralBeams.push(
                                        <GenericBeam key={`beam-z-l-${i}`} l={lenL} w={BEAM_W} h={BEAM_H}
                                            pos={[midW / 2, (hStart + hMid) / 2 + offset + BEAM_H / 2, z]}
                                            rot={[0, 0, angL]} />
                                    );
                                    const lenR = Math.sqrt(Math.pow(midW, 2) + Math.pow(hMid - hEnd, 2));
                                    const angR = Math.atan2(hMid - hEnd, midW);
                                    structuralBeams.push(
                                        <GenericBeam key={`beam-z-r-${i}`} l={lenR} w={BEAM_W} h={BEAM_H}
                                            pos={[midW + midW / 2, (hEnd + hMid) / 2 + offset + BEAM_H / 2, z]}
                                            rot={[0, 0, -angR]} />
                                    );
                                } else {
                                    const h0 = getPointHeight(0, z);
                                    const hW = getPointHeight(W, z);
                                    const len = Math.sqrt(Math.pow(W, 2) + Math.pow(hW - h0, 2));
                                    const ang = Math.atan2(hW - h0, W);
                                    structuralBeams.push(
                                        <GenericBeam key={`beam-z-s-${i}`} l={len} w={BEAM_W} h={BEAM_H}
                                            pos={[W / 2, (h0 + hW) / 2 + offset + BEAM_H / 2, z]}
                                            rot={[0, 0, ang]} />
                                    );
                                }
                            }
                        }
                    }

                    // Ridge Beams
                    if (is2AguasNS) {
                        const mid = W / 2;
                        const hS = getPointHeight(mid, 0), hE = getPointHeight(mid, L);
                        const len = Math.sqrt(Math.pow(L, 2) + Math.pow(hE - hS, 2)), ang = Math.atan2(hE - hS, L);
                        structuralBeams.push(<GenericBeam key="ridge-ns" l={len} w={0.2} h={0.2} pos={[mid, (hS + hE) / 2 + offset + 0.1, L / 2]} rot={[ang, Math.PI / 2, 0]} />);
                    }
                    if (is2AguasEW) {
                        const mid = L / 2;
                        const hW = getPointHeight(0, mid), hE = getPointHeight(W, mid);
                        const len = Math.sqrt(Math.pow(W, 2) + Math.pow(hE - hW, 2)), ang = Math.atan2(hE - hW, W);
                        structuralBeams.push(<GenericBeam key="ridge-ew" l={len} w={0.2} h={0.2} pos={[W / 2, (hW + hE) / 2 + offset + 0.1, mid]} rot={[0, 0, ang]} />);
                    }
                }

                return (
                    <group>
                        {structuralBeams}
                        {roofMeshes}
                    </group>
                );
            })()}


            {openings.map((op: any) => <Opening3D key={op.id} opening={op} dimensions={dimensions} project={project} />)}

            {/* SYNC LABELS: Show measurements in 3D to match facade configs */}
            <group>
                {/* Height Labels at Corners */}
                {[
                    { p: [0, getPointHeight(0, 0), 0], label: `H:${getPointHeight(0, 0).toFixed(2)}m` },
                    { p: [width, getPointHeight(width, 0), 0], label: `H:${getPointHeight(width, 0).toFixed(2)}m` },
                    { p: [0, getPointHeight(0, length), length], label: `H:${getPointHeight(0, length).toFixed(2)}m` },
                    { p: [width, getPointHeight(width, length), length], label: `H:${getPointHeight(width, length).toFixed(2)}m` }
                ].map((item, i) => (
                    <Text
                        key={`label-h-${i}`}
                        position={[item.p[0], item.p[1] + 0.3, item.p[2]] as [number, number, number]}
                        fontSize={0.25}
                        color="#1e293b"
                        anchorX="center"
                        anchorY="middle"
                        {...{ backgroundColor: "white", padding: 0.05 } as Record<string, unknown>}
                    >
                        {item.label}
                    </Text>
                ))}

                {/* Ridge Peak Labels */}
                {is2AguasNS && (
                    <Text
                        position={[width / 2, getPointHeight(width / 2, length / 2) + 0.3, length / 2]}
                        fontSize={0.3}
                        color="#0369a1"
                        fontWeight="bold"
                        {...{ backgroundColor: "white", padding: 0.08 } as Record<string, unknown>}
                    >
                        Pico: {getPointHeight(width / 2, length / 2).toFixed(2)}m
                    </Text>
                )}
                {is2AguasEW && (
                    <Text
                        position={[width / 2, getPointHeight(width / 2, length / 2) + 0.3, length / 2]}
                        fontSize={0.3}
                        color="#0369a1"
                        fontWeight="bold"
                        {...{ backgroundColor: "white", padding: 0.08 } as Record<string, unknown>}
                    >
                        Pico: {getPointHeight(width / 2, length / 2).toFixed(2)}m
                    </Text>
                )}

                {/* Base Dimensions Labels */}
                <Text position={[width / 2, -0.2, length + 0.5]} fontSize={0.3} color="#94a3b8" rotation={[-Math.PI / 2, 0, 0]}>Frente: {width}m</Text>
                <Text position={[width + 0.5, -0.2, length / 2]} fontSize={0.3} color="#94a3b8" rotation={[-Math.PI / 2, 0, Math.PI / 2]}>Largo: {length}m</Text>
            </group>
        </group>
    );
};

const FactoryLogo = () => {
    try {
        const texture = useTexture('https://lafabricadelpanel.com.ar/wp-content/uploads/2026/02/logo-la-fabrica-del-panel.png');
        return (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 6]} receiveShadow>
                <planeGeometry args={[3, 1.2]} />
                <meshStandardMaterial map={texture} transparent alphaTest={0.1} />
            </mesh>
        );
    } catch {
        return null;
    }
};

const Viewer3D = () => {
    const {
        dimensions = { width: 6, length: 8 },
        openings = [],
        facadeConfigs = {},
        interiorWalls = [],
        showBeams = true,
        showRoofPlates = true,
        project = {},
        addSnapshot,
        beamOffset = 0,
        setBeamOffset
    } = useStore();
    const canvasRef = React.useRef<HTMLDivElement>(null);
    const [captured, setCaptured] = React.useState(false);
    const [facadeMaterial, setFacadeMaterial] = useState<FacadeMaterialType>('osb');

    const handleCapture = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current.querySelector('canvas');
        if (canvas) {
            const img = canvas.toDataURL('image/jpeg', 0.9);
            addSnapshot(img);
            setCaptured(true);
            setTimeout(() => setCaptured(false), 2000);
        }
    };

    return (
        <div id="viewer-3d-container" ref={canvasRef} className="w-full h-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative group">
            <Canvas
                shadows
                camera={{ position: [12, 10, 12], fov: 35 }}
                gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    alpha: false,
                    powerPreference: "high-performance"
                }}
                dpr={typeof window !== 'undefined' && window.devicePixelRatio > 1 ? 2 : 1.5}
            >
                <Environment preset="city" />
                <ambientLight intensity={0.5} />
                <directionalLight
                    position={[15, 25, 15]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize={[4096, 4096]}
                    shadow-camera-left={-30}
                    shadow-camera-right={30}
                    shadow-camera-top={30}
                    shadow-camera-bottom={-30}
                    shadow-bias={-0.0001}
                />
                <HouseModel dimensions={dimensions} openings={openings} facadeConfigs={facadeConfigs} interiorWalls={interiorWalls} showBeams={showBeams} showRoofPlates={showRoofPlates} project={project} beamOffset={beamOffset} facadeMaterial={facadeMaterial} />
                <FactoryLogo />
                <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
                <ContactShadows opacity={0.25} scale={40} blur={2} far={10} position={[0, -0.01, 0]} />
            </Canvas>

            {/* Material Selection Panel */}
            <div className="absolute bottom-6 right-24 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-2 flex items-center gap-1.5 lg:translate-y-4 lg:opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-1">Material</span>
                {(Object.entries(FACADE_MATERIALS) as [FacadeMaterialType, typeof FACADE_MATERIALS[FacadeMaterialType]][]).map(([key, val]) => (
                    <button
                        key={key}
                        onClick={() => setFacadeMaterial(key)}
                        title={val.label}
                        className={`w-7 h-7 rounded-lg border-2 transition-all ${facadeMaterial === key ? 'border-slate-900 scale-110 shadow-md' : 'border-slate-300 hover:border-slate-500'}`}
                        style={{ backgroundColor: val.color }}
                    />
                ))}
            </div>

            {/* Float Capture Button */}
            <button
                onClick={handleCapture}
                className={`absolute bottom-6 right-6 p-4 rounded-2xl shadow-xl transition-all flex items-center gap-2 group/btn ${captured
                    ? 'bg-emerald-500 text-white translate-y-0 opacity-100 scale-100'
                    : 'bg-white/80 backdrop-blur-md text-slate-800 hover:bg-slate-900 hover:text-white lg:translate-y-4 lg:opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                    }`}
            >
                {captured ? <Check size={20} /> : <Camera size={20} />}
                <span className="text-[10px] font-black uppercase tracking-widest overflow-hidden whitespace-nowrap transition-all w-0 group-hover/btn:w-20">
                    {captured ? 'Capturado' : 'Captura 3D'}
                </span>
            </button>
        </div>
    );
};
export default Viewer3D;
