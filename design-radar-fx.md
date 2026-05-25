# Radar FX — Documentação de Design da Interface

> **Versão:** v2.0  
> **Stack:** React 18 + Tailwind CSS 3 + Framer Motion + Lucide Icons  
> **Plataforma:** Trading automatizado multi-robô com interface tecnológica neon

---

## 1. Design System

### 1.1 Paleta de Cores

| Token | Cor | Uso |
|-------|-----|-----|
| `trader-blue` | `#2563EB` | Primary, links, elementos ativos |
| `trader-cyan` | `#22D3EE` | Gradientes, destaques secundários |
| `trader-green` | `#16A34A` | Lucro, online, positivo |
| `trader-red` | `#EF4444` | Perda, crítico, negativo |
| `trader-amber` | `#F59E0B` | Alerta, moderado |
| `slate-950` | `#020617` | Fundo principal |
| `slate-900` | `#0f172a` | Sidebar, cards |
| `slate-800` | `#1e293b` | Bordas, elementos secundários |

### 1.2 Gradientes

| Gradiente | Cores | Aplicação |
|-----------|-------|-----------|
| **Logo RADAR** | `blue-400 → cyan-300` | `#60a5fa → #67e8f9` |
| **Section header** | `blue-500 → cyan-400` | `#3b82f6 → #22d3ee` |
| **Scrollbar** | `blue-500 → cyan-400` | `#3b82f6 → #22d3ee` |
| **Botão ativo** | `blue-500/10` | `rgba(59,130,246,0.1)` |

### 1.3 Tipografia

| Elemento | Tamanho | Peso | Transform |
|----------|---------|------|-----------|
| Logo RADAR FX | `22px` | `900` (black) | itálico |
| Título de página | `14px` | `700` (bold) | `uppercase tracking-[0.2em]` |
| Section header (sidebar) | `10px` | `700` | `uppercase tracking-[0.2em]` |
| Item de menu | `13px` | `600` (semibold) | `uppercase tracking-wide` |
| Badge status | `8px` | `900` (black) | `uppercase italic` |

### 1.4 Ícones (Lucide)

| Contexto | Tamanho |
|----------|---------|
| Sidebar (normal) | `18px` |
| Sidebar (colapsado) | `20px` |
| Header badges | `10px` |
| Botões inline | `14-16px` |
| KPIs | `18-24px` |

### 1.5 Spacing & Bordas

| Elemento | Valor |
|----------|-------|
| Sidebar largura (expandida) | `w-64` (256px) |
| Sidebar largura (colapsada) | `w-20` (80px) |
| Padding seções | `px-5 py-5` (logo), `pl-4 pr-3 py-5` (nav) |
| Gap entre itens de menu | `gap-3` (12px) |
| Border radius padrão | `rounded-xl` (12px) |
| Border radius cards | `rounded-xl` (12px) |
| Border radius badges | `rounded-full` (9999px) |

---

## 2. Layout

### 2.1 Estrutura Geral

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │          │  │  Header (h-16)                            │ │
│  │          │  │  ┌─ Badges status ─┐ ┌─ Device toggle ─┐ │ │
│  │ SIDEBAR  │  ├──────────────────────────────────────────┤ │
│  │ expandida│  │                                          │ │
│  │ (w-64)   │  │  MAIN CONTENT (flex-1, overflow-y-auto)  │ │
│  │ ou       │  │                                          │ │
│  │ colapsada│  │  ┌────────────────────────────────────┐  │ │
│  │ (w-20)   │  │  │  Children (30 telas)               │  │ │
│  │          │  │  └────────────────────────────────────┘  │ │
│  └──────────┘  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Sidebar (componente `Layout.tsx`)

#### Logo Area (altura 76px)
```
┌──────────────────────────────────┐
│  ╭──────────╮  RADAR FX          │  ← gradiente blue→cyan itálico
│  │  radar   │  [● MT5 Online]    │  ← badge verde pulsante
│  │ animado  │                    │
│  ╰──────────╯                    │
└──────────────────────────────────┘
```

**Radar animado:**
- 3 anéis concêntricos pulsando com `pulse-ring` (2.5s, delays 0/0.4/0.8s)
- Ponto central branco com glow azul `shadow-[0_0_20px_rgba(96,165,250,1)]`
- Sweep giratório com `spin-sweep` (2s linear) — gradiente cônico azul→ciano
- 4 blips ciano em posições aleatórias com `blink-target`

#### Menu Sections

Cada seção tem:
```
┌─ GRADIENTE LABEL ──── line ──────┐  ← 10px bold, tracking 0.2em
│  ▷ Item 1          [● badge]     │  ← 13px semibold uppercase
│  ▷ Item 2          [● badge]     │
│  ▷ Item 3 (ativo)   [● badge]    │  ← bg-blue-500/10 + border-l-[3px]
└───────────────────────────────────┘
```

**Estados dos itens:**

| Estado | Background | Border | Texto | Shadow |
|--------|-----------|--------|-------|--------|
| **Ativo** | `bg-blue-500/10` | `border-l-[3px] border-blue-400` | `text-white` | `inset 0 0 30px rgba(59,130,246,0.15)` |
| **Hover** | `bg-white/[0.06]` | `border-l-2 border-slate-500` | `text-white` | `inset 0 0 20px rgba(255,255,255,0.02)` |
| **Inativo** | transparent | none | `text-slate-400` | none |

**Badges de robô ativo:**

| Robô | Cor | RGB |
|------|-----|-----|
| Alpha Robot | Fuchsia | `217, 70, 239` |
| Bitcoin Pro | Green | `22, 163, 74` |
| Shark Bot | Cyan | `6, 182, 212` |
| Alpha Cripto | Orange | `249, 115, 22` |
| Gold Scalper | Amber | `251, 191, 36` |
| Micro Sniper | Indigo | `99, 102, 241` |
| Swing IA | Yellow | `234, 179, 8` |
| Copy Trader | Violet | `139, 92, 246` |
| Speed Scalper | Cyan | `34, 211, 238` |
| Supreme AI | Emerald | `16, 185, 129` |
| Omni Prob | Purple | `168, 85, 247` |

#### Modo Colapsado

- Largura: `w-20` (80px)
- Apenas ícones centralizados
- Badges de robôs ativos: `absolute -top-0.5 -right-0.5`
- Tooltip via `title` attribute
- Botão toggle `◀` / `▶` no centro direito

#### Modo Tablet

- Drawer overlay com spring animation (Framer Motion)
- Trigger: botão hamburger no header
- Overlay escuro `bg-slate-950/60 backdrop-blur-sm`
- Drawer width: `w-72`

#### User Profile (final da sidebar)

```
┌──────────────────────────────────┐
│  [👤 ●]  Trader Pro             │  ← status online green dot
│           Sessão Ativa           │
└──────────────────────────────────┘
```
- `bg-slate-800/50 rounded-xl border border-slate-800`
- Avatar com `status-online` absolute positioning

### 2.3 Header

```
┌─ Título Página ────────── Badges ── Toggle ─┐
│  Cockpit                   [● BTC Pro]       [📱]
│                            [● Gold]          [💻]
│                            [● MT5]           [🔄]
└──────────────────────────────────────────────┘
```

- Altura: `h-16`
- Background: `bg-slate-900/50 backdrop-blur-md`
- Border bottom: `border-b border-slate-800`
- Sticky top com `z-10`
- Badges com glow pulse específico de cada robô

### 2.4 Neon Scrollbar

```css
.sidebar-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #3b82f6, #22d3ee);
    box-shadow: 0 0 12px rgba(59,130,246,0.5), 0 0 24px rgba(34,211,238,0.2);
}
```

---

## 3. Padrões de Componentes

### 3.1 Cards Padrão

```tsx
<div className="bg-slate-800/50 rounded-xl border border-slate-800 p-4">
    {/* conteúdo */}
</div>
```

| Propriedade | Valor |
|-------------|-------|
| Background | `bg-slate-800/50` |
| Border | `border border-slate-800` |
| Border radius | `rounded-xl` |
| Padding | `p-4` (16px) |
| Hover (opcional) | `hover:border-slate-700 hover:bg-slate-800/70` |

### 3.2 Glassmorphism Panels

```tsx
<div className="glass-panel rounded-xl p-4">
```

```css
.glass-panel {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### 3.3 Botões

| Tipo | Classes |
|------|---------|
| **Primary** | `bg-trader-blue text-white px-4 py-2 rounded-xl hover:bg-blue-600` |
| **Secondary** | `bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2 rounded-xl hover:bg-slate-700` |
| **Ghost** | `text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-xl` |
| **Danger** | `bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl hover:bg-red-500/20` |
| **Toggle** | `relative w-11 h-6 rounded-full transition-colors` (switch) |

### 3.4 Badges

| Tipo | Classes |
|------|---------|
| **Online** | `bg-green-600/10 border border-green-600/20 rounded-full px-2.5 py-1` |
| **BUY** | `bg-green-500/10 text-green-400 border border-green-500/20` |
| **SELL** | `bg-red-500/10 text-red-400 border border-red-500/20` |
| **INFO** | `bg-blue-500/10 text-blue-400` |
| **WARNING** | `bg-amber-500/10 text-amber-400` |
| **CRITICAL** | `bg-red-500/10 text-red-400` |

### 3.5 Tabelas

```tsx
<div className="overflow-x-auto">
    <table className="w-full text-sm">
        <thead>
            <tr className="text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 text-left">Coluna</th>
            </tr>
        </thead>
        <tbody>
            <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-3 px-4 text-slate-300">Valor</td>
            </tr>
        </tbody>
    </table>
</div>
```

---

## 4. Sistema de Animações

### 4.1 Keyframes CSS

| Animação | Duração | Descrição |
|----------|---------|-----------|
| `glow-pulse` | 2s infinite | Badge robô ativo (escala + box-shadow) |
| `pulse-ring` | 2.5s infinite | Anéis do radar sidebar |
| `blink-target` | 1.5-2s infinite | Blips do radar sidebar |
| `spin-sweep` | 2s linear infinite | Sweep giratório do radar |
| `slide-in` | 0.2s ease-out | Drawer mobile |
| `ping` | 1s infinite | Bolinha status (Tailwind nativo) |

### 4.2 Framer Motion Transitions

| Contexto | Tipo | Duração |
|----------|------|---------|
| Drawer sidebar | Spring (damping:28, stiffness:250) | - |
| Page transitions | `AnimatePresence mode="popLayout"` | 0.2s |
| Cards aparecendo | `whileInView` + `viewport once` | 0.3s |
| Hover scale | `whileHover={{ scale: 1.02 }}` | 0.15s |
| Tap | `whileTap={{ scale: 0.98 }}` | 0.1s |

### 4.3 Hover Effects Padrão

| Elemento | Efeito |
|----------|--------|
| Botão menu | `hover:bg-white/[0.06] hover:translate-x-0.5` + borda esquerda |
| Card | `hover:border-slate-700 hover:bg-slate-800/70` |
| Table row | `hover:bg-slate-800/30` |
| Botão header | `hover:bg-trader-blue/20 hover:text-trader-blue` |

---

## 5. Templates de Página

### 5.1 Dashboard Padrão

```
┌─ Header ─────────────────────────────────────────────────┐
│  Título da Página         [badges status]                │
├──────────────────────────────────────────────────────────┤
│  ┌─ KPI ─┐ ┌─ KPI ─┐ ┌─ KPI ─┐ ┌─ KPI ─┐              │
│  │ $1,234│ │ 75%   │ │ 12    │ │ +$567 │              │
│  │ Lucro  │ │ Win   │ │ Trades│ │ Hoje  │              │
│  └────────┘ └────────┘ └────────┘ └────────┘              │
│                                                          │
│  ┌─ Painel Principal (flex-1) ────────────────────────┐ │
│  │  [Gráfico / Tabela / Cards]                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Side Panel (opcional, w-80) ────────────────────┐  │
│  │  [Configurações / Detalhes / Log]                 │  │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Painel de Robô

```
┌─ Header ───────────────────────────────────────┐
│  🤖 Alpha Robot          [● Ativo] [⚙ Config] │
├────────────────────────────────────────────────┤
│  ┌─ Toggle ─┐  ┌─ Select ─┐  ┌─ Slider ──┐   │
│  │ [ON/OFF] │  │ Perfil   │  │ Lote 0.02 │   │
│  └──────────┘  └──────────┘  └───────────┘   │
│                                               │
│  ┌─ Cards de Símbolo ──────────────────────┐  │
│  │  ┌─ XAUUSD ─┐ ┌─ BTCUSD ─┐ ┌─ ETHUSD ┐│  │
│  │  │ Score:82 │ │ Score:65 │ │ Score:71││  │
│  │  │ BUY      │ │ SELL     │ │ NEUTRAL ││  │
│  │  └──────────┘ └──────────┘ └─────────┘│  │
│  └────────────────────────────────────────┘  │
│                                               │
│  ┌─ Histórico (tabela) ───────────────────┐  │
│  │  Ticket | Símbolo | Direção | Resultado│  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 5.3 Trading Panel (Operar)

```
┌─ Header ───────────────────────────────────────────────┐
│  💹 Operar                    [● Disciplina Ativa]    │
├────────────────────────────────────────────────────────┤
│  ┌─ Grid de Símbolos ──────────────────────────────┐  │
│  │  ┌──────┬───────┬──────┬──────┬──────┬──────┐  │  │
│  │  │ EUR  │ GBP   │ XAU  │ BTC  │ ETH  │ SP500│  │  │
│  │  │1.0876│1.2765 │2345  │68942 │3421  │5432  │  │  │
│  │  │[BUY] │[BUY]  │[BUY] │[BUY] │[BUY] │[BUY] │  │  │
│  │  │[SELL]│[SELL] │[SELL]│[SELL]│[SELL]│[SELL]│  │  │
│  │  └──────┴───────┴──────┴──────┴──────┴──────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ Sentimento ──────┐  ┌─ Posições Abertas ──────┐  │
│  │  BTC: 72 (Alta)   │  │  BTC BUY 0.02 $34.50    │  │
│  │  EUR: 45 (Neutro) │  │  XAU SELL 0.02 -$12.30  │  │
│  └───────────────────┘  └──────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 6. Responsividade

### 6.1 Breakpoints

| Breakpoint | Largura | Sidebar |
|-----------|---------|---------|
| **Mobile** | `< 640px` | Hidden (bottom nav ou drawer) |
| **Tablet** | `640px - 1023px` | Drawer overlay c/ hamburger |
| **Desktop** | `≥ 1024px` | Sidebar fixa (64 ou 20) |

### 6.2 Mobile Adaptations

- Sidebar vira bottom navigation (RadarApp.tsx)
- Header com hamburger + título
- Cards em grid de 1 coluna
- Touch-friendly targets (min 44px)
- `overscroll-behavior-y: none`
- `height: 100dvh`

### 6.3 Tablet Adaptations

- Drawer sidebar com overlay
- Cabeçalho compacto
- Cards em grid de 2 colunas
- Badges status encurtados (apenas nome)

---

## 7. Padrões de Código

### 7.1 Convenções Tailwind

- Preferir classes utilitárias a CSS customizado
- Usar `@apply` apenas para padrões repetitivos (glass-panel)
- Cores do tema: `trader-{color}` para cores proprietárias
- Variantes: `hover:`, `active:`, `group-hover:`, `dark:`

### 7.2 Convenções de Componentes

- Componentes em `client/src/components/`
- Nomes PascalCase: `TradingPanel.tsx`, `MotorIAPanel.tsx`
- Props tipadas com interface no próprio arquivo
- `React.FC` com children via `LayoutProps`
- Estados: `useState` + `useCallback` + `useEffect` (sem biblioteca externa de estado)

### 7.3 Convenções de Animação

- Animações CSS para: glow, pulse, spin, slide
- Framer Motion para: layout transitions, spring, appear/disappear
- `AnimatePresence` para elementos condicionais
- `motion.div` com `initial`, `animate`, `exit`

---

## 8. Checklist de Consistência Visual

- [ ] Todos os cards usam `rounded-xl border border-slate-800 bg-slate-800/50`
- [ ] Todos os badges seguem o padrão `bg-{color}-500/10 border border-{color}-500/20`
- [ ] Títulos de página em `text-sm font-bold uppercase tracking-[0.2em] text-slate-300`
- [ ] Scrollbars seguem o padrão neon blue
- [ ] Gradientes usam `blue-400 → cyan-300` (logo) ou `blue-500 → cyan-400` (headers)
- [ ] Botões têm `rounded-xl` e padding consistente `px-4 py-2`
- [ ] Tabelas têm `border-b border-slate-800/50` e hover `bg-slate-800/30`
- [ ] KPIs seguem `text-2xl font-black text-white` + label `text-xs text-slate-500`
- [ ] Toggles seguem padrão `w-11 h-6 rounded-full` com bolinha branca

---

## 9. Assets

| Asset | Localização | Formato |
|-------|-------------|---------|
| Radar FX logo | `public/radar_fx_super_logo.png` | PNG |
| Favicon | `public/favicon.ico` | ICO |
| Ícones | Lucide React (importação dinâmica) | SVG inline |
| Gráficos | Recharts + Lightweight Charts | Canvas/SVG |
| Sons | `client/src/services/SoundService.ts` | Web Audio API |
