"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Plus, Trash2, RotateCcw, Download,
  Lightbulb, Shield, X, Home, Ruler, DoorOpen, Layers, Wrench
} from 'lucide-react';
import {
  analizarConRetry, ERROR_MESSAGES,
  type GeminiExtractionResult
} from '@/shared/lib/gemini-service';
import { useStore } from '@/shared/store/useStore';
import { useRouter } from 'next/navigation';
import { fullCalculation } from '@/shared/lib/calculations';
import { calculateBudget } from '@/shared/lib/budget';
import type { FacadeSide, GeometryResult, Project } from '@/shared/types';

/* ─── Accordion ─── */
const Accordion = ({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600">{icon}</div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  );
};

/* ─── Input Row ─── */
const Field = ({ label, value, onChange, type = 'text', unit, className = '' }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; unit?: string; className?: string;
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
    <div className="flex items-center gap-1">
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
      />
      {unit && <span className="text-[9px] font-bold text-slate-400 shrink-0">{unit}</span>}
    </div>
  </div>
);

/* ─── Loading Messages ─── */
const LOADING_MSGS = [
  "Analizando planos arquitectonicos...",
  "Identificando muros y aberturas...",
  "Leyendo planilla de paneles...",
  "Calculando dimensiones...",
  "Verificando datos extraidos...",
];

/* ══════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════ */
const PlanAnalyzerPage = () => {
  // Restore from store if available (survives navigation)
  const storedExtraction = useStore(s => s.lastExtraction) as GeminiExtractionResult | null;
  const setLastExtraction = useStore(s => s.setLastExtraction);

  const [step, setStep] = useState<'upload' | 'loading' | 'review' | 'results'>(storedExtraction ? 'review' : 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [data, setData] = useState<GeminiExtractionResult | null>(storedExtraction);
  const [results, setResults] = useState<{ geo: GeometryResult; quantities: Record<string, number>; items: Array<{ id: string; name: string; category: string; unit: string; qty: number; price: number; total: number }>; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keep store in sync when data changes
  useEffect(() => {
    if (data) setLastExtraction(data);
  }, [data, setLastExtraction]);

  /* ── File handling ── */
  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF'); return; }
    if (f.size > 20 * 1024 * 1024) { setError('El archivo supera los 20MB'); return; }
    setFile(f);
    setError(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  /* ── Analyze ── */
  const startAnalysis = async () => {
    if (!file) return;
    setStep('loading'); setError(null); setLoadingMsg(0);
    const interval = setInterval(() => setLoadingMsg(p => (p + 1) % LOADING_MSGS.length), 3000);
    try {
      const result = await analizarConRetry(file);
      setData(result);
      setStep('review');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'INTERNAL';
      setError(ERROR_MESSAGES[msg] || msg || 'Error desconocido');
      setStep('upload');
    } finally {
      clearInterval(interval);
    }
  };

  /* ── Calculate using the SAME engine as Budget ── */
  const calculate = () => {
    if (!data) return;
    loadToStore();
    // Read fresh state after loadToStore
    const st = useStore.getState();
    const { geo, quantities } = fullCalculation(
      st.dimensions, st.selections, st.interiorWalls, st.openings,
      st.facadeConfigs, { ...st.project, perimeterWalls: st.perimeterWalls, interiorWalls: st.interiorWalls } as Partial<Project>,
      st.foundationType, st.structureType, st.prices
    );
    const { items, total } = calculateBudget(quantities, st.prices, st.project);
    setResults({ geo, quantities, items, total });
    setStep('results');
  };

  /* ── Reset ── */
  const reset = () => { setStep('upload'); setFile(null); setData(null); setResults(null); setError(null); setLastExtraction(null); };

  /* ── Load extracted data into the main store for budget calculation ── */
  const loadToStore = () => {
    if (!data) return;
    const s = useStore.getState();
    const d = data.dimensiones_generales;
    const baseH = d.altura_minima > 0 ? d.altura_minima : 2.44;
    const ridgeH = d.altura_maxima > baseH ? d.altura_maxima : baseH;

    // Use extracted dimensions, but if superficie_total is larger than ancho*largo,
    // adjust dimensions to match the real surface area from the blueprint
    let finalWidth = d.ancho;
    let finalLength = d.largo;
    const calcArea = d.ancho * d.largo;
    const realArea = data.proyecto.superficie_total;
    if (realArea > 0 && calcArea > 0 && Math.abs(realArea - calcArea) > 1) {
      // Scale proportionally to match the real surface area
      const scale = Math.sqrt(realArea / calcArea);
      finalWidth = parseFloat((d.ancho * scale).toFixed(2));
      finalLength = parseFloat((d.largo * scale).toFixed(2));
    }

    // Set dimensions
    s.setDimensions({ width: finalWidth, length: finalLength, height: baseH, ridgeHeight: ridgeH });

    // Set project info
    s.setProjectData({
      clientName: data.proyecto.nombre,
      location: data.proyecto.proyectista,
      date: data.proyecto.fecha,
    });

    // Configure facade types from extracted exterior walls
    // Map extracted wall types to facade configs
    const mapWallType = (tipo: string): 'recto' | 'inclinado' | '2-aguas' => {
      if (tipo === 'gable') return '2-aguas';
      if (tipo === 'mono-slope') return 'inclinado';
      return 'recto';
    };

    // Try to match extracted walls to facades by name
    const facadeMap: Record<FacadeSide, { type: 'recto' | 'inclinado' | '2-aguas'; hBase: number; hMax: number }> = {
      Norte: { type: 'recto', hBase: baseH, hMax: baseH },
      Sur: { type: 'recto', hBase: baseH, hMax: baseH },
      Este: { type: 'recto', hBase: baseH, hMax: baseH },
      Oeste: { type: 'recto', hBase: baseH, hMax: baseH },
    };

    data.muros_exteriores.forEach(m => {
      const name = m.nombre.toLowerCase();
      let side: FacadeSide | null = null;
      if (name.includes('norte') || name.includes('front') || name.includes('frontal')) side = 'Norte';
      else if (name.includes('sur') || name.includes('poster') || name.includes('back') || name.includes('trasera')) side = 'Sur';
      else if (name.includes('este') || name.includes('east') || name.includes('derech') || name.includes('right')) side = 'Este';
      else if (name.includes('oeste') || name.includes('west') || name.includes('izquier') || name.includes('left')) side = 'Oeste';
      else if (name.includes('lateral')) {
        // Assign to first unassigned lateral
        if (facadeMap.Este.type === 'recto' && facadeMap.Este.hBase === baseH) side = 'Este';
        else side = 'Oeste';
      } else if (name.includes('long') || name.includes('largo')) {
        if (facadeMap.Norte.type === 'recto' && facadeMap.Norte.hBase === baseH) side = 'Norte';
        else side = 'Sur';
      } else if (name.includes('short') || name.includes('corto') || name.includes('ancho')) {
        if (facadeMap.Este.type === 'recto' && facadeMap.Este.hBase === baseH) side = 'Este';
        else side = 'Oeste';
      }

      if (side) {
        facadeMap[side] = {
          type: mapWallType(m.tipo),
          hBase: m.altura_base,
          hMax: m.altura_pico,
        };
      }
    });

    // If no walls were matched by name, distribute by geometry
    const unmatchedWalls = data.muros_exteriores.filter(m => {
      const name = m.nombre.toLowerCase();
      return !['norte','sur','este','oeste','front','back','right','left','lateral','long','short','frontal','poster','trasera','derech','izquier'].some(k => name.includes(k));
    });

    const allSides: FacadeSide[] = ['Norte', 'Sur', 'Este', 'Oeste'];
    unmatchedWalls.forEach((m, i) => {
      const side = allSides[i % 4];
      if (facadeMap[side].type === 'recto' && facadeMap[side].hBase === baseH) {
        facadeMap[side] = { type: mapWallType(m.tipo), hBase: m.altura_base, hMax: m.altura_pico };
      }
    });

    // Apply facade configs
    allSides.forEach(side => {
      s.updateFacadeConfig(side, facadeMap[side]);
    });

    // Clear existing interior walls and openings
    useStore.getState().interiorWalls.forEach(w => s.removeWall(w.id));
    useStore.getState().openings.forEach(o => s.removeOpening(o.id));

    // Add interior walls
    data.muros_interiores.forEach((m, i) => {
      s.addWall('interior', {
        x: (i + 1) * (d.ancho / (data.muros_interiores.length + 1)),
        y: 0,
        length: m.largo,
        isVertical: m.largo <= d.ancho,
      });
    });

    // Add openings to facades
    data.aberturas.forEach((ab) => {
      let side: FacadeSide = 'Norte';
      const muro = ab.muro_asociado.toLowerCase();
      if (muro.includes('norte') || muro.includes('front')) side = 'Norte';
      else if (muro.includes('sur') || muro.includes('poster') || muro.includes('back')) side = 'Sur';
      else if (muro.includes('este') || muro.includes('east') || muro.includes('derech')) side = 'Este';
      else if (muro.includes('oeste') || muro.includes('west') || muro.includes('izquier')) side = 'Oeste';
      else if (muro.includes('interior') || muro.includes('int')) side = 'Norte';
      else {
        // Distribute to the facade with the longest wall
        const longest = data.muros_exteriores.reduce((a, b) => b.largo > a.largo ? b : a, data.muros_exteriores[0]);
        const ln = longest?.nombre.toLowerCase() || '';
        if (ln.includes('norte') || ln.includes('front')) side = 'Norte';
        else if (ln.includes('sur')) side = 'Sur';
        else side = 'Norte';
      }

      for (let q = 0; q < ab.cantidad; q++) {
        s.addOpening(side, ab.tipo === 'door' ? 'door' : 'window');
        const lastOp = useStore.getState().openings;
        const last = lastOp[lastOp.length - 1];
        if (last) {
          s.updateOpening(last.id, { width: ab.ancho, height: ab.alto, x: 0.5 + q * (ab.ancho + 0.3) });
        }
      }
    });

    // Set foundation type from extraction
    const fund = data.estructura.tipo_fundacion.toLowerCase();
    if (fund.includes('platea') || fund.includes('losa') || fund.includes('hormig')) {
      s.setFoundationType('platea');
    } else {
      s.setFoundationType('estructura');
    }
  };

  const goToBudget = () => { loadToStore(); router.push('/budget'); };

  /* ── Update helpers ── */
  const updateData = (patch: Partial<GeminiExtractionResult>) => setData(prev => prev ? { ...prev, ...patch } : prev);
  const updateMuroExt = (idx: number, patch: Record<string, unknown>) => {
    if (!data) return;
    const muros = [...data.muros_exteriores];
    muros[idx] = { ...muros[idx], ...patch };
    updateData({ muros_exteriores: muros });
  };
  const updateMuroInt = (idx: number, patch: Record<string, unknown>) => {
    if (!data) return;
    const muros = [...data.muros_interiores];
    muros[idx] = { ...muros[idx], ...patch };
    updateData({ muros_interiores: muros });
  };
  const updateAbertura = (idx: number, patch: Record<string, unknown>) => {
    if (!data) return;
    const abs = [...data.aberturas];
    abs[idx] = { ...abs[idx], ...patch };
    updateData({ aberturas: abs });
  };

  /* ══════════════════════════════════════
     RENDER
     ══════════════════════════════════════ */
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Cotizador desde Plano</h2>
          <p className="text-slate-400 text-sm font-medium">Subi un PDF de planos y la IA extrae los datos automaticamente</p>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
            <RotateCcw size={14} /> Nuevo Analisis
          </button>
        )}
      </div>

      {/* ═══ STEP 1: UPLOAD ═══ */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
              dragOver ? 'border-cyan-400 bg-cyan-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center"><FileText size={32} className="text-emerald-600" /></div>
                <p className="text-sm font-black text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1"><X size={12} /> Quitar</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center"><Upload size={32} className="text-slate-400" /></div>
                <p className="text-sm font-bold text-slate-600">Arrastra un PDF de planos aqui</p>
                <p className="text-xs text-slate-400">o hace click para seleccionar archivo (max 20MB)</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
              <AlertTriangle size={18} className="text-rose-500 shrink-0" />
              <p className="text-xs font-bold text-rose-700">{error}</p>
            </div>
          )}

          {file && (
            <button onClick={startAnalysis} className="w-full flex items-center justify-center gap-3 py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-colors shadow-lg shadow-cyan-500/20">
              <Lightbulb size={18} /> Analizar Plano con IA
            </button>
          )}
        </div>
      )}

      {/* ═══ STEP 2: LOADING ═══ */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-cyan-200 rounded-full animate-spin border-t-cyan-500" />
            <Loader2 size={32} className="absolute inset-0 m-auto text-cyan-500 animate-pulse" />
          </div>
          <p className="text-sm font-bold text-slate-600 animate-pulse">{LOADING_MSGS[loadingMsg]}</p>
          <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Gemini esta analizando tu plano. Esto puede tardar hasta 30 segundos.</p>
        </div>
      )}

      {/* ═══ STEP 3: REVIEW FORM ═══ */}
      {step === 'review' && data && (
        <div className="space-y-4">
          {/* Confidence bar */}
          <div className={`flex items-center gap-4 p-4 rounded-2xl border ${
            data.confianza >= 70 ? 'bg-emerald-50 border-emerald-200' : data.confianza >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <Shield size={20} className={data.confianza >= 70 ? 'text-emerald-600' : data.confianza >= 50 ? 'text-amber-600' : 'text-rose-600'} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Confianza de la extraccion</span>
                <span className="text-sm font-black">{data.confianza}%</span>
              </div>
              <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${data.confianza >= 70 ? 'bg-emerald-500' : data.confianza >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${data.confianza}%` }} />
              </div>
            </div>
          </div>

          {data.notas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              <p className="text-xs font-black text-amber-700 uppercase tracking-wider mb-2">Notas de la IA</p>
              {data.notas.map((n, i) => <p key={i} className="text-xs text-amber-800 flex items-start gap-2"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{n}</p>)}
            </div>
          )}

          {/* Proyecto */}
          <Accordion title="Datos del Proyecto" icon={<Home size={18} />} defaultOpen>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Nombre" value={data.proyecto.nombre} onChange={v => updateData({ proyecto: { ...data.proyecto, nombre: v } })} className="col-span-2" />
              <Field label="Superficie" value={data.proyecto.superficie_total} onChange={v => updateData({ proyecto: { ...data.proyecto, superficie_total: Number(v) } })} type="number" unit="m2" />
              <Field label="Proyectista" value={data.proyecto.proyectista} onChange={v => updateData({ proyecto: { ...data.proyecto, proyectista: v } })} />
            </div>
          </Accordion>

          {/* Dimensiones */}
          <Accordion title="Dimensiones Generales" icon={<Ruler size={18} />} defaultOpen>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Largo" value={data.dimensiones_generales.largo} onChange={v => updateData({ dimensiones_generales: { ...data.dimensiones_generales, largo: Number(v) } })} type="number" unit="m" />
              <Field label="Ancho" value={data.dimensiones_generales.ancho} onChange={v => updateData({ dimensiones_generales: { ...data.dimensiones_generales, ancho: Number(v) } })} type="number" unit="m" />
              <Field label="Altura Min" value={data.dimensiones_generales.altura_minima} onChange={v => updateData({ dimensiones_generales: { ...data.dimensiones_generales, altura_minima: Number(v) } })} type="number" unit="m" />
              <Field label="Altura Max" value={data.dimensiones_generales.altura_maxima} onChange={v => updateData({ dimensiones_generales: { ...data.dimensiones_generales, altura_maxima: Number(v) } })} type="number" unit="m" />
            </div>
          </Accordion>

          {/* Muros Exteriores */}
          <Accordion title={`Muros Exteriores (${data.muros_exteriores.length})`} icon={<Layers size={18} />} defaultOpen>
            <div className="space-y-3">
              {data.muros_exteriores.map((m, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase">{m.nombre || `Muro ${i + 1}`}</span>
                    <button onClick={() => updateData({ muros_exteriores: data.muros_exteriores.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <Field label="Nombre" value={m.nombre} onChange={v => updateMuroExt(i, { nombre: v })} className="col-span-2 md:col-span-1" />
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                      <select value={m.tipo} onChange={e => updateMuroExt(i, { tipo: e.target.value })}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-400">
                        <option value="straight">Recto</option>
                        <option value="mono-slope">Una Agua</option>
                        <option value="gable">Dos Aguas</option>
                      </select>
                    </div>
                    <Field label="Largo" value={m.largo} onChange={v => updateMuroExt(i, { largo: Number(v) })} type="number" unit="m" />
                    <Field label="Alt. Base" value={m.altura_base} onChange={v => updateMuroExt(i, { altura_base: Number(v) })} type="number" unit="m" />
                    <Field label="Alt. Pico" value={m.altura_pico} onChange={v => updateMuroExt(i, { altura_pico: Number(v) })} type="number" unit="m" />
                  </div>
                </div>
              ))}
              <button onClick={() => updateData({ muros_exteriores: [...data.muros_exteriores, { nombre: `Muro ${data.muros_exteriores.length + 1}`, tipo: 'straight', largo: 3, altura_base: 2.44, altura_pico: 2.44 }] })}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-cyan-300 hover:text-cyan-500 flex items-center justify-center gap-2 transition-colors">
                <Plus size={14} /> Agregar Muro
              </button>
            </div>
          </Accordion>

          {/* Muros Interiores */}
          <Accordion title={`Muros Interiores (${data.muros_interiores.length})`} icon={<Layers size={18} />}>
            <div className="space-y-2">
              {data.muros_interiores.map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                  <Field label="Nombre" value={m.nombre} onChange={v => updateMuroInt(i, { nombre: v })} className="flex-1" />
                  <Field label="Largo" value={m.largo} onChange={v => updateMuroInt(i, { largo: Number(v) })} type="number" unit="m" className="w-24" />
                  <Field label="Alto" value={m.altura} onChange={v => updateMuroInt(i, { altura: Number(v) })} type="number" unit="m" className="w-24" />
                  <button onClick={() => updateData({ muros_interiores: data.muros_interiores.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-rose-500 mt-4"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={() => updateData({ muros_interiores: [...data.muros_interiores, { nombre: `Tabique ${data.muros_interiores.length + 1}`, largo: 2, altura: 2.44 }] })}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-cyan-300 hover:text-cyan-500 flex items-center justify-center gap-2 transition-colors">
                <Plus size={14} /> Agregar Tabique
              </button>
            </div>
          </Accordion>

          {/* Aberturas */}
          <Accordion title={`Aberturas (${data.aberturas.length})`} icon={<DoorOpen size={18} />}>
            <div className="space-y-2">
              {data.aberturas.map((ab, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-2">
                  <div className="flex flex-col gap-1 w-20">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Tipo</label>
                    <select value={ab.tipo} onChange={e => updateAbertura(i, { tipo: e.target.value })}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-cyan-400">
                      <option value="door">Puerta</option>
                      <option value="window">Ventana</option>
                    </select>
                  </div>
                  <Field label="Denom." value={ab.denominacion} onChange={v => updateAbertura(i, { denominacion: v })} className="w-16" />
                  <Field label="Cant." value={ab.cantidad} onChange={v => updateAbertura(i, { cantidad: Number(v) })} type="number" className="w-14" />
                  <Field label="Ancho" value={ab.ancho} onChange={v => updateAbertura(i, { ancho: Number(v) })} type="number" unit="m" className="w-20" />
                  <Field label="Alto" value={ab.alto} onChange={v => updateAbertura(i, { alto: Number(v) })} type="number" unit="m" className="w-20" />
                  <Field label="Muro" value={ab.muro_asociado} onChange={v => updateAbertura(i, { muro_asociado: v })} className="flex-1 min-w-[80px]" />
                  <button onClick={() => updateData({ aberturas: data.aberturas.filter((_, j) => j !== i) })} className="text-slate-300 hover:text-rose-500 mt-4"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={() => updateData({ aberturas: [...data.aberturas, { tipo: 'window', denominacion: `V${data.aberturas.length + 1}`, cantidad: 1, ancho: 1.2, alto: 1.0, muro_asociado: '' }] })}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-cyan-300 hover:text-cyan-500 flex items-center justify-center gap-2 transition-colors">
                <Plus size={14} /> Agregar Abertura
              </button>
            </div>
          </Accordion>

          {/* Techo */}
          <Accordion title="Techo" icon={<Home size={18} />}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Tipo" value={data.techo.tipo} onChange={v => updateData({ techo: { ...data.techo, tipo: v } })} />
              <Field label="Pendiente" value={data.techo.pendiente_estimada} onChange={v => updateData({ techo: { ...data.techo, pendiente_estimada: Number(v) } })} type="number" unit="°" />
              <Field label="Sup. Proyeccion" value={data.techo.superficie_proyeccion} onChange={v => updateData({ techo: { ...data.techo, superficie_proyeccion: Number(v) } })} type="number" unit="m2" />
              <Field label="Material" value={data.techo.material} onChange={v => updateData({ techo: { ...data.techo, material: v } })} />
            </div>
          </Accordion>

          {/* Estructura */}
          <Accordion title="Estructura" icon={<Wrench size={18} />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Fundacion" value={data.estructura.tipo_fundacion} onChange={v => updateData({ estructura: { ...data.estructura, tipo_fundacion: v } })} />
              <Field label="Estructura" value={data.estructura.tipo_estructura} onChange={v => updateData({ estructura: { ...data.estructura, tipo_estructura: v } })} />
              <Field label="Montantes" value={data.estructura.montantes} onChange={v => updateData({ estructura: { ...data.estructura, montantes: v } })} />
            </div>
          </Accordion>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={calculate} className="flex-1 flex items-center justify-center gap-3 py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-colors">
              <CheckCircle2 size={18} /> Ver Resumen
            </button>
            <button onClick={goToBudget} className="flex-1 flex items-center justify-center gap-3 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-colors shadow-lg shadow-orange-500/20">
              <FileText size={18} /> Ir a Presupuesto
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: RESULTS (same engine as Budget) ═══ */}
      {step === 'results' && results && data && (
        <div className="space-y-6">
          {/* Project Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Datos del Plano</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div><span className="text-slate-400 font-bold">Proyecto:</span> <span className="font-black text-slate-800">{data.proyecto.nombre}</span></div>
              <div><span className="text-slate-400 font-bold">Proyectista:</span> <span className="font-black text-slate-800">{data.proyecto.proyectista}</span></div>
              <div><span className="text-slate-400 font-bold">Superficie:</span> <span className="font-black text-slate-800">{data.proyecto.superficie_total} m2</span></div>
              <div><span className="text-slate-400 font-bold">Fecha:</span> <span className="font-black text-slate-800">{data.proyecto.fecha}</span></div>
            </div>
          </div>

          {/* Panel Count */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Muros Ext.', value: results.geo.cantMurosExt, color: 'bg-cyan-500' },
              { label: 'Muros Int.', value: results.geo.cantMurosInt, color: 'bg-amber-500' },
              { label: 'Piso', value: results.geo.cantPiso, color: 'bg-emerald-500' },
              { label: 'Techo', value: results.geo.cantTecho, color: 'bg-violet-500' },
              { label: 'TOTAL', value: results.geo.totalPaneles, color: 'bg-slate-900' },
            ].map((item, i) => (
              <div key={i} className={`${item.color} rounded-2xl p-5 text-white text-center`}>
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">{item.label}</p>
                <p className="text-3xl font-black mt-1">{item.value}</p>
                <p className="text-[10px] font-bold opacity-60">paneles</p>
              </div>
            ))}
          </div>

          {/* Geometry */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Geometria de la Casa</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { l: 'Area Planta', v: results.geo.areaPiso?.toFixed(2), u: 'm2' },
                { l: 'Perimetro Ext.', v: results.geo.perimExt?.toFixed(2), u: 'ml' },
                { l: 'Area Muros Bruta', v: results.geo.areaMurosBruta?.toFixed(2), u: 'm2' },
                { l: 'Area Techo', v: results.geo.areaTecho?.toFixed(2), u: 'm2' },
                { l: 'ML Tabiques', v: results.geo.tabiques?.toFixed(2), u: 'ml' },
                { l: 'Perim. Aberturas', v: results.geo.perimAberturas?.toFixed(2), u: 'ml' },
              ].map((r, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{r.l}</p>
                  <p className="text-lg font-black text-slate-800">{r.v || '0'} <span className="text-[10px] text-slate-400 font-bold">{r.u}</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Materials / Insumos Table */}
          {results.items.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Listado de Insumos y Materiales</h3>
                <div className="bg-orange-500 text-white px-4 py-1.5 rounded-xl text-xs font-black">
                  Total: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(results.total)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-[8px] font-black text-white uppercase tracking-widest">
                    <tr>
                      <th className="px-4 py-3 text-left">Material</th>
                      <th className="px-3 py-3 text-center">Unid.</th>
                      <th className="px-3 py-3 text-center">Cant.</th>
                      <th className="px-3 py-3 text-right">Unitario</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {results.items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-700">{item.name}</td>
                        <td className="px-3 py-2 text-center text-slate-400 font-bold">{item.unit}</td>
                        <td className="px-3 py-2 text-center font-black text-slate-800">{item.qty}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(item.price)}</td>
                        <td className="px-4 py-2 text-right font-black text-slate-900">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <button onClick={goToBudget} className="w-full flex items-center justify-center gap-3 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-colors shadow-lg shadow-orange-500/20">
            <FileText size={18} /> Ir a Presupuesto Completo
          </button>
          <div className="flex gap-3">
            <button onClick={() => setStep('review')} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
              <RotateCcw size={14} /> Editar Datos
            </button>
            <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors">
              <Download size={14} /> Imprimir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanAnalyzerPage;
