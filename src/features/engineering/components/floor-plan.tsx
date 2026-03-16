"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '@/shared/store/useStore';
import { calculateGeometry } from '@/shared/lib/calculations';
import { Plus, Minus, RotateCcw, PenTool, Trash2, Repeat, Layout, X, ChevronDown, ChevronUp, Ruler, Undo2, Redo2 } from 'lucide-react';

interface RangeControlProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    step: number;
    unit: string;
}

const RangeControl = ({ label, value, onChange, min, max, step, unit }: RangeControlProps) => {
    const [localValue, setLocalValue] = React.useState<string>(Number(value).toFixed(2));
    React.useEffect(() => { setLocalValue(Number(value).toFixed(2)); }, [value]);

    const clamp = (v: number) => Math.max(min, Math.min(max, v));

    const commit = (raw: string) => {
        let v = parseFloat(raw);
        if (isNaN(v)) v = value;
        v = clamp(v);
        setLocalValue(v.toFixed(2));
        onChange(v);
    };

    const inc = () => onChange(parseFloat(clamp(value + step).toFixed(4)));
    const dec = () => onChange(parseFloat(clamp(value - step).toFixed(4)));

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight w-14 shrink-0">{label}</span>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white h-7 flex-1">
                <button onClick={dec} className="h-full w-6 flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors border-r border-slate-200">
                    <Minus size={10} className="text-slate-500" />
                </button>
                <input
                    type="text" value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={() => commit(localValue)}
                    onKeyDown={(e) => e.key === 'Enter' && commit(localValue)}
                    className="flex-1 text-center text-[11px] font-bold text-slate-800 outline-none bg-transparent h-full min-w-0"
                />
                <button onClick={inc} className="h-full w-6 flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors border-l border-slate-200">
                    <Plus size={10} className="text-slate-500" />
                </button>
            </div>
            <span className="text-[9px] font-bold text-slate-400 w-5 shrink-0">{unit}</span>
        </div>
    );
};

interface FloorPlanProps {
    hideUI?: boolean;
    isPrint?: boolean;
    isExpanded?: boolean;
}

const FloorPlan = ({ hideUI, isPrint, isExpanded }: FloorPlanProps) => {
    interface CrosshairOverlayProps {
        getSVGCoords: (clientX: number, clientY: number, snap?: boolean) => { x: number; y: number };
        BASE_SCALE: number;
    }

    const CrosshairOverlay = ({ getSVGCoords, BASE_SCALE }: CrosshairOverlayProps) => {
        const [pos, setPos] = useState({ x: 0, y: 0 });
        useEffect(() => {
            const handleMove = (e: MouseEvent) => setPos(getSVGCoords(e.clientX, e.clientY, true));
            window.addEventListener('mousemove', handleMove);
            return () => window.removeEventListener('mousemove', handleMove);
        }, [getSVGCoords]);

        return (
            <g className="pointer-events-none">
                <line x1={pos.x - 20} y1={pos.y} x2={pos.x + 20} y2={pos.y} stroke="#6366f1" strokeWidth="1" />
                <line x1={pos.x} y1={pos.y - 20} x2={pos.x} y2={pos.y + 20} stroke="#6366f1" strokeWidth="1" />
                <circle cx={pos.x} cy={pos.y} r="4" fill="none" stroke="#6366f1" strokeWidth="1" />
            </g>
        );
    };

    const shouldHideUI = hideUI || isPrint;
    const {
        dimensions, setDimensions, interiorWalls, perimeterWalls, addWall, updateWall, updateInteriorWall, removeWall,
        activeInteriorWallId, setActiveInteriorWallId, activeId, setActive, resetProject, openings, project,
        foundationType, structureType, selections, facadeConfigs,
        customMeasurements, addCustomMeasurement, clearCustomMeasurements,
        activeOpeningId, setActiveOpeningId, activeRecessId, setActiveRecessId, removeOpening, removeRecess,
        undo, redo, historyIndex, history,
        copyWall, cutWall, pasteWall, duplicateWall, updateOpening,
        updateRecess: storeUpdateRecess, addOpening
    } = useStore();

    // Local wrapper: the component calls updateRecess(id, updates) but the store expects (side, id, updates)
    const updateRecess = (id: string, updates: Record<string, unknown>) => {
        const recess = (project.recesses || []).find((r: { id: string }) => r.id === id);
        storeUpdateRecess(recess?.side || 'Norte', id, updates);
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [showPanels, setShowPanels] = useState(true);
    const [minimizedPanels, setMinimizedPanels] = useState<Record<string, boolean>>({});
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isShiftHeld, setIsShiftHeld] = useState(false);
    const [tempMeasurement, setTempMeasurement] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null); // { start: {x,y}, end: {x,y} }
    const [tempWall, setTempWall] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null); // { start: {x,y}, end: {x,y} }
    const [draggingWallId, setDraggingWallId] = useState<string | null>(null);
    const [activeMeasurementId, setActiveMeasurementId] = useState<string | null>(null);
    const SNAP_VALUE = 40;

    const toggleMinimizePanel = (id: string) => {
        setMinimizedPanels(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Auto-fit logic when dimensions or expanded state changes
    useEffect(() => {
        if (isExpanded || isPrint) {
            const padding = isPrint ? 150 : 100;
            const availableW = 800 - padding;
            const availableH = 600 - padding;
            const houseW = (dimensions.width || 6) * BASE_SCALE;
            const houseH = (dimensions.length || 8) * BASE_SCALE;
            const autoZoom = Math.min(availableW / houseW, availableH / houseH, isExpanded ? 2.5 : 1.5);
            setZoom(autoZoom);
            setPan({ x: 0, y: 0 });
        } else {
            const padding = 120;
            const availableW = 800 - padding;
            const availableH = 600 - padding;
            const houseW = (dimensions.width || 6) * BASE_SCALE;
            const houseH = (dimensions.length || 8) * BASE_SCALE;
            const autoZoom = Math.min(availableW / houseW, availableH / houseH, 1.8);
            setZoom(autoZoom);
            setPan({ x: 0, y: 0 });
        }
    }, [isExpanded, isPrint, dimensions.width, dimensions.length]);

    // Wheel zoom (non-passive to prevent page scroll)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoom(prev => {
                const delta = e.deltaY < 0 ? 0.15 : -0.15;
                return Math.min(5, Math.max(0.2, prev + delta));
            });
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // Space/Shift key tracking
    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setIsSpaceHeld(true); }
            if (e.key === 'Shift') { setIsShiftHeld(true); }
        };
        const handleUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') { setIsSpaceHeld(false); }
            if (e.key === 'Shift') { setIsShiftHeld(false); }
        };
        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
    }, []);

    // Keyboard Delete Functionality
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (activeMeasurementId) {
                    useStore.getState().removeCustomMeasurement(activeMeasurementId);
                    setActiveMeasurementId(null);
                } else if (activeInteriorWallId) {
                    removeWall(activeInteriorWallId);
                    setActiveInteriorWallId(null);
                } else if (activeOpeningId) {
                    removeOpening(activeOpeningId);
                    setActiveOpeningId(null);
                } else if (activeRecessId) {
                    removeRecess(activeRecessId);
                    setActiveRecessId(null);
                } else if (activeId && !['Norte', 'Sur', 'Este', 'Oeste'].includes(activeId)) {
                    removeWall(activeId);
                    setActive(null, null);
                }
            }

            // --- UNDO / REDO KEYBOARD SHORTCUTS ---
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' || e.key === 'Z') {
                    e.preventDefault();
                    undo();
                } else if (e.key === 'y' || e.key === 'Y') {
                    e.preventDefault();
                    redo();
                } else if (e.key === 'c' || e.key === 'C') {
                    if (activeInteriorWallId) {
                        e.preventDefault();
                        copyWall(activeInteriorWallId);
                    }
                } else if (e.key === 'x' || e.key === 'X') {
                    if (activeInteriorWallId) {
                        e.preventDefault();
                        cutWall(activeInteriorWallId);
                        setActiveInteriorWallId(null);
                    }
                } else if (e.key === 'v' || e.key === 'V') {
                    e.preventDefault();
                    pasteWall();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeMeasurementId, activeInteriorWallId, activeOpeningId, activeRecessId, activeId, removeWall, setActive, removeOpening, removeRecess, undo, redo]);

    // Fixed Rectangle Logic
    const w = dimensions.width || 6;
    const l = dimensions.length || 8;
    const BASE_SCALE = 50;
    const recesses = (project as any)?.recesses || [];
    // selections is now destructured at the top

    const getSegments = (side: string) => {
        const total = (side === 'Norte' || side === 'Sur') ? w : l;
        let segments: Array<{ start: number; end: number }> = [{ start: 0, end: total }];

        // 1. Hide segments that are fully "recessed" (hideBase)
        recesses.filter((r: any) => r.side === side && r.hideBase).forEach((r: any) => {
            let next: Array<{ start: number; end: number }> = [];
            segments.forEach(s => {
                if (r.x >= s.end || r.x + r.width <= s.start) {
                    next.push(s);
                } else {
                    if (r.x > s.start) next.push({ start: s.start, end: r.x });
                    if (r.x + r.width < s.end) next.push({ start: r.x + r.width, end: s.end });
                }
            });
            segments = next;
        });

        // 2. Hide segments due to hideSideWall on adjacent corners
        recesses.filter((r: any) => r.hideSideWall).forEach((r: any) => {
            const isAtStart = r.x < 0.1;
            const isAtEnd = r.x + r.width > (r.side === 'Norte' || r.side === 'Sur' ? w : l) - 0.1;

            // Norte (Start=West, End=East)
            if (r.side === 'Norte') {
                if (isAtStart && side === 'Oeste') { // West End is North
                    segments = segments.map(s => s.end > l - r.depth ? (s.start >= l - r.depth ? null : { ...s, end: l - r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
                if (isAtEnd && side === 'Este') { // East Start is North
                    segments = segments.map(s => s.start < r.depth ? (s.end <= r.depth ? null : { ...s, start: r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
            }
            // Este (Start=North, End=South)
            if (r.side === 'Este') {
                if (isAtStart && side === 'Norte') { // North End is East
                    segments = segments.map(s => s.end > w - r.depth ? (s.start >= w - r.depth ? null : { ...s, end: w - r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
                if (isAtEnd && side === 'Sur') { // Sur Start is East
                    segments = segments.map(s => s.start < r.depth ? (s.end <= r.depth ? null : { ...s, start: r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
            }
            // Sur (Start=East, End=West)
            if (r.side === 'Sur') {
                if (isAtStart && side === 'Este') { // East End is South
                    segments = segments.map(s => s.end > l - r.depth ? (s.start >= l - r.depth ? null : { ...s, end: l - r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
                if (isAtEnd && side === 'Oeste') { // West Start is South
                    segments = segments.map(s => s.start < r.depth ? (s.end <= r.depth ? null : { ...s, start: r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
            }
            // Oeste (Start=South, End=North)
            if (r.side === 'Oeste') {
                if (isAtStart && side === 'Sur') { // Sur End is West
                    segments = segments.map(s => s.end > w - r.depth ? (s.start >= w - r.depth ? null : { ...s, end: w - r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
                if (isAtEnd && side === 'Norte') { // Norte Start is West
                    segments = segments.map(s => s.start < r.depth ? (s.end <= r.depth ? null : { ...s, start: r.depth }) : s).filter(Boolean) as Array<{ start: number; end: number }>;
                }
            }
        });

        return segments;
    };

    const geo = React.useMemo(() => {
        return calculateGeometry(dimensions, interiorWalls, facadeConfigs || {}, openings, project, selections);
    }, [dimensions, interiorWalls, openings, project, selections, facadeConfigs]);

    const getSVGCoords = (clientX: number, clientY: number, snap = false) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        let x = (clientX - rect.left - 400 - pan.x) / zoom;
        let y = (clientY - rect.top - 300 - pan.y) / zoom;

        if (snap) {
            const step = BASE_SCALE * 0.01; // 1cm snapping
            x = Math.round(x / step) * step;
            y = Math.round(y / step) * step;
        }
        return { x, y };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent interaction if clicking on UI buttons or inputs
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

        const isWallClick = (e.target as HTMLElement).getAttribute('data-wall-id');
        const isMeasureClick = (e.target as HTMLElement).getAttribute('data-measure-id');
        const isPanning = isSpaceHeld || e.button === 1;
        const isMeasuring = e.shiftKey;
        const startCoords = getSVGCoords(e.clientX, e.clientY, true);

        let localMeasurement: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
        let localWallData: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;

        if (isMeasureClick) {
            setActiveMeasurementId(isMeasureClick);
            return;
        }

        const isOpeningClick = (e.target as HTMLElement).closest('[data-opening-id]');
        if (isOpeningClick) {
            setActiveOpeningId((isOpeningClick as HTMLElement).getAttribute('data-opening-id'));
            return;
        }

        // Wall click = drag the wall
        if (isWallClick && !isMeasuring && !isPanning) {
            setDraggingWallId(isWallClick);
            setActiveInteriorWallId(isWallClick);
            setIsDragging(true);
        } else if ((e.target as HTMLElement).closest('svg')) {
            // Clear selections if clicking background
            if ((e.target as HTMLElement).id === 'canvas-bg' || (e.target as HTMLElement).tagName === 'svg') {
                setActiveInteriorWallId(null);
                setActiveOpeningId(null);
                setActiveRecessId(null);
                setActiveMeasurementId(null);
                setActive(null, null);
            }

            if (isPanning) {
                setIsDragging(true);
            } else if (isMeasuring) {
                localMeasurement = { start: startCoords, end: startCoords };
                setTempMeasurement(localMeasurement);
                setIsDragging(true);
            } else {
                // Default: click+drag draws a wall
                localWallData = { start: startCoords, end: startCoords };
                setTempWall(localWallData);
                setIsDragging(true);
            }
        } else {
            return;
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startPan = { ...pan };

        // Initial wall position for dragging
        let initialWallPos: { x: number; y: number } | null = null;
        if (isWallClick && !isMeasuring && !isPanning) {
            const wall = interiorWalls.find((w: any) => w.id === isWallClick);
            if (wall) initialWallPos = { x: (wall as any).x, y: (wall as any).y };
        }

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (isWallClick && initialWallPos) {
                // Dragging an existing wall
                const currentCoords = getSVGCoords(moveEvent.clientX, moveEvent.clientY, true);
                const startCoordsRef = getSVGCoords(startX, startY, true);
                const dx = (currentCoords.x - startCoordsRef.x) / BASE_SCALE;
                const dy = (currentCoords.y - startCoordsRef.y) / BASE_SCALE;

                updateInteriorWall(isWallClick, {
                    x: Math.max(0, Math.min(w, initialWallPos.x + dx)),
                    y: Math.max(0, Math.min(l, initialWallPos.y + dy))
                });
            } else if (isPanning) {
                // Panning
                setPan({
                    x: startPan.x + (moveEvent.clientX - startX),
                    y: startPan.y + (moveEvent.clientY - startY)
                });
            } else if (isMeasuring) {
                const currentCoords = getSVGCoords(moveEvent.clientX, moveEvent.clientY, true);
                const dx = Math.abs(currentCoords.x - startCoords.x);
                const dy = Math.abs(currentCoords.y - startCoords.y);

                const snappedEnd = { ...currentCoords };
                if (dy > dx) {
                    snappedEnd.x = startCoords.x;
                } else {
                    snappedEnd.y = startCoords.y;
                }

                localMeasurement = { start: startCoords, end: snappedEnd };
                setTempMeasurement(localMeasurement);
            } else {
                // Drawing a new wall
                const currentCoords = getSVGCoords(moveEvent.clientX, moveEvent.clientY, true);
                localWallData = { start: startCoords, end: currentCoords };
                setTempWall(localWallData);
            }
        };

        const onMouseUp = () => {
            setIsDragging(false);
            setDraggingWallId(null);

            if (isMeasuring && localMeasurement) {
                const distX = localMeasurement.end.x - localMeasurement.start.x;
                const distY = localMeasurement.end.y - localMeasurement.start.y;
                const dist = Math.sqrt(distX * distX + distY * distY) / BASE_SCALE;
                if (dist > 0.05) {
                    addCustomMeasurement(localMeasurement);
                }
                setTempMeasurement(null);
            }

            if (!isPanning && !isMeasuring && localWallData) {
                const dx = Math.abs(localWallData.end.x - localWallData.start.x);
                const dy = Math.abs(localWallData.end.y - localWallData.start.y);
                const isVertical = dy > dx;
                const len = (isVertical ? dy : dx) / BASE_SCALE;

                if (len > 0.1) {
                    addWall('interior', {
                        x: (Math.min(localWallData.start.x, localWallData.end.x) + w * BASE_SCALE / 2) / BASE_SCALE,
                        y: (Math.min(localWallData.start.y, localWallData.end.y) + l * BASE_SCALE / 2) / BASE_SCALE,
                        length: len,
                        isVertical
                    });
                }
                setTempWall(null);
                localWallData = null;
            }
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

    };

    const renderDimension = (x1: number, y1: number, x2: number, y2: number, label: string, color = "#94a3b8", isTotal = false) => {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Keep text right-side up
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;

        return (
            <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
                <rect
                    x={isTotal ? -30 : -20}
                    y={isTotal ? -28 : -25}
                    width={isTotal ? 60 : 40}
                    height={isTotal ? 20 : 16}
                    rx={isTotal ? 10 : 2}
                    fill={isTotal ? "#334155" : "white"}
                    stroke={isTotal ? "none" : color}
                    strokeWidth={1}
                />
                <text
                    textAnchor="middle"
                    dy={isTotal ? -14 : -13}
                    className={`${isTotal ? 'text-[11px] fill-white' : 'text-[10px] fill-slate-800'} font-black uppercase`}
                >
                    {label}m
                </text>
            </g>
        );
    };

    const renderWoodSpacers = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const pxLen = Math.sqrt(dx * dx + dy * dy);
        const lengthM = pxLen / BASE_SCALE;
        if (lengthM < 1.2) return null;

        const angle = Math.atan2(dy, dx);
        const stepPx = 1.2 * BASE_SCALE;
        const spacerWPx = 0.04 * BASE_SCALE;
        const thicknessPx = 0.09 * BASE_SCALE;
        const spacers: React.ReactNode[] = [];

        for (let d = stepPx; d < pxLen - 5; d += stepPx) {
            const tx = x1 + (dx / pxLen) * d;
            const ty = y1 + (dy / pxLen) * d;
            spacers.push(
                <rect
                    key={`w-${d}`}
                    x={-spacerWPx / 2} y={-thicknessPx / 2}
                    width={spacerWPx} height={thicknessPx}
                    fill="#d97706"
                    transform={`translate(${tx}, ${ty}) rotate(${angle * 180 / Math.PI})`}
                />
            );
        }
        return <g>{spacers}</g>;
    };

    const renderCardinalMarkers = () => {
        const offset = 100;
        const circleR = 25;
        return (
            <g className="pointer-events-none select-none">
                {/* Norte */}
                <g transform={`translate(0, ${-l * BASE_SCALE / 2 - offset})`}>
                    <circle r={circleR} fill="#1e293b" fillOpacity="0.9" stroke="#6366f1" strokeWidth="2" />
                    <text textAnchor="middle" dy="5" fontSize="16" fontWeight="900" fill="white">N</text>
                    <text textAnchor="middle" dy="45" fontSize="10" fontWeight="900" fill="#64748b" className="uppercase tracking-[0.2em] shadow-sm">NORTE</text>
                </g>
                {/* Sur */}
                <g transform={`translate(0, ${l * BASE_SCALE / 2 + offset})`}>
                    <circle r={circleR} fill="#1e293b" fillOpacity="0.9" stroke="#6366f1" strokeWidth="2" />
                    <text textAnchor="middle" dy="5" fontSize="16" fontWeight="900" fill="white">S</text>
                    <text textAnchor="middle" dy="45" fontSize="10" fontWeight="900" fill="#64748b" className="uppercase tracking-[0.2em] shadow-sm">SUR</text>
                </g>
                {/* Este */}
                <g transform={`translate(${w * BASE_SCALE / 2 + offset}, 0)`}>
                    <circle r={circleR} fill="#1e293b" fillOpacity="0.9" stroke="#6366f1" strokeWidth="2" />
                    <text textAnchor="middle" dy="5" fontSize="16" fontWeight="900" fill="white">E</text>
                    <text textAnchor="middle" dy="45" fontSize="10" fontWeight="900" fill="#64748b" className="uppercase tracking-[0.2em] shadow-sm">ESTE</text>
                </g>
                {/* Oeste */}
                <g transform={`translate(${-w * BASE_SCALE / 2 - offset}, 0)`}>
                    <circle r={circleR} fill="#1e293b" fillOpacity="0.9" stroke="#6366f1" strokeWidth="2" />
                    <text textAnchor="middle" dy="5" fontSize="16" fontWeight="900" fill="white">O</text>
                    <text textAnchor="middle" dy="45" fontSize="10" fontWeight="900" fill="#64748b" className="uppercase tracking-[0.2em] shadow-sm">OESTE</text>
                </g>
            </g>
        );
    };

    // Helper to render openings (doors/windows) on a wall
    const renderOpenings = (wallStart: { x: number; y: number }, wallEnd: { x: number; y: number }, wallSide: string, wallId: string) => {
        // Hide openings if facade is hidden
        if ((project as any)?.perimeterVisibility?.[wallSide] === false) return null;

        const wallOpenings = (openings || []).filter((o: any) => o.side === wallSide || o.side === wallId);
        const dx = wallEnd.x - wallStart.x;
        const dy = wallEnd.y - wallStart.y;
        const wallLen = Math.sqrt(dx * dx + dy * dy);

        return wallOpenings.map((o: any) => {
            const ratio = o.x / (wallLen / BASE_SCALE);
            const pos = {
                x: wallStart.x + dx * ratio,
                y: wallStart.y + dy * ratio
            };

            // Adjust depth for floating doors
            let depthOffset = 0;
            const rec = recesses.find((r: any) => r.side === wallSide && o.x >= r.x && o.x <= r.x + r.width);
            if (rec && rec.hideBase) {
                depthOffset = rec.depth * BASE_SCALE;
            }

            let finalX = pos.x;
            let finalY = pos.y;
            if (wallSide === 'Norte') finalY += depthOffset;
            if (wallSide === 'Sur') finalY -= depthOffset;
            if (wallSide === 'Este') finalX -= depthOffset;
            if (wallSide === 'Oeste') finalX += depthOffset;

            const openWidth = o.width * BASE_SCALE;
            const isDoor = o.type === 'door';
            const isActive = activeOpeningId === o.id;

            return (
                <g
                    key={o.id}
                    transform={`translate(${finalX}, ${finalY}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
                    onClick={(e) => { e.stopPropagation(); setActiveOpeningId(o.id); }}
                    className="cursor-pointer"
                    data-opening-id={o.id}
                >
                    <rect
                        x={0} y={-4.5} width={openWidth} height={9}
                        fill={isDoor ? "#fbbf24" : "#38bdf8"}
                        stroke={isActive ? "#4f46e5" : "white"}
                        strokeWidth={isActive ? 2 : 1}
                        opacity={isActive ? 1 : 0.9}
                    />
                    {isDoor && (
                        <>
                            {/* Door Leaf (opens inwards) */}
                            <line
                                x1={0} y1={0} x2={0} y2={openWidth}
                                stroke="#fbbf24" strokeWidth={2.5}
                                strokeLinecap="round"
                            />
                            {/* Dash Arc */}
                            <path
                                d={`M 0 ${openWidth} Q ${openWidth} ${openWidth} ${openWidth} 0`}
                                fill="none" stroke="#fbbf24" strokeWidth={1.5}
                                strokeDasharray="3 3"
                            />
                        </>
                    )}
                </g>
            );
        });
    };

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {/* TOOLBAR */}
            {!shouldHideUI && (
                <div className={`absolute ${isExpanded ? 'top-6' : 'top-3'} left-1/2 -translate-x-1/2 z-50 flex bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-xl gap-1.5 items-center`}>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        <PenTool size={12} className="text-slate-500" />
                        <span className="hidden sm:inline">Dibujar</span>
                        <span className="text-slate-300 mx-0.5">|</span>
                        <span className="text-[7px]">Shift = Medir</span>
                        <span className="text-slate-300 mx-0.5">|</span>
                        <span className="text-[7px]">Espacio = Paneo</span>
                    </div>
                    <div className="w-px h-5 bg-slate-200"></div>
                    <button
                        onClick={() => {
                            addWall('perimeter', { x1: w / 2 - 1.5, y1: -l / 2 - 1, x2: w / 2 + 1.5, y2: -l / 2 - 1, type: 'perimeter' });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all text-[10px] font-bold uppercase"
                    >
                        <Plus size={14} /> Muro
                    </button>
                    <button
                        onClick={() => addOpening('Norte', 'door')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all text-[10px] font-bold uppercase"
                    >
                        <Plus size={14} /> Puerta
                    </button>
                    <button
                        onClick={() => addOpening('Norte', 'window')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 transition-all text-[10px] font-bold uppercase"
                    >
                        <Plus size={14} /> Ventana
                    </button>
                    {customMeasurements?.length > 0 && (
                        <button onClick={clearCustomMeasurements} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all" title="Borrar medidas">
                            <Trash2 size={14} />
                        </button>
                    )}
                    <div className="w-px h-5 bg-slate-200"></div>
                    <button onClick={resetProject} className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-lg" title="Borrar Todo"><RotateCcw size={14} /></button>
                    <button
                        onClick={() => setShowPanels(!showPanels)}
                        className={`p-2 rounded-lg transition-all ${showPanels ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                        title={showPanels ? "Ocultar Paneles" : "Mostrar Paneles"}
                    >
                        <Layout size={14} />
                    </button>
                    {isShiftHeld && (
                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider px-1 flex items-center gap-1"><Ruler size={10} /> Midiendo</span>
                    )}
                </div>
            )}

            {/* CANVAS */}
            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 relative overflow-hidden"
                style={{ cursor: isSpaceHeld ? (isDragging ? 'grabbing' : 'grab') : 'crosshair' }}
                onMouseDown={handleMouseDown}
            >
                <style>
                    {`
                        .cursor-grab { cursor: grab !important; }
                        .cursor-grabbing { cursor: grabbing !important; }
                        /* Hand cursor hotspot at fingertips (12, 0) */
                        [style*="cursor: grab"] {
                            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='black' stroke='white' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5'/%3E%3Cpath d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v10'/%3E%3Cpath d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8'/%3E%3Cpath d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/%3E%3C/svg%3E") 12 0, grab !important;
                        }
                        [style*="cursor: grabbing"] {
                            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='black' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5'/%3E%3Cpath d='M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v10'/%3E%3Cpath d='M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8'/%3E%3Cpath d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/%3E%3C/svg%3E") 12 0, grabbing !important;
                        }
                    `}
                </style>
                <svg width="100%" height="100%" viewBox="0 0 800 600">
                    <defs>
                        <pattern id="grid" width={BASE_SCALE} height={BASE_SCALE} patternUnits="userSpaceOnUse">
                            <path d={`M ${BASE_SCALE} 0 L 0 0 0 ${BASE_SCALE}`} fill="none" stroke={isPrint ? "transparent" : "#e2e8f0"} strokeWidth="1" />
                        </pattern>
                    </defs>

                    {(() => {
                        const finalPan = pan;
                        const finalZoom = zoom;

                        return (
                            <g transform={`translate(${400 + finalPan.x}, ${300 + finalPan.y}) scale(${finalZoom})`}>
                                {!isPrint && <rect id="canvas-bg" x={-3000} y={-3000} width={6000} height={6000} fill="url(#grid)" />}
                                {isPrint && <rect x={-w * BASE_SCALE / 2} y={-l * BASE_SCALE / 2} width={w * BASE_SCALE} height={l * BASE_SCALE} fill="white" />}

                                {renderCardinalMarkers()}


                                {/* BASE HOUSE RECTANGLE WITH RECESSES (L and C Shapes) */}
                                <g>
                                    {/* Main House Fill and Perimeter Lines */}
                                    <rect
                                        x={-w * BASE_SCALE / 2}
                                        y={-l * BASE_SCALE / 2}
                                        width={w * BASE_SCALE}
                                        height={l * BASE_SCALE}
                                        fill="white"
                                        stroke="none"
                                    />

                                    {/* Render segments and labels for the 4 main sides */}
                                    {['Norte', 'Sur', 'Este', 'Oeste'].map(side => {
                                        const segments = getSegments(side);
                                        return segments.map((seg, i) => {
                                            let x1: number, y1: number, x2: number, y2: number, dx = 0, dy = 0;
                                            const startOffset = seg.start * BASE_SCALE;
                                            const endOffset = seg.end * BASE_SCALE;

                                            if (side === 'Norte') {
                                                x1 = -w * BASE_SCALE / 2 + startOffset; y1 = -l * BASE_SCALE / 2;
                                                x2 = -w * BASE_SCALE / 2 + endOffset; y2 = -l * BASE_SCALE / 2;
                                                dy = -25;
                                            } else if (side === 'Sur') {
                                                x1 = w * BASE_SCALE / 2 - startOffset; y1 = l * BASE_SCALE / 2;
                                                x2 = w * BASE_SCALE / 2 - endOffset; y2 = l * BASE_SCALE / 2;
                                                dy = 35;
                                            } else if (side === 'Este') {
                                                x1 = w * BASE_SCALE / 2; y1 = -l * BASE_SCALE / 2 + startOffset;
                                                x2 = w * BASE_SCALE / 2; y2 = -l * BASE_SCALE / 2 + endOffset;
                                                dx = 35;
                                            } else { // Oeste
                                                x1 = -w * BASE_SCALE / 2; y1 = l * BASE_SCALE / 2 - startOffset;
                                                x2 = -w * BASE_SCALE / 2; y2 = l * BASE_SCALE / 2 - endOffset;
                                                dx = -35;
                                            }

                                            const isVisible = (project as any)?.perimeterVisibility?.[side] !== false;

                                            return (
                                                <g key={`${side}-${i}`} opacity={isVisible ? 1 : 0.2}>
                                                    <line
                                                        x1={x1} y1={y1} x2={x2} y2={y2}
                                                        stroke={isVisible ? "#991b1b" : "#94a3b8"}
                                                        strokeWidth={isVisible ? 4.5 : 2}
                                                        strokeDasharray={isVisible ? "none" : "8,8"}
                                                        strokeLinecap="butt"
                                                    />
                                                    {isVisible && renderWoodSpacers(x1, y1, x2, y2)}
                                                    {isVisible && renderDimension(x1 + dx, y1 + dy, x2 + dx, y2 + dy, (seg.end - seg.start).toFixed(2), "#991b1b")}
                                                </g>
                                            );
                                        });
                                    })}

                                    {/* Render Recesses (The holes that make L/C shapes) */}
                                    {recesses.map((r: any) => {
                                        const side = r.side;
                                        let rx = 0, ry = 0;
                                        let rw = (side === 'Norte' || side === 'Sur') ? r.width * BASE_SCALE : r.depth * BASE_SCALE;
                                        let rh = (side === 'Norte' || side === 'Sur') ? r.depth * BASE_SCALE : r.width * BASE_SCALE;

                                        if (side === 'Sur') {
                                            rx = w * BASE_SCALE / 2 - (r.x + r.width) * BASE_SCALE;
                                            ry = l * BASE_SCALE / 2 - r.depth * BASE_SCALE;
                                        } else if (side === 'Norte') {
                                            rx = -w * BASE_SCALE / 2 + r.x * BASE_SCALE;
                                            ry = -l * BASE_SCALE / 2;
                                        } else if (side === 'Este') {
                                            rx = w * BASE_SCALE / 2 - r.depth * BASE_SCALE;
                                            ry = -l * BASE_SCALE / 2 + r.x * BASE_SCALE;
                                        } else if (side === 'Oeste') {
                                            rx = -w * BASE_SCALE / 2;
                                            ry = l * BASE_SCALE / 2 - (r.x + r.width) * BASE_SCALE;
                                        }

                                        const isSideVisible = (project as any)?.perimeterVisibility?.[side] !== false;
                                        const isActive = activeRecessId === r.id;

                                        return (
                                            <g key={r.id} opacity={isSideVisible ? 1 : 0.2} onClick={(e) => { e.stopPropagation(); setActiveRecessId(r.id); }}>
                                                {/* 1. "Cutout" - fill matches background and covers the main border if hideBase is true */}
                                                <rect
                                                    x={rx} y={ry}
                                                    width={rw} height={rh}
                                                    fill={isActive ? "#eff6ff" : "#f8fafc"}
                                                    stroke={isActive ? "#2563eb" : (r.hideBase ? "none" : "#991b1b")}
                                                    strokeWidth={isActive ? 6 : 4.5}
                                                />

                                                {/* 2. If hideBase, we must manually draw the internal walls of the recess */}
                                                {r.hideBase && (
                                                    <g>
                                                        {/* Clear the perimeter segment */}
                                                        <rect
                                                            x={side === 'Norte' || side === 'Sur' ? rx : (side === 'Este' ? rx + rw - 3 : rx - 3)}
                                                            y={side === 'Este' || side === 'Oeste' ? ry : (side === 'Sur' ? ry + rh - 3 : ry - 3)}
                                                            width={side === 'Norte' || side === 'Sur' ? rw : 6}
                                                            height={side === 'Este' || side === 'Oeste' ? rh : 6}
                                                            fill="#f8fafc"
                                                        />
                                                        {/* Internal Walls */}
                                                        {side === 'Norte' && (
                                                            <g>
                                                                <polyline points={`${rx},${ry} ${rx},${ry + rh} ${rx + rw},${ry + rh} ${rx + rw},${ry}`} fill="none" stroke="#991b1b" strokeWidth={4.5} strokeLinejoin="miter" />
                                                                {renderWoodSpacers(rx, ry, rx, ry + rh)}
                                                                {renderWoodSpacers(rx, ry + rh, rx + rw, ry + rh)}
                                                                {renderWoodSpacers(rx + rw, ry + rh, rx + rw, ry)}
                                                                {renderDimension(rx, ry, rx, ry + rh, r.depth.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx, ry + rh, rx + rw, ry + rh, r.width.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx + rw, ry + rh, rx + rw, ry, r.depth.toFixed(2), "#991b1b")}
                                                            </g>
                                                        )}
                                                        {side === 'Sur' && (
                                                            <g>
                                                                <polyline points={`${rx},${ry + rh} ${rx},${ry} ${rx + rw},${ry} ${rx + rw},${ry + rh}`} fill="none" stroke="#991b1b" strokeWidth={4.5} strokeLinejoin="miter" />
                                                                {renderWoodSpacers(rx, ry + rh, rx, ry)}
                                                                {renderWoodSpacers(rx, ry, rx + rw, ry)}
                                                                {renderWoodSpacers(rx + rw, ry, rx + rw, ry + rh)}
                                                                {renderDimension(rx, ry + rh, rx, ry, r.depth.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx, ry, rx + rw, ry, r.width.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx + rw, ry, rx + rw, ry + rh, r.depth.toFixed(2), "#991b1b")}
                                                            </g>
                                                        )}
                                                        {side === 'Este' && (
                                                            <g>
                                                                <polyline points={`${rx + rw},${ry} ${rx},${ry} ${rx},${ry + rh} ${rx + rw},${ry + rh}`} fill="none" stroke="#991b1b" strokeWidth={4.5} strokeLinejoin="miter" />
                                                                {renderWoodSpacers(rx + rw, ry, rx, ry)}
                                                                {renderWoodSpacers(rx, ry, rx, ry + rh)}
                                                                {renderWoodSpacers(rx, ry + rh, rx + rw, ry + rh)}
                                                                {renderDimension(rx + rw, ry, rx, ry, r.depth.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx, ry, rx, ry + rh, r.width.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx, ry + rh, rx + rw, ry + rh, r.depth.toFixed(2), "#991b1b")}
                                                            </g>
                                                        )}
                                                        {side === 'Oeste' && (
                                                            <g>
                                                                <polyline points={`${rx},${ry} ${rx + rw},${ry} ${rx + rw},${ry + rh} ${rx},${ry + rh}`} fill="none" stroke="#991b1b" strokeWidth={4.5} strokeLinejoin="miter" />
                                                                {renderWoodSpacers(rx, ry, rx + rw, ry)}
                                                                {renderWoodSpacers(rx + rw, ry, rx + rw, ry + rh)}
                                                                {renderWoodSpacers(rx + rw, ry + rh, rx, ry + rh)}
                                                                {renderDimension(rx, ry, rx + rw, ry, r.depth.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx + rw, ry, rx + rw, ry + rh, r.width.toFixed(2), "#991b1b")}
                                                                {renderDimension(rx + rw, ry + rh, rx, ry + rh, r.depth.toFixed(2), "#991b1b")}
                                                            </g>
                                                        )}

                                                        {/* 3. Hide Adjacent Corner Wall Segment if enabled */}
                                                        {r.hideSideWall && (
                                                            <g>
                                                                {(() => {
                                                                    let srx = 0, sry = 0, srw = 0, srh = 0;
                                                                    const isAtStart = r.x <= 0.1;
                                                                    const isAtEnd = r.x + r.width >= (side === 'Norte' || side === 'Sur' ? dimensions.width : dimensions.length) - 0.1;

                                                                    if (side === 'Sur' && isAtStart) { // Bottom-Right Corner (Sur Start)
                                                                        srx = w * BASE_SCALE / 2 - 6;
                                                                        sry = l * BASE_SCALE / 2 - r.depth * BASE_SCALE - 6;
                                                                        srw = 12; srh = r.depth * BASE_SCALE + 12;
                                                                    } else if (side === 'Sur' && isAtEnd) { // Bottom-Left Corner (Sur End)
                                                                        srx = -w * BASE_SCALE / 2 - 6;
                                                                        sry = l * BASE_SCALE / 2 - r.depth * BASE_SCALE - 6;
                                                                        srw = 12; srh = r.depth * BASE_SCALE + 12;
                                                                    } else if (side === 'Norte' && isAtStart) { // Top-Left Corner (Norte Start)
                                                                        srx = -w * BASE_SCALE / 2 - 6;
                                                                        sry = -l * BASE_SCALE / 2 - 6;
                                                                        srw = 12; srh = r.depth * BASE_SCALE + 12;
                                                                    } else if (side === 'Norte' && isAtEnd) { // Top-Right Corner (Norte End)
                                                                        srx = w * BASE_SCALE / 2 - 6;
                                                                        sry = -l * BASE_SCALE / 2 - 6;
                                                                        srw = 12; srh = r.depth * BASE_SCALE + 12;
                                                                    } else if (side === 'Este' && isAtStart) { // Top-Right Corner (Este Start)
                                                                        srx = w * BASE_SCALE / 2 - r.depth * BASE_SCALE - 6;
                                                                        sry = -l * BASE_SCALE / 2 - 6;
                                                                        srw = r.depth * BASE_SCALE + 12; srh = 12;
                                                                    } else if (side === 'Este' && isAtEnd) { // Bottom-Right Corner (Este End)
                                                                        srx = w * BASE_SCALE / 2 - r.depth * BASE_SCALE - 6;
                                                                        sry = l * BASE_SCALE / 2 - 6;
                                                                        srw = r.depth * BASE_SCALE + 12; srh = 12;
                                                                    } else if (side === 'Oeste' && isAtStart) { // Bottom-Left Corner (Oeste Start)
                                                                        srx = -w * BASE_SCALE / 2 - 6;
                                                                        sry = l * BASE_SCALE / 2 - r.depth * BASE_SCALE - 6;
                                                                        srw = r.depth * BASE_SCALE + 12; srh = 12;
                                                                    } else if (side === 'Oeste' && isAtEnd) { // Top-Left Corner (Oeste End)
                                                                        srx = -w * BASE_SCALE / 2 - 6;
                                                                        sry = -l * BASE_SCALE / 2 - 6;
                                                                        srw = r.depth * BASE_SCALE + 12; srh = 12;
                                                                    }

                                                                    return srh > 0 ? <rect x={srx} y={sry} width={srw} height={srh} fill="#f8fafc" /> : null;
                                                                })()}
                                                            </g>
                                                        )}

                                                        {/* Delete Button on Recess */}
                                                        <g transform={`translate(${rx + rw / 2}, ${ry + rh / 2})`} onClick={(e) => { e.stopPropagation(); removeRecess(r.id); }}>
                                                            <circle r="15" fill="#ef4444" className="cursor-pointer hover:fill-red-600 transition-colors" />
                                                            <path d="M-5,-5 L5,5 M-5,5 L5,-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                                        </g>
                                                    </g>
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* Render openings on base walls */}
                                    {renderOpenings({ x: -w * BASE_SCALE / 2, y: -l * BASE_SCALE / 2 }, { x: w * BASE_SCALE / 2, y: -l * BASE_SCALE / 2 }, 'Norte', 'Norte')}
                                    {renderOpenings({ x: w * BASE_SCALE / 2, y: l * BASE_SCALE / 2 }, { x: -w * BASE_SCALE / 2, y: l * BASE_SCALE / 2 }, 'Sur', 'Sur')}
                                    {renderOpenings({ x: w * BASE_SCALE / 2, y: -l * BASE_SCALE / 2 }, { x: w * BASE_SCALE / 2, y: l * BASE_SCALE / 2 }, 'Este', 'Este')}
                                    {renderOpenings({ x: -w * BASE_SCALE / 2, y: l * BASE_SCALE / 2 }, { x: -w * BASE_SCALE / 2, y: -l * BASE_SCALE / 2 }, 'Oeste', 'Oeste')}
                                </g>

                                {/* PERIMETER MEASUREMENTS REMOVED (Handled by segments) */}

                                {/* DYNAMIC PERIMETER WALLS (Extra walls outside) */}
                                {perimeterWalls && perimeterWalls.filter((wall: any) => !['Norte', 'Sur', 'Este', 'Oeste'].includes(wall.id)).map((wall: any) => {
                                    const isActive = activeId === wall.id;
                                    const x1 = (wall.x1 - w / 2) * BASE_SCALE;
                                    const y1 = (wall.y1 - l / 2) * BASE_SCALE;
                                    const x2 = (wall.x2 - w / 2) * BASE_SCALE;
                                    const y2 = (wall.y2 - l / 2) * BASE_SCALE;
                                    const length = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));

                                    return (
                                        <g key={wall.id} onClick={(e) => { e.stopPropagation(); setActive(wall.id, 'perimeter'); }}>
                                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isActive ? "#06b6d4" : "#991b1b"} strokeWidth={12} strokeLinecap="butt" className="cursor-pointer" />
                                            {renderWoodSpacers(x1, y1, x2, y2)}
                                            {renderDimension(x1, y1 - 15, x2, y2 - 15, length.toFixed(2), isActive ? "#06b6d4" : "#991b1b")}
                                            {renderOpenings({ x: x1, y: y1 }, { x: x2, y: y2 }, wall.id, wall.id)}
                                        </g>
                                    )
                                })}

                                {/* INTERIOR WALLS */}
                                {interiorWalls && interiorWalls.map((wall: any) => {
                                    const isActive = activeInteriorWallId === wall.id;
                                    const startX = wall.x !== undefined ? (wall.x - w / 2) * BASE_SCALE : (wall.x1 - w / 2) * BASE_SCALE;
                                    const startY = wall.y !== undefined ? (wall.y - l / 2) * BASE_SCALE : (wall.y1 - l / 2) * BASE_SCALE;
                                    const endX = wall.length !== undefined ? (wall.isVertical ? startX : startX + wall.length * BASE_SCALE) : (wall.x2 - w / 2) * BASE_SCALE;
                                    const endY = wall.length !== undefined ? (wall.isVertical ? startY + wall.length * BASE_SCALE : startY) : (wall.y2 - l / 2) * BASE_SCALE;
                                    const length = wall.length !== undefined ? wall.length : Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / BASE_SCALE;

                                    const isDraggingThis = draggingWallId === wall.id;

                                    return (
                                        <g key={wall.id}
                                            onClick={(e) => { e.stopPropagation(); setActiveInteriorWallId(wall.id); }}
                                            className="group"
                                        >
                                            <line
                                                x1={startX} y1={startY} x2={endX} y2={endY}
                                                stroke={isActive ? (isDraggingThis ? "#22d3ee" : "#06b6d4") : "#991b1b"}
                                                strokeWidth={isActive ? 8 : 4.5}
                                                strokeLinecap="butt"
                                                className="cursor-move"
                                                data-wall-id={wall.id}
                                            />
                                            {renderWoodSpacers(startX, startY, endX, endY)}
                                            {renderDimension(startX, startY - (wall.isVertical ? 0 : 20), endX, endY - (wall.isVertical ? 0 : 20), Number(length).toFixed(2), isActive ? "#06b6d4" : "#991b1b")}

                                            {/* Visual Guidelines to exterior walls when active */}
                                            {isActive && (
                                                <g className="pointer-events-none opacity-40">
                                                    {wall.isVertical ? (
                                                        <>
                                                            {/* Distance to North */}
                                                            {renderDimension(startX, -l * BASE_SCALE / 2, startX, startY, (wall.y).toFixed(2), "#06b6d4")}
                                                            <line x1={startX} y1={-l * BASE_SCALE / 2} x2={startX} y2={startY} stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 4" />
                                                            {/* Distance to South */}
                                                            {renderDimension(startX, endY, startX, l * BASE_SCALE / 2, (l - wall.y - wall.length).toFixed(2), "#06b6d4")}
                                                            <line x1={startX} y1={endY} x2={startX} y2={l * BASE_SCALE / 2} stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 4" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* Distance to West */}
                                                            {renderDimension(-w * BASE_SCALE / 2, startY, startX, startY, (wall.x).toFixed(2), "#06b6d4")}
                                                            <line x1={-w * BASE_SCALE / 2} y1={startY} x2={startX} y2={startY} stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 4" />
                                                            {/* Distance to East */}
                                                            {renderDimension(endX, startY, w * BASE_SCALE / 2, startY, (w - wall.x - wall.length).toFixed(2), "#06b6d4")}
                                                            <line x1={endX} y1={startY} x2={w * BASE_SCALE / 2} y2={startY} stroke="#06b6d4" strokeWidth="1" strokeDasharray="4 4" />
                                                        </>
                                                    )}
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* MEASUREMENTS OVERLAY (Rendered last to be on top) */}
                                <g className="measurements-overlay">
                                    {tempWall && (
                                        <g className="pointer-events-none">
                                            {(() => {
                                                const dx = Math.abs(tempWall.end.x - tempWall.start.x);
                                                const dy = Math.abs(tempWall.end.y - tempWall.start.y);
                                                const isVertical = dy > dx;
                                                const x1 = tempWall.start.x;
                                                const y1 = tempWall.start.y;
                                                const x2 = isVertical ? x1 : tempWall.end.x;
                                                const y2 = isVertical ? tempWall.end.y : y1;
                                                const len = Math.abs(isVertical ? (y2 - y1) : (x2 - x1)) / BASE_SCALE;
                                                return (
                                                    <>
                                                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f43f5e" strokeWidth="6" strokeDasharray="8 4" opacity="0.6" />
                                                        {renderDimension(x1, y1 - 20, x2, y2 - 20, len.toFixed(2), "#f43f5e")}
                                                    </>
                                                );
                                            })()}
                                        </g>
                                    )}

                                    {/* Crosshair when measuring or drawing */}
                                    {!isSpaceHeld && !tempMeasurement && !tempWall && (
                                        <CrosshairOverlay getSVGCoords={getSVGCoords} BASE_SCALE={BASE_SCALE} />
                                    )}
                                    {(customMeasurements || []).map((m: any) => {
                                        const isActive = activeMeasurementId === m.id;
                                        return (
                                            <g key={m.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveMeasurementId(m.id); }}>
                                                <line
                                                    x1={m.start.x} y1={m.start.y}
                                                    x2={m.end.x} y2={m.end.y}
                                                    stroke={isActive ? "#4f46e5" : "#6366f1"}
                                                    strokeWidth={isActive ? 6 : 2.5}
                                                    strokeDasharray={isActive ? "none" : "5 3"}
                                                    data-measure-id={m.id}
                                                />
                                                <circle cx={m.start.x} cy={m.start.y} r={isActive ? 5 : 3.5} fill={isActive ? "#4f46e5" : "#6366f1"} data-measure-id={m.id} />
                                                <circle cx={m.end.x} cy={m.end.y} r={isActive ? 5 : 3.5} fill={isActive ? "#4f46e5" : "#6366f1"} data-measure-id={m.id} />
                                                {(() => {
                                                    const dist = Math.sqrt(Math.pow(m.end.x - m.start.x, 2) + Math.pow(m.end.y - m.start.y, 2)) / BASE_SCALE;
                                                    return renderDimension(m.start.x, m.start.y, m.end.x, m.end.y, `${dist.toFixed(2)}`, isActive ? "#4f46e5" : "#6366f1");
                                                })()}
                                            </g>
                                        );
                                    })}

                                    {tempMeasurement && (
                                        <g className="pointer-events-none">
                                            <line
                                                x1={tempMeasurement.start.x} y1={tempMeasurement.start.y}
                                                x2={tempMeasurement.end.x} y2={tempMeasurement.end.y}
                                                stroke="#6366f1" strokeWidth="2.5" strokeDasharray="5 3"
                                                opacity="0.8"
                                            />
                                            <circle cx={tempMeasurement.start.x} cy={tempMeasurement.start.y} r="3.5" fill="#6366f1" />
                                            <circle cx={tempMeasurement.end.x} cy={tempMeasurement.end.y} r="3.5" fill="#6366f1" />
                                            {(() => {
                                                const dist = Math.sqrt(Math.pow(tempMeasurement.end.x - tempMeasurement.start.x, 2) + Math.pow(tempMeasurement.end.y - tempMeasurement.start.y, 2)) / BASE_SCALE;
                                                if (dist < 0.05) return null;
                                                return renderDimension(tempMeasurement.start.x, tempMeasurement.start.y, tempMeasurement.end.x, tempMeasurement.end.y, `${dist.toFixed(2)}`, "#6366f1");
                                            })()}
                                        </g>
                                    )}
                                </g>
                            </g>
                        );
                    })()}
                </svg>

                {/* ZOOM & NAVIGATION CONTROLS */}
                {!shouldHideUI && (
                    <div className={`absolute ${isExpanded ? 'bottom-8 left-8' : 'bottom-4 left-4'} z-[70] flex flex-col gap-2 transition-all duration-500`}>
                        <div className="bg-white/95 backdrop-blur-xl p-1 rounded-xl border border-slate-200 shadow-lg flex flex-col gap-0.5">
                            <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all active:scale-90" title="Acercar"><Plus size={16} /></button>
                            <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all active:scale-90" title="Alejar"><Minus size={16} /></button>
                        </div>
                        <button
                            onClick={() => {
                                const padding = 100;
                                const availableW = 800 - padding;
                                const availableH = 600 - padding;
                                const houseW = w * BASE_SCALE;
                                const houseH = l * BASE_SCALE;
                                const autoZoom = Math.min(availableW / houseW, availableH / houseH, isExpanded ? 2.5 : 1.5);
                                setZoom(autoZoom);
                                setPan({ x: 0, y: 0 });
                            }}
                            className="bg-slate-900 p-2 hover:bg-slate-800 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center border border-white/10"
                            title="Ajustar a Pantalla"
                        ><Repeat size={14} /></button>
                        <div className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-xl text-center tracking-widest shadow-lg border border-white/10">
                            {Math.round(zoom * 100)}%
                        </div>
                        <div className="bg-white/95 backdrop-blur-xl p-1 rounded-xl border border-slate-200 shadow-lg flex gap-0.5 items-center">
                            <button onClick={() => undo()} disabled={historyIndex <= 0} className={`p-2 rounded-lg transition-all active:scale-90 ${historyIndex > 0 ? 'hover:bg-amber-50 text-amber-600' : 'text-slate-200 cursor-not-allowed'}`} title="Deshacer (Ctrl+Z)"><Undo2 size={16} /></button>
                            <button onClick={() => redo()} disabled={historyIndex >= history.length - 1} className={`p-2 rounded-lg transition-all active:scale-90 ${historyIndex < history.length - 1 ? 'hover:bg-amber-50 text-amber-600' : 'text-slate-200 cursor-not-allowed'}`} title="Rehacer (Ctrl+Y)"><Redo2 size={16} /></button>
                        </div>
                    </div>
                )}

                {/* FLOATING EDIT PANELS */}
                {!shouldHideUI && showPanels && (
                    <div className="absolute top-16 right-3 z-[60] flex flex-col gap-3 pointer-events-auto max-h-[calc(100%-80px)] overflow-y-auto custom-scrollbar pr-1">
                        {/* Custom Measurement Edit */}
                        {activeMeasurementId && (
                            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl border border-indigo-200 shadow-lg w-56 relative">
                                <button onClick={() => setActiveMeasurementId(null)} className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 transition-colors"><X size={12} /></button>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Medida</h3>
                                    <button onClick={() => { useStore.getState().removeCustomMeasurement(activeMeasurementId); setActiveMeasurementId(null); }} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                </div>
                                {(() => {
                                    const m = customMeasurements.find((m: any) => m.id === activeMeasurementId);
                                    if (!m) return null;
                                    const currentDist = Math.sqrt(Math.pow(m.end.x - m.start.x, 2) + Math.pow(m.end.y - m.start.y, 2)) / BASE_SCALE;

                                    const updateLength = (newLen: number) => {
                                        if (newLen <= 0) return;
                                        const dx = m.end.x - m.start.x;
                                        const dy = m.end.y - m.start.y;
                                        const angle = Math.atan2(dy, dx);
                                        const newEnd = {
                                            x: m.start.x + Math.cos(angle) * (newLen * BASE_SCALE),
                                            y: m.start.y + Math.sin(angle) * (newLen * BASE_SCALE)
                                        };
                                        useStore.getState().updateCustomMeasurement(m.id, { end: newEnd });
                                    };

                                    return (
                                        <div className="space-y-4">
                                            <RangeControl
                                                label="Largo Total"
                                                value={currentDist}
                                                onChange={updateLength}
                                                min={0.1} max={20} step={0.01} unit=" m"
                                            />
                                            <div className="text-[9px] text-slate-400 italic px-2">
                                                Ajusta el largo manteniendo el angulo original.
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Interior Wall Edit */}
                        {activeInteriorWallId && (
                            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl border border-cyan-200 shadow-lg w-56 relative">
                                <button onClick={() => setActiveInteriorWallId(null)} className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 transition-colors"><X size={12} /></button>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">Tabique</h3>
                                    <button onClick={() => removeWall(activeInteriorWallId)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                </div>
                                {(() => {
                                    const wall = interiorWalls.find((w: any) => w.id === activeInteriorWallId);
                                    if (!wall) return null;
                                    return (
                                        <div className="space-y-2">
                                            <RangeControl label="Largo" value={(wall as any).length || 0} onChange={(v) => updateInteriorWall(activeInteriorWallId, { length: v })} min={0.5} max={15} step={0.1} unit="m" />
                                            <RangeControl label="Pos. X" value={(wall as any).x || 0} onChange={(v) => updateInteriorWall(activeInteriorWallId, { x: v })} min={0} max={15} step={0.1} unit="m" />
                                            <RangeControl label="Pos. Y" value={(wall as any).y || 0} onChange={(v) => updateInteriorWall(activeInteriorWallId, { y: v })} min={0} max={20} step={0.1} unit="m" />
                                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                                <button
                                                    onClick={() => updateInteriorWall(activeInteriorWallId, { isVertical: !(wall as any).isVertical })}
                                                    className="py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                                >Rotar</button>
                                                <button
                                                    onClick={() => duplicateWall(activeInteriorWallId)}
                                                    className="py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                                >Duplicar</button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Opening Edit */}
                        {activeOpeningId && (
                            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl border border-orange-200 shadow-lg w-56 relative">
                                <button onClick={() => setActiveOpeningId(null)} className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 transition-colors"><X size={12} /></button>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Abertura</h3>
                                    <button onClick={() => removeOpening(activeOpeningId)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                </div>
                                {(() => {
                                    const o = openings.find((o: any) => o.id === activeOpeningId);
                                    if (!o) return null;
                                    return (
                                        <div className="space-y-2">
                                            <RangeControl label="Ancho" value={(o as any).width || ((o as any).type === 'door' ? 0.9 : 1.2)} onChange={(v) => updateOpening(activeOpeningId, { width: v })} min={0.4} max={5} step={0.01} unit="m" />
                                            <RangeControl label="Alto" value={(o as any).height || ((o as any).type === 'door' ? 2.1 : 1.2)} onChange={(v) => updateOpening(activeOpeningId, { height: v })} min={0.4} max={3} step={0.01} unit="m" />
                                            <RangeControl label="Pos. X" value={(o as any).x || 0} onChange={(v) => updateOpening(activeOpeningId, { x: v })} min={0} max={15} step={0.01} unit="m" />
                                            <div className="text-[9px] text-slate-400 italic pt-1">
                                                {(o as any).type === 'door' ? 'Puerta' : 'Ventana'} — {(o as any).side}
                                            </div>
                                            <button
                                                onClick={() => addOpening((o as any).side, (o as any).type)}
                                                className="w-full py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all mt-1"
                                            >Duplicar</button>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Perimeter Wall Edit (Extra walls) */}
                        {activeId && !['Norte', 'Sur', 'Este', 'Oeste'].includes(activeId) && (
                            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl border border-indigo-200 shadow-lg w-56 relative">
                                <button onClick={() => setActive(null, null)} className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 transition-colors"><X size={12} /></button>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Muro Exterior</h3>
                                    <button onClick={() => removeWall(activeId)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                </div>
                                {(() => {
                                    const wall = perimeterWalls.find((w: any) => w.id === activeId);
                                    if (!wall) return null;
                                    return (
                                        <div className="space-y-2">
                                            <RangeControl label="X Ini" value={(wall as any).x1} onChange={(v) => updateWall(activeId, { x1: v })} min={-20} max={20} step={0.1} unit="m" />
                                            <RangeControl label="Y Ini" value={(wall as any).y1} onChange={(v) => updateWall(activeId, { y1: v })} min={-20} max={20} step={0.1} unit="m" />
                                            <RangeControl label="X Fin" value={(wall as any).x2} onChange={(v) => updateWall(activeId, { x2: v })} min={-20} max={20} step={0.1} unit="m" />
                                            <RangeControl label="Y Fin" value={(wall as any).y2} onChange={(v) => updateWall(activeId, { y2: v })} min={-20} max={20} step={0.1} unit="m" />
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {recesses.map((r: any) => {
                            const isNS = r.side === 'Norte' || r.side === 'Sur';
                            const maxW = isNS ? dimensions.width : dimensions.length;
                            const maxD = isNS ? dimensions.length : dimensions.width;
                            const isMinimized = minimizedPanels[r.id];

                            return (
                                <div key={r.id} className="bg-white/95 backdrop-blur-xl rounded-xl border border-amber-200 shadow-lg w-56 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/50">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleMinimizePanel(r.id)}>
                                            {isMinimized ? <ChevronDown size={12} className="text-amber-600" /> : <ChevronUp size={12} className="text-amber-600" />}
                                            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Forma ({r.side})</h3>
                                        </div>
                                        <button onClick={() => removeRecess(r.id)} className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={12} /></button>
                                    </div>
                                    {!isMinimized && (
                                        <div className="p-4 pt-2 space-y-2">
                                            <RangeControl label="Posicion" value={r.x} onChange={(v) => updateRecess(r.id, { x: v })} min={0} max={maxW - r.width} step={0.1} unit="m" />
                                            <RangeControl label="Ancho" value={r.width} onChange={(v) => updateRecess(r.id, { width: v })} min={0.5} max={maxW} step={0.1} unit="m" />
                                            <RangeControl label="Fondo" value={r.depth} onChange={(v) => updateRecess(r.id, { depth: v })} min={0.5} max={maxD * 0.8} step={0.1} unit="m" />
                                            <div className="flex justify-between items-center p-1.5 bg-slate-50 rounded-lg">
                                                <span className="text-[9px] font-black text-slate-500 uppercase">Muro Base</span>
                                                <button onClick={() => updateRecess(r.id, { hideBase: !r.hideBase })} className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all ${r.hideBase ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {r.hideBase ? 'Eliminado' : 'Visible'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* STATS OVERLAY */}
            {!shouldHideUI && (
                <div className="absolute bottom-4 right-4 z-50 pointer-events-none">
                    <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 shadow-lg flex items-center gap-3">
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-white">{geo.areaPiso.toFixed(1)}</span>
                            <span className="text-[9px] font-bold text-cyan-400">m2</span>
                        </div>
                        <div className="w-px h-4 bg-white/10"></div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-white">{geo.totalPaneles}</span>
                            <span className="text-[9px] font-bold text-amber-400">pan</span>
                        </div>
                        <div className="w-px h-4 bg-white/10"></div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-white">{geo.perimExt.toFixed(1)}</span>
                            <span className="text-[9px] font-bold text-emerald-400">ml</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloorPlan;
