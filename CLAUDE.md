# Cotizador SIP - Factory OS

> **Cotizador Modulador SIP** para "La Fabrica del Panel" (Argentina).
> Herramienta de ingenieria, presupuesto y CRM para construccion con paneles SIP.
> El humano dice QUE quiere. Tu decides COMO construirlo.

---

## Dominio del Negocio

- **Empresa**: La Fabrica del Panel - fabricante de paneles SIP en Argentina
- **Producto**: Paneles SIP (Structural Insulated Panels) estandar 1.22m x 2.44m
- **Moneda**: ARS (Pesos Argentinos)
- **Objetivo**: Disenar casas en planta/fachada/3D, calcular materiales y generar presupuestos PDF
- **Usuarios**: Vendedores e ingenieros de La Fabrica del Panel

### Conceptos Clave del Dominio

| Concepto | Significado |
|----------|-------------|
| Panel SIP | Panel estructural aislante (1.22m x 2.44m) |
| Fachada | Vista lateral de la casa (Norte, Sur, Este, Oeste) |
| Abertura | Puerta o ventana en una fachada |
| Retranqueo (Recess) | Zona empotrada en una fachada |
| Muro perimetral | Pared exterior del perimetro |
| Muro interior (tabique) | Division interna |
| Platea / Estructura | Tipos de fundacion |
| Madera / Metal | Tipos de estructura |

---

## Stack Tecnico (Golden Path)

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Framework | Next.js + App Router | 16.x |
| UI | React | 19.x |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 3.4 |
| Estado | Zustand (con persist) | 5.x |
| 3D | Three.js (@react-three/fiber + drei) | r182 |
| PDF | jsPDF + html2canvas | - |
| Iconos | lucide-react | - |
| CSS Utils | clsx, tailwind-merge | - |

**NO hay backend todavia** — todo es client-side con localStorage (Zustand persist).
**NO hay Supabase, Zod, ni auth** — son items futuros del Golden Path.

---

## Arquitectura Feature-First

```
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                   # Root layout (Inter font, globals.css)
│   ├── page.tsx                     # Redirect → /engineering
│   ├── globals.css                  # Tailwind + print styles
│   └── (main)/                      # Route group con AppLayout (nav lateral)
│       ├── layout.tsx               # Wrapper con AppLayout
│       ├── engineering/page.tsx     # Modulo principal (dynamic, ssr:false)
│       ├── budget/page.tsx          # Presupuesto
│       ├── crm/page.tsx             # CRM de leads
│       ├── admin/page.tsx           # Admin de precios
│       └── export/page.tsx          # Exportar PDF
│
├── features/                         # Organizadas por funcionalidad
│   ├── engineering/components/      # FloorPlan, FacadeView, Viewer3D, EngineeringPage
│   ├── budget/components/           # BudgetPage
│   ├── crm/components/              # CRMPage
│   ├── admin/components/            # AdminPage
│   └── export/components/           # ExportPage, PDFReportTemplate, ExportDataButton
│
└── shared/
    ├── components/app-layout.tsx    # Layout principal con navegacion
    ├── lib/
    │   ├── constants.ts             # INITIAL_PRICES, dimensiones default
    │   ├── calculations.ts          # Calculos geometricos (areas, paneles, perimetros)
    │   └── budget.ts                # Logica de presupuesto
    ├── store/useStore.ts            # Zustand store global (persist en localStorage)
    └── types/index.ts               # TODOS los tipos del dominio
```

### Convenciones de Archivos

- **Componentes**: `PascalCase` → `FloorPlan`, `FacadeView`, `Viewer3D`
- **Archivos**: `kebab-case` → `floor-plan.tsx`, `facade-view.tsx`
- **Variables/funciones**: `camelCase`
- **Tipos**: `PascalCase` → `FacadeSide`, `Opening`, `InteriorWall`

---

## Modulos del Sistema

### 1. Engineering (Modulo Principal)
- **FloorPlan**: Editor 2D SVG de planta — muros, aberturas, mediciones
- **FacadeView**: Vista SVG de cada fachada con paneles, aberturas, retranqueos
- **Viewer3D**: Visualizacion Three.js interactiva de la casa completa
- **EngineeringPage**: Orquesta los 3 viewers + controles laterales

### 2. Budget
- Calcula materiales automaticamente desde la geometria
- Permite overrides manuales (qty, price, name, unit, category)
- Muestra subtotal y total con ajuste porcentual

### 3. CRM
- Registro de leads/clientes con area, estado, presupuesto
- Datos: nombre, email, telefono, ubicacion, CUIT

### 4. Admin
- Gestion de precios base de productos
- Categorias de materiales

### 5. Export
- Genera PDF con planta, fachadas, 3D, presupuesto detallado
- Usa html2canvas para capturar vistas + jsPDF

---

## Store (Zustand)

El store en `shared/store/useStore.ts` es el corazon de la app:
- **Persist**: Guarda en localStorage automaticamente
- **History**: Undo/Redo con snapshots
- **Secciones**: Project, Dimensions, Walls, Openings, Facades, Selections, CRM, Products, Rooms, SavedDesigns
- **Snap**: Grid de 5cm (SNAP_VALUE = 0.05) para alineacion

### Tipos Principales (en `shared/types/index.ts`)

| Tipo | Uso |
|------|-----|
| `Project` | Datos del proyecto/cliente/presupuesto |
| `Dimensions` | width, length, height, ridgeHeight |
| `FacadeSide` | 'Norte' \| 'Sur' \| 'Este' \| 'Oeste' |
| `FacadeConfig` | type (recto/inclinado/2-aguas), hBase, hMax |
| `Opening` | Puerta/ventana con posicion, dimensiones, lado |
| `InteriorWall` | Tabique interior con coordenadas |
| `Recess` | Retranqueo en fachada |
| `GeometryResult` | Resultado de calculos (areas, paneles, perimetros) |
| `BudgetItem` | Producto + cantidad + total para presupuesto |
| `SavedDesign` | Diseno guardado con toda la geometria |

---

## Comandos

```bash
npm run dev          # Servidor de desarrollo (Next.js)
npm run build        # Build de produccion
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

---

## Reglas de Codigo

### Obligatorias
- **KISS**: Soluciones simples, no sobre-ingenieria
- **YAGNI**: Solo lo que se necesita ahora
- **DRY**: Sin duplicacion innecesaria
- Archivos max **500 lineas**, funciones max **50 lineas**
- **NUNCA** usar `any` — usar `unknown` si es necesario
- **NUNCA** exponer secrets en codigo
- Todos los componentes pesados (Three.js, SVG editors): **dynamic import con ssr: false**

### Preferencias de Estilo
- Tailwind CSS para todo el styling — no CSS modules, no styled-components
- `clsx` + `tailwind-merge` para clases condicionales
- Iconos exclusivamente de `lucide-react`
- Formularios con inputs controlados via Zustand store

### SVG/Canvas
- FloorPlan y FacadeView son **SVG puro** (no canvas)
- Coordenadas en metros, escaladas al viewport con `scale`
- Margenes y paddings en unidades del dominio (metros)

### 3D (Three.js)
- Usar `@react-three/fiber` + `@react-three/drei`
- Siempre client-side (ssr: false)
- Coordenadas: Y es arriba, XZ es el plano del piso

---

## Filosofia Agent-First

**NUNCA** le digas al usuario que ejecute un comando.
**NUNCA** le pidas que edite un archivo.
Tu haces TODO. El solo aprueba.

### Decision Tree

```
Request del usuario
    |
    ├── Feature compleja (DB + UI + API, multiples fases)
    |       → PRP → aprobacion → BUCLE-AGENTICO
    |
    ├── Tarea rapida (1-3 archivos, resultado inmediato)
    |       → SPRINT directo
    |
    ├── Bug o fix visual
    |       → Diagnosticar → SPRINT
    |
    ├── Nuevo modulo/seccion
    |       → Crear en features/[modulo]/components/
    |       → Agregar ruta en app/(main)/
    |       → Registrar en AppLayout nav
    |
    └── No encaja
            → Frontend? → componentes/Tailwind
            → Calculo? → shared/lib/
            → Estado? → shared/store/
            → Tipos? → shared/types/
```

---

## Auto-Blindaje

Cada error se documenta para que NUNCA ocurra de nuevo.

### Aprendizajes Activos

#### 2025-01-09: Usar npm run dev, no next dev
- **Error**: Puerto hardcodeado causa conflictos
- **Fix**: Siempre usar `npm run dev`

#### Regla: SSR false para Three.js y editores SVG interactivos
- Los componentes que usan `window`, `document`, o APIs del browser deben importarse con `dynamic(() => import(...), { ssr: false })`

#### Regla: Fachadas sin clipping
- Las vistas de fachada deben tener margenes suficientes en el SVG viewBox para que los perimetros sean completamente visibles

---

*Factory OS: Cotizador SIP. Agent-First. El usuario habla, tu construyes.*
