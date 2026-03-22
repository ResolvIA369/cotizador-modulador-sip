import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { INITIAL_PRICES } from '@/shared/lib/constants';
import type {
  Project,
  Dimensions,
  PerimeterWall,
  InteriorWall,
  Opening,
  OpeningType,
  FacadeConfig,
  FacadeSide,
  Selections,
  FoundationType,
  StructureType,
  Product,
  CustomMeasurement,
  CRMEntry,
  Defaults,
  Clipboard,
  Recess,
  Room,
  RoomType,
  SavedDesign,
} from '@/shared/types';

const SNAP_VALUE = 0.05; // 5cm snapping for easier alignment
const roundToSnap = (val: number): number => Math.round(val / SNAP_VALUE) * SNAP_VALUE;

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
};

// Snapshot of serializable state saved to history
interface HistorySnapshot {
  project: Project;
  dimensions: Dimensions;
  perimeterWalls: PerimeterWall[];
  interiorWalls: InteriorWall[];
  openings: Opening[];
  facadeConfigs: Record<FacadeSide, FacadeConfig>;
  selections: Selections;
  foundationType: FoundationType;
  structureType: StructureType;
  customMeasurements: CustomMeasurement[];
}

interface StoreState {
  // --- HISTORY STATE ---
  history: HistorySnapshot[];
  historyIndex: number;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;

  // --- PROJECT STATE ---
  project: Project;

  // --- DEFAULTS FOR ADMIN ---
  defaults: Defaults;

  // --- CRM / LEADS ---
  crmEntries: CRMEntry[];

  // --- SNAPSHOTS ---
  snapshots: string[];

  // --- ENGINEERING STATE ---
  dimensions: Dimensions;

  // Geometry
  perimeterWalls: PerimeterWall[];
  interiorWalls: InteriorWall[];
  openings: Opening[];
  facadeConfigs: Record<FacadeSide, FacadeConfig>;
  activeId: string | null;
  activeType: string | null;
  activeOpeningId: string | null;
  activeRecessId: string | null;
  showBeams: boolean;
  showRoofPlates: boolean;
  beamOffset: number;

  selections: Selections;
  foundationType: FoundationType;
  structureType: StructureType;
  prices: Product[];
  customMeasurements: CustomMeasurement[];

  // --- ROOMS ---
  rooms: Room[];

  // --- SAVED DESIGNS ---
  savedDesigns: SavedDesign[];

  // --- PLAN EXTRACTION (Gemini) ---
  lastExtraction: unknown | null;

  // --- CLIPBOARD ---
  clipboard: Clipboard | null;
  activeInteriorWallId: string | null;

  // --- ACTIONS ---
  setActive: (id: string | null, type: string | null) => void;

  addWall: (type: 'perimeter' | 'interior', data: Omit<PerimeterWall, 'id'> | Omit<InteriorWall, 'id'>) => void;
  updateWall: (id: string, updates: Partial<PerimeterWall> | Partial<InteriorWall>) => void;
  removeWall: (id: string) => void;
  duplicateWall: (id: string) => void;

  copyWall: (id: string) => void;
  cutWall: (id: string) => void;
  pasteWall: () => void;

  setDimensions: (dims: Partial<Dimensions>) => void;

  addOpening: (side: FacadeSide, type: OpeningType, recessId?: string | null, recessWall?: string | null) => void;
  removeOpening: (id: string) => void;
  updateOpening: (id: string, updates: Partial<Opening>) => void;

  setShowBeams: (val: boolean) => void;
  setShowRoofPlates: (val: boolean) => void;
  setBeamOffset: (val: number) => void;
  updateFacadeConfig: (side: FacadeSide, updates: Partial<FacadeConfig>) => void;

  setFoundationType: (type: FoundationType) => void;
  setStructureType: (type: StructureType) => void;

  setSelectionId: (id: keyof Selections, value: Selections[keyof Selections]) => void;
  setSelections: (updates: Partial<Selections>) => void;
  setRoofSystem: (type: 'sip' | 'sandwich') => void;
  toggleSelectionCategory: (cat: keyof Selections) => void;

  setProjectData: (data: Partial<Project>) => void;
  updateProjectInfo: (field: string, value: unknown) => void;
  togglePerimeterVisibility: (side: FacadeSide) => void;
  setOverride: (id: string, data: Partial<{ qty: number; price: number; name: string; unit: string; category: string }>) => void;
  removeOverride: (id: string) => void;

  setActiveInteriorWallId: (id: string | null) => void;
  setActiveOpeningId: (id: string | null) => void;
  setActiveRecessId: (id: string | null) => void;
  updateInteriorWall: (id: string, updates: Partial<InteriorWall>) => void;

  addSnapshot: (img: string) => void;
  removeSnapshot: (index: number) => void;

  addCustomMeasurement: (m: Omit<CustomMeasurement, 'id'>) => void;
  clearCustomMeasurements: () => void;
  removeCustomMeasurement: (id: string) => void;
  updateCustomMeasurement: (id: string, updates: Partial<CustomMeasurement>) => void;

  updateRecess: (side: FacadeSide, id: string, updates: Partial<Recess>) => void;
  removeRecess: (id: string) => void;
  clearRecesses: () => void;

  addLShape: () => void;
  addCShape: () => void;

  // --- PRODUCT MANAGEMENT ---
  updateProduct: (id: string, updates: Partial<Product>) => void;
  addProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

  // --- DEFAULTS MANAGEMENT ---
  updateDefaults: (updates: Partial<{ benefits: string; extraNotes: string }>) => void;

  // --- CRM MANAGEMENT ---
  saveToCRM: (total: number) => void;
  updateCRMStatus: (id: string, status: string) => void;
  deleteCRMEntry: (id: string) => void;

  // --- BUDGET ---
  generateBudgetNumber: () => void;

  // --- ROOMS ---
  addRoom: (name: string, type: RoomType) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  removeRoom: (id: string) => void;

  // --- SAVED DESIGNS ---
  saveDesign: (name: string, area: number, totalPanels: number) => void;
  loadDesign: (id: string) => void;
  deleteDesign: (id: string) => void;

  // --- PLAN EXTRACTION ---
  setLastExtraction: (data: unknown | null) => void;

  resetProject: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // --- HISTORY STATE ---
      history: [],
      historyIndex: -1,

      saveHistory: () => {
        const state = get();
        const snapshot: HistorySnapshot = JSON.parse(JSON.stringify({
          project: state.project,
          dimensions: state.dimensions,
          perimeterWalls: state.perimeterWalls,
          interiorWalls: state.interiorWalls,
          openings: state.openings,
          facadeConfigs: state.facadeConfigs,
          selections: state.selections,
          foundationType: state.foundationType,
          structureType: state.structureType,
          customMeasurements: state.customMeasurements
        }));

        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(snapshot);
        if (newHistory.length > 50) newHistory.shift();

        set({
          history: newHistory,
          historyIndex: newHistory.length - 1
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const prevState = history[historyIndex - 1];
          set({
            ...prevState,
            historyIndex: historyIndex - 1
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const nextState = history[historyIndex + 1];
          set({
            ...nextState,
            historyIndex: historyIndex + 1
          });
        }
      },

      // --- PROJECT STATE ---
      project: {
        budgetNumber: '',
        status: 'Borrador', // 'Borrador', 'Presupuestado', 'En Seguimiento', 'Cerrado', 'Perdido'
        clientName: '',
        cuit: '',
        phone: '',
        email: '',
        location: '',
        date: new Date().toISOString().split('T')[0],
        projectInfo: {
          benefits: '',
          extraNotes: '',
          adjustmentPercentage: 0,
          showEarlyPaymentDiscount: true
        },
        recesses: [], // For irregular shapes like halls
        perimeterVisibility: { Norte: true, Sur: true, Este: true, Oeste: true },
        overrides: {} // { [productId]: { qty: number, price: number } }
      },

      // --- DEFAULTS FOR ADMIN ---
      defaults: {
        benefits: '• Compromiso de Eficiencia: 6% de descuento por cierre temprano (7 días).\n• Escalabilidad: 8% de descuento en compras > 20 unidades.\n• Optimización: 12% de beneficio por pago en efectivo.\n• Acompañamiento: Asesoría técnica y manuales paso a paso.',
        extraNotes: '• Validez: 7 días corridos.\n• Precios Netos: No incluyen IVA.\n• Reserva: Descuentos válidos según vigencia.\n• Logística: No incluye envío ni descarga.'
      },

      // --- CRM / LEADS ---
      crmEntries: [
        { id: '1', date: '2024-01-10', client: 'Juan Perez', email: 'juan@example.com', phone: '11223344', location: 'Buenos Aires', area: 48, status: 'Presupuesto', total: 12500000 },
        { id: '2', date: '2024-01-12', client: 'Maria Garcia', email: 'maria@example.com', phone: '22334455', location: 'Cordoba', area: 64, status: 'Contacto', total: 15800000 }
      ],

      // --- SNAPSHOTS ---
      snapshots: [],

      // --- ROOMS ---
      rooms: [],

      // --- SAVED DESIGNS ---
      savedDesigns: [],

      // --- PLAN EXTRACTION ---
      lastExtraction: null,

      // --- ENGINEERING STATE ---
      dimensions: {
        width: 6,
        length: 8,
        height: 2.44,
        ridgeHeight: 3.5,
      },

      // Geometry
      perimeterWalls: [
        { id: 'Norte', side: 'Norte' },
        { id: 'Sur', side: 'Sur' },
        { id: 'Este', side: 'Este' },
        { id: 'Oeste', side: 'Oeste' },
      ],
      interiorWalls: [],
      openings: [],
      facadeConfigs: {
        Norte: { type: '2-aguas', hBase: 2.44, hMax: 3.5 },
        Sur: { type: '2-aguas', hBase: 2.44, hMax: 3.5 },
        Este: { type: 'recto', hBase: 2.44, hMax: 2.44 },
        Oeste: { type: 'recto', hBase: 2.44, hMax: 2.44 }
      },
      activeId: null,
      activeType: null,
      activeOpeningId: null,
      activeRecessId: null,
      showBeams: true,
      showRoofPlates: true,
      beamOffset: 0,

      selections: {
        exteriorWallId: "OSB-70-E",
        interiorWallId: "OSB-70-DECO",
        roofId: "TECHO-OSB-70",
        floorId: "PISO-OSB-70",
        roofSystem: "sip",
        includeExterior: true,
        includeInterior: true,
        includeRoof: true,
        includeFloor: true,
        includeEngineeringDetail: true,
      },
      foundationType: 'platea',
      structureType: 'madera',
      prices: INITIAL_PRICES,
      customMeasurements: [], // { id, start: {x,y}, end: {x,y} }

      // --- ACTIONS ---
      setActive: (id, type) => set({ activeId: id, activeType: type }),

      addWall: (type, data) => {
        get().saveHistory();
        set((state) => ({
          [type === 'perimeter' ? 'perimeterWalls' : 'interiorWalls']: [
            ...(state[type === 'perimeter' ? 'perimeterWalls' : 'interiorWalls']),
            { id: generateUUID(), ...data }
          ]
        }));
      },

      updateWall: (id, updates) => {
        get().saveHistory();
        set((state) => {
          const isPerimeter = state.perimeterWalls.some(w => w.id === id);
          const key = isPerimeter ? 'perimeterWalls' : 'interiorWalls';
          return {
            [key]: (state[key] as Array<PerimeterWall | InteriorWall>).map(w => w.id === id ? { ...w, ...updates } : w)
          };
        });
      },

      removeWall: (id) => {
        get().saveHistory();
        set((state) => {
          const isPerimeter = state.perimeterWalls.some(w => w.id === id);
          const key = isPerimeter ? 'perimeterWalls' : 'interiorWalls';
          return {
            [key]: (state[key] as Array<PerimeterWall | InteriorWall>).filter(w => w.id !== id),
            activeId: state.activeId === id ? null : state.activeId,
            activeType: state.activeId === id ? null : state.activeType,
            activeInteriorWallId: state.activeInteriorWallId === id ? null : state.activeInteriorWallId
          };
        });
      },

      duplicateWall: (id) => {
        get().saveHistory();
        set((state) => {
          const wall = state.interiorWalls.find(w => w.id === id);
          if (!wall) return state;
          const newWall: InteriorWall = {
            ...wall,
            id: generateUUID(),
            x: (wall.x ?? 0) + 0.5,
            y: (wall.y ?? 0) + 0.5
          };
          return {
            interiorWalls: [...state.interiorWalls, newWall],
            activeInteriorWallId: newWall.id
          };
        });
      },

      // --- CLIPBOARD ---
      clipboard: null,
      copyWall: (id) => {
        const wall = get().interiorWalls.find(w => w.id === id);
        if (wall) set({ clipboard: { type: 'wall', data: wall } });
      },
      cutWall: (id) => {
        const wall = get().interiorWalls.find(w => w.id === id);
        if (wall) {
          set({ clipboard: { type: 'wall', data: wall } });
          get().removeWall(id);
        }
      },
      pasteWall: () => {
        const { clipboard } = get();
        if (clipboard && clipboard.type === 'wall') {
          get().saveHistory();
          const newWall: InteriorWall = {
            ...clipboard.data,
            id: generateUUID(),
            x: (clipboard.data.x ?? 0) + 0.2,
            y: (clipboard.data.y ?? 0) + 0.2
          };
          set((state) => ({
            interiorWalls: [...state.interiorWalls, newWall],
            activeInteriorWallId: newWall.id
          }));
        }
      },

      setDimensions: (dims) => {
        get().saveHistory();
        set((state) => {
          const newDims = { ...state.dimensions, ...dims };
          const newConfigs = { ...state.facadeConfigs };

          if (dims.height !== undefined) {
            (Object.keys(newConfigs) as FacadeSide[]).forEach(side => {
              newConfigs[side] = { ...newConfigs[side], hBase: dims.height as number };
              if (newConfigs[side].type === 'recto') {
                newConfigs[side].hMax = dims.height as number;
              }
            });
          }
          if (dims.ridgeHeight !== undefined) {
            (Object.keys(newConfigs) as FacadeSide[]).forEach(side => {
              if (newConfigs[side].type === '2-aguas' || newConfigs[side].type === 'inclinado') {
                newConfigs[side].hMax = dims.ridgeHeight as number;
              }
            });
          }

          return {
            dimensions: newDims,
            facadeConfigs: newConfigs
          };
        });
      },

      // Opening Actions
      addOpening: (side, type, recessId = null, recessWall = null) => {
        get().saveHistory();
        set((state) => ({
          openings: [...state.openings, {
            id: generateUUID(),
            side,
            type, // 'window' or 'door'
            width: type === 'door' ? 0.9 : 1.2,
            height: type === 'door' ? 2.1 : 1.2,
            x: 0.5, // Default position
            y: type === 'door' ? 0 : 0.8,
            recessId,
            recessWall, // 'back', 'left', 'right'
            isOutward: false
          }]
        }));
      },
      removeOpening: (id) => {
        get().saveHistory();
        set((state) => ({
          openings: state.openings.filter(o => o.id !== id)
        }));
      },
      updateOpening: (id, updates) => {
        get().saveHistory();
        set((state) => ({
          openings: state.openings.map(o => o.id === id ? { ...o, ...updates } : o)
        }));
      },

      setShowBeams: (val) => set({ showBeams: val }),
      setShowRoofPlates: (val) => set({ showRoofPlates: val }),
      setBeamOffset: (val) => set({ beamOffset: val }),
      updateFacadeConfig: (side, updates) => {
        get().saveHistory();
        set((state) => ({
          facadeConfigs: {
            ...state.facadeConfigs,
            [side]: { ...state.facadeConfigs[side], ...updates }
          }
        }));
      },

      setFoundationType: (type) => set((state) => ({
        foundationType: type,
        selections: {
          ...state.selections,
          includeFloor: type === 'platea' ? false : state.selections.includeFloor
        }
      })),
      setStructureType: (type) => set({ structureType: type }),

      setSelectionId: (id, value) => set((state) => ({
        selections: { ...state.selections, [id]: value }
      })),
      setSelections: (updates) => set((state) => ({
        selections: { ...state.selections, ...updates }
      })),
      setRoofSystem: (type) => set((state) => {
        const newSelections = { ...state.selections, roofSystem: type };
        // Also update the roofId to the first matching one
        const compatibleProduct = state.prices.find(p =>
          p.category === "1. SISTEMA DE PANELES" &&
          (type === 'sandwich' ? p.id.includes('SAND-') : (p.id.includes('TECHO-') || p.id === 'COL-70' || p.id === 'CE-70' || p.id === 'SID-70'))
        );
        if (compatibleProduct) {
          newSelections.roofId = compatibleProduct.id;
        }
        return { selections: newSelections };
      }),
      toggleSelectionCategory: (cat) => set((state) => ({
        selections: { ...state.selections, [cat]: !state.selections[cat] }
      })),

      activeInteriorWallId: null,

      setProjectData: (data) => set((state) => ({
        project: { ...state.project, ...data }
      })),

      updateProjectInfo: (field, value) => set((state) => ({
        project: {
          ...state.project,
          projectInfo: {
            ...(state.project?.projectInfo || {}),
            [field]: value
          }
        }
      })),
      togglePerimeterVisibility: (side) => set((state) => ({
        project: {
          ...state.project,
          perimeterVisibility: {
            ...(state.project.perimeterVisibility || { Norte: true, Sur: true, Este: true, Oeste: true }),
            [side]: !(state.project.perimeterVisibility?.[side] ?? true)
          }
        }
      })),
      setOverride: (id, data) => set((state) => ({
        project: {
          ...state.project,
          overrides: {
            ...state.project.overrides,
            [id]: { ...(state.project.overrides[id] || {}), ...data }
          }
        }
      })),
      removeOverride: (id) => set((state) => {
        const newOverrides = { ...state.project.overrides };
        delete newOverrides[id];
        return {
          project: { ...state.project, overrides: newOverrides }
        };
      }),
      setActiveInteriorWallId: (id) => set({ activeInteriorWallId: id, activeId: null, activeOpeningId: null, activeRecessId: null }),
      setActiveOpeningId: (id) => set({ activeOpeningId: id, activeId: null, activeInteriorWallId: null, activeRecessId: null }),
      setActiveRecessId: (id) => set({ activeRecessId: id, activeId: null, activeInteriorWallId: null, activeOpeningId: null }),
      updateInteriorWall: (id, updates) => {
        get().saveHistory();
        set((state) => ({
          interiorWalls: state.interiorWalls.map(w => w.id === id ? { ...w, ...updates } : w)
        }));
      },
      addSnapshot: (img) => set((state) => ({
        snapshots: [img, ...state.snapshots].slice(0, 10)
      })),
      removeSnapshot: (index) => set((state) => ({
        snapshots: state.snapshots.filter((_, i) => i !== index)
      })),
      addCustomMeasurement: (m) => {
        get().saveHistory();
        set((state) => ({
          customMeasurements: [...state.customMeasurements, { id: generateUUID(), ...m }]
        }));
      },
      clearCustomMeasurements: () => set({ customMeasurements: [] }),
      removeCustomMeasurement: (id) => {
        get().saveHistory();
        set((state) => ({
          customMeasurements: state.customMeasurements.filter(m => m.id !== id)
        }));
      },
      updateCustomMeasurement: (id, updates) => set((state) => ({
        customMeasurements: state.customMeasurements.map(m => m.id === id ? { ...m, ...updates } : m)
      })),

      updateRecess: (_side, id, updates) => set((state) => ({
        project: {
          ...state.project,
          recesses: (state.project.recesses || []).map(r => r.id === id ? { ...r, ...updates } : r)
        }
      })),
      removeRecess: (id) => set((state) => ({
        project: {
          ...state.project,
          recesses: (state.project.recesses || []).filter(r => r.id !== id)
        }
      })),
      clearRecesses: () => set((state) => ({
        project: { ...state.project, recesses: [] }
      })),

      addLShape: () => set((state) => {
        const { width, length } = state.dimensions;
        const recessWidth = length * 0.4;
        const recessDepth = width * 0.4;
        const newRecess: Recess = {
          id: generateUUID(),
          side: 'Este',
          x: 0,
          width: recessWidth,
          depth: recessDepth,
          height: state.dimensions.height,
          hideBase: true,
          hideSideWall: true
        };
        return { project: { ...state.project, recesses: [newRecess] } };
      }),

      addCShape: () => set((state) => {
        const { width, length } = state.dimensions;
        const recessWidth = length * 0.5;
        const recessDepth = width * 0.3;
        const newRecess: Recess = {
          id: generateUUID(),
          side: 'Este',
          x: (length - recessWidth) / 2,
          width: recessWidth,
          depth: recessDepth,
          height: state.dimensions.height,
          hideBase: true
        };
        return { project: { ...state.project, recesses: [newRecess] } };
      }),

      // --- PRODUCT MANAGEMENT ---
      updateProduct: (id, updates) => set((state) => ({
        prices: state.prices.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      addProduct: (product) => set((state) => ({
        prices: [...state.prices, product]
      })),
      deleteProduct: (id) => set((state) => ({
        prices: state.prices.filter(p => p.id !== id)
      })),

      // --- DEFAULTS MANAGEMENT ---
      updateDefaults: (updates) => set((state) => ({
        defaults: { ...state.defaults, ...updates }
      })),

      // --- CRM MANAGEMENT ---
      saveToCRM: (total) => set((state) => {
        const entry: CRMEntry = {
          id: generateUUID(),
          date: state.project.date || new Date().toISOString().split('T')[0],
          client: state.project.clientName || 'Sin nombre',
          email: state.project.email || '',
          phone: state.project.phone || '',
          location: state.project.location || '',
          area: state.dimensions.width * state.dimensions.length,
          status: 'Presupuesto',
          total: total,
          budgetNumber: state.project.budgetNumber || '',
          cuit: state.project.cuit || '',
        };
        return { crmEntries: [...state.crmEntries, entry] };
      }),
      updateCRMStatus: (id, status) => set((state) => ({
        crmEntries: state.crmEntries.map(e => e.id === id ? { ...e, status } : e)
      })),
      deleteCRMEntry: (id) => set((state) => ({
        crmEntries: state.crmEntries.filter(e => e.id !== id)
      })),

      // --- BUDGET ---
      generateBudgetNumber: () => set((state) => ({
        project: {
          ...state.project,
          budgetNumber: state.project.budgetNumber || `LFP-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`
        }
      })),

      // --- ROOMS ---
      addRoom: (name: string, type: RoomType) => set(state => ({
        rooms: [...state.rooms, { id: generateUUID(), name, type }]
      })),
      updateRoom: (id: string, updates: Partial<Room>) => set(state => ({
        rooms: state.rooms.map(r => r.id === id ? { ...r, ...updates } : r)
      })),
      removeRoom: (id: string) => set(state => ({
        rooms: state.rooms.filter(r => r.id !== id)
      })),

      // --- SAVED DESIGNS ---
      saveDesign: (name: string, area: number, totalPanels: number) => {
        const state = get();
        const bathroomCount = state.rooms.filter(r => r.type === 'bano').length;
        const design: SavedDesign = {
          id: generateUUID(),
          name,
          date: new Date().toISOString(),
          dimensions: { ...state.dimensions },
          interiorWalls: JSON.parse(JSON.stringify(state.interiorWalls)),
          perimeterWalls: JSON.parse(JSON.stringify(state.perimeterWalls)),
          openings: JSON.parse(JSON.stringify(state.openings)),
          facadeConfigs: JSON.parse(JSON.stringify(state.facadeConfigs)),
          selections: { ...state.selections },
          foundationType: state.foundationType,
          structureType: state.structureType,
          rooms: JSON.parse(JSON.stringify(state.rooms)),
          recesses: JSON.parse(JSON.stringify(state.project.recesses || [])),
          perimeterVisibility: { ...state.project.perimeterVisibility },
          area,
          totalPanels,
          roomCount: state.rooms.length,
          bathroomCount,
        };
        set({ savedDesigns: [...state.savedDesigns, design] });
      },
      loadDesign: (id: string) => {
        const state = get();
        const design = state.savedDesigns.find(d => d.id === id);
        if (!design) return;
        set({
          dimensions: { ...design.dimensions },
          interiorWalls: JSON.parse(JSON.stringify(design.interiorWalls)),
          perimeterWalls: JSON.parse(JSON.stringify(design.perimeterWalls)),
          openings: JSON.parse(JSON.stringify(design.openings)),
          facadeConfigs: JSON.parse(JSON.stringify(design.facadeConfigs)),
          selections: { ...design.selections },
          foundationType: design.foundationType,
          structureType: design.structureType,
          rooms: JSON.parse(JSON.stringify(design.rooms)),
          project: {
            ...state.project,
            recesses: JSON.parse(JSON.stringify(design.recesses || [])),
            perimeterVisibility: { ...design.perimeterVisibility },
          },
        });
      },
      deleteDesign: (id: string) => set(state => ({
        savedDesigns: state.savedDesigns.filter(d => d.id !== id)
      })),

      // --- PLAN EXTRACTION ---
      setLastExtraction: (data: unknown | null) => set({ lastExtraction: data }),

      resetProject: () => set({
        dimensions: { width: 6, length: 8, height: 2.44, ridgeHeight: 3.5 },
        facadeConfigs: {
          Norte: { type: '2-aguas', hBase: 2.44, hMax: 3.5 },
          Sur: { type: '2-aguas', hBase: 2.44, hMax: 3.5 },
          Este: { type: 'recto', hBase: 2.44, hMax: 2.44 },
          Oeste: { type: 'recto', hBase: 2.44, hMax: 2.44 }
        },
        perimeterWalls: [{ id: 'Norte', side: 'Norte' }, { id: 'Sur', side: 'Sur' }, { id: 'Este', side: 'Este' }, { id: 'Oeste', side: 'Oeste' }],
        interiorWalls: [], activeId: null, activeType: null, activeOpeningId: null, activeRecessId: null, openings: [], showBeams: true, showRoofPlates: true, beamOffset: 0, selections: { exteriorWallId: "OSB-70-E", interiorWallId: "OSB-70-DECO", roofId: "TECHO-OSB-70", floorId: "PISO-OSB-70", roofSystem: "sip", includeExterior: true, includeInterior: true, includeRoof: true, includeFloor: true, includeEngineeringDetail: true }, foundationType: 'platea', structureType: 'madera', project: { budgetNumber: `LFP-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`, status: 'Borrador', clientName: '', cuit: '', phone: '', email: '', location: '', date: new Date().toISOString().split('T')[0], projectInfo: { benefits: '', extraNotes: '', adjustmentPercentage: 0, showEarlyPaymentDiscount: true }, recesses: [], overrides: {}, perimeterVisibility: { Norte: true, Sur: true, Este: true, Oeste: true } }, snapshots: [], customMeasurements: [], rooms: []
      })
    }),
    {
      name: 'sip-project-storage',
      version: 6,
      migrate: (persistedState) => {
        const init = {
          project: { budgetNumber: '', status: 'Borrador', clientName: '', cuit: '', phone: '', email: '', location: '', date: new Date().toISOString().split('T')[0], projectInfo: { benefits: '', extraNotes: '', adjustmentPercentage: 0, showEarlyPaymentDiscount: true }, recesses: [], perimeterVisibility: { Norte: true, Sur: true, Este: true, Oeste: true }, overrides: {} },
          dimensions: { width: 6, length: 8, height: 2.44, ridgeHeight: 3.5 },
          perimeterWalls: [{ id: 'Norte', side: 'Norte' }, { id: 'Sur', side: 'Sur' }, { id: 'Este', side: 'Este' }, { id: 'Oeste', side: 'Oeste' }],
          interiorWalls: [], openings: [],
          facadeConfigs: { Norte: { type: '2-aguas', hBase: 2.44, hMax: 3.5 }, Sur: { type: '2-aguas', hBase: 2.44, hMax: 3.5 }, Este: { type: 'recto', hBase: 2.44, hMax: 2.44 }, Oeste: { type: 'recto', hBase: 2.44, hMax: 2.44 } },
          selections: { exteriorWallId: "OSB-70-E", interiorWallId: "OSB-70-DECO", roofId: "TECHO-OSB-70", floorId: "PISO-OSB-70", roofSystem: "sip", includeExterior: true, includeInterior: true, includeRoof: true, includeFloor: true, includeEngineeringDetail: true },
          prices: INITIAL_PRICES, foundationType: 'platea', structureType: 'madera', snapshots: [], crmEntries: [], activeId: null, activeType: null, showBeams: true, showRoofPlates: true, beamOffset: 0, defaults: {
            benefits: '• Compromiso de Eficiencia: 6% de descuento por cierre temprano (7 días).\n• Escalabilidad: 8% de descuento en compras > 20 unidades.\n• Optimización: 12% de beneficio por pago en efectivo.\n• Acompañamiento: Asesoría técnica y manuales paso a paso.',
            extraNotes: '• Validez: 7 días corridos.\n• Precios Netos: No incluyen IVA.\n• Reserva: Descuentos válidos según vigencia.\n• Logística: No incluye envío ni descarga.'
          }
        };
        if (!persistedState) return init;
        const m = { ...init, ...(persistedState as Partial<StoreState>) };
        const ps = persistedState as Partial<StoreState>;
        m.project = { ...init.project, ...(ps.project || {}) };
        m.project.projectInfo = { ...init.project.projectInfo, ...(ps.project?.projectInfo || {}) };
        m.selections = { ...init.selections, ...(ps.selections || {}) };
        m.prices = INITIAL_PRICES;
        return m;
      }
    }
  )
);
