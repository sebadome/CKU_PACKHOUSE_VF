import { VariedadOption } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getVariedades = async (): Promise<VariedadOption[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/variedades`);
    if (!res.ok) return [];

    const json = await res.json();
    return json?.data ?? [];
  } catch (e) {
    console.error("getVariedades:", e);
    return [];
  }
};
