<!-- GERADO por sync-rules.js a partir de core/protocolo/fases/fase-00-ambiente.md — não edite aqui: edite core/ e rode sync-rules. -->

# Fase 0 — Descoberta do ambiente

Antes de iniciar, levante:
1. Sistema operacional: Windows (WSL), macOS ou Linux.
2. CPU, RAM, GPU e VRAM disponíveis.
3. Espaço livre em disco.
4. Ferramentas instaladas: Node.js, Python, Docker, Git e as demais.
5. Repositório Git, branches e alterações não commitadas.
6. Provedores de IA disponíveis, modelos e limites conhecidos.
7. Disponibilidade de Headroom, Laya e Jev.
8. Disponibilidade de Playwright, CDP e ferramentas de browser.
9. Credenciais e autenticações disponíveis, **só a presença, nunca os valores**. Não leia arquivo de credencial e não mexa em login.
10. Orçamento permitido por tarefa, etapa e projeto.

Comandos de detecção (só leitura): `uname -a`; `nproc` ou `sysctl -n hw.ncpu`; `free -h` ou `sysctl -n hw.memsize`; `df -h .`; `node -v; python3 -V; docker -v; git --version`; `git status -sb`; `nvidia-smi` quando houver GPU; `command -v headroom cch`; `codex login status` e equivalentes para saber se há sessão.

Monte uma tabela que separe **detectado**, **informado pelo usuário** e **desconhecido**. Não presuma que uma ferramenta está instalada nem que uma conta tem determinado recurso.

**Orçamento de recursos do dispositivo:** reserve memória para o SO e para os apps do usuário. Paralelismo segue R1, com teto padrão de 2 sessões. Para subir o teto, use a medição desta fase (RAM livre ÷ ~600 MB por sessão, mantendo a reserva). Não rode uma quantidade arbitrária de agentes simultâneos.
