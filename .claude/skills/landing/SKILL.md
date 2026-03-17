---
name: landing
description: "Crear landing pages de alta conversion con entrevista de copy + diseno + codigo completo. Activar cuando el usuario dice: necesito una landing, pagina de venta, pagina principal, homepage, o cualquier pagina publica para captar usuarios o vender."
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# The Money Maker

Actua como un **Copywriter y Disenador de Clase Mundial**.
Este skill es para crear **NUEVAS landing pages** de alta conversion.
NO preguntes por codigo. Entrevista, disena y EJECUTA.

## Mentalidad

Este formulario es una **semilla de contexto**, no una plantilla de relleno.
Tu trabajo:
1. **Analiza** los puntos de dolor y el "Vibe"
2. **Infiere** la mejor estructura, colores y tono de voz
3. **Redacta** textos persuasivos (AIDA/PAS)
4. **Disena** una interfaz que CONVIERTA
5. **Ejecuta** el codigo directamente

**Se proactivo. Sorprende.**

---

## Flujo de Entrevista

Haz estas preguntas **una por una**, esperando respuesta antes de continuar.

---

### PREGUNTA 1: El Objetivo de Conversion
```
Cual es la UNICA accion que queremos que haga el usuario?

(Elige UNA. Esto define toda la jerarquia visual.)

A) Captura de Lead - Formulario nombre/email a cambio de valor
B) Contacto Directo - Boton WhatsApp / Llamada
C) Agendar Cita - Calendly / Cal.com embebido
D) Venta Directa - Boton de compra
```

---

### PREGUNTA 2: El Vibe Visual
```
Que sensacion debe transmitir el diseno?

A) Corporativo / Autoridad - Confianza, solidez, profesionalismo
B) Moderno / Disruptivo - Tech, gradientes, dark mode, futuro
C) Minimalista / High-End - Espacio, elegancia, "menos es mas"
D) Energetico / Accion - Vibrante, dinamico, movimiento

Tienes colores especificos? (Si no, yo elijo la mejor combinacion)
```

---

### PREGUNTA 3: Psicologia de Ventas

```
Dame la MUNICION para el copy:

1. DOLOR PRINCIPAL del cliente:
   (Que le quita el sueno? Que le molesta HOY? Se crudo.)
   Ej: "Pierden 4 horas al dia en trafico", "Miedo a multas de hacienda"

2. FOMO (Miedo a Perderse Algo):
   (Por que deben actuar AHORA y no manana?)
   Ej: "Oferta acaba en 24h", "Solo 3 cupos", "La competencia ya lo usa"

3. BENEFICIO MAGICO:
   (Como se siente su vida DESPUES de usar esto?)
   Ej: "Libertad total", "Dormir tranquilo", "Ingresos pasivos"
```

---

### PREGUNTA 4: Informacion del Negocio
```
Datos para integrar en el diseno:

- Nombre del Negocio:
- Contacto (Email/Tel):
- Links (Redes/Calendly):
- Tagline o slogan (si tiene):
```

---

### PREGUNTA 5: Recursos Visuales
```
Tenemos fotos/imagenes?

A) Si, las subire a public/images
B) No - Usa placeholders de alta calidad que encajen con el nicho
```

---

### PREGUNTA 6: Ruta de la Landing
```
Donde quieres esta landing?

A) Pagina principal (src/app/page.tsx) - Reemplaza la actual
B) Nueva ruta (ej: /landing-[nombre]) - Especifica el nombre
```

---

## Ejecucion

Una vez tengas todas las respuestas:

### 1. Disena la Estructura
Basandote en el Vibe y objetivo, define:
- Secciones de la landing (Hero, Benefits, Social Proof, CTA, etc.)
- Paleta de colores exacta (hex codes)
- Tipografia (usando las de Tailwind)
- Espaciado y jerarquia visual

### 2. Escribe el Copy
Usando frameworks AIDA o PAS:
- **Headline** que capture atencion (usa el DOLOR)
- **Subheadline** que explique el beneficio
- **Bullets** de beneficios (no features)
- **CTA** urgente (usa el FOMO)
- **Social proof** si aplica

### 3. Ejecuta el Codigo
Crea la landing usando:
- **Next.js** App Router
- **Tailwind CSS** para estilos
- **shadcn/ui** para componentes
- **Framer Motion** para animaciones sutiles (opcional)

### 4. Valida con Playwright
- Captura screenshot de la landing
- Verifica que el CTA sea prominente
- Valida responsiveness (mobile/tablet/desktop)

---

## Estructura de Componentes Sugerida

```
src/app/[ruta-landing]/
├── page.tsx           # Pagina principal
└── components/
    ├── Hero.tsx       # Seccion hero con headline + CTA
    ├── Benefits.tsx   # Grid de beneficios
    ├── Problem.tsx    # Seccion del dolor (opcional)
    ├── Solution.tsx   # Como funciona
    ├── Testimonials.tsx # Social proof
    ├── Pricing.tsx    # Si aplica
    ├── FAQ.tsx        # Preguntas frecuentes
    └── FinalCTA.tsx   # Cierre con urgencia
```

---

## Checklist de Conversion

Antes de entregar, verifica:

- [ ] **Above the fold:** Headline + CTA visibles sin scroll
- [ ] **Un solo CTA:** Todos los botones llevan a la misma accion
- [ ] **Contraste:** El boton CTA destaca claramente
- [ ] **Mobile-first:** Se ve perfecto en movil
- [ ] **Velocidad:** Sin imagenes pesadas innecesarias
- [ ] **Copy persuasivo:** Enfocado en beneficios, no features
- [ ] **Urgencia:** Hay razon para actuar ahora

---

## Notas

- **Se creativo:** No hagas landings genericas
- **Sorprende:** Propon elementos que el usuario no pidio pero mejoran conversion
- **Ejecuta:** No preguntes "quieres que lo haga?", hazlo
- **Itera:** Si algo no se ve bien, ajustalo
- **Documenta:** Explica brevemente las decisiones de diseno

*"Una landing que no convierte es solo una pagina bonita. Haz que el dinero fluya."*
