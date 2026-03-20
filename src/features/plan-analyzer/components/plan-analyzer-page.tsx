"use client";

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Plus, Trash2, RotateCcw, Download,
  Lightbulb, Shield, X, Home, Ruler, DoorOpen, Layers, Wrench
} from 'lucide-react';
import {
  analizarConRetry, calcularDesdeExtraccion, ERROR_MESSAGES,
  type GeminiExtractionResult
} from '@/shared/lib/gemini-service';

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
  const [step, setStep] = useState<'upload' | 'loading' | 'review' | 'results'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [data, setData] = useState<GeminiExtractionResult | null>(null);
  const [results, setResults] = useState<ReturnType<typeof calcularDesdeExtraccion> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setError(ERROR_MESSAGES[msg] || ERROR_MESSAGES['INTERNAL']);
      setStep('upload');
    } finally {
      clearInterval(interval);
    }
  };

  /* ── Calculate ── */
  const calculate = () => {
    if (!data) return;
    setResults(calcularDesdeExtraccion(data));
    setStep('results');
  };

  /* ── Reset ── */
  const reset = () => { setStep('upload'); setFile(null); setData(null); setResults(null); setError(null); };

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

          {/* Calculate Button */}
          <button onClick={calculate} className="w-full flex items-center justify-center gap-3 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-colors shadow-lg shadow-orange-500/20">
            <CheckCircle2 size={18} /> Calcular Presupuesto
          </button>
        </div>
      )}

      {/* ═══ STEP 4: RESULTS ═══ */}
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
              { label: 'Muros Ext.', value: results.wallPanels, color: 'bg-cyan-500' },
              { label: 'Muros Int.', value: results.internalPanels, color: 'bg-amber-500' },
              { label: 'Piso', value: results.floorPanels, color: 'bg-emerald-500' },
              { label: 'Techo', value: results.roofPanels, color: 'bg-violet-500' },
              { label: 'TOTAL', value: results.totalPanels, color: 'bg-slate-900' },
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
                { l: 'Area Planta', v: results.houseArea.toFixed(2), u: 'm2' },
                { l: 'Perimetro', v: results.housePerimeter.toFixed(2), u: 'ml' },
                { l: 'Area Muros Bruta', v: results.extWallAreaGross.toFixed(2), u: 'm2' },
                { l: 'Area Muros Neta', v: results.extWallAreaNet.toFixed(2), u: 'm2' },
                { l: 'Area Techo', v: results.roofArea.toFixed(2), u: 'm2' },
                { l: 'Area Aberturas', v: results.openingsArea.toFixed(2), u: 'm2' },
                { l: 'ML Tabiques', v: results.internalLinearMeters.toFixed(2), u: 'ml' },
                { l: 'Perim. Paneles', v: results.totalPanelsPerimeter.toFixed(2), u: 'ml' },
                { l: 'Perim. Corte', v: results.totalCutPerimeter.toFixed(2), u: 'ml' },
              ].map((r, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{r.l}</p>
                  <p className="text-lg font-black text-slate-800">{r.v} <span className="text-[10px] text-slate-400 font-bold">{r.u}</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Openings Summary */}
          {data.aberturas.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Resumen de Aberturas</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2">Denom.</th><th className="px-3 py-2">Cant.</th><th className="px-3 py-2">Ancho</th><th className="px-3 py-2">Alto</th><th className="px-3 py-2">Muro</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.aberturas.map((ab, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold">{ab.tipo === 'door' ? 'Puerta' : 'Ventana'}</td>
                        <td className="px-3 py-2 text-center font-black">{ab.denominacion}</td>
                        <td className="px-3 py-2 text-center font-black">{ab.cantidad}</td>
                        <td className="px-3 py-2 text-center">{ab.ancho}m</td>
                        <td className="px-3 py-2 text-center">{ab.alto}m</td>
                        <td className="px-3 py-2 text-center text-slate-400">{ab.muro_asociado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => setStep('review')} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
              <RotateCcw size={14} /> Editar Datos
            </button>
            <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
              <Download size={14} /> Exportar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanAnalyzerPage;
