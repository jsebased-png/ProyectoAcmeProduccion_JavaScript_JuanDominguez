import { firestoreStorage } from './firestoreStore.js';

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeText(s) {
  return String(s ?? '').trim();
}

export function required(value) {
  return normalizeText(value).length > 0;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

export function toast(el, { type = 'info', message = '' } = {}) {
  el.className = `toast ${type}`;
  el.textContent = message;
}

export function parseFormula(formulaText) {
  const text = normalizeText(formulaText);
  if (!text) return [];

  const parts = text
    .split(/[;,]/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const out = [];
  for (const part of parts) {
    const m = part.match(/^([^:=\-\s]+)\s*[:=]\s*(\d+(?:\.\d+)?)$/i);
    if (!m) continue;
    out.push({ code: normalizeText(m[1]).toUpperCase(), qty: Number(m[2]) });
  }
  return out;
}

export function formatFormulaRows(formulaArr) {
  if (!Array.isArray(formulaArr) || formulaArr.length === 0) {
    return '<p>No hay fórmula definida.</p>';
  }
  return `<ul>${formulaArr.map((r) => `<li>${escapeHtml(r.code)} : ${r.qty}</li>`).join('')}</ul>`;
}

export const storage = {
  async get(key, fallback) {
    return firestoreStorage.get(key, fallback);
  },
  async set(key, value) {
    return firestoreStorage.set(key, value);
  },
};

