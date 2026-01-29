export type FormStatus = 'Borrador' | 'Ingresado';

export type UserRole = 'Administrador' | 'Trabajador CKU';

export interface User {
  name: string;
  roles: UserRole[];
}

export type TemplateStatus = 'Borrador' | 'Publicada' | 'Deprecada';

export type FieldType =
  | 'text'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'time'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'measure_series'
  | 'textarea'
  | 'file'
  | 'dynamic_table'
  | 'pressure_matrix'
  | 'autocomplete';  // ← LÍNEA NUEVA

export interface VariedadOption {
  variedad: string;
  grupo: string;
}
export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  regex?: string;
  decimals?: number;
}

export interface DynamicTableColumn {
  key: string;
  label: string;
  type: Exclude<FieldType, 'dynamic_table' | 'measure_series' | 'file' | 'pressure_matrix'> | 'pressure_button' | 'findings_button';
  options?: string[];
  catalog?: string;
  required?: boolean;
  // FIX: Replace min with validations object for consistency
  validations?: FieldValidation;
  calc?: string;
  readOnly?: boolean;
  help?: string;
  excludeFromCalc?: boolean; // NEW: Allows excluding specific columns from row calculations
}

// NEW: Interface for field dependencies (conditional visibility)
export interface FieldDependency {
  key: string; // The key of the field to watch (dot notation supported in implementation)
  value: any | any[]; // The value(s) that make the dependent field visible
}

export interface FormField {
  id?: string; // NEW: Unique ID for the field, optional for mocks
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  validations?: FieldValidation;
  options?: string[];
  dynamicOptions?: string;  // ← LÍNEA NUEVA
  campo?: string;           // ← LÍNEA NUEVA
  catalog?: string;
  series_count?: number;
  columns?: DynamicTableColumn[];
  initialRows?: Record<string, any>[]; // NEW: Allow admins to set default rows
  user_can_add_columns?: boolean;
  user_can_add_rows?: boolean;
  persist_schema_per_form?: boolean;
  order?: number; // NEW: Order for rendering, optional for mocks
  // FIX: Add readOnly property to FormField
  readOnly?: boolean;
  // NEW: Add dependency for conditional visibility
  dependency?: FieldDependency;
  hideBrix?: boolean; // NEW: Propiedad para ocultar brix en matrices de presión
  hideCalibre?: boolean; // NEW: Propiedad para ocultar calibre en matrices de presión
  showSummaryColumns?: boolean; // NEW: Propiedad para mostrar MAX, MIN, X en matrices de presión
  showOnlyAverage?: boolean; // NEW: Propiedad para mostrar solo el promedio en matrices de presión
  isWeightMode?: boolean; // NEW: Indica si la matriz de presiones opera en modo pesos
}

export interface FormSection {
  id?: string; // NEW: Unique ID for the section, optional for mocks
  key: string;
  title: string;
  // FIX: Add optional description to FormSection
  description?: string;
  fields: FormField[];
  order?: number; // NEW: Order for rendering, optional for mocks
  // NEW: Add dependency for conditional section visibility
  dependency?: FieldDependency;
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  version: string;
  status: TemplateStatus;
  tags: string[];
  sections: FormSection[];
  publishedTo?: UserRole[]; // NEW
  icon?: string; // NEW
}

export interface FormSubmission {
  id: string;
  templateId: string;
  status: FormStatus;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  submittedBy?: string;
  dynamicSchemas?: Record<string, DynamicTableColumn[]>;
  planta?: string;
  customName?: string; // NEW: Nombre personalizado para identificar el borrador
}