# Mirror de Upstreams (V-JP) — Risco B

O vendoring pinado clona do upstream. Se o repo for **apagado** ou o pacote **despublicado**,
a montagem morre. O mirror guarda uma **cópia própria** (tarball) de cada upstream externo,
verificável por **SHA-256**.

- `node .harness/tools/mirror.js` — **auditoria offline** (determinística): `ok | corrupted | missing | unverified`.
  `unverified ≠ ok` (sem sha registrado não se confia cegamente). Sai 0 só se TODAS ok.
- `node .harness/tools/mirror.js --fetch` — **toca a rede** (opt-in): clona os upstreams git pinados,
  gera os tarballs e grava o `manifest.json` com os SHAs.

O espelho vive em `.mirror/` (gitignored — reproduzível pelo manifesto). Ver spec §3.6.
