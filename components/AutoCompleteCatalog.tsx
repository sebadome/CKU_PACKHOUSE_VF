import React, { useEffect, useRef, useState } from 'react';
import Input from './ui/Input';



interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const AutocompleteHuerto: React.FC<Props> = ({ value, onChange, disabled }) => {
  // ↑ AGREGADO: disabled
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const buscar = async (q: string) => {
    if (!q || q.length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    //const url = `http://localhost:4000/api/catalogo/autocomplete/huerto?q=${encodeURIComponent(q)}`;
    const url = `${API_BASE_URL}/api/catalogo/autocomplete/huerto?q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error en fetch: ${res.statusText}`);
      const data: string[] = await res.json();

      setOptions(data);
      setOpen(data.length > 0);
    } catch (err) {
      console.error('Error AutocompleteHuerto:', err);
      setOptions([]);
      setOpen(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        label="Huerto"
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value);
          buscar(e.target.value);
        }}
        onFocus={() => value && buscar(value)}
        placeholder="Escriba nombre de huerto"
        autoComplete="off"
        disabled={disabled}  // ← AGREGADO: pasar disabled al Input
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

export default AutocompleteHuerto;