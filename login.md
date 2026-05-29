# Login Page — Radar FX

## Arquivos

| Arquivo | Função |
|---------|--------|
| `client/src/pages/LoginPage.tsx` | Tela de login com 3 modos: login, registrar, recuperar senha |
| `client/src/services/auth.ts` | Serviço de autenticação (login, register, recover, token, remember) |
| `server/src/routes/auth.ts` | Rotas `/api/auth/login`, `/api/auth/register`, `/api/auth/recover` |
| `server/src/middleware/auth.ts` | Middleware JWT `authenticateToken` |

## Funcionalidades

- **Login** com `admin` / `radar2024`
- **Registrar-se** (cria novo usuário, mínimo 3 caracteres, senha mín 6)
- **Recuperar senha** (simulado — retorna instruções)
- **Lembrar de mim** (salva usuário no localStorage)
- **Toggle senha** (olho mostra/esconde)

## Design

| Elemento | Classe/Estilo |
|----------|---------------|
| Fundo | `bg-slate-950` + gradiente radial blue/cyan |
| Radar animado | Canvas API — sweep rotativo, círculos concêntricos, linhas radiais |
| Card | `bg-slate-800/50 backdrop-blur rounded-xl border border-slate-800` |
| Logo | **RADAR** gradiente `blue-400 → blue-500`, **FX** `text-white` |
| Labels | `text-[10px] font-bold uppercase tracking-[0.2em]` |
| Inputs | `bg-slate-900/60 border-slate-700/50 rounded-xl` focus `border-blue-500/50` |
| Botão primary | `bg-blue-600 hover:bg-blue-500 rounded-xl` |
| Animação | Framer Motion `fade + scale` na entrada |

## Radar Background (`RadarBackground`)

- Canvas 2D em `absolute inset-0 pointer-events-none`
- 5 círculos concêntricos opacidade progressiva
- 12 linhas radiais
- Sweep cônico (conicGradient) rotacionando 0.008/frame
- Linha de varredura com opacidade 0.15
- Tamanho: `Math.min(cx, cy) * 0.9`

## Endpoints

| Método | Rota | Body | Resposta |
|--------|------|------|----------|
| POST | `/api/auth/login` | `{ username, password }` | `{ token, username }` |
| POST | `/api/auth/register` | `{ username, password }` | `{ token, username, message }` |
| POST | `/api/auth/recover` | `{ username }` | `{ message }` |
