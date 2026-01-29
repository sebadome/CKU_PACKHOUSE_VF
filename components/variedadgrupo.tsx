import { useEffect, useState } from 'react';
import { VariedadOption } from '../types';
import { getVariedades } from '../mapvariedadgrupo';

interface Props {
  value: string;
  onChange: (variedad: string, grupo: string) => void;
  disabled?: boolean;
}

const VariedadSelect: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [variedades, setVariedades] = useState<VariedadOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVariedades()
      .then(setVariedades)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const variedad = e.target.value;
    const grupo =
      variedades.find(v => v.variedad === variedad)?.grupo || '';

    onChange(variedad, grupo);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || loading}
      className="w-full rounded border px-2 py-1 text-sm"
    >
      <option value="">-- Seleccionar --</option>
      {variedades.map(v => (
        <option key={v.variedad} value={v.variedad}>
          {v.variedad}
        </option>
      ))}
    </select>
  );
};

export default VariedadSelect;