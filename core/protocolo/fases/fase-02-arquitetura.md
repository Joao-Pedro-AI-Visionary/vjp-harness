# Fase 2 — Arquitetura preliminar

**Escolha a plataforma antes da tecnologia:**
| Formato | Quando escolher |
|---|---|
| Site estático / landing | conteúdo, captação |
| Web responsiva (SPA/SSR/SSG) | SaaS, CRM, dashboards, portais, sistemas administrativos |
| PWA | instalável, offline, distribuição sem loja no início |
| Mobile nativo | integração profunda com iOS/Android, sensores, processamento intensivo |
| Mobile cross-platform | Android + iOS com lógica compartilhada (Expo/React Native, Flutter) |
| Desktop / Tauri / Electron | app local, arquivos, integração com o SO |
| CLI / TUI | ferramentas de dev, automações, agentes, operações |
| Extensão de navegador | funcionalidade integrada às páginas |
| API / headless | serviço consumido por outros apps |
| Worker / edge / serverless / eventos | webhooks, cargas intermitentes, automação |

A escolha considera: necessidade dos usuários, distribuição, recursos do dispositivo, UX, prazo, custo de desenvolvimento e manutenção, capacidade de evolução, infraestrutura e segurança.

Escolha front, back, banco, autenticação, hospedagem, observabilidade e testes, cada um **com justificativa técnica**. Avalie SQL × NoSQL, BaaS × backend próprio, monólito modular × serviços separados, e a necessidade real de cache, filas e object storage.
- Regra de tamanho: a solução **mais simples** que cubra os requisitos reais dos próximos 6–12 meses, sem presumir milhões de usuários e sem ignorar crescimento plausível. Para MVP, o ponto de partida costuma ser um **monólito modular** bem estruturado.
- Nada de microsserviços, Kubernetes, filas ou outro componente complexo sem necessidade concreta.
- A stack homologada do harness (NestJS + Prisma, contrato OpenAPI, vertical slice; ver `.harness/AGENT_RULES.md` §3) é a **candidata preliminar padrão**. Ela entra no benchmark como qualquer outra e não é imposta.
- Contrato-primeiro: os contratos de API e eventos (OpenAPI 3.1 / AsyncAPI 3.0) nascem aqui como rascunho.

**Saída:** arquitetura preliminar + ADRs das decisões importantes em `.gbrain/decisions.md` (sem harness: `docs/projeto/adr/`).
