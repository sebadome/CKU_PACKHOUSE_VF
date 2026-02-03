import React, { useEffect, useRef, useState, useCallback } from "react";
import Input from "./ui/Input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const AutocompleteProductor: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

  const buscar = useCallback(
    async (q: string) => {
      const query = (q ?? "").trim();

      // Reglas mínimas
      if (!query || query.length < 2 || disabled) {
        setOptions([]);
        setOpen(false);
        return;
      }

      if (!API_BASE_URL) {
        console.error("❌ Falta VITE_API_BASE_URL en .env/.env.local");
        setOptions([]);
        setOpen(false);
        return;
      }

      // ✅ Endpoint correcto: productor
      const url = `${API_BASE_URL}/api/catalogo/autocomplete/productor?q=${encodeURIComponent(query)}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error en fetch: ${res.status} ${res.statusText}`);

        const data = (await res.json()) as string[];

        const cleaned = (Array.isArray(data) ? data : [])
          .map((x) => (x ?? "").toString().trim())
          .filter(Boolean);

        setOptions(cleaned);
        setOpen(cleaned.length > 0);
      } catch (err) {
        console.error("Error AutocompleteProductor:", err);
        setOptions([]);
        setOpen(false);
      }
    },
    [API_BASE_URL, disabled]
  );

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Si el input queda disabled, cerramos lista
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setOptions([]);
    }
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        label="Productor"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          buscar(v);
        }}
        onFocus={() => value && buscar(value)}
        placeholder="Escriba nombre del productor"
        autoComplete="off"
        disabled={disabled}
      />

      {open && options.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border rounded-lg shadow mt-1 max-h-48 overflow-auto">
          {options.map((opt) => (
            <li
              key={opt}
              className="px-3 py-2 hover:bg-cku-blue/10 cursor-pointer text-sm"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteProductor;
