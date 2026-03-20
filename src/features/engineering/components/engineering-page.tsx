"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/shared/store/useStore';
import { calculateGeometry } from '@/shared/lib/calculations';
import type { HousePreset } from '@/shared/lib/presets';
import type { Project, FacadeSide } from '@/shared/types';
import FloorPlan from './floor-plan';
import FacadeView from './facade-view';
import Viewer3D from './viewer-3d';
import Link from 'next/link';
import {
    FileText, Copy, Download, Maximize2, X,
    Square, Plus, Minus, ChevronDown, ChevronUp,
    Box, Ruler, Eye, EyeOff, RotateCcw, Layers,
    Save, FolderOpen, Trash2, DoorOpen
} from 'lucide-react';
import html2canvas from 'html2canvas';

/* ──────────────────────────────────────────────
   Number Stepper Input (+/- buttons)
   ────────────────────────────────────────────── */
interface NumberStepperProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    step: number;
    unit: string;
    compact?: boolean;
}

const NumberStepper = ({ label, value, onChange, min, max, step, unit, compact }: NumberStepperProps) => {
    const [localValue, setLocalValue] = useState<string>(String(value));
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setLocalValue(String(step < 1 ? value.toFixed(2) : value));
    }, [value, step]);

    const clamp = (v: number) => Math.max(min, Math.min(max, v));

    const commitValue = (raw: string) => {
        const normalized = raw.replace(',', '.');
        let v = parseFloat(normalized);
        if (isNaN(v)) v = min;
        v = clamp(v);
        setLocalValue(String(step < 1 ? v.toFixed(2) : v));
        onChange(v);
    };

    const increment = useCallback(() => onChange(parseFloat(clamp(parseFloat(String(value)) + step).toFixed(4))), [value, step, min, max, onChange]);
    const decrement = useCallback(() => onChange(parseFloat(clamp(parseFloat(String(value)) - step).toFixed(4))), [value, step, min, max, onChange]);

    const stopLongPress = useCallback(() => {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }, []);

    const startLongPress = useCallback((action: () => void) => {
        action();
        let speed = 120;
        const accelerate = () => {
            action();
            speed = Math.max(25, speed - 8);
            intervalRef.current = setTimeout(accelerate, speed) as unknown as ReturnType<typeof setInterval>;
        };
        timeoutRef.current = setTimeout(accelerate, 350);
    }, []);

    useEffect(() => stopLongPress, [stopLongPress]);

    return (
        <div className={compact ? "flex flex-col gap-1" : "flex flex-col gap-1.5"}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white h-9">
                <button
                    onMouseDown={() => startLongPress(decrement)}
                    onMouseUp={stopLongPress}
                    onMouseLeave={stopLongPress}
                    onTouchStart={() => startLongPress(decrement)}
                    onTouchEnd={stopLongPress}
                    className="h-full w-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors border-r border-slate-200"
                >
                    <Minus size={12} className="text-slate-500" />
                </button>
                <div className="flex items-center gap-0.5 px-1 flex-1 justify-center">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={() => commitValue(localValue)}
                        onKeyDown={(e) => e.key === 'Enter' && commitValue(localValue)}
                        className="h-full w-12 text-center text-sm font-bold text-slate-800 outline-none bg-transparent"
                    />
                    <span className="text-[10px] font-bold text-slate-400">{unit}</span>
                </div>
                <button
                    onMouseDown={() => startLongPress(increment)}
                    onMouseUp={stopLongPress}
                    onMouseLeave={stopLongPress}
                    onTouchStart={() => startLongPress(increment)}
                    onTouchEnd={stopLongPress}
                    className="h-full w-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors border-l border-slate-200"
                >
                    <Plus size={12} className="text-slate-500" />
                </button>
            </div>
        </div>
    );
};

/* ──────────────────────────────────────────────
   DataRow for the technical report
   ────────────────────────────────────────────── */
interface DataRowProps {
    label: string;
    value: string | number;
    sub?: string;
    inverted?: boolean;
}

const DataRow = ({ label, value, sub, inverted }: DataRowProps) => (
    <div className={`flex justify-between items-baseline border-b py-1 font-mono text-[11px] leading-none ${inverted ? 'border-slate-800' : 'border-slate-100'}`}>
        <span className={inverted ? 'text-slate-500' : 'text-slate-400'}>{label}</span>
        <div className="text-right">
            <span className={`font-bold ${inverted ? 'text-slate-200' : 'text-slate-800'}`}>{value}</span>
            {sub && <span className={`ml-1 text-[9px] ${inverted ? 'text-slate-600' : 'text-slate-400'}`}>{sub}</span>}
        </div>
    </div>
);

/* ──────────────────────────────────────────────
   Toggle Button
   ────────────────────────────────────────────── */
const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button onClick={onClick} className="flex items-center gap-2 group">
        <div className={`w-8 h-4 rounded-full relative transition-colors ${on ? 'bg-cyan-500' : 'bg-slate-200'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${on ? 'left-4' : 'left-0.5'}`} />
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-slate-700 transition-colors">{label}</span>
    </button>
);

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
const Engineering = () => {
    const {
        dimensions, setDimensions,
        interiorWalls, updateInteriorWall,
        openings,
        facadeConfigs, updateFacadeConfig,
        showBeams, setShowBeams,
        showRoofPlates, setShowRoofPlates,
        activeInteriorWallId, setActiveInteriorWallId,
        project, foundationType, setFoundationType, structureType, setStructureType,
        selections, toggleSelectionCategory, setSelectionId, setSelections, setRoofSystem,
        prices, perimeterWalls,
        updateRecess, removeRecess, clearRecesses, addLShape, addCShape,
        togglePerimeterVisibility,
        addWall, removeWall,
        savedDesigns, saveDesign, loadDesign, deleteDesign,
        addOpening,
    } = useStore();

    /* ── default selections bootstrap ── */
    useEffect(() => {
        const { history, saveHistory } = useStore.getState();
        if (history.length === 0) saveHistory();

        const defaultValues: Record<string, unknown> = {
            exteriorWallId: "OSB-70-E", interiorWallId: "OSB-70-DECO",
            roofId: "TECHO-OSB-70", floorId: "PISO-OSB-70",
            includeExterior: true, includeInterior: true, includeRoof: true, includeFloor: true,
        };
        const missing: Record<string, unknown> = {};
        let needsSync = false;
        Object.keys(defaultValues).forEach(key => {
            if ((selections as any)[key] === undefined) {
                missing[key] = defaultValues[key];
                needsSync = true;
            }
        });
        if (needsSync) setSelections(missing as any);
    }, [selections, setSelections]);

    /* ── local UI state ── */
    const [maximizedFacade, setMaximizedFacade] = useState<FacadeSide | null>(null);
    const [isFloorPlanExpanded, setIsFloorPlanExpanded] = useState(false);
    const [_activePresetId, setActivePresetId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'plano' | '3d'>('plano');
    const [showReport, setShowReport] = useState(false);
    const [showDesigns, setShowDesigns] = useState(false);
    const [saveName, setSaveName] = useState('');

    /* ── geometry calculation ── */
    const geo = useMemo(() => {
        return calculateGeometry(dimensions, interiorWalls, facadeConfigs, openings, { ...project, perimeterWalls, interiorWalls } as Partial<Project> & { foundationType?: string }, selections);
    }, [dimensions, interiorWalls, facadeConfigs, openings, project, selections, perimeterWalls]);

    const area = dimensions.width * dimensions.length;

    /* ── apply a preset ── */
    const applyPreset = useCallback((preset: HousePreset) => {
        setActivePresetId(preset.id);
        setDimensions(preset.dimensions);
        setFoundationType(preset.foundationType);
        setStructureType(preset.structureType);
        setRoofSystem(preset.roofSystem);
        setSelectionId('exteriorWallId', preset.exteriorWallId);
        setSelectionId('interiorWallId', preset.interiorWallId);
        setSelectionId('roofId', preset.roofId);
        setSelectionId('floorId', preset.floorId);

        // Clear existing interior walls and apply preset layout
        interiorWalls.forEach(w => removeWall(w.id));
        if (preset.interiorWalls) {
            preset.interiorWalls.forEach(wall => {
                addWall('interior', {
                    x: wall.x,
                    y: wall.y,
                    length: wall.length,
                    isVertical: wall.isVertical,
                });
            });
        }
    }, [setDimensions, setFoundationType, setStructureType, setRoofSystem, setSelectionId, interiorWalls, removeWall, addWall]);

    /* ── build report text ── */
    const buildReportText = () => {
        let text = `==========================================\n`;
        text += `   REPORTE TECNICO - MODULADOR SIP\n`;
        text += `   LA FABRICA DEL PANEL\n`;
        text += `==========================================\n\n`;
        text += `PROYECTO\n`;
        text += `  Cliente: ${project.clientName || 'No especificado'}\n`;
        text += `  Ubicacion: ${project.location || 'No especificada'}\n`;
        text += `  Fecha: ${project.date || new Date().toLocaleDateString('es-AR')}\n`;
        text += `  Presupuesto: ${project.budgetNumber || '---'}\n\n`;
        text += `DIMENSIONES BASE\n`;
        text += `  Largo: ${dimensions.length}m | Ancho: ${dimensions.width}m | Alt. Muros: ${dimensions.height}m | Cumbrera: ${dimensions.ridgeHeight}m\n`;
        text += `  Superficie: ${area} m2 | Perimetro: ${geo.perimExt.toFixed(2)} ml\n\n`;
        text += `1. MUROS EXTERIORES (FACHADAS)\n`;
        Object.entries(geo.sides || {}).filter(([_, stats]: [string, unknown]) => (stats as Record<string, unknown>).isVisible).forEach(([side, stats]: [string, unknown]) => {
            const s = stats as Record<string, unknown>;
            text += `   Fachada ${side}:\n`;
            text += `     Area: ${(s.area as number).toFixed(2)} m2 | Paneles: ${s.panels} | Perim: ${((s.perimPanels as number) ?? 0).toFixed(2)} ml | Aberturas: ${(s.openingML as number).toFixed(2)} ml\n`;
        });
        text += `   TOTAL Muros Ext: ${geo.areaMurosBruta.toFixed(2)} m2 | ${geo.cantMurosExt} paneles | ${geo.perimMurosExt?.toFixed(2)} ml perim.\n\n`;
        text += `2. TABIQUES INTERIORES\n`;
        text += `   Lineales: ${geo.tabiques.toFixed(2)} ml | Paneles: ${geo.cantMurosInt} | Perim: ${geo.perimMurosInt?.toFixed(2)} ml\n\n`;
        text += `3. PISO\n`;
        text += `   Area: ${geo.areaPiso.toFixed(2)} m2 | Paneles: ${geo.cantPiso} | Perim: ${geo.perimPiso?.toFixed(2)} ml\n\n`;
        text += `4. TECHO\n`;
        text += `   Area: ${geo.areaTecho.toFixed(2)} m2 | Paneles: ${geo.cantTecho} | Perim: ${geo.perimTecho?.toFixed(2)} ml\n\n`;
        text += `==========================================\n`;
        text += `RESUMEN GENERAL\n`;
        text += `  Perimetro Exterior: ${geo.perimExt.toFixed(2)} ml\n`;
        text += `  Total Aberturas: ${geo.totalAberturasCount} u | Perim: ${geo.perimAberturas.toFixed(2)} ml\n`;
        text += `  TOTAL PANELES: ${geo.totalPaneles} u\n`;
        text += `  Perimetro Lineal Total: ${geo.perimLinealPaneles.toFixed(2)} ml\n`;
        text += `==========================================\n`;
        text += `  WhatsApp: 3518093394 (area ventas)\n`;
        return text;
    };

    /* ── copy to clipboard ── */
    const copyToClipboard = async () => {
        const text = buildReportText();
        try {
            await navigator.clipboard.writeText(text);
            alert("Reporte copiado al portapapeles!");
        } catch {
            // Fallback for browsers that block clipboard API
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert("Reporte copiado al portapapeles!");
        }
    };

    /* ── download report as TXT ── */
    const downloadReport = () => {
        const text = buildReportText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Reporte_SIP_${project.clientName || 'Proyecto'}_${dimensions.width}x${dimensions.length}m.txt`.replace(/[^a-z0-9._-]/gi, '_');
        link.click();
        URL.revokeObjectURL(url);
    };

    void _activePresetId; // preset selection kept for programmatic use

    /* ══════════════════════════════════════════════
       RENDER
       ══════════════════════════════════════════════ */
    return (
        <div className="flex flex-col gap-4 pb-6">

            {/* ════════════════════════════════════════
               ROW 2: CONTROLS RIBBON
               ════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {/* Dimensions */}
                    <NumberStepper label="Largo" value={dimensions.length} onChange={(v) => setDimensions({ length: v })} min={3} max={20} step={0.5} unit="m" compact />
                    <NumberStepper label="Ancho" value={dimensions.width} onChange={(v) => setDimensions({ width: v })} min={3} max={15} step={0.5} unit="m" compact />
                    <NumberStepper label="Alt. Muros" value={dimensions.height} onChange={(v) => setDimensions({ height: v })} min={2.44} max={5.0} step={0.10} unit="m" compact />
                    <NumberStepper label="Cumbrera" value={dimensions.ridgeHeight} onChange={(v) => setDimensions({ ridgeHeight: v })} min={2.44} max={7.0} step={0.10} unit="m" compact />

                    {/* Foundation */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cimentacion</label>
                        <div className="flex h-9 border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setFoundationType('platea')}
                                className={`flex-1 text-[10px] font-bold uppercase transition-all ${foundationType === 'platea' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >Platea</button>
                            <button
                                onClick={() => setFoundationType('estructura')}
                                className={`flex-1 text-[10px] font-bold uppercase transition-all border-l border-slate-200 ${foundationType === 'estructura' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >Estruc.</button>
                        </div>
                    </div>

                    {/* Structure Type */}
                    <div className={`flex flex-col gap-1.5 transition-opacity ${foundationType === 'platea' ? 'opacity-30 pointer-events-none' : ''}`}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estructura</label>
                        <div className="flex h-9 border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setStructureType('madera')}
                                className={`flex-1 text-[10px] font-bold uppercase transition-all ${structureType === 'madera' ? 'bg-cyan-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >Madera</button>
                            <button
                                onClick={() => setStructureType('metal')}
                                className={`flex-1 text-[10px] font-bold uppercase transition-all border-l border-slate-200 ${structureType === 'metal' ? 'bg-cyan-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >Metal</button>
                        </div>
                    </div>

                    {/* Roof System */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Techo</label>
                        <div className="flex h-9 border border-slate-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setRoofSystem('sip')}
                                className={`flex-1 text-[10px] font-bold uppercase transition-all ${(selections as any).roofSystem === 'sip' ? 'bg-orange-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >SIP</button>
                            <button
                                onClick={() => setRoofSystem('sandwich')}
                                className={`flex-1 text-[10px] font-bold uppercase transition-all border-l border-slate-200 ${(selections as any).roofSystem === 'sandwich' ? 'bg-orange-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >Sandwich</button>
                        </div>
                    </div>
                </div>

                {/* Second row: shape + roof material + facade toggles */}
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                    {/* Plant shape */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Planta:</span>
                        <button
                            onClick={() => clearRecesses()}
                            className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center transition-all ${(project as any).recesses?.length === 0 ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                            title="Rectangular"
                        ><Square size={14} /></button>
                        <button
                            onClick={() => addLShape()}
                            className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center transition-all ${(project as any).recesses?.length === 1 && (project as any).recesses[0].hideSideWall ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                            title="Forma L"
                        ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16" /></svg></button>
                        <button
                            onClick={() => addCShape()}
                            className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center transition-all ${(project as any).recesses?.length === 1 && !(project as any).recesses[0].hideSideWall ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                            title="Forma C"
                        ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4H4v16h16" /></svg></button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden md:block" />

                    {/* Roof material dropdown */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material:</span>
                        <select
                            value={(selections as any).roofId}
                            onChange={(e) => setSelectionId('roofId', e.target.value)}
                            className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-orange-400 transition-colors"
                        >
                            {prices
                                .filter((p: any) => p.category === "1. SISTEMA DE PANELES" &&
                                    ((selections as any).roofSystem === 'sandwich' ? p.id.includes('SAND-') : (p.id.includes('TECHO-') || p.id === 'COL-70' || p.id === 'CE-70' || p.id === 'SID-70')))
                                .map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))
                            }
                        </select>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden md:block" />

                    {/* Facade toggles */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Fachadas:</span>
                        {(['Norte', 'Sur', 'Este', 'Oeste'] as const).map(side => {
                            const isVisible = (project as any).perimeterVisibility?.[side] !== false;
                            return (
                                <button
                                    key={side}
                                    onClick={() => togglePerimeterVisibility(side)}
                                    className={`h-6 w-6 rounded text-[9px] font-bold transition-all border flex items-center justify-center ${isVisible
                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                                        }`}
                                >{side.charAt(0)}</button>
                            );
                        })}
                    </div>

                    {/* Stats push right */}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-2 bg-slate-900 text-white rounded-lg px-3 py-1.5">
                            <span className="text-sm sm:text-lg font-black">{area}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">m2</span>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-500 text-white rounded-lg px-3 py-1.5">
                            <span className="text-sm sm:text-lg font-black">{geo.totalPaneles}</span>
                            <span className="text-[10px] font-bold text-orange-200 uppercase">paneles</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════
               ROW 3: MAIN VIEWER (Floor Plan / 3D toggle)
               ════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main viewer: Floor Plan or 3D */}
                <div className={`lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${isFloorPlanExpanded ? 'fixed inset-0 z-[100] rounded-none' : ''}`}>
                    {/* Viewer tabs */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setActiveTab('plano')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'plano' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <span className="flex items-center gap-1.5"><Ruler size={12} /> Plano</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('3d')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${activeTab === '3d' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <span className="flex items-center gap-1.5"><Box size={12} /> 3D</span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {activeTab === '3d' && (
                                <>
                                    <Toggle on={showBeams} onClick={() => setShowBeams(!showBeams)} label="Vigas" />
                                    <Toggle on={showRoofPlates} onClick={() => setShowRoofPlates(!showRoofPlates)} label="Cubierta" />
                                </>
                            )}
                            <button
                                onClick={() => setIsFloorPlanExpanded(!isFloorPlanExpanded)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title={isFloorPlanExpanded ? "Contraer" : "Expandir"}
                            >
                                {isFloorPlanExpanded ? <X size={16} /> : <Maximize2 size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Viewer content */}
                    <div className={`flex-1 ${isFloorPlanExpanded ? '' : 'h-[350px] sm:h-[450px] lg:h-[600px]'}`}>
                        {activeTab === 'plano' ? (
                            <FloorPlan hideUI={!!maximizedFacade} isExpanded={isFloorPlanExpanded} />
                        ) : (
                            <Viewer3D />
                        )}
                    </div>
                </div>

                {/* Right side: Technical report + actions */}
                <div className="flex flex-col gap-4">
                    {/* Quick summary cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Muros Ext</p>
                            <p className="text-2xl font-black text-slate-800">{geo.cantMurosExt}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{geo.areaMurosBruta.toFixed(1)} m2</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tabiques</p>
                            <p className="text-2xl font-black text-slate-800">{geo.cantMurosInt}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{geo.tabiques.toFixed(1)} ml</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Techo</p>
                            <p className="text-2xl font-black text-slate-800">{geo.cantTecho}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{geo.areaTecho.toFixed(1)} m2</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Piso</p>
                            <p className="text-2xl font-black text-slate-800">{geo.cantPiso}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{geo.areaPiso.toFixed(1)} m2</p>
                        </div>
                    </div>

                    {/* Save & Gallery */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const name = saveName.trim() || `Diseño ${savedDesigns.length + 1}`;
                                saveDesign(name, area, geo.totalPaneles);
                                setSaveName('');
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors"
                        ><Save size={12} /> Guardar</button>
                        <button
                            onClick={() => setShowDesigns(!showDesigns)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors ${showDesigns ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        ><FolderOpen size={12} /> Mis Diseños ({savedDesigns.length})</button>
                    </div>

                    {/* Save name input */}
                    <input
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Nombre del diseño (opcional)..."
                        className="w-full px-3 py-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-orange-300 text-slate-600 font-medium"
                    />

                    {/* Saved Designs Gallery */}
                    {showDesigns && savedDesigns.length > 0 && (
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 space-y-1.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                            {savedDesigns.map(d => (
                                <div key={d.id} className="bg-white rounded-lg p-2.5 border border-slate-100 hover:border-orange-200 transition-colors group">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-slate-800 truncate">{d.name}</span>
                                        <span className="text-[8px] text-slate-400">{new Date(d.date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-slate-500 font-medium">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">{d.area} m2</span>
                                        <span>{d.dimensions.width}x{d.dimensions.length}m</span>
                                        <span>{d.roomCount} amb</span>
                                        {d.bathroomCount > 0 && <span>{d.bathroomCount} bano{d.bathroomCount > 1 ? 's' : ''}</span>}
                                        <span>{d.totalPanels} pan</span>
                                    </div>
                                    <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => loadDesign(d.id)} className="flex-1 py-1 bg-orange-500 text-white rounded-md text-[8px] font-bold uppercase hover:bg-orange-400 transition-colors">Cargar</button>
                                        <button onClick={() => deleteDesign(d.id)} className="px-2 py-1 bg-slate-100 text-rose-500 rounded-md text-[8px] font-bold uppercase hover:bg-rose-50 transition-colors">Borrar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Technical Report (expandable) */}
                    <div className={`bg-slate-900 rounded-2xl overflow-hidden flex flex-col ${showReport ? 'flex-1' : ''}`}>
                        <button
                            onClick={() => setShowReport(!showReport)}
                            className={`flex items-center justify-between px-4 hover:bg-slate-800 transition-colors ${showReport ? 'py-3' : 'py-2'}`}
                        >
                            <span className={`font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2 ${showReport ? 'text-xs' : 'text-[10px]'}`}>
                                <FileText size={showReport ? 14 : 12} /> Reporte Tecnico
                            </span>
                            {showReport ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                        </button>

                        {showReport && (
                            <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar">
                                {/* Facades */}
                                <div>
                                    <h4 className="text-cyan-400 text-[10px] uppercase font-black mb-2 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" /> Muros Exteriores
                                    </h4>
                                    {Object.entries(geo.sides || {}).filter(([_, stats]: [string, any]) => stats.isVisible).map(([side, stats]: [string, any]) => (
                                        <div key={side} className="bg-white/5 p-2.5 rounded-xl border border-white/5 mb-1.5">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-white uppercase">{side}</span>
                                                <span className="text-[9px] font-bold text-cyan-400">{stats.panels} pan.</span>
                                            </div>
                                            <DataRow label="Area" value={stats.area.toFixed(2)} sub="m2" inverted />
                                            <DataRow label="Perim." value={stats.perimPanels?.toFixed(2)} sub="ml" inverted />
                                        </div>
                                    ))}
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                        <DataRow label="Total Area" value={geo.areaMurosBruta.toFixed(2)} sub="m2" inverted />
                                        <DataRow label="Total Perim." value={geo.perimMurosExt?.toFixed(2)} sub="ml" inverted />
                                    </div>
                                </div>

                                {/* Interior */}
                                <div>
                                    <h4 className="text-amber-400 text-[10px] uppercase font-black mb-2 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Tabiques
                                    </h4>
                                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                        <DataRow label="ML" value={geo.tabiques.toFixed(2)} sub="ml" inverted />
                                        <DataRow label="Paneles" value={geo.cantMurosInt} sub="u" inverted />
                                        <DataRow label="Perim." value={geo.perimMurosInt?.toFixed(2)} sub="ml" inverted />
                                    </div>
                                </div>

                                {/* Floor & Roof */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <h4 className="text-emerald-400 text-[10px] uppercase font-black mb-2">Piso</h4>
                                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                            <DataRow label="Area" value={geo.areaPiso.toFixed(2)} sub="m2" inverted />
                                            <DataRow label="Pan." value={geo.cantPiso} sub="u" inverted />
                                            <DataRow label="Per." value={geo.perimPiso?.toFixed(2)} sub="ml" inverted />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-violet-400 text-[10px] uppercase font-black mb-2">Techo</h4>
                                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                                            <DataRow label="Area" value={geo.areaTecho.toFixed(2)} sub="m2" inverted />
                                            <DataRow label="Pan." value={geo.cantTecho} sub="u" inverted />
                                            <DataRow label="Per." value={geo.perimTecho?.toFixed(2)} sub="ml" inverted />
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-gradient-to-r from-cyan-500/20 to-orange-500/20 p-3 rounded-xl border border-white/10">
                                    <DataRow label="Perim. Ext." value={geo.perimExt.toFixed(2)} sub="ml" inverted />
                                    <DataRow label="Aberturas" value={geo.totalAberturasCount} sub="u" inverted />
                                    <DataRow label="Perim. Aberturas" value={geo.perimAberturas.toFixed(2)} sub="ml" inverted />
                                    <DataRow label="Total Paneles" value={geo.totalPaneles} sub="u" inverted />
                                    <DataRow label="Perim. Lineal" value={geo.perimLinealPaneles.toFixed(2)} sub="ml" inverted />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                    >
                                        <Copy size={14} /> Copiar
                                    </button>
                                    <button
                                        onClick={downloadReport}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                    >
                                        <Download size={14} /> Descargar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Go to Budget */}
                    <Link
                        href="/budget"
                        className="flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors shadow-lg shadow-orange-500/20"
                    >
                        <FileText size={16} /> Ir a Presupuesto
                    </Link>
                </div>
            </div>

            {/* ════════════════════════════════════════
               ROW 4: FACADES STRIP
               ════════════════════════════════════════ */}
            {!isFloorPlanExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['Norte', 'Sur', 'Este', 'Oeste'] as const).map(side => {
                        const isVisible = (project as any).perimeterVisibility?.[side] !== false;
                        return (
                            <div key={side} className={`h-72 bg-white rounded-2xl border shadow-sm overflow-hidden relative group transition-opacity ${isVisible ? 'border-slate-200' : 'border-slate-100 opacity-40'}`}>
                                <FacadeView
                                    type={side}
                                    data={{ ...dimensions, openings, facadeConfigs }}
                                    onMaximize={() => setMaximizedFacade(side)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ════════════════════════════════════════
               FACADE MODAL (maximized)
               ════════════════════════════════════════ */}
            {maximizedFacade && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
                    <div className="bg-white w-full max-w-6xl h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
                        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                    Fachada {maximizedFacade}
                                    <span className="bg-cyan-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">Avanzado</span>
                                </h2>
                                <p className="text-slate-400 text-xs font-medium">Tipo de techo y alturas de esta fachada.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => togglePerimeterVisibility(maximizedFacade!)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${(project as any).perimeterVisibility?.[maximizedFacade] !== false
                                        ? 'bg-emerald-500 text-white border-emerald-600'
                                        : 'bg-white text-slate-400 border-slate-200'
                                        }`}
                                >
                                    {(project as any).perimeterVisibility?.[maximizedFacade] !== false ? <><Eye size={14} /> Activa</> : <><EyeOff size={14} /> Excluida</>}
                                </button>
                                <button onClick={() => setMaximizedFacade(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-rose-500">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row min-h-0">
                            <div className="flex-1 p-3 md:p-6 bg-slate-50/30 min-h-[200px]">
                                <FacadeView
                                    type={maximizedFacade}
                                    data={{ ...dimensions, openings, facadeConfigs }}
                                    scale={45}
                                    isMaximized={true}
                                />
                            </div>

                            <div className="w-full md:w-72 lg:w-80 border-t md:border-t-0 md:border-l border-slate-100 p-4 md:p-6 space-y-4 md:space-y-6 bg-white overflow-y-auto max-h-[40vh] md:max-h-none">
                                {(() => {
                                    const config = (facadeConfigs as any)[maximizedFacade] || { type: 'recto', hBase: 2.44, hMax: 2.44 };
                                    return (
                                        <>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Agregar Aberturas</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => addOpening(maximizedFacade! as FacadeSide, 'window')}
                                                        className="flex items-center justify-center gap-2 py-2.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-xl text-[10px] font-bold uppercase border border-cyan-200 transition-all"
                                                    >
                                                        <Square size={14} /> Ventana
                                                    </button>
                                                    <button
                                                        onClick={() => addOpening(maximizedFacade! as FacadeSide, 'door')}
                                                        className="flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-[10px] font-bold uppercase border border-amber-200 transition-all"
                                                    >
                                                        <DoorOpen size={14} /> Puerta
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tipo de Techo</label>
                                                <div className="space-y-2">
                                                    {(['recto', 'inclinado', '2-aguas'] as const).map(type => (
                                                        <button
                                                            key={type}
                                                            onClick={() => updateFacadeConfig(maximizedFacade!, { type })}
                                                            className={`w-full px-3 py-3 rounded-xl text-sm font-bold border-2 transition-all text-left ${config.type === type
                                                                ? 'bg-cyan-50 border-cyan-500 text-cyan-700'
                                                                : 'border-slate-100 text-slate-400 hover:border-slate-200'
                                                                }`}
                                                        >
                                                            <span className="capitalize block">{type.replace('-', ' ')}</span>
                                                            <span className="text-[10px] font-normal opacity-60">
                                                                {type === 'recto' && "Techo plano."}
                                                                {type === 'inclinado' && "Pendiente lateral."}
                                                                {type === '2-aguas' && "Doble pendiente."}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Cotas</label>
                                                {config.type === 'recto' && (
                                                    <NumberStepper label="Altura Muro" value={config.hBase} onChange={(v) => updateFacadeConfig(maximizedFacade!, { hBase: v, hMax: v })} min={2.44} max={5.0} step={0.1} unit="m" />
                                                )}
                                                {config.type === 'inclinado' && (
                                                    <>
                                                        <NumberStepper label="Alt. Izquierda" value={config.hBase} onChange={(v) => updateFacadeConfig(maximizedFacade!, { hBase: v })} min={2.44} max={6.0} step={0.1} unit="m" />
                                                        <NumberStepper label="Alt. Derecha" value={config.hMax} onChange={(v) => updateFacadeConfig(maximizedFacade!, { hMax: v })} min={2.44} max={6.0} step={0.1} unit="m" />
                                                    </>
                                                )}
                                                {config.type === '2-aguas' && (
                                                    <>
                                                        <NumberStepper label="Alt. Aleros" value={config.hBase} onChange={(v) => updateFacadeConfig(maximizedFacade!, { hBase: v })} min={2.44} max={6.0} step={0.1} unit="m" />
                                                        <NumberStepper label="Alt. Cumbrera" value={config.hMax} onChange={(v) => updateFacadeConfig(maximizedFacade!, { hMax: v })} min={2.44} max={7.0} step={0.1} unit="m" />
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Engineering;
