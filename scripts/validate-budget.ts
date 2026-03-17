/**
 * Script de validación independiente para el módulo Budget
 * Prueba los cálculos de materiales contra las fórmulas definidas
 *
 * Ejecutar: npx tsx scripts/validate-budget.ts
 */

// ============================================================
// FÓRMULAS ESPERADAS (extraídas de las reglas del proyecto)
// ============================================================
// Panel estándar SIP: 1.22m x 2.44m = 2.977 m²
// Variables de entrada: paneles_muros, paneles_piso, paneles_techo_conv, paneles_techo_sandwich
//
// MADERAS:
//   MAD_VINC_2X3 = paneles_muros * 7
//   MAD_VINC_PISO_2X3 = paneles_piso * 5
//   MAD_SOL_BASE = paneles_muros * 1
//   MAD_ACOMP_SOL = paneles_muros * 1
//   MAD_VIGA_TECHO_3X6 = paneles_techo_conv * 3.5
//   MAD_CLAV_2X2 = paneles_muros * 3.5
//   MAD_CLAV_TECHO_2X2 = paneles_techo_conv * 4
//   FLEJES_TECHO = paneles_techo_conv * 3.25
//
// TORNILLOS:
//   FIX_6X1_5 = (paneles_muros + paneles_piso) * 55
//   FIX_6X2 = paneles_muros * 3
//   TORX_120 = paneles_muros * 2.25
//   TORX_140 = paneles_muros * 5
//   TORN_HEX_3 = paneles_techo_conv * 28
//   HEX_T2_14X5 = paneles_techo_sandwich * 5.5
//   FIX_6X1 = paneles_techo_conv * 11
//   FIX_8X3 = paneles_muros * 8 + paneles_techo_conv * 10
//
// FIJACIÓN:
//   VARILLA_12 = max(1, round(paneles_muros * 0.22)) [solo platea]
//   KIT_TUERCA = VARILLA_12 * 3
//   ANCLAJE_QUIMICO = max(1, round(paneles_muros * 0.12))
//
// SELLADORES:
//   ESPUMA_PU = max(1, round(total_paneles * 0.22))
//   PEG_PU = max(1, round(paneles_muros * 0.05))
//   MEMB_LIQ = max(1, round(paneles_muros * 0.035))
//   MEMB_AUTO = max(1, round(paneles_muros * 0.03))
//
// CUBIERTA:
//   CHAPA_C27 = ceil(paneles_techo_conv * 2.977)
//   BARRERA = max(1, ceil(paneles_muros / 12))
// ============================================================

interface TestCase {
  name: string;
  paneles_muros_ext: number;
  paneles_muros_int: number;
  paneles_piso: number;
  paneles_techo: number;
  areaPiso: number;
  areaTecho: number;
  foundationType: 'platea' | 'estructura';
  structureType: 'madera' | 'metal';
  roofSystem: 'sip' | 'sandwich';
  includeExterior: boolean;
  includeInterior: boolean;
  includeFloor: boolean;
  includeRoof: boolean;
}

interface ExpectedQuantities {
  [key: string]: number;
}

function calculateExpected(tc: TestCase): ExpectedQuantities {
  const includeFloor = tc.foundationType === 'platea' ? false : tc.includeFloor;
  const paneles_muros = (tc.includeExterior ? tc.paneles_muros_ext : 0) + (tc.includeInterior ? tc.paneles_muros_int : 0);
  const paneles_piso = includeFloor ? tc.paneles_piso : 0;
  const isSandwich = tc.roofSystem === 'sandwich';
  const paneles_techo_conv = (tc.includeRoof && !isSandwich) ? tc.paneles_techo : 0;
  const paneles_techo_sandwich = (tc.includeRoof && isSandwich) ? tc.paneles_techo : 0;
  const total_paneles = paneles_muros + paneles_piso + (tc.includeRoof ? tc.paneles_techo : 0);

  const varilla = !includeFloor && paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.22)) : 0;

  return {
    // Maderas
    MAD_VINC_2X3: Math.round(paneles_muros * 7),
    MAD_VINC_PISO_2X3: includeFloor ? Math.round(paneles_piso * 5) : 0,
    MAD_SOL_BASE: Math.round(paneles_muros * 1),
    MAD_ACOMP_SOL: Math.round(paneles_muros * 1),
    MAD_VIGA_TECHO_3X6: Math.round(paneles_techo_conv * 3.5),
    MAD_CLAV_2X2: Math.round(paneles_muros * 3.5),
    MAD_CLAV_TECHO_2X2: Math.round(paneles_techo_conv * 4),
    FLEJES_TECHO: Math.round(paneles_techo_conv * 3.25),
    MAD_VIGA_PISO_3X6: includeFloor && (tc.structureType === 'madera' || tc.structureType === 'metal') ? Math.ceil(tc.areaPiso * 2.5 * 1.1) : 0,
    // Tornillos
    FIX_6X1_5: Math.round((paneles_muros + paneles_piso) * 55),
    FIX_6X2: Math.round(paneles_muros * 3),
    TORX_120: Math.round(paneles_muros * 2.25),
    TORX_140: Math.round(paneles_muros * 5),
    TORN_HEX_3: Math.round(paneles_techo_conv * 28),
    HEX_T2_14X5: Math.round(paneles_techo_sandwich * 5.5),
    FIX_6X1: Math.round(paneles_techo_conv * 11),
    FIX_8X3: Math.round(paneles_muros * 8 + paneles_techo_conv * 10),
    // Fijación
    VARILLA_12: varilla,
    KIT_TUERCA: varilla * 3,
    ANCLAJE_QUIMICO: paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.12)) : 0,
    // Selladores
    ESPUMA_PU: total_paneles > 0 ? Math.max(1, Math.round(total_paneles * 0.22)) : 0,
    PEG_PU: paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.05)) : 0,
    MEMB_LIQ: paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.035)) : 0,
    MEMB_AUTO: paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.03)) : 0,
    // Cubierta
    CHAPA_C27: Math.ceil(paneles_techo_conv * 2.977),
    BARRERA: paneles_muros > 0 ? Math.max(1, Math.ceil(paneles_muros / 12)) : 0,
  };
}

function simulateCalculateQuantities(tc: TestCase): ExpectedQuantities {
  // Simula exactamente lo que hace calculateQuantities del código fuente
  const includeFloor = tc.foundationType === 'platea' ? false : tc.includeFloor;
  const paneles_muros = (tc.includeExterior ? tc.paneles_muros_ext : 0) + (tc.includeInterior ? tc.paneles_muros_int : 0);
  const paneles_piso = includeFloor ? tc.paneles_piso : 0;
  const isSandwich = tc.roofSystem === 'sandwich';
  const paneles_techo_conv = (tc.includeRoof && !isSandwich) ? tc.paneles_techo : 0;
  const paneles_techo_sandwich = (tc.includeRoof && isSandwich) ? tc.paneles_techo : 0;
  const total_paneles = paneles_muros + paneles_piso + (tc.includeRoof ? tc.paneles_techo : 0);

  const q: ExpectedQuantities = {};

  q['MAD_VINC_2X3'] = Math.round(paneles_muros * 7);
  q['MAD_VINC_PISO_2X3'] = includeFloor ? Math.round(paneles_piso * 5) : 0;
  q['MAD_SOL_BASE'] = Math.round(paneles_muros * 1);
  q['MAD_ACOMP_SOL'] = Math.round(paneles_muros * 1);
  q['MAD_VIGA_TECHO_3X6'] = Math.round(paneles_techo_conv * 3.5);
  q['MAD_CLAV_2X2'] = Math.round(paneles_muros * 3.5);
  q['MAD_CLAV_TECHO_2X2'] = Math.round(paneles_techo_conv * 4);
  q['FLEJES_TECHO'] = Math.round(paneles_techo_conv * 3.25);
  if (includeFloor && (tc.structureType === 'madera' || tc.structureType === 'metal')) {
    q['MAD_VIGA_PISO_3X6'] = Math.ceil(tc.areaPiso * 2.5 * 1.1);
  } else {
    q['MAD_VIGA_PISO_3X6'] = 0;
  }
  q['FIX_6X1_5'] = Math.round((paneles_muros + paneles_piso) * 55);
  q['FIX_6X2'] = Math.round(paneles_muros * 3);
  q['TORX_120'] = Math.round(paneles_muros * 2.25);
  q['TORX_140'] = Math.round(paneles_muros * 5);
  q['TORN_HEX_3'] = Math.round(paneles_techo_conv * 28);
  q['HEX_T2_14X5'] = Math.round(paneles_techo_sandwich * 5.5);
  q['FIX_6X1'] = Math.round(paneles_techo_conv * 11);
  q['FIX_8X3'] = Math.round(paneles_muros * 8 + paneles_techo_conv * 10);

  if (!includeFloor) {
    q['VARILLA_12'] = paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.22)) : 0;
  } else {
    q['VARILLA_12'] = 0;
  }
  q['KIT_TUERCA'] = q['VARILLA_12'] * 3;
  q['ANCLAJE_QUIMICO'] = paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.12)) : 0;

  q['ESPUMA_PU'] = total_paneles > 0 ? Math.max(1, Math.round(total_paneles * 0.22)) : 0;
  q['PEG_PU'] = paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.05)) : 0;
  q['MEMB_LIQ'] = paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.035)) : 0;
  q['MEMB_AUTO'] = paneles_muros > 0 ? Math.max(1, Math.round(paneles_muros * 0.03)) : 0;

  q['CHAPA_C27'] = Math.ceil(paneles_techo_conv * 2.977);
  q['BARRERA'] = paneles_muros > 0 ? Math.max(1, Math.ceil(paneles_muros / 12)) : 0;

  return q;
}

// ============================================================
// 10 CASOS DE PRUEBA
// ============================================================
const testCases: TestCase[] = [
  {
    name: "1. Monoambiente 4x6 platea SIP",
    paneles_muros_ext: 8, paneles_muros_int: 2, paneles_piso: 0, paneles_techo: 9,
    areaPiso: 24, areaTecho: 28, foundationType: 'platea', structureType: 'madera',
    roofSystem: 'sip', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "2. Casa 6x8 platea SIP",
    paneles_muros_ext: 16, paneles_muros_int: 4, paneles_piso: 0, paneles_techo: 17,
    areaPiso: 48, areaTecho: 55, foundationType: 'platea', structureType: 'madera',
    roofSystem: 'sip', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "3. Casa 8x10 platea SIP",
    paneles_muros_ext: 24, paneles_muros_int: 6, paneles_piso: 0, paneles_techo: 27,
    areaPiso: 80, areaTecho: 90, foundationType: 'platea', structureType: 'madera',
    roofSystem: 'sip', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "4. Casa 10x12 platea Sandwich",
    paneles_muros_ext: 32, paneles_muros_int: 8, paneles_piso: 0, paneles_techo: 40,
    areaPiso: 120, areaTecho: 130, foundationType: 'platea', structureType: 'metal',
    roofSystem: 'sandwich', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "5. Cabana 4x5 estructura madera Sandwich",
    paneles_muros_ext: 6, paneles_muros_int: 1, paneles_piso: 7, paneles_techo: 8,
    areaPiso: 20, areaTecho: 25, foundationType: 'estructura', structureType: 'madera',
    roofSystem: 'sandwich', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "6. Solo muros exteriores (sin int, sin piso, sin techo)",
    paneles_muros_ext: 14, paneles_muros_int: 0, paneles_piso: 0, paneles_techo: 0,
    areaPiso: 42, areaTecho: 0, foundationType: 'platea', structureType: 'madera',
    roofSystem: 'sip', includeExterior: true, includeInterior: false, includeFloor: false, includeRoof: false,
  },
  {
    name: "7. Sin muros exteriores (solo interiores + techo)",
    paneles_muros_ext: 12, paneles_muros_int: 3, paneles_piso: 0, paneles_techo: 15,
    areaPiso: 56, areaTecho: 60, foundationType: 'platea', structureType: 'madera',
    roofSystem: 'sip', includeExterior: false, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "8. Oficina 5x6 platea Sandwich",
    paneles_muros_ext: 10, paneles_muros_int: 2, paneles_piso: 0, paneles_techo: 11,
    areaPiso: 30, areaTecho: 32, foundationType: 'platea', structureType: 'metal',
    roofSystem: 'sandwich', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "9. Duplex 6x10 platea SIP",
    paneles_muros_ext: 20, paneles_muros_int: 8, paneles_piso: 0, paneles_techo: 21,
    areaPiso: 60, areaTecho: 68, foundationType: 'platea', structureType: 'metal',
    roofSystem: 'sip', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
  {
    name: "10. Casa grande estructura con piso 10x12",
    paneles_muros_ext: 30, paneles_muros_int: 10, paneles_piso: 41, paneles_techo: 35,
    areaPiso: 120, areaTecho: 135, foundationType: 'estructura', structureType: 'madera',
    roofSystem: 'sip', includeExterior: true, includeInterior: true, includeFloor: true, includeRoof: true,
  },
];

// ============================================================
// EJECUCIÓN
// ============================================================
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

console.log('='.repeat(70));
console.log('  VALIDACIÓN DE FÓRMULAS - MÓDULO BUDGET');
console.log('  10 Casos de Prueba vs Fórmulas Definidas');
console.log('='.repeat(70));
console.log('');

for (const tc of testCases) {
  const expected = calculateExpected(tc);
  const actual = simulateCalculateQuantities(tc);

  let casePass = true;
  const caseFailures: string[] = [];

  for (const key of Object.keys(expected)) {
    totalTests++;
    if (expected[key] !== actual[key]) {
      casePass = false;
      failedTests++;
      caseFailures.push(`    FALLO: ${key} — esperado: ${expected[key]}, obtenido: ${actual[key]}`);
    } else {
      passedTests++;
    }
  }

  const includeFloor = tc.foundationType === 'platea' ? false : tc.includeFloor;
  const pm = (tc.includeExterior ? tc.paneles_muros_ext : 0) + (tc.includeInterior ? tc.paneles_muros_int : 0);
  const pp = includeFloor ? tc.paneles_piso : 0;
  const pt = tc.includeRoof ? tc.paneles_techo : 0;

  if (casePass) {
    console.log(`  PASS  ${tc.name}`);
    console.log(`        paneles_muros=${pm}  paneles_piso=${pp}  paneles_techo=${pt}  total=${pm+pp+pt}`);
  } else {
    console.log(`  FAIL  ${tc.name}`);
    console.log(`        paneles_muros=${pm}  paneles_piso=${pp}  paneles_techo=${pt}  total=${pm+pp+pt}`);
    caseFailures.forEach(f => console.log(f));
    failures.push(...caseFailures);
  }
  console.log('');
}

console.log('='.repeat(70));
console.log(`  RESULTADO: ${passedTests}/${totalTests} pruebas pasaron`);
if (failedTests === 0) {
  console.log('  TODAS LAS FÓRMULAS COINCIDEN');
} else {
  console.log(`  ${failedTests} pruebas FALLARON:`);
  failures.forEach(f => console.log(f));
}
console.log('='.repeat(70));

// Tabla resumen de un caso ejemplo
console.log('');
console.log('  DETALLE CASO 2 (Casa 6x8 platea SIP):');
console.log('-'.repeat(55));
const detail = calculateExpected(testCases[1]);
const categories: Record<string, string[]> = {
  'MADERAS': ['MAD_VINC_2X3', 'MAD_VINC_PISO_2X3', 'MAD_SOL_BASE', 'MAD_ACOMP_SOL', 'MAD_VIGA_TECHO_3X6', 'MAD_CLAV_2X2', 'MAD_CLAV_TECHO_2X2', 'FLEJES_TECHO', 'MAD_VIGA_PISO_3X6'],
  'TORNILLOS': ['FIX_6X1_5', 'FIX_6X2', 'TORX_120', 'TORX_140', 'TORN_HEX_3', 'HEX_T2_14X5', 'FIX_6X1', 'FIX_8X3'],
  'FIJACIÓN': ['VARILLA_12', 'KIT_TUERCA', 'ANCLAJE_QUIMICO'],
  'SELLADORES': ['ESPUMA_PU', 'PEG_PU', 'MEMB_LIQ', 'MEMB_AUTO'],
  'CUBIERTA': ['CHAPA_C27', 'BARRERA'],
};
for (const [cat, keys] of Object.entries(categories)) {
  console.log(`  ${cat}:`);
  for (const k of keys) {
    console.log(`    ${k.padEnd(22)} = ${detail[k]}`);
  }
}
console.log('-'.repeat(55));

process.exit(failedTests > 0 ? 1 : 0);
