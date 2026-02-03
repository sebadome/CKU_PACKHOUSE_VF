export type FormStatus = 'Borrador' | 'Ingresado';
export type UserRole = 'Administrador' | 'Trabajador CKU';

// ✅ ACTUALIZADO: User con todos los campos necesarios para autenticación
export interface User {
  name: string;
  apellido: string;      // ← NUEVO
  email: string;         // ← NUEVO
  rut: string;          // ← NUEVO
  planta: string;       // ← NUEVO
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
  | 'autocomplete';

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
  validations?: FieldValidation;
  calc?: string;
  readOnly?: boolean;
  help?: string;
  excludeFromCalc?: boolean;
}

export interface FieldDependency {
  key: string;
  value: any | any[];
}

export interface FormField {
  id?: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  validations?: FieldValidation;
  options?: string[];
  dynamicOptions?: string;
  campo?: string;
  catalog?: string;
  series_count?: number;
  columns?: DynamicTableColumn[];
  initialRows?: Record<string, any>[];
  user_can_add_columns?: boolean;
  user_can_add_rows?: boolean;
  persist_schema_per_form?: boolean;
  order?: number;
  readOnly?: boolean;
  dependency?: FieldDependency;
  hideBrix?: boolean;
  hideCalibre?: boolean;
  showSummaryColumns?: boolean;
  showOnlyAverage?: boolean;
  isWeightMode?: boolean;
}

export interface FormSection {
  id?: string;
  key: string;
  title: string;
  description?: string;
  fields: FormField[];
  order?: number;
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
  publishedTo?: UserRole[];
  icon?: string;
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
  customName?: string;
}