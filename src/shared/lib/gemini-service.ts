const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface GeminiExtractionResult {
  proyecto: { nombre: string; superficie_total: number; proyectista: string; fecha: string };
  dimensiones_generales: { largo: number; ancho: number; altura_minima: number; altura_maxima: number };
  muros_exteriores: Array<{ nombre: string; tipo: 'straight' | 'mono-slope' | 'gable'; largo: number; altura_base: number; altura_pico: number }>;
  muros_interiores: Array<{ nombre: string; largo: number; altura: number }>;
  aberturas: Array<{ tipo: 'door' | 'window'; denominacion: string; cantidad: number; ancho: number; alto: number; muro_asociado: string }>;
  paneles_identificados: Array<{ numero: number; ancho: number; alto: number; ubicacion: string }>;
  techo: { tipo: string; pendiente_estimada: number; superficie_proyeccion: number; material: string };
  estructura: { tipo_fundacion: string; tipo_estructura: string; montantes: string };
  confianza: number;
  notas: string[];
}

const PROMPT_EXTRACCION = `Sos un experto en construcción con paneles SIP (Structural Insulated Panels) y en lectura de planos arquitectónicos.

Analizá este PDF de planos de una vivienda y extraé TODA la información técnica necesaria para cotizar los materiales SIP.

INSTRUCCIONES DE EXTRACCIÓN:

1. PROYECTO: Buscá nombre del proyecto, superficie total (m²), proyectista y fecha en las carátulas de los planos.

2. DIMENSIONES GENERALES: Del plano de planta (layout), extraé largo y ancho totales de la vivienda, y las alturas mínima y máxima de los cortes/vistas.

3. MUROS EXTERIORES: Identificá cada muro perimetral. Para cada uno determiná:
   - Nombre descriptivo (ej: "Fachada Norte", "Lateral Este")
   - Tipo: "straight" (altura uniforme), "mono-slope" (una agua, altura varía linealmente), "gable" (a dos aguas, tiene pico)
   - Largo en metros
   - Altura base en metros
   - Altura pico en metros (igual a base si es straight)

4. MUROS INTERIORES: Identificá tabiques y divisiones internas con largo y altura.

5. ABERTURAS: De la planilla de aberturas o del plano de planta, listá TODAS las puertas y ventanas con:
   - Tipo (door/window)
   - Denominación (P1, V1, PV1, etc.)
   - Cantidad
   - Ancho y alto en metros
   - A qué muro están asociadas (si es posible determinarlo)

6. PANELES IDENTIFICADOS: Si el plano incluye láminas de despiece de paneles (numerados), listá cada panel con número, ancho, alto y ubicación.

7. TECHO: Tipo de techo (una agua, dos aguas, plano), pendiente estimada en grados, superficie en proyección, material (ej: sandwich chapa, convencional).

8. ESTRUCTURA: Tipo de fundación (platea, pilotes, etc.), tipo de estructura (wood frame, steel frame), dimensión de montantes.

9. CONFIANZA: Un número de 0 a 100 indicando qué tan completa y confiable es tu extracción. 100 = extraje todo con certeza. Menos de 70 = hay datos que tuve que estimar.

10. NOTAS: Lista de observaciones, datos que no pudiste extraer, o cosas que el usuario debería verificar.

IMPORTANTE:
- Si un dato NO está en el plano, estimalo razonablemente y marcalo en las notas.
- Los planos pueden tener geometrías irregulares, techos a diferentes alturas, galerías externas, etc. Adaptate a lo que veas.
- Priorizá la información de las láminas de PANELES y ABERTURAS si existen, ya que son las más precisas.
- Las dimensiones están en metros. Si ves centímetros, convertí.

Respondé ÚNICAMENTE con un JSON válido con esta estructura exacta:

{
  "proyecto": { "nombre": "", "superficie_total": 0, "proyectista": "", "fecha": "" },
  "dimensiones_generales": { "largo": 0, "ancho": 0, "altura_minima": 0, "altura_maxima": 0 },
  "muros_exteriores": [{ "nombre": "", "tipo": "straight|mono-slope|gable", "largo": 0, "altura_base": 0, "altura_pico": 0 }],
  "muros_interiores": [{ "nombre": "", "largo": 0, "altura": 0 }],
  "aberturas": [{ "tipo": "door|window", "denominacion": "", "cantidad": 0, "ancho": 0, "alto": 0, "muro_asociado": "" }],
  "paneles_identificados": [{ "numero": 0, "ancho": 0, "alto": 0, "ubicacion": "" }],
  "techo": { "tipo": "", "pendiente_estimada": 0, "superficie_proyeccion": 0, "material": "" },
  "estructura": { "tipo_fundacion": "", "tipo_estructura": "", "montantes": "" },
  "confianza": 0,
  "notas": []
}`;

export async function analizarPlano(pdfFile: File): Promise<GeminiExtractionResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API_KEY_INVALID');

  if (pdfFile.size > 20 * 1024 * 1024) throw new Error('file_too_large');

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(pdfFile);
  });

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
        { text: PROMPT_EXTRACCION }
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const errMsg = err?.error?.message || '';
    const errStatus = err?.error?.status || '';
    console.error('[Gemini] API error:', response.status, errStatus, errMsg, JSON.stringify(err));
    // Show the actual Google error to the user for debugging
    if (errMsg) {
      throw new Error(`Google API (${response.status}): ${errMsg}`);
    }
    const code = errStatus || (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'INTERNAL');
    throw new Error(code);
  }

  const data = await response.json();
  console.log('[Gemini] Raw response:', JSON.stringify(data).substring(0, 500));

  // Check for blocked or empty responses
  if (!data.candidates || data.candidates.length === 0) {
    console.error('[Gemini] No candidates in response:', data);
    throw new Error(data.promptFeedback?.blockReason || 'INTERNAL');
  }

  const candidate = data.candidates[0];
  if (candidate.finishReason === 'SAFETY') {
    console.error('[Gemini] Blocked by safety filters');
    throw new Error('INVALID_ARGUMENT');
  }

  const text = candidate.content?.parts?.[0]?.text || '';
  if (!text) {
    console.error('[Gemini] Empty text in response');
    throw new Error('parse_error');
  }

  // Clean potential markdown wrappers and parse JSON
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('[Gemini] JSON parse failed. Raw text:', text.substring(0, 1000));
    throw new Error('parse_error');
  }
}

export async function analizarConRetry(pdfFile: File, maxRetries = 2): Promise<GeminiExtractionResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await analizarPlano(pdfFile);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('429') || msg === 'RATE_LIMIT_EXCEEDED') {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error('No se pudo analizar el plano');
}

export const ERROR_MESSAGES: Record<string, string> = {
  'API_KEY_INVALID': 'La API key de Gemini no es valida. Verificala en ai.google.dev',
  'RATE_LIMIT_EXCEEDED': 'Limite de uso alcanzado. Espera unos segundos e intenta de nuevo.',
  'RESOURCE_EXHAUSTED': 'Se agoto la cuota diaria gratuita. Intenta manana.',
  'INVALID_ARGUMENT': 'El PDF no pudo ser procesado. Verifica que no este danado.',
  'INTERNAL': 'Error interno de Gemini. Intenta de nuevo en unos segundos.',
  'parse_error': 'No se pudo interpretar la respuesta. Intenta de nuevo.',
  'file_too_large': 'El PDF supera los 20MB. Intenta con un archivo mas liviano.',
  'network_error': 'Error de conexion. Verifica tu internet e intenta de nuevo.',
};

export function calcularDesdeExtraccion(datos: GeminiExtractionResult) {
  const PANEL_AREA = 1.22 * 2.44;
  const wastes = { walls: 1.045, floor: 1.02, roof: 1.085, internal: 1.05 };

  let extWallAreaGross = 0;
  let openingsArea = 0;
  let openingsPerimeter = 0;

  datos.muros_exteriores.forEach(m => {
    if (m.tipo === 'straight') extWallAreaGross += m.largo * m.altura_base;
    else if (m.tipo === 'mono-slope') extWallAreaGross += m.largo * (m.altura_base + m.altura_pico) / 2;
    else if (m.tipo === 'gable') extWallAreaGross += (m.largo * m.altura_base) + (m.largo * (m.altura_pico - m.altura_base) / 2);
  });

  datos.aberturas.forEach(ab => {
    openingsArea += ab.ancho * ab.alto * ab.cantidad;
    openingsPerimeter += 2 * (ab.ancho + ab.alto) * ab.cantidad;
  });

  const houseArea = datos.dimensiones_generales.largo * datos.dimensiones_generales.ancho;
  const intArea = datos.muros_interiores.reduce((s, m) => s + m.largo * m.altura, 0);
  const roofArea = datos.techo.superficie_proyeccion > 0
    ? datos.techo.superficie_proyeccion * 1.05
    : houseArea * 1.18 * 1.05;

  const wallPanels = Math.ceil(((extWallAreaGross - openingsArea) / PANEL_AREA) * wastes.walls);
  const floorPanels = Math.ceil((houseArea / PANEL_AREA) * wastes.floor);
  const roofPanels = Math.ceil((roofArea / PANEL_AREA) * wastes.roof);
  const internalPanels = Math.ceil((intArea / PANEL_AREA) * wastes.internal);
  const totalPanels = wallPanels + floorPanels + roofPanels + internalPanels;
  const totalPanelsPerimeter = totalPanels * (2 * (1.22 + 2.44));

  return {
    wallPanels, floorPanels, roofPanels, internalPanels, totalPanels,
    houseArea,
    housePerimeter: 2 * (datos.dimensiones_generales.largo + datos.dimensiones_generales.ancho),
    extWallAreaGross,
    extWallAreaNet: extWallAreaGross - openingsArea,
    roofArea,
    openingsArea,
    openingsPerimeter,
    internalLinearMeters: datos.muros_interiores.reduce((s, m) => s + m.largo, 0),
    intArea,
    totalPanelsPerimeter,
    totalCutPerimeter: (totalPanelsPerimeter * 0.15) + openingsPerimeter,
  };
}
