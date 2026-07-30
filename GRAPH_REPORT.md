# 🕸️ GRAPHIFY KNOWLEDGE GRAPH REPORT

> **Proyecto:** CORAZA CTA — Sistema de Control Táctico de Seguridad
> **Fecha de Análisis:** 30/7/2026, 12:31:19 p. m.
> **Motor:** Graphify Local AST Dependency Parser

---

## 📊 Resumen Ejecutivo del Grafo

- 📁 **Total de Módulos / Archivos (`src/`):** `54`
- 🔗 **Total de Conexiones / Relaciones:** `149`
- 📄 **Páginas de UI:** `9`
- 🧩 **Componentes Reutilizables:** `22`
- 🧠 **Stores de Estado (Zustand):** `10`
- 🪝 **Hooks Personalizados:** `3`
- 🛠️ **Utilidades & Libs:** `6`

---

## 👑 "God Nodes" — Módulos Críticos y Más Conectados

Los **God Nodes** son los componentes y módulos con mayor número de dependencias entrantes y salientes:

| Rango | Módulo | Categoría | Grado Total | Entrantes (In) | Salientes (Out) | Líneas |
|---|---|---|---|---|---|---|
| 1 | `store/programacionStore.ts` | `store` | **25** | 17 | 8 | 2108 |
| 2 | `store/puestoStore.ts` | `store` | **25** | 21 | 4 | 605 |
| 3 | `store/vigilanteStore.ts` | `store` | **23** | 20 | 3 | 719 |
| 4 | `pages/GestionPuestos.tsx` | `page` | **22** | 0 | 22 | 2838 |
| 5 | `utils/tacticalToast.tsx` | `util` | **15** | 15 | 0 | 139 |
| 6 | `store/authStore.ts` | `store` | **12** | 11 | 1 | 182 |
| 7 | `store/auditStore.ts` | `store` | **10** | 8 | 2 | 123 |
| 8 | `lib/supabase.ts` | `util` | **9** | 9 | 0 | 28 |
| 9 | `App.tsx` | `other` | **7** | 1 | 6 | 214 |
| 10 | `components/layout/Sidebar.tsx` | `component` | **7** | 1 | 6 | 283 |

---

## 🧩 Distribución por Capas Arquitectónicas

### 1. 🧠 Capa de Estado (Zustand Stores)
- `store/aiStore.tsx` — Utilizado por **4** componentes/páginas (Líneas: 174)
- `store/appStore.ts` — Utilizado por **3** componentes/páginas (Líneas: 81)
- `store/auditStore.ts` — Utilizado por **8** componentes/páginas (Líneas: 123)
- `store/authStore.ts` — Utilizado por **11** componentes/páginas (Líneas: 182)
- `store/motorTurnos.ts` — Utilizado por **2** componentes/páginas (Líneas: 808)
- `store/programacionStore.ts` — Utilizado por **17** componentes/páginas (Líneas: 2108)
- `store/programacionTypes.ts` — Utilizado por **1** componentes/páginas (Líneas: 134)
- `store/puestoStore.ts` — Utilizado por **21** componentes/páginas (Líneas: 605)
- `store/uiStore.ts` — Utilizado por **3** componentes/páginas (Líneas: 33)
- `store/vigilanteStore.ts` — Utilizado por **20** componentes/páginas (Líneas: 719)

### 2. 🖥️ Capa de Vistas (Páginas)
- `pages/AuditoriaInterna.tsx` — Importa **3** módulos internos (Líneas: 345)
- `pages/Configuracion.tsx` — Importa **3** módulos internos (Líneas: 407)
- `pages/Dashboard.tsx` — Importa **5** módulos internos (Líneas: 506)
- `pages/GestionPuestos.tsx` — Importa **22** módulos internos (Líneas: 2838)
- `pages/Inteligencia.tsx` — Importa **5** módulos internos (Líneas: 275)
- `pages/Login.tsx` — Importa **2** módulos internos (Líneas: 248)
- `pages/Novedades.tsx` — Importa **3** módulos internos (Líneas: 611)
- `pages/Resumen.tsx` — Importa **5** módulos internos (Líneas: 658)
- `pages/Vigilantes.tsx` — Importa **4** módulos internos (Líneas: 409)

### 3. 🧩 Componentes Tácticos Reutilizables
- `components/ai/CorazaAI.tsx` (Entrantes: 0, Salientes: 4)
- `components/dashboard/KpiCard.tsx` (Entrantes: 1, Salientes: 0)
- `components/ErrorBoundary.tsx` (Entrantes: 2, Salientes: 0)
- `components/guards/GuardDetailModal.tsx` (Entrantes: 1, Salientes: 4)
- `components/guards/GuardModal.tsx` (Entrantes: 1, Salientes: 3)
- `components/layout/AppLayout.tsx` (Entrantes: 1, Salientes: 4)
- `components/layout/Sidebar.tsx` (Entrantes: 1, Salientes: 6)
- `components/layout/Topbar.tsx` (Entrantes: 1, Salientes: 5)
- `components/puestos/AddTurnoForm.tsx` (Entrantes: 1, Salientes: 2)
- `components/puestos/CeldaCalendario.tsx` (Entrantes: 1, Salientes: 2)
- `components/puestos/CoordinationPanel.tsx` (Entrantes: 1, Salientes: 4)
- `components/puestos/EditCeldaModal.tsx` (Entrantes: 1, Salientes: 4)
- `components/puestos/GestionPersonalModal.tsx` (Entrantes: 1, Salientes: 4)
- `components/puestos/GestionRolesModal.tsx` (Entrantes: 1, Salientes: 3)
- `components/puestos/HistorialProgramacionModal.tsx` (Entrantes: 1, Salientes: 2)

---

## 🌐 Visualización Interactiva

Se ha generado el archivo **`graph.html`** en la raíz del proyecto.
Puedes abrirlo en cualquier navegador para explorar la red interactiva con zoom, filtros por categoría y resaltado de nodos.
