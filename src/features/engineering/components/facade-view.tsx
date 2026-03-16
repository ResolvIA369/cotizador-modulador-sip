"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '@/shared/store/useStore';
import { Square, DoorOpen, Maximize, Trash2, X } from 'lucide-react';
import type { FacadeSide } from '@/shared/types';

interface FacadeViewProps {
    type: string;
    data: any;
    scale?: number;
    onMaximize?: () => void;
    isMaximized?: boolean;
}

const FacadeView = ({ type, data, scale = 20, onMaximize, isMaximized = false }: FacadeViewProps) => {
    const side = type as FacadeSide;
    const { width = 0, length = 0, openings = [], facadeConfigs = {} } = data || {};
    const { addOpening, removeOpening, updateOpening, togglePerimeterVisibility, project, activeOpeningId, setActiveOpeningId } = useStore();

    const isVisible = (project as any).perimeterVisibility?.[type] !== false;

    const config = (facadeConfigs as any)[type] || { type: 'recto', hBase: 2.44, hMax: 2.44 };
    const h1 = config.hBase;
    const h2 = config.hMax;

    const isFrontBack = type === 'Norte' || type === 'Sur';
    const wallWidth = isFrontBack ? width : length;

    // UseMemo for facade openings to improve performance and avoids re-renders
    const facadeOpenings = useMemo(() => {
        return (openings || []).filter((o: any) => o.side === type);
    }, [openings, type]);

    const stats = useMemo(() => {
        let area = 0;
        if (config.type === 'recto') area = wallWidth * h1;
        else if (config.type === 'inclinado') area = wallWidth * (h1 + h2) / 2;
        else if (config.type === '2-aguas') area = wallWidth * h1 + (wallWidth * (h2 - h1) / 2);

        const panels = Math.ceil(area / (1.22 * 2.44));
        const openingML = facadeOpenings.reduce((acc: number, o: any) => acc + (o.width + o.height) * 2, 0);

        return { area, panels, openingML };
    }, [wallWidth, h1, h2, config.type, facadeOpenings]);

    const [interaction, setInteraction] = useState<string | null>(null); // 'move' | 'resize'

    const handleInteraction = (e: MouseEvent) => {
        if (!interaction || !activeOpeningId) return;

        const scaleInv = 1 / scale;
        const dx = e.movementX * scaleInv;
        const dy = e.movementY * scaleInv;

        const current = openings.find((o: any) => o.id === activeOpeningId);
        if (!current) return;

        if (interaction === 'move') {
            updateOpening(activeOpeningId, {
                x: Math.max(0, Math.min(wallWidth - current.width, current.x + dx)),
                y: Math.max(0, Math.min(Math.max(h1, h2) - current.height, current.y - dy))
            });
        } else if (interaction === 'resize') {
            updateOpening(activeOpeningId, {
                width: Math.max(0.4, Math.min(wallWidth - current.x, current.width + dx)),
                height: Math.max(0.4, Math.min(Math.max(h1, h2) - current.y, current.height - dy))
            });
        }
    };

    useEffect(() => {
        const stop = () => { setInteraction(null); }; // Don't clear activeOpeningId here to allow keyboard deletion
        if (interaction) {
            window.addEventListener('mousemove', handleInteraction as any);
            window.addEventListener('mouseup', stop);
        }
        return () => {
            window.removeEventListener('mousemove', handleInteraction as any);
            window.removeEventListener('mouseup', stop);
        };
    }, [interaction, activeOpeningId, openings, h1, h2, wallWidth]);

    // Keyboard listener for deletion moved to FloorPlan or handled globally if needed.
    // However, FacadeView is a subcomponent, so we'll keep its own listener for focus but use store ID.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (activeOpeningId && (e.key === 'Delete' || e.key === 'Backspace')) {
                removeOpening(activeOpeningId);
                setActiveOpeningId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeOpeningId, removeOpening, setActiveOpeningId]);

    // Points for the wall polygon
    const points: string[] = [];
    points.push(`0,0`);
    points.push(`${wallWidth * scale},0`);

    if (config.type === 'recto') {
        points.push(`${wallWidth * scale},${h1 * scale}`);
        points.push(`0,${h1 * scale}`);
    } else if (config.type === 'inclinado') {
        points.push(`${wallWidth * scale},${h2 * scale}`);
        points.push(`0,${h1 * scale}`);
    } else if (config.type === '2-aguas') {
        points.push(`${wallWidth * scale},${h1 * scale}`);
        points.push(`${(wallWidth * scale) / 2},${h2 * scale}`);
        points.push(`0,${h1 * scale}`);
    }

    const svgHeight = Math.max(h1, h2, 2.44) * scale + 40;
    const polygonPoints = points.map(p => {
        const [x, y] = p.split(',').map(Number);
        return `${x},${svgHeight - y - 20}`;
    }).join(' ');

    // Manual Panel Grid (1.22 x 2.44) starting from bottom
    const gridCols = Math.ceil(wallWidth / 1.22);
    const gridRows = Math.ceil(Math.max(h1, h2) / 2.44);
    const panelElements: React.ReactNode[] = [];
    for (let c = 0; c < gridCols; c++) {
        for (let r = 0; r < gridRows; r++) {
            panelElements.push(
                <rect
                    key={`p-${c}-${r}`}
                    x={c * 1.22 * scale}
                    y={svgHeight - (r + 1) * 2.44 * scale - 20}
                    width={1.22 * scale}
                    height={2.44 * scale}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="0.5"
                />
            );
        }
    }

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-full relative group transition-all duration-300 ${!isVisible ? 'bg-slate-100 ring-1 ring-slate-200' : ''}`}>

            {/* Top Badges and Controls */}
            <div className="absolute top-3 left-3 right-3 z-[40] flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full" />
                        Fachada {type}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 pointer-events-auto">
                    <div className="flex items-center gap-2">
                        {!isMaximized && !isVisible && (
                            <button
                                onClick={(e) => { e.stopPropagation(); togglePerimeterVisibility(side); }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all shadow-lg border-2 bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                            >
                                Excluida
                                <div className="w-2 h-2 rounded-full bg-slate-300" />
                            </button>
                        )}
                        {!isMaximized && isVisible && (
                            <div className="flex gap-1.5 p-1 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-xl">
                                <button onClick={() => addOpening(side, 'window')} title="Anadir Ventana" className="p-2 text-slate-600 hover:text-cyan-500 hover:bg-slate-50 rounded-xl transition-all"><Square size={16} /></button>
                                <button onClick={() => addOpening(side, 'door')} title="Anadir Puerta" className="p-2 text-slate-600 hover:text-cyan-500 hover:bg-slate-50 rounded-xl transition-all"><DoorOpen size={16} /></button>
                                <button onClick={onMaximize} title="Maximizar" className="p-2 text-slate-600 hover:text-cyan-500 hover:bg-slate-50 rounded-xl transition-all"><Maximize size={16} /></button>
                                <button onClick={() => togglePerimeterVisibility(side)} title="Excluir Fachada" className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border-l border-slate-100 ml-1"><Trash2 size={16} /></button>
                            </div>
                        )}
                    </div>

                    {isMaximized && isVisible && (
                        <div className="bg-white/90 backdrop-blur border border-slate-200 px-3 py-2 rounded-xl shadow-lg flex gap-4 items-center animate-in slide-in-from-top-1">
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Area Fachada</span>
                                <span className="text-[11px] font-black text-slate-800">{stats.area.toFixed(2)} m2</span>
                            </div>
                            <div className="w-px h-5 bg-slate-200" />
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Paneles SIP</span>
                                <span className="text-[11px] font-black text-slate-800">{stats.panels} Unid.</span>
                            </div>
                            <div className="w-px h-5 bg-slate-200" />
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Aberturas ML</span>
                                <span className="text-[11px] font-black text-slate-800">{stats.openingML.toFixed(2)} ml</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>



            <div className={`flex-1 flex items-center justify-center p-4 bg-slate-50/50 transition-all duration-300 relative ${!isVisible ? 'bg-slate-200/50 grayscale border-dashed border-2 m-4 rounded-xl' : ''}`} onMouseDown={() => isVisible && setActiveOpeningId(null)}>
                {!isVisible && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100/40 backdrop-blur-[2px] rounded-xl">
                        <div className="bg-rose-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl animate-pulse">
                            Fachada Excluida
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePerimeterVisibility(side); }}
                            className="mt-4 text-[10px] font-black text-slate-500 hover:text-emerald-600 underline underline-offset-4 uppercase tracking-widest decoration-2"
                        >
                            Habilitar para presupuesto
                        </button>
                    </div>
                )}
                <svg width="100%" height="100%" viewBox={`-10 0 ${wallWidth * scale + 20} ${svgHeight}`} preserveAspectRatio="xMidYMid meet" className={!isVisible ? 'opacity-20' : ''}>
                    <defs>
                        <clipPath id={`clip-${type}`}>
                            <polygon points={polygonPoints} />
                        </clipPath>
                    </defs>

                    {/* Wall Background */}
                    <polygon points={polygonPoints} fill="white" stroke="#334155" strokeWidth="2" />

                    {/* Manual Panels with clipPath */}
                    <g clipPath={`url(#clip-${type})`}>
                        {panelElements}
                    </g>

                    {/* Openings */}
                    {facadeOpenings.map((o: any) => (
                        <g
                            key={o.id}
                            transform={`translate(${o.x * scale}, ${svgHeight - (o.y + o.height) * scale - 20})`}
                            onMouseDown={(e) => { e.stopPropagation(); setActiveOpeningId(o.id); setInteraction('move'); }}
                            className="cursor-move group/op"
                        >
                            <rect
                                width={o.width * scale} height={o.height * scale}
                                fill={o.type === 'window' ? (activeOpeningId === o.id ? '#e0f2fe' : '#f0f9ff') : (activeOpeningId === o.id ? '#f1f5f9' : '#f8fafc')}
                                stroke={activeOpeningId === o.id ? '#0284c7' : '#0ea5e9'}
                                strokeWidth={activeOpeningId === o.id ? 3 : 2} rx="2"
                            />

                            {/* Opening Dimensions Labels */}
                            <g transform={`translate(${o.width * scale / 2}, -5)`}>
                                <rect x="-15" y="-12" width="30" height="10" rx="2" fill="white" opacity="0.9" />
                                <text textAnchor="middle" fontSize="6" fontWeight="bold" fill="#0369a1">{o.width.toFixed(2)}m</text>
                            </g>
                            <g transform={`translate(${o.width * scale + 5}, ${o.height * scale / 2}) rotate(90)`}>
                                <rect x="-15" y="-12" width="30" height="10" rx="2" fill="white" opacity="0.9" />
                                <text textAnchor="middle" fontSize="6" fontWeight="bold" fill="#0369a1">{o.height.toFixed(2)}m</text>
                            </g>

                            {/* Resize handle */}
                            <circle
                                cx={o.width * scale} cy={0} r={5} fill="white" stroke="#0ea5e9"
                                className="cursor-ne-resize opacity-0 group-hover/op:opacity-100"
                                onMouseDown={(e) => { e.stopPropagation(); setActiveOpeningId(o.id); setInteraction('resize'); }}
                            />
                            {/* Remove handle (Trash Icon) */}
                            <g
                                transform={`translate(${-10}, ${-10})`}
                                className="cursor-pointer opacity-0 group-hover/op:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); removeOpening(o.id); setActiveOpeningId(null); }}
                            >
                                <circle r="10" fill="#ef4444" />
                                <g transform="translate(-6,-6) scale(0.65)">
                                    <Trash2 size={18} color="white" />
                                </g>
                            </g>
                        </g>
                    ))}
                </svg>
            </div>
            {/* Opening Compact Controls */}
            {activeOpeningId && isVisible && (() => {
                const op = openings.find((o: any) => o.id === activeOpeningId);
                if (!op) return null;
                return (
                    <div className="absolute bottom-2 left-2 right-2 z-30 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-slate-200 shadow-md">
                        <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">{op.type === 'door' ? 'Puerta' : 'Ventana'}</span>
                        <div className="flex items-center gap-0.5">
                            <span className="text-[8px] text-slate-400 font-bold">X</span>
                            <input type="number" step="0.01" value={op.x.toFixed(2)}
                                onChange={(e) => updateOpening(op.id, { x: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-12 h-5 text-[10px] font-bold text-center bg-slate-50 border border-slate-200 rounded outline-none focus:border-cyan-400"
                            />
                        </div>
                        <div className="flex items-center gap-0.5">
                            <span className="text-[8px] text-slate-400 font-bold">Y</span>
                            <input type="number" step="0.01" value={op.y.toFixed(2)}
                                onChange={(e) => updateOpening(op.id, { y: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-12 h-5 text-[10px] font-bold text-center bg-slate-50 border border-slate-200 rounded outline-none focus:border-cyan-400"
                            />
                        </div>
                        <div className="w-px h-4 bg-slate-200" />
                        <div className="flex items-center gap-0.5">
                            <span className="text-[8px] text-slate-400 font-bold">An</span>
                            <input type="number" step="0.01" value={op.width.toFixed(2)}
                                onChange={(e) => updateOpening(op.id, { width: Math.max(0.4, parseFloat(e.target.value) || 0.4) })}
                                className="w-12 h-5 text-[10px] font-bold text-center bg-slate-50 border border-slate-200 rounded outline-none focus:border-cyan-400"
                            />
                        </div>
                        <div className="flex items-center gap-0.5">
                            <span className="text-[8px] text-slate-400 font-bold">Al</span>
                            <input type="number" step="0.01" value={op.height.toFixed(2)}
                                onChange={(e) => updateOpening(op.id, { height: Math.max(0.4, parseFloat(e.target.value) || 0.4) })}
                                className="w-12 h-5 text-[10px] font-bold text-center bg-slate-50 border border-slate-200 rounded outline-none focus:border-cyan-400"
                            />
                        </div>
                        <button onClick={() => setActiveOpeningId(null)} className="p-0.5 text-slate-300 hover:text-slate-600 transition-colors ml-auto shrink-0">
                            <X size={12} />
                        </button>
                    </div>
                );
            })()}
        </div>
    );
};

export default FacadeView;
