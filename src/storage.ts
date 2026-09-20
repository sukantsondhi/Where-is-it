import type { AppState } from "./types";
import { initialState } from "./data";

const KEY = "where-is-it:demo:v1";

export function loadState(): AppState {
  if (import.meta.env.VITE_DATA_MODE === "azure") return initialState;
  try {
    const value = localStorage.getItem(KEY);
    return value ? JSON.parse(value) as AppState : initialState;
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState): void {
  if (import.meta.env.VITE_DATA_MODE === "azure") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState(): void {
  localStorage.removeItem(KEY);
}
