# Reference (information-oriented)

> **Propósito:** Descrição técnica precisa e exaustiva. Fonte da verdade.
> **Público:** Desenvolvedores, mantenedores, integradores.
> **Tom:** Neutro, exato, minimalista. Sem prosa desnecessária.

## Template de Referência

```markdown
---
title: "[Nome do Componente/API/Config]"
type: reference
quadrant: information-oriented
version: "x.y.z"
last_updated: "YYYY-MM-DD"
---

# [Nome da Referência]

## Visão Geral

[Descrição concisa do que este componente/API/config faz. Máximo 2 parágrafos.]

---

## 1. Endpoints

### `[METHOD] /[path]`

**Descrição:** [O que este endpoint faz.]

**Headers:**

| Header | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `[Nome]` | `[tipo]` | ✅/⬜ | `[valor]` | [Descrição] |

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `[nome]` | `[tipo]` | ✅/⬜ | `[valor]` | [Descrição] |

**Request Body:**

```json
{
  "campo": "tipo / descrição",
  "opcional": "string (opcional)"
}
```

**Response `[status]`:**

```json
{
  "status": "success",
  "data": { }
}
```

**Errors:**

| Código | Mensagem | Quando ocorre |
|---|---|---|
| `[status]` | `[mensagem]` | [Condição] |

---

## 2. Schema / Modelo de Dados

### `[Nome do Schema]`

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `[campo]` | `[tipo]` | ✅/⬜ | `[valor]` | [Descrição] |

---

## 3. Configuração

### Variáveis de Ambiente

| Variável | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `[NOME_VAR]` | `[tipo]` | ✅/⬜ | `[valor]` | [Descrição] |

### Arquivo de Configuração (`config.yaml` / `.env`)

```yaml
chave:
  subchave: valor        # [Descrição]
```

---

## 4. CLI / Comandos

### `[comando]`

**Uso:**
```bash
comando [flags] [argumentos]
```

**Flags:**

| Flag | Alias | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|---|
| `--[flag]` | `-[alias]` | `[tipo]` | ✅/⬜ | `[valor]` | [Descrição] |

**Exemplo:**
```bash
comando --flag valor
```

---

## 5. Exemplos de Uso

```typescript
// Exemplo de chamada ao endpoint
const response = await fetch('/api/exemplo');
const data = await response.json();
```

> A reference **não ensina**. Se o leitor precisa de explicação, direcione para um Tutorial ou Explanation. Se precisa resolver um problema, direcione para um How-to.
