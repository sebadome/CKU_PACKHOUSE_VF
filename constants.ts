import { FormTemplate, FormSubmission, User, DynamicTableColumn, FieldType } from './types';
import { v4 as uuidv4 } from 'uuid';

export const MOCK_USER: User = {
    name: 'Juan Pérez',
    roles: ['Administrador', 'Trabajador CKU'],
};

// Helper to generate 30 fixed line columns for Step 3 of REG.CKU.017
const getFixedLineColumns = (): DynamicTableColumn[] => {
    return Array.from({ length: 30 }, (_, i) => ({
        key: `l${i + 1}`,
        label: `Línea ${i + 1}`,
        // Fix: Explicitly cast 'text' to prevent it from being inferred as 'string'
        type: 'text' as const,
        required: false,
    }));
};

// Helper for Step 4 of REG.CKU.017 (Mercado Interno)
const getMercadoInternoColumns = (): DynamicTableColumn[] => {
    const columns: DynamicTableColumn[] = [
        { key: 'defecto', label: 'Defecto', type: 'text', readOnly: true }
    ];
    for (let i = 1; i <= 20; i++) {
        columns.push({ key: `c${i}`, label: `# Frutos ${i}`, type: 'integer', required: false });
    }
    columns.push({ key: 'promedio_x', label: 'Promedio X', type: 'decimal', readOnly: true });
    return columns;
};

// Helper for Step 5 of REG.CKU.018 (Mercado Interno Presizer)
const getPresizerInternalMarketColumns = (): DynamicTableColumn[] => {
    const columns: DynamicTableColumn[] = [
        { key: 'defecto', label: 'DEFECTO', type: 'text', readOnly: true }
    ];
    for (let i = 1; i <= 30; i++) {
        columns.push({ key: `f${i}`, label: `# Fruta ${i}`, type: 'integer', required: false });
    }
    columns.push({ key: 'promedio_x', label: 'X (PROMEDIO)', type: 'decimal', readOnly: true });
    return columns;
};

// Helper for Step 4 of REG.CKU.018 (Presizer)
const getChannelColumns = (): DynamicTableColumn[] => {
    return Array.from({ length: 50 }, (_, i) => ({
        key: `ch${i + 1}`,
        label: `CANAL ${i + 1}`,
        // Fix: Explicitly cast 'text' to prevent it from being inferred as 'string'
        type: 'text' as const,
        required: false,
    }));
};

// Helper for Step 5 Weight Control columns
const getWeightControlColumns = (): DynamicTableColumn[] => {
    const columns: DynamicTableColumn[] = [
        { key: 'calibre', label: 'Calibre', type: 'text', readOnly: true },
        { key: 'n_cajas', label: '# Cajas', type: 'integer', readOnly: true }
    ];
    for (let i = 1; i <= 10; i++) {
        columns.push({ key: `c${i}`, label: `${i}`, type: 'decimal', required: false });
    }
    columns.push({ key: 'promedio', label: 'Promedio', type: 'decimal', readOnly: true });
    return columns;
};

// ANÁLISIS DE PRECOSECHA template
const ANALISIS_PRECOSECHA_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.013',
    title: 'C.K.U PRE-COSECHA',
    description: 'Análisis de precosecha para Manzanas y Peras.',
    version: '2.8',
    status: 'Publicada',
    tags: ['Precosecha', 'Manzana', 'Pera', 'Calidad'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'file-text',
    sections: [
        {
            key: 'datos_generales',
            title: '1. Datos Generales',
            fields: [
                { key: 'planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'tipo_fruta', label: 'Tipo Fruta', type: 'select', options: ['MANZANA', 'PERAS'] },
                { key: 'productor', label: 'Productor', type: 'autocomplete' },
                { key: 'identificacion.variedad', label: 'Variedad Real', type: 'select', options: [], dynamicOptions: 'variedades' },
                {
                    key: 'variedad_rotulada_grupo',
                    label: 'Variedad Rotulada (Grupo)',
                    type: 'text',
                    readOnly: true,
                },
                { key: 'huerto_cuartel', label: 'Huerto / Cuartel', type: 'autocomplete' },
                { key: 'agronomo', label: 'Agrónomo', type: 'text' },
                { key: 'temporada', label: 'Temporada', type: 'text', readOnly: true },
                { key: 'fecha_muestra', label: 'F.M.', type: 'date', help: 'Fecha de Muestreo' },
                { key: 'fecha_analisis', label: 'F.A.', type: 'date', help: 'Fecha de Análisis' },
            ],
        },
        {
            key: 'caracterizacion_externa',
            title: '2. Caracterización externa de la muestra',
            description: 'Ingrese los datos de caracterización externa, dimensiones y distribución de calibres.',
            fields: [
                { key: 'n_frutos_muestra', label: 'N° Frutos de la Muestra', type: 'integer', help: 'Cantidad total de frutos evaluados.' },
                {
                    key: 'matriz_frutos_externo',
                    label: 'Matriz Fruto a Fruto',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    help: 'Ingrese Color de Fondo, Diámetro, Peso y Calibre para cada fruto (1 a 10).',
                    columns: [
                        { key: 'n_fruto', label: 'Fruto N°', type: 'text', readOnly: true },
                        { key: 'color_fondo', label: 'Color Fondo', type: 'text' },
                        { key: 'diametro', label: 'Diámetro (mm)', type: 'decimal' },
                        { key: 'peso', label: 'Peso (g)', type: 'decimal' },
                        { key: 'calibre', label: 'Calibre', type: 'text', readOnly: false },
                    ],
                    initialRows: Array.from({ length: 10 }, (_, i) => ({
                        _id: uuidv4(),
                        n_fruto: (i + 1).toString(),
                        color_fondo: '',
                        diametro: '',
                        peso: '',
                        calibre: '',
                        _isFixed: true
                    }))
                },
                { key: 'promedio_diametro', label: 'PROMEDIO X Diámetro (mm)', type: 'decimal', readOnly: true, help: 'Cálculo automático.' },
                { key: 'promedio_peso', label: 'PROMEDIO X Peso (g)', type: 'decimal', readOnly: true, help: 'Cálculo automático.' },
                {
                    key: 'matriz_color_cubrimiento',
                    label: 'Matriz Color de Cubrimiento',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    help: 'Ingrese el porcentaje de color de cubrimiento para cada fruto.',
                    columns: [
                        { key: 'n_fruto', label: 'Fruto N°', type: 'text', readOnly: true },
                        { key: 'color_cubrimiento', label: 'Color de Cubrimiento (%)', type: 'integer' },
                    ],
                    initialRows: Array.from({ length: 10 }, (_, i) => ({
                        _id: uuidv4(),
                        n_fruto: (i + 1).toString(),
                        color_fondo: '',
                        color_cubrimiento: '',
                        _isFixed: true
                    })),
                    dependency: {
                        key: 'variedad_rotulada_grupo',
                        value: ['ROJAS', 'GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI']
                    }
                },
                {
                    key: 'promedio_color_cubrimiento',
                    label: 'Promedio Color de Cubrimiento (%)',
                    type: 'decimal',
                    readOnly: true,
                    help: 'Cálculo automático.',
                    dependency: {
                        key: 'variedad_rotulada_grupo',
                        value: ['ROJAS', 'GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI']
                    }
                },
                {
                    key: 'matriz_categorias_calibre',
                    label: 'Distribución por Categorías',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    user_can_add_columns: false,
                    help: 'Ingrese la cantidad de frutos por categoría.',
                    columns: [
                        { key: 'cat_minus_50', label: '-50', type: 'integer' },
                        { key: 'cat_plus_50', label: '+50', type: 'integer' },
                        { key: 'cat_plus_30', label: '+30', type: 'integer' },
                        { key: 'cat_minus_30', label: '-30', type: 'integer' },
                    ],
                    initialRows: [{ _id: uuidv4(), _isFixed: true }],
                    dependency: {
                        key: 'variedad_rotulada_grupo',
                        value: ['ROJAS', 'GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI']
                    }
                },
                {
                    key: 'mensaje_granny_smith',
                    label: 'Distribución por Categorías / Color de Cubrimiento',
                    type: 'text',
                    readOnly: true,
                    help: 'Para la variedad GRANNY SMITH no aplica distribución por color de cubrimiento.',
                    dependency: {
                        key: 'variedad_rotulada_grupo',
                        value: 'GRANNY SMITH'
                    }
                }
            ],
        },
        {
            key: 'madurez_firmeza',
            title: '3. Madurez: Color Pulpa y Presiones',
            description: 'Información de madurez interna (Color Pulpa y Firmeza).',
            fields: [
                {
                    key: 'color_pulpa',
                    label: 'Color Pulpa',
                    type: 'select',
                    options: ['Blanca', 'Verde - Blanca', 'Verde', 'Blanca - Amarilla', 'Amarilla'],
                    required: false,
                    help: 'Seleccione el color predominante.'
                },
                {
                    key: 'matriz_presiones',
                    label: 'Matriz de Presiones (P R E S I O N E S)',
                    type: 'pressure_matrix',
                    user_can_add_rows: true,
                    help: 'Ingrese Calibre, # Frutos, Brix y detalle de presiones por fruto.',
                    initialRows: []
                },
                { key: 'presion_promedio', label: 'PROMEDIO X', type: 'decimal', readOnly: true, help: 'Promedio global de todas las presiones.' },
                { key: 'presion_max', label: 'MAX', type: 'decimal', readOnly: true, help: 'Valor máximo registrado.' },
                { key: 'presion_min', label: 'MIN', type: 'decimal', readOnly: true, help: 'Valor mínimo registrado.' },
                { key: 'sol_promedio', label: 'SOL X (Promedio SOL)', type: 'decimal', readOnly: true },
            ]
        },
        {
            key: 'almidon_semilla',
            title: '4. Almidón y Color de Semilla',
            description: 'Matrices de Almidón y Color de Semilla.',
            fields: [
                {
                    key: 'matriz_almidon_sol',
                    label: 'Matriz de Almidón',
                    help: 'Ingrese los valores de almidon de hasta 10 frutos por serie.',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    columns: [
                        { key: 'calibre', label: 'CALIBRE', type: 'text' },
                        { key: 'f1', label: '1', type: 'decimal' },
                        { key: 'f2', label: '2', type: 'decimal' },
                        { key: 'f3', label: '3', type: 'decimal' },
                        { key: 'f4', label: '4', type: 'decimal' },
                        { key: 'f5', label: '5', type: 'decimal' },
                        { key: 'f6', label: '6', type: 'decimal' },
                        { key: 'f7', label: '7', type: 'decimal' },
                        { key: 'f8', label: '8', type: 'decimal' },
                        { key: 'f9', label: '9', type: 'decimal' },
                        { key: 'f10', label: '10', type: 'decimal' },
                    ],
                    initialRows: []
                },
                { key: 'almidon_promedio', label: 'PROMEDIO X (Almidón)', type: 'decimal', readOnly: true },
                { key: 'almidon_max', label: 'MAX (Almidón)', type: 'decimal', readOnly: true },
                { key: 'almidon_min', label: 'MIN (Almidón)', type: 'decimal', readOnly: true },
                {
                    key: 'matriz_color_semilla',
                    label: 'Matriz Color de Semilla',
                    help: 'Ingrese cuántas semillas observa en cada categoría de color. Los totales por categoría se calculan automáticamente.',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    columns: [
                        { key: 'calibre', label: 'Calibre', type: 'text' },
                        { key: 'sem_0', label: '0', type: 'integer' },
                        { key: 'sem_1_8', label: '1/8', type: 'integer' },
                        { key: 'sem_1_4', label: '1/4', type: 'integer' },
                        { key: 'sem_1_2', label: '1/2', type: 'integer' },
                        { key: 'sem_3_4', label: '3/4', type: 'integer' },
                        { key: 'sem_1', label: '1', type: 'integer' },
                    ],
                    initialRows: []
                },
                {
                    key: 'suma_color_semilla',
                    label: 'Totales (Suma)',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    readOnly: true,
                    columns: [
                        { key: 'sem_0', label: '0', type: 'integer' },
                        { key: 'sem_1_8', label: '1/8', type: 'integer' },
                        { key: 'sem_1_4', label: '1/4', type: 'integer' },
                        { key: 'sem_1_2', label: '1/2', type: 'integer' },
                        { key: 'sem_3_4', label: '3/4', type: 'integer' },
                        { key: 'sem_1', label: '1', type: 'integer' },
                    ],
                    initialRows: [{ _id: uuidv4(), sem_0: 0, sem_1_8: 0, sem_1_4: 0, sem_1_2: 0, sem_3_4: 0, sem_1: 0 }]
                }
            ]
        },
        {
            key: 'parametros_quimicos_defectos',
            title: '5. Parámetros Químicos y Defectos Internos',
            description: 'Ingrese parámetros químicos, defectos internos (Corazón Acuoso y Mohoso) y observaciones finales.',
            fields: [
                { key: 'ph', label: 'pH', type: 'decimal' },
                { key: 'acidez', label: 'Acidez', type: 'decimal' },
                { key: 'gasto_ml', label: 'Gasto (ml)', type: 'decimal', help: 'El % de Ácido Málico se calculará automáticamente.' },
                { key: 'ac_malico_pct', label: '% Ácido Málico', type: 'decimal', readOnly: true, help: 'Cálculo: Gasto (ml) * 0.067' },
                {
                    key: 'matriz_cor_acuoso',
                    label: 'Defectos internos – Cor. Acuoso',
                    help: 'Ingrese la cantidad de frutos para cada categoría de Corazón Acuoso.',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'categoria', label: 'Categoría', type: 'text', readOnly: true },
                        { key: 'frutos', label: 'Frutos', type: 'integer' },
                    ],
                    initialRows: [
                        { _id: uuidv4(), categoria: 'G1', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G2', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G3', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G4', frutos: '', _isFixed: true },
                    ]
                },
                {
                    key: 'matriz_cor_mohoso',
                    label: 'Defectos internos – Cor. Mohoso',
                    help: 'Ingrese la cantidad de frutos para cada categoría de Corazón Mohoso.',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'categoria', label: 'Categoría', type: 'text', readOnly: true },
                        { key: 'frutos', label: 'Frutos', type: 'integer' },
                    ],
                    initialRows: [
                        { _id: uuidv4(), categoria: 'G1.S', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G1.H', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G2.S', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G2.H', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G3.S', frutos: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'G3.H', frutos: '', _isFixed: true },
                    ]
                },
                { key: 'observaciones', label: 'Observations', type: 'textarea' },
                { key: 'tecnico', label: 'Técnico (TEC)', type: 'text', help: 'Nombre y Apellido' },
                { key: 'ayudante', label: 'Ayudante (AYUD.)', type: 'text', help: 'Nombre y Apellido' },
            ]
        }
    ],
};

// RECEPCIÓN MADUREZ POMÁCEAS template
const RECEPCION_MADUREZ_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.014',
    title: 'RECEPCIÓN MADUREZ POMÁCEAS',
    description: 'Formulario de recepción y análisis de madurez para pomáceas.',
    version: '3.1',
    status: 'Publicada',
    tags: ['Recepción', 'Madurez', 'Pomáceas'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'thermometer',
    sections: [
        {
            key: 'encabezado_recepcion',
            title: '1. Datos de recepción',
            fields: [
                { key: 'encabezado.planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'encabezado.temporada', label: 'Temporada', type: 'text', readOnly: true },
                { key: 'identificacion.codigo', label: 'CÓDIGO', type: 'text' },

                // ✅ Productor igual en todas: autocomplete
                { key: 'identificacion.productor', label: 'PRODUCTOR', type: 'autocomplete' },

                { key: 'encabezado.tipo_fruta', label: 'Tipo Fruta', type: 'select', options: ['MANZANA', 'PERA'] },

                // ✅ Variedad Real igual en todas: select + dynamicOptions
                { key: 'identificacion.variedad', label: 'VARIEDAD', type: 'select', options: [], dynamicOptions: 'variedades' },

                // ✅ Grupo igual en todas: text readOnly (se autocompleta desde la variedad)
                {
                    key: 'identificacion.variedad_rotulada_grupo',
                    label: 'Variedad Rotulada (Grupo)',
                    type: 'text',
                    readOnly: true,
                },

                {
                    key: 'identificacion.tamano_muestra',
                    label: 'Tamaño de Muestra',
                    type: 'integer',
                    help: 'Ingrese el número de frutos de la muestra (ej: 30).',
                },

                // ✅ Huerto igual en todas: autocomplete
                { key: 'identificacion.huerto', label: 'HUERTO', type: 'autocomplete' },

                { key: 'identificacion.n_bins', label: 'N° Bins', type: 'text' },
                { key: 'encabezado.folio_cku', label: 'FOLIO CKU', type: 'text' },
                { key: 'datos_cosecha.n_carta_cosecha', label: 'N° CARTA COSECHA', type: 'text' },
                { key: 'datos_cosecha.n_guia_entrada', label: 'N° GUÍA ENTRADA', type: 'text' },
                { key: 'datos_cosecha.fecha_cosecha', label: 'FECHA COSECHA', type: 'date' },
                { key: 'datos_cosecha.fecha_revision', label: 'FECHA REVISIÓN', type: 'date' },
                { key: 'datos_cosecha.hora_ingreso_camion', label: 'HORA INGRESO CAMIÓN', type: 'time' },
            ]
        },
        {
            key: 'madurez_parciales',
            title: '2. MADUREZ – Calibre Grande (Parciales, Presiones y % Sólidos Solubles)',
            fields: [
                { key: 'madurez.calibre', label: 'Calibre', type: 'text', readOnly: true },
                { key: 'madurez.solidos_solubles', label: '% Sólidos Solubles', type: 'decimal', help: 'Ej: 12.5' },
                {
                    key: 'tabla_parciales',
                    label: 'Parciales y Presiones',
                    help: 'Ingrese las presiones de cada parcial (hasta 20).',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'n_parcial', label: 'Parcial N°', type: 'text', readOnly: true },
                        { key: 'presion_1', label: 'Presión 1', type: 'decimal' },
                        { key: 'presion_2', label: 'Presión 2', type: 'decimal' },
                    ],
                    initialRows: Array.from({ length: 20 }, (_, i) => ({
                        _id: uuidv4(),
                        n_parcial: (i + 1).toString(),
                        presion_1: '',
                        presion_2: '',
                        _isFixed: true
                    })),
                },
                {
                    key: 'matriz_resumen_presiones_grande',
                    label: 'Resumen Presión de pulpa – Calibre Grande',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'estadistico', label: '', type: 'text', readOnly: true },
                        { key: 'grande', label: 'GRANDE', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), estadistico: 'X', grande: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MAX', grande: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MIN', grande: '', _isFixed: true },
                    ]
                },
            ]
        },
        {
            key: 'madurez_mediano',
            title: '3. MADUREZ – Calibre Mediano (Parciales, Presiones y % Sólidos Solubles)',
            fields: [
                { key: 'madurez_mediano.calibre', label: 'Calibre', type: 'text', readOnly: true },
                { key: 'madurez_mediano.solidos_solubles', label: '% Sólidos Solubles', type: 'decimal', help: 'Ej: 12.5' },
                {
                    key: 'tabla_parciales_mediano',
                    label: 'Parciales y Presiones (Mediano)',
                    help: 'Ingrese las presiones de cada parcial (hasta 20).',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'n_parcial', label: 'Parcial N°', type: 'text', readOnly: true },
                        { key: 'presion_1', label: 'Presión 1', type: 'decimal' },
                        { key: 'presion_2', label: 'Presión 2', type: 'decimal' },
                    ],
                    initialRows: Array.from({ length: 20 }, (_, i) => ({
                        _id: uuidv4(),
                        n_parcial: (i + 1).toString(),
                        presion_1: '',
                        presion_2: '',
                        _isFixed: true
                    })),
                },
                {
                    key: 'matriz_resumen_presiones_mediano',
                    label: 'Resumen Presión de pulpa – Calibre Mediano',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'estadistico', label: '', type: 'text', readOnly: true },
                        { key: 'mediano', label: 'MEDIANO', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), estadistico: 'X', mediano: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MAX', mediano: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MIN', mediano: '', _isFixed: true },
                    ]
                },
            ]
        },
        {
            key: 'madurez_chico',
            title: '4. MADUREZ – Calibre Chico (Parciales, Presiones y % Sólidos Solubles)',
            fields: [
                { key: 'madurez_chico.calibre', label: 'Calibre', type: 'text', readOnly: true },
                { key: 'madurez_chico.solidos_solubles', label: '% Sólidos Solubles', type: 'decimal', help: 'Ej: 12.5' },
                {
                    key: 'tabla_parciales_chico',
                    label: 'Parciales y Presiones (Chico)',
                    help: 'Ingrese las presiones de cada parcial (hasta 20).',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'n_parcial', label: 'Parcial N°', type: 'text', readOnly: true },
                        { key: 'presion_1', label: 'Presión 1', type: 'decimal' },
                        { key: 'presion_2', label: 'Presión 2', type: 'decimal' },
                    ],
                    initialRows: Array.from({ length: 20 }, (_, i) => ({
                        _id: uuidv4(),
                        n_parcial: (i + 1).toString(),
                        presion_1: '',
                        presion_2: '',
                        _isFixed: true
                    })),
                },
                {
                    key: 'matriz_resumen_presiones_chico',
                    label: 'Resumen Presión de pulpa – Calibre Chico',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'estadistico', label: '', type: 'text', readOnly: true },
                        { key: 'chico', label: 'CHICO', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), estadistico: 'X', chico: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MAX', chico: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MIN', chico: '', _isFixed: true },
                    ]
                },
            ]
        },
        {
            key: 'resumen_madurez',
            title: '5. Resumen Madurez (Semilla y Pulpa)',
            fields: [
                {
                    key: 'matriz_resumen_madurez',
                    label: 'Matriz de Madurez',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'parametro', label: 'MADUREZ', type: 'text', readOnly: true },
                        { key: 'grande', label: 'GRANDE', type: 'select' },
                        { key: 'mediano', label: 'MEDIANO', type: 'select' },
                        { key: 'chico', label: 'CHICO', type: 'select' },
                    ],
                    initialRows: [
                        {
                            _id: uuidv4(),
                            parametro: 'COLOR DE SEMILLA',
                            grande: '', mediano: '', chico: '',
                            _isFixed: true,
                            _rowOptions: {
                                grande: ['0', '1/8', '1/4', '1/2', '3/4', '1'],
                                mediano: ['0', '1/8', '1/4', '1/2', '3/4', '1'],
                                chico: ['0', '1/8', '1/4', '1/2', '3/4', '1'],
                            }
                        },
                        {
                            _id: uuidv4(),
                            parametro: 'COLOR DE PULPA',
                            grande: '', mediano: '', chico: '',
                            _isFixed: true,
                            _rowOptions: {
                                grande: ['Verde', 'Verde - Blanca', 'Blanca', 'Blanca - Amarilla', 'Amarilla'],
                                mediano: ['Verde', 'Verde - Blanca', 'Blanca', 'Blanca - Amarilla', 'Amarilla'],
                                chico: ['Verde', 'Verde - Blanca', 'Blanca', 'Blanca - Amarilla', 'Amarilla'],
                            }
                        },
                    ]
                },
                {
                    key: 'matriz_resumen_presion_general',
                    label: 'Resumen Presión de Pulpa',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'estadistico', label: '', type: 'text', readOnly: true },
                        { key: 'general', label: 'General', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), estadistico: 'X', general: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MAX', general: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MIN', general: '', _isFixed: true },
                    ]
                }
            ]
        },
        {
            key: 'parciales',
            title: '6. Medición Almidón',
            fields: [
                {
                    key: 'parciales',
                    label: 'Detalle de Parciales',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    columns: [
                        { key: 'parametro', label: 'Parcial', type: 'integer', readOnly: true },
                        { key: 'almidon_grande', label: 'ALMID CALIBRE GRANDE', type: 'decimal' },
                        { key: 'almidon_mediano', label: 'ALMID CALIBRE MEDIANO', type: 'decimal' },
                        { key: 'almidon_chico', label: 'ALMID CALIBRE CHICO', type: 'decimal' },
                    ],
                    initialRows: Array.from({ length: 20 }, (_, i) => ({
                        _id: uuidv4(),
                        parametro: i + 1,
                        almidon_grande: '',
                        almidon_mediano: '',
                        almidon_chico: '',
                        _isFixed: true
                    }))
                },
                {
                    key: 'matriz_resumen_almidon',
                    label: 'Resumen Test de almidón por calibre',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'estadistico', label: '', type: 'text', readOnly: true },
                        { key: 'grande', label: 'GRANDE', type: 'decimal', readOnly: true },
                        { key: 'mediano', label: 'MEDIANO', type: 'decimal', readOnly: true },
                        { key: 'chico', label: 'CHICO', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), estadistico: 'X', grande: '', mediano: '', chico: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MAX', grande: '', mediano: '', chico: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MIN', grande: '', mediano: '', chico: '', _isFixed: true },
                    ]
                },
                {
                    key: 'matriz_resumen_almidon_global',
                    label: 'Resumen Almidón Global',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'estadistico', label: '', type: 'text', readOnly: true },
                        { key: 'global', label: 'GLOBAL', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), estadistico: 'X', global: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MAX', global: '', _isFixed: true },
                        { _id: uuidv4(), estadistico: 'MIN', global: '', _isFixed: true },
                    ]
                }
            ]
        },
        {
            key: 'defectos_internos',
            title: '7. Corazón Mohoso / Acuoso y Parámetros Químicos',
            fields: [
                {
                    key: 'matriz_corazon_mohoso',
                    label: 'CORAZÓN MOHOSO',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'calibre', label: 'CALIBRE', type: 'text', readOnly: true },
                        { key: '1_s', label: '1 - S', type: 'text' },
                        { key: '1_h', label: '1 - H', type: 'text' },
                        { key: '2_s', label: '2 - S', type: 'text' },
                        { key: '2_h', label: '2 - H', type: 'text' },
                        { key: '3_s', label: '3 - S', type: 'text' },
                        { key: '3_h', label: '3 - H', type: 'text' },
                    ],
                    initialRows: [
                        { _id: uuidv4(), calibre: 'GRANDE', _isFixed: true },
                        { _id: uuidv4(), calibre: 'MEDIANO', _isFixed: true },
                        { _id: uuidv4(), calibre: 'CHICO', _isFixed: true },
                    ]
                },
                {
                    key: 'matriz_corazon_acuoso',
                    label: 'CORAZÓN ACUOSO',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'calibre', label: 'CALIBRE', type: 'text', readOnly: true },
                        { key: 'g1', label: 'G1', type: 'decimal' },
                        { key: 'g2', label: 'G2', type: 'decimal' },
                        { key: 'g3', label: 'G3', type: 'decimal' },
                        { key: 'g4', label: 'G4', type: 'decimal' },
                    ],
                    initialRows: [
                        { _id: uuidv4(), calibre: 'GRANDE', _isFixed: true },
                        { _id: uuidv4(), calibre: 'MEDIANO', _isFixed: true },
                        { _id: uuidv4(), calibre: 'CHICO', _isFixed: true },
                        { _id: uuidv4(), calibre: 'X (Promedio)', _isFixed: true, _isReadOnlyRow: true },
                    ]
                },
                {
                    key: 'matriz_promedios_cor_acuoso',
                    label: 'Promedios Corazón Acuoso',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'calibre', label: 'CALIBRE', type: 'text', readOnly: true },
                        { key: 'promedio', label: 'X (Promedio)', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), calibre: 'GRANDE', promedio: '', _isFixed: true, _isReadOnlyRow: true },
                        { _id: uuidv4(), calibre: 'MEDIANO', promedio: '', _isFixed: true, _isReadOnlyRow: true },
                        { _id: uuidv4(), calibre: 'CHICO', promedio: '', _isFixed: true, _isReadOnlyRow: true },
                    ]
                },
                { key: 'acidez', label: 'ACIDEZ', type: 'decimal' },
                { key: 'ph', label: 'pH', type: 'decimal' },
                { key: 'gasto_naoh', label: 'GASTO NaOH', type: 'decimal' },
            ]
        },
        {
            key: 'resolucion_final',
            title: '8. Resolución',
            fields: [
                {
                    key: 'tipo_frio_codigo',
                    label: 'Tipo de frío / Código tipo frío',
                    type: 'select',
                    options: ['AC-S', 'AC-D', 'FC-S', 'FC-1', 'FC-1S', 'FC-2', 'FC-2S', 'FC-3', 'FC-3S']
                },
                { key: 'tratamiento_producto', label: 'Tratamiento / producto', type: 'textarea' },
                {
                    key: 'fogging',
                    label: 'Fogging',
                    type: 'select',
                    options: ['Con Fogging', 'Sin Fogging']
                },
                { key: 'resolucion.estado', label: 'Resolución', type: 'select', options: ['Normal', 'Rechazo 2', 'Rechazo 1'] },
                { key: 'n_camara_destino', label: 'N° cámara destino (solo si se conoce)', type: 'text', required: false },
                { key: 'observaciones_madurez', label: 'Observaciones madurez', type: 'textarea' },
                { key: 'causal_rechazo', label: 'Causal rechazo', type: 'textarea' },
                { key: 'firmas.realizado_por', label: 'Realizado por', type: 'text', help: 'Nombre y Apellido' },
                { key: 'firmas.revisado_por', label: 'Revisado por', type: 'text', help: 'Nombre y Apellido' },
            ]
        }
    ]
};

// PROYECCIÓN DE EMBALAJE POMÁCEAS – RECEPCIÓN template
const PROYECCION_EMBALAJE_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.015',
    title: 'PROYECCIÓN DE EMBALAJE POMÁCEAS – RECEPCIÓN',
    description: 'Proyección de embalaje y color.',
    version: '1.0',
    status: 'Publicada',
    tags: ['Proyección', 'Calidad'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'pie-chart',
    sections: [
        {
            key: 'encabezado',
            title: '1. Identificación y Datos de Recepción',
            fields: [
                { key: 'encabezado.planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'encabezado.temporada', label: 'Temporada', type: 'text', readOnly: true },

                // ✅ Productor como en REG.CKU.013 (autocomplete)
                { key: 'recepcion.productor', label: 'Productor', type: 'autocomplete' },

                { key: 'recepcion.codigo_productor', label: 'Código Productor', type: 'text' },
                { key: 'encabezado.tipo_fruta', label: 'Tipo de fruta', type: 'select', options: ['MANZANA', 'PERA'] },

                // ✅ Variedad Real como en REG.CKU.013 (select con dynamicOptions: 'variedades')
                { key: 'recepcion.variedad', label: 'Variedad Real', type: 'select', options: [], dynamicOptions: 'variedades' },

                // ✅ Variedad Rotulada (Grupo) como en REG.CKU.013 (text readonly, se autocompleta desde VariedadSelect en FormFiller)
                {
                    key: 'recepcion.variedad_rotulada_grupo',
                    label: 'Variedad Rotulada (Grupo)',
                    type: 'text',
                    readOnly: true,
                },

                { key: 'recepcion.n_bins', label: 'N° Bins', type: 'text' },
                { key: 'recepcion.tamano_muestra', label: 'Tamaño de Muestra', type: 'integer' },
                { key: 'recepcion.folio_cku', label: 'Folio CKU', type: 'text' },
                { key: 'recepcion.n_guia_entrada', label: 'N° GUÍA ENTRADA', type: 'text' },
                { key: 'recepcion.tarja_entrada', label: 'Tarja Entrada', type: 'text' },
                { key: 'recepcion.fecha_cosecha', label: 'Fecha Cosecha', type: 'date' },
                { key: 'recepcion.fecha_recepcion', label: 'Fecha Recepción', type: 'date' },
                { key: 'recepcion.temp_pulpa', label: 'T° Pulpa (°C)', type: 'decimal' },
            ]
        },
        {
            key: 'calibre_color',
            title: '2. Calibre, Color de Fondo y Color de Cubrimiento',
            fields: [
                {
                    key: 'tabla_calibre',
                    label: 'Calibre',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    columns: [
                        { key: 'sc', label: 'S/C', type: 'text' },
                        { key: 'gr', label: 'GR', type: 'text' },
                        { key: 'med', label: 'MED', type: 'text' },
                        { key: 'ch', label: 'CH', type: 'text' },
                        { key: 'pc', label: 'P/C', type: 'text' },
                    ],
                    initialRows: [{ _id: uuidv4(), _isFixed: false }]
                },
                {
                    key: 'tabla_color_fondo',
                    label: 'Color de Fondo',
                    help: 'Ingrese la cantidad de frutos por grupo de color de fondo (categorías 1 a 7).',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    columns: [
                        { key: 'c1', label: '1', type: 'integer' },
                        { key: 'c2', label: '2', type: 'integer' },
                        { key: 'c3', label: '3', type: 'integer' },
                        { key: 'c4', label: '4', type: 'integer' },
                        { key: 'c5', label: '5', type: 'integer' },
                        { key: 'c6', label: '6', type: 'integer' },
                        { key: 'c7', label: '7', type: 'integer' },
                    ],
                    initialRows: [{ _id: uuidv4(), _isFixed: false }],
                    dependency: {
                        key: 'recepcion.variedad_rotulada_grupo',
                        value: ['GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI', 'GRANNY SMITH']
                    }
                },
                {
                    key: 'tabla_color_cubrimiento',
                    label: 'Color de Cubrimiento',
                    help: 'Ingrese la cantidad de frutos por categoría.',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'cat_0', label: 'C1', type: 'integer' },
                        { key: 'cat_1', label: 'C2', type: 'integer' },
                        { key: 'cat_2', label: 'C3', type: 'integer' },
                        { key: 'cat_3', label: 'C4', type: 'integer' },
                    ],
                    initialRows: [{ _id: uuidv4(), _isFixed: true }],
                    dependency: {
                        key: 'recepcion.variedad_rotulada_grupo',
                        value: ['ROJAS', 'GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI']
                    }
                }
            ]
        },
        {
            key: 'categoria_especie',
            title: '3. Categoría según Especie',
            description: 'Complete solo si corresponde a Manzanas.',
            fields: [
                {
                    key: 'danos_defectos',
                    label: 'Daños y defectos – % frutos',
                    help: 'Ingrese the number of frutos that presenta cada daño (unidades). Los porcentajes se calcularán automáticamente.',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    columns: [
                        { key: 'concepto', label: 'Concepto', type: 'text', readOnly: true },
                        { key: 'leve_unidades', label: 'LEVE (unidades)', type: 'integer' },
                        { key: 'leve_pct', label: 'LEVE (% frutos)', type: 'decimal', readOnly: true },
                        { key: 'grave_unidades', label: 'GRAVE (unidades)', type: 'integer' },
                        { key: 'grave_pct', label: 'GRAVE (% frutos)', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        'Golpe de sol', 'Machucón', 'Russet', 'Herida', 'Partidura', 'Roce',
                        'Deforme', 'Amarillez', 'Daño polilla', 'Daño escama', 'Sol postcosecha',
                        'Infiltración', 'Corcho', 'Lenticelosis', 'Bitter pit', 'Daño granizo',
                        'Quemado de sol', 'Ramaleo', 'Falta de color en grano', 'Pigmentación rosada',
                        'Litasis', 'Cracking', 'Color café (burro)', 'Golpe trips', 'Pudrición',
                        'Daño eulia', 'Daño penacho', 'Velo blanco'
                    ].map(c => ({ _id: uuidv4(), concepto: c, headers: [], leve_unidades: '', leve_pct: '', grave_unidades: '', grave_pct: '', _isFixed: true }))
                },
                {
                    key: 'plagas_enfermedades',
                    label: 'Plagas y enfermedades – % frutos',
                    help: 'Ingrese the number of frutos que presenta cada plaga o enfermedad (unidades). Los porcentajes se calcularán automáticamente.',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    columns: [
                        { key: 'plaga_enfermedad', label: 'Plaga / enfermedad', type: 'text', readOnly: true },
                        { key: 'leve_unidades', label: 'LEVE (unidades)', type: 'integer' },
                        { key: 'leve_pct', label: 'LEVE (% frutos)', type: 'decimal', readOnly: true },
                        { key: 'grave_unidades', label: 'GRAVE (unidades)', type: 'integer' },
                        { key: 'grave_pct', label: 'GRAVE (% frutos)', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        'Chanchito blanco', 'Polilla', 'Pulgón lanígero', 'Escama', 'Venturia',
                        'Arañita', 'Eulia', 'Alternaria'
                    ].map(p => ({ _id: uuidv4(), plaga_enfermedad: p, leve_unidades: '', lave_pct: '', grave_unidades: '', grave_pct: '', _isFixed: true }))
                }
            ]
        },
        {
            key: 'proyeccion_embalaje_step',
            title: '4. Proyección de Embalaje',
            fields: [
                {
                    key: 'tabla_proyeccion_embalaje',
                    label: 'Porcentaje de Proyección de Embalaje',
                    type: 'dynamic_table',
                    help: 'Seleccione la categoría de proyección de embalaje que corresponde al lote.',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'categoria', label: 'Categoría', type: 'text', readOnly: true },
                        { key: 'n_frutos', label: 'N° de frutos', type: 'integer' },
                        { key: 'porcentaje', label: 'Porcentaje %', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [
                        { _id: uuidv4(), categoria: 'Premium', n_frutos: '', porcentaje: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'Super', n_frutos: '', porcentaje: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'Fancy', n_frutos: '', porcentaje: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'Choice', n_frutos: '', porcentaje: '', _isFixed: true },
                        { _id: uuidv4(), categoria: 'Comercial', n_frutos: '', porcentaje: '', _isFixed: true },
                    ]
                }
            ]
        },
        {
            key: 'condicion_transporte',
            title: '5. Condición del Camión y Observaciones',
            fields: [
                {
                    key: 'matriz_condicion_camion',
                    label: 'Condiciones de recepción / camión',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'item', label: 'Item', type: 'text', readOnly: true },
                        { key: 'no', label: 'NO', type: 'boolean' },
                        { key: 'si', label: 'SI', type: 'boolean' },
                        { key: 'observaciones', label: 'OBSERVACIONES', type: 'text' },
                    ],
                    initialRows: [
                        { _id: uuidv4(), item: 'Carpa', _isFixed: true },
                        { _id: uuidv4(), item: 'Cuerdas', _isFixed: true },
                        { _id: uuidv4(), item: 'Higiene camión', _isFixed: true },
                        { _id: uuidv4(), item: 'Mal olor', _isFixed: true },
                        { _id: uuidv4(), item: 'Clavos o astillas', _isFixed: true },
                        { _id: uuidv4(), item: 'Pisos o paredes rotos', _isFixed: true },
                    ]
                },
                { key: 'observaciones_generales', label: 'Observaciones', type: 'textarea' },
                { key: 'realizado_por', label: 'Realizado por', type: 'text' },
                { key: 'revisado_por', label: 'Revisado por', type: 'text' },
                {
                    key: 'resumen_fruta_exportable',
                    label: 'RESUMEN FRUTA EXPORTABLE',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'cantidad_exportable', label: 'Cantidad de Fruta Exportable', type: 'integer', readOnly: true },
                        { key: 'porcentaje_exportable', label: 'Porcentaje % en relación al Tamaño de Muestra', type: 'decimal', readOnly: true },
                    ],
                    initialRows: [{ _id: uuidv4(), cantidad_exportable: '', porcentaje_exportable: '', _isFixed: true }]
                }
            ]
        }
    ]
};

// ATMÓSFERA CONTROLADA POMÁCEAS template
// ✅ AC_RECEPCION_TEMPLATE (REG.CKU.022) — Bloque corregido y funcional
// Cambio aplicado: Productor pasa de type:'text' a type:'autocomplete'
// (Tu FormFiller.tsx ya renderiza AutoCompleteProductor cuando type === 'autocomplete' y key incluye 'productor')

const AC_RECEPCION_TEMPLATE: FormTemplate = {
  id: "REG.CKU.022",
  title: "ATMÓSFERA CONTROLADA POMÁCEAS",
  description: "Control de recepción en Atmósfera Controlada.",
  version: "1.0",
  status: "Publicada",
  tags: ["AC", "Recepción"],
  publishedTo: ["Trabajador CKU", "Administrador"],
  icon: "wind",
  sections: [
    {
      key: "identificacion",
      title: "1. Identificación",
      fields: [
        { key: "encabezado.planta", label: "Planta", type: "text", readOnly: true },
        { key: "encabezado.temporada", label: "Temporada", type: "text", readOnly: true },
        { key: "encabezado.tipo_fruta", label: "Tipo Fruta", type: "select", options: ["MANZANA", "PERA"] },
        { key: "encabezado.camara", label: "Cámara", type: "text" },

        // ✅ AQUÍ EL FIX: Productor como autocomplete
        { key: "encabezado.productor", label: "Productor", type: "autocomplete" },

        {
          key: "encabezado.variedad",
          label: "Variedad Real",
          type: "select",
          options: [
            "Gala",
            "Fuji",
            "Granny Smith",
            "Pink Lady",
            "Cripps Pink",
            "Ambrosia",
            "Honeycrisp",
            "Bartlett",
            "Packhams",
            "Abate Fetel",
          ],
        },
        { key: "encabezado.dias_ac", label: "Días en AC", type: "integer" },
        {
          key: "encabezado.tipo_frio",
          label: "Tipo de Frío",
          type: "select",
          options: ["AC", "AC-S", "AC-D", "FL", "FL-S", "FC-1S", "Convencional"],
        },
        { key: "encabezado.bins_lote", label: "Bins Lote", type: "text" },
        { key: "encabezado.folio_cku", label: "Folio CKU", type: "text" },
        { key: "recepcion.tarja_entrada", label: "Tarja Entrada", type: "text" },
        { key: "recepcion.fecha_cosecha", label: "Fecha Cosecha", type: "date" },
        { key: "recepcion.fecha_analisis", label: "Fecha Análisis", type: "date" },
        { key: "recepcion.temp_pulpa", label: "T° Pulpa (°C)", type: "decimal" },
      ],
    },

    {
      key: "step_3_presiones",
      title: "2. Presiones Fruto",
      fields: [
        {
          key: "matriz_presiones",
          label: "Presiones",
          type: "pressure_matrix",
          user_can_add_rows: true,
          user_can_add_columns: false,
          hideBrix: true,
          hideCalibre: true,
          showSummaryColumns: true,
          showOnlyAverage: true,
          initialRows: [
            {
              _id: uuidv4(),
              n_frutos: "",
              detalles: [],
              _isFixed: true,
            },
          ],
        },
        { key: "solidos_solubles", label: "Sólidos solubles (°Brix)", type: "decimal" },
      ],
    },

    {
      key: "step_4_matriz_fruto",
      title: "3. Matriz Test de Almidón",
      fields: [
        {
          key: "matriz_fruto_3",
          label: "Matriz Test de Almidón",
          type: "dynamic_table",
          user_can_add_rows: true,
          user_can_add_columns: false,
          columns: [
            { key: "concepto", label: "Concepto", type: "text", readOnly: false },
            { key: "c1", label: "1", type: "decimal" },
            { key: "c2", label: "2", type: "decimal" },
            { key: "c3", label: "3", type: "decimal" },
            { key: "c4", label: "4", type: "decimal" },
            { key: "c5", label: "5", type: "decimal" },
            { key: "c6", label: "6", type: "decimal" },
            { key: "c7", label: "7", type: "decimal" },
            { key: "c8", label: "8", type: "decimal" },
            { key: "c9", label: "9", type: "decimal" },
            { key: "c10", label: "10", type: "decimal" },
            { key: "cx", label: "X", type: "decimal", calc: "average", readOnly: true },
            { key: "porcentaje", label: "Porcentaje", type: "decimal", excludeFromCalc: true },
          ],
          initialRows: [
            { _id: uuidv4(), concepto: "TEST ALMIDÓN", _isFixed: true },
            { _id: uuidv4(), concepto: "COLOR DE FONDO", _isFixed: true },
            { _id: uuidv4(), concepto: "COLOR DE PULPA", _isFixed: true },
            { _id: uuidv4(), concepto: "CORAZÓN ACUOSO/MOHOSO", _isFixed: true },
            { _id: uuidv4(), concepto: "DESHIDRATACIÓN", _isFixed: true },
            { _id: uuidv4(), concepto: "BITTER PIT / LENTIC.", _isFixed: true },
            { _id: uuidv4(), concepto: "SUNSCALD", _isFixed: true },
            { _id: uuidv4(), concepto: "ESCALD / STAINING", _isFixed: true },
            { _id: uuidv4(), concepto: "CRACKING / PARTIDURA", _isFixed: true },
            { _id: uuidv4(), concepto: "PUDRICIÓN", _isFixed: true },
          ],
        },
      ],
    },

    {
      key: "resolucion_final",
      title: "4. Observaciones y Firmas",
      fields: [
        { key: "observaciones", label: "Observaciones", type: "textarea" },
        { key: "realizado_por", label: "Realizado por", type: "text" },
        { key: "revisado_por", label: "Revisado por", type: "text" },
      ],
    },
  ],
};


const PACKING_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.016',
    title: 'CONTROL DE PACKING',
    description: 'Registro de control de calidad en línea de packing.',
    version: '1.0',
    status: 'Publicada',
    tags: ['Packing', 'Calidad'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'box',
    sections: [
        {
            key: 'encabezado',
            title: 'Identificación',
            fields: [
                { key: 'encabezado.planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'encabezado.tipo_fruta', label: 'Especie', type: 'select', options: ['MANZANA', 'PERA'] },
                { key: 'encabezado.fecha', label: 'Fecha', type: 'date' },
                { key: 'encabezado.turno', label: 'Turno', type: 'select', options: ['A', 'B'] },
            ]
        }
    ]
};

const EMPAQUE_PRESIZE_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.017',
    title: 'C.K.U Empaque',
    description: 'Control de calidad para proceso de Empaque.',
    version: '1.0',
    status: 'Publicada',
    tags: ['Presize', 'Calidad'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'layers',
    sections: [
        {
            key: 'encabezado',
            title: 'Identificación',
            fields: [
                { key: 'encabezado.planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'encabezado.tipo_fruta', label: 'Tipo Fruta', type: 'select', options: ['MANZANA', 'PERA'] },

                // ✅ Productor como en REG.CKU.013 (autocomplete)
                { key: 'productor', label: 'Productor', type: 'autocomplete' },

                { key: 'codigo_productor', label: 'Código Productor', type: 'text' },
                { key: 'mercado', label: 'Mercado', type: 'text' },

                // ✅ Variedad Real como en REG.CKU.013 (select + dynamicOptions)
                { key: 'variedad', label: 'Variedad Real', type: 'select', options: [], dynamicOptions: 'variedades' },

                {
                    key: 'variedad_rotulada_grupo',
                    label: 'Variedad Rotulada (Grupo)',
                    type: 'select',
                    options: ['ROJAS', 'GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI', 'GRANNY SMITH'],
                },
                { key: 'calibre', label: 'Calibre', type: 'integer' },
                { key: 'categoria', label: 'Categoría', type: 'text' },
                { key: 'ot', label: 'O.T', type: 'text' },
                { key: 'n_bins', label: 'N° Bins', type: 'text' },
                { key: 'turno', label: 'Turno', type: 'text' },
                {
                    key: 'tipo_frio',
                    label: 'Tipo Frío',
                    type: 'select',
                    options: ['AC-S', 'AC-D', 'FC-S', 'FC-1', 'FC-1S', 'FC-2', 'FC-2S', 'FC-3', 'FC-3S'],
                },
                { key: 'temporada', label: 'Temporada', type: 'text', readOnly: true },
                { key: 'fecha_embalaje', label: 'Fecha Embalaje', type: 'date' },
            ]
        },
        {
            key: 'presiones_calibre',
            title: '2. Presiones por calibre',
            fields: [
                {
                    key: 'presiones_por_calibre',
                    label: 'Tabla de Presiones',
                    type: 'pressure_matrix',
                    user_can_add_rows: true,
                    hideBrix: true,
                    initialRows: []
                },
                { key: 'presion_promedio', label: 'PROMEDIO X', type: 'decimal', readOnly: true, help: 'Promedio global de todas las presiones.' },
                { key: 'presion_max', label: 'MAX', type: 'decimal', readOnly: true, help: 'Valor máximo registrado.' },
                { key: 'presion_min', label: 'MIN', type: 'decimal', readOnly: true, help: 'Valor mínimo registrado.' },
            ]
        },
        {
            key: 'control_calidad_linea',
            title: '3. Control de Calidad en Línea',
            fields: [
                {
                    key: 'tabla_datos_linea',
                    label: '3A – Datos por línea',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'concepto', label: 'Concepto', type: 'text', readOnly: true },
                        ...getFixedLineColumns(),
                    ],
                    initialRows: [
                        'Productor', 'Calibre', 'Categoría', 'Peso', 'Plu %', 'Encerado (B-R-M)'
                    ].map(c => ({ _id: uuidv4(), concepto: c, _isFixed: true }))
                },
                {
                    key: 'tabla_danos_defectos',
                    label: '3B – Daños y Defectos – %',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: (() => {
                        const baseCols = getFixedLineColumns();
                        return [
                            { key: 'concepto', label: 'Defecto', type: 'text', readOnly: true },
                            ...baseCols,
                            { key: 'promedio_fila', label: 'Promedio', type: 'decimal', readOnly: true }
                        ];
                    })(),
                    initialRows: [
                        'Golpe sol', 'Machucón', 'Herida abierta', 'Corcho', 'Roce', 'Russet', 'Partidura',
                        'Amarilla', 'Len/Bitter', 'Falta color', 'Deforme', 'Infiltración', 'Escaldado',
                        'Otros', 'Comercial', '% Comercial'
                    ].map(c => ({ _id: uuidv4(), concepto: c, _isFixed: true }))
                },
                {
                    key: 'tabla_fuera_categoria',
                    label: '3C – Fuera de Categoría',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: (() => {
                        const lineCols = getFixedLineColumns();
                        return [
                            { key: 'concepto', label: 'Item', type: 'text', readOnly: true },
                            ...lineCols,
                            { key: 'promedio_fila', label: 'Promedio', type: 'decimal', readOnly: true }
                        ];
                    })(),
                    initialRows: (() => {
                        const rows = ['Superior %', 'Inferior %', 'Choice %', 'Resolución'].map(c => {
                            const row: any = { _id: uuidv4(), concepto: c, _isFixed: true };
                            if (c === 'Resolución') {
                                row._rowOptions = {};
                                for (let i = 1; i <= 30; i++) {
                                    row._rowOptions[`l${i}`] = ['Aprobado', 'Rechazado'];
                                }
                            }
                            return row;
                        });
                        return rows;
                    })()
                }
            ]
        },
        {
            key: 'mercado_interno',
            title: '4. Mercado Interno',
            fields: [
                {
                    key: 'tabla_mercado_interno',
                    label: 'Tabla Mercado Interno',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: getPresizerInternalMarketColumns(),
                    initialRows: [
                        'Golpe sol', 'Machucón', 'Herida abierta', 'Corcho', 'Roce', 'Russet',
                        'Partidura', 'Infiltración', 'Lenticelosis', 'Bitter pit', 'Pudrición',
                        'Sunscald', 'Escaldado', 'Staining', 'Litisias', 'Daño polilla',
                        'Escama', 'Venturia', 'Penacho', 'Granizo', 'Deforme', 'Falta color',
                        'Pigmentación', 'Deshidratación', 'Cracking', 'Hoja / restos floral',
                        'Fruta expor.', 'N° frutos'
                    ].map(d => {
                        const row: any = {
                            _id: uuidv4(),
                            defecto: d,
                            _isFixed: true,
                            _isReadOnlyRow: d === 'N° frutos'
                        };
                        for (let i = 1; i <= 30; i++) row[`f${i}`] = '';
                        row.promedio_x = '';
                        return row;
                    })
                }
            ]
        },
        {
            key: 'control_peso',
            title: '5. Control de Peso',
            fields: [
                { key: 'umbral_peso', label: 'Umbral de peso', type: 'decimal', help: 'Los pesos menores a este valor se resaltarán en rojo.' },
                {
                    key: 'tabla_control_peso',
                    label: 'Control de Peso',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    user_can_add_columns: false,
                    columns: getWeightControlColumns(),
                    initialRows: []
                },
                { key: 'promedio_pesos_general', label: 'Promedio de Pesos General', type: 'decimal', readOnly: true, help: 'Calculado como (Suma total pesos) / (Suma total # Cajas)' },
                { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
                { key: 'realizado_por', label: 'Realizado por', type: 'text' },
                { key: 'revisado_por', label: 'Revisado por', type: 'text' }
            ]
        }
    ]
};

const CONDICION_POMACEAS_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.018',
    title: 'C.K.U Presizer',
    description: 'Control de calidad para proceso de Presizer.',
    version: '1.0',
    status: 'Publicada',
    tags: ['Condición', 'Almacenaje'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'thermometer',
    sections: [
        {
            key: 'identificacion',
            title: 'Identificación y datos de recepción',
            fields: [
                { key: 'planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'tipo_fruta', label: 'Tipo Fruta', type: 'select', options: ['MANZANA', 'PERA'] },

                // ✅ Productor como en REG.CKU.013 (autocomplete)
                { key: 'productor', label: 'Productor', type: 'autocomplete' },

                { key: 'mercado', label: 'Mercado', type: 'text' },

                // ✅ Variedad Real como en REG.CKU.013 (select + dynamicOptions)
                { key: 'variedad', label: 'Variedad Real', type: 'select', options: [], dynamicOptions: 'variedades' },

                { key: 'ot', label: 'O.T', type: 'text' },
                { key: 'n_bins', label: 'N° Bins', type: 'text' },
                { key: 'turno', label: 'Turno', type: 'text' },
                {
                    key: 'tipo_frio',
                    label: 'Tipo de frío',
                    type: 'select',
                    options: ['AC-S', 'AC-D', 'FC-S', 'FC-1', 'FC-1S', 'FC-2', 'FC-2S', 'FC-3', 'FC-3S'],
                },
                { key: 'temporada', label: 'Temporada', type: 'text', readOnly: true },
                { key: 'fecha_cosecha', label: 'Fecha de cosecha', type: 'date' },
                { key: 'fecha_embalaje', label: 'Fecha de embalaje', type: 'date' },
                { key: 'cant_te', label: 'Cantidad de Tarjas de Entrada', type: 'integer', validations: { min: 0 } },
                {
                    key: 'te',
                    label: 'Tarjas de Entrada',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'n_tarja', label: 'N° de Tarja', type: 'text', readOnly: true },
                        { key: 'tarja_entrada', label: 'Tarja de Entrada', type: 'text' }
                    ]
                },
                { key: 'camara', label: 'Cámara', type: 'text', series_count: 2 },
            ]
        },
        {
            key: 'presiones_seccion',
            title: '2. Presiones por Calibre',
            fields: [
                {
                    key: 'matriz_presiones',
                    label: 'Tabla de Presiones',
                    type: 'pressure_matrix',
                    user_can_add_rows: true,
                    hideBrix: true,
                    showSummaryColumns: true,
                    initialRows: [{ _id: uuidv4(), calibre: '', n_frutos: 0, detalles: [] }]
                }
            ]
        },
        {
            key: 'control_peso_seccion',
            title: '3. Control de Peso',
            fields: [
                {
                    key: 'tabla_control_peso',
                    label: 'Control de Peso',
                    type: 'pressure_matrix',
                    user_can_add_rows: true,
                    hideBrix: true,
                    isWeightMode: true,
                    showSummaryColumns: true,
                    initialRows: [{ _id: uuidv4(), calibre: '', n_frutos: 0, detalles: [] }]
                }
            ]
        },
        {
            key: 'calidad_canal_seccion',
            title: '4. Control de Calidad por Canal',
            fields: [
                {
                    key: 'tabla_datos_canal',
                    label: '4A – Datos por canal/salida',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'concepto', label: 'CONCEPTO', type: 'text', readOnly: true },
                        ...getChannelColumns()
                    ],
                    initialRows: [
                        'Canal / Salida', 'Calibre', 'Categoría', 'Peso', 'Nº Frutos'
                    ].map(c => ({ _id: uuidv4(), concepto: c, _isFixed: true }))
                },
                {
                    key: 'tabla_fuera_categoria_canal',
                    label: '4B – Fuera de Categoría',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'concepto', label: 'CONCEPTO', type: 'text' as const, readOnly: true },
                        ...getChannelColumns()
                    ],
                    initialRows: [
                        'Superior %', 'Inferior %', 'Choice %', 'Resolución'
                    ].map(c => {
                        const row: any = { _id: uuidv4(), concepto: c, _isFixed: true };
                        if (c === 'Resolución') {
                            row._rowOptions = {};
                            for (let i = 1; i <= 50; i++) {
                                row._rowOptions[`ch${i}`] = ['Aprobado', 'Rechazado'];
                            }
                        }
                        return row;
                    })
                },
                {
                    key: 'tabla_danos_defectos_canal',
                    label: '4C – Daños y Defectos',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: [
                        { key: 'concepto', label: 'CONCEPTO', type: 'text' as const, readOnly: true },
                        ...getChannelColumns()
                    ],
                    initialRows: [
                        'Golpe Sol', 'Machucón', 'Herida Abierta', 'Corcho', 'Roce', 'Russet', 'Partidura',
                        'Amarilla', 'Len/Bitter', 'Falta Color', 'Deforme', 'Infiltración', 'Escaldado',
                        'Otros', 'Comercial', '% Comercial'
                    ].map(c => ({
                        _id: uuidv4(),
                        concepto: c,
                        _isFixed: true,
                        _isReadOnlyRow: c === 'Comercial' || c === '% Comercial'
                    }))
                }
            ]
        },
        {
            key: 'mercado_interno_seccion',
            title: '5. Mercado Interno',
            fields: [
                {
                    key: 'tabla_mercado_interno',
                    label: 'Tabla Mercado Interno',
                    type: 'dynamic_table',
                    user_can_add_rows: false,
                    user_can_add_columns: false,
                    columns: getPresizerInternalMarketColumns(),
                    initialRows: [
                        'Golpe sol', 'Machucón', 'Herida abierta', 'Corcho', 'Roce', 'Russet',
                        'Partidura', 'Infiltración', 'Lenticelosis', 'Bitter pit', 'Pudrición',
                        'Sunscald', 'Escaldado', 'Staining', 'Litisias', 'Daño polilla',
                        'Escama', 'Venturia', 'Penacho', 'Granizo', 'Deforme', 'Falta color',
                        'Pigmentación', 'Dehidratación', 'Cracking', 'Hoja / restos floral',
                        'Fruta expor.', 'N° frutos'
                    ].map(d => {
                        const row: any = {
                            _id: uuidv4(),
                            defecto: d,
                            _isFixed: true,
                            _isReadOnlyRow: d === 'N° frutos'
                        };
                        for (let i = 1; i <= 30; i++) row[`f${i}`] = '';
                        row.promedio_x = '';
                        return row;
                    })
                }
            ]
        },
        {
            key: 'observaciones_tecnico_seccion',
            title: '6. Observaciones y Técnico',
            fields: [
                {
                    key: 'observaciones',
                    label: 'Observaciones',
                    type: 'textarea',
                    required: false
                },
                {
                    key: 'tecnico',
                    label: 'Técnico',
                    type: 'text',
                    required: false
                },
                {
                    key: 'realizado_por',
                    label: 'Realizado por',
                    type: 'text',
                    required: false
                },
                {
                    key: 'revisado_por',
                    label: 'Revisado por',
                    type: 'text',
                    required: false
                }
            ]
        }
    ]
};

const MERCADO_INTERNO_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.026',
    title: 'MERCADO INTERNO',
    description: 'Control de despacho para mercado interno.',
    version: '1.0',
    status: 'Publicada',
    tags: ['Market Interno'],
    publishedTo: ['Administrador'],
    icon: 'shopping-bag',
    sections: [
        {
            key: 'identificacion',
            title: 'Datos Generales',
            fields: [
                { key: 'planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'tipo_fruta', label: 'Especie', type: 'select', options: ['MANZANA', 'PERA'] },
            ]
        }
    ]
};

const PRE_EMBARQUE_TEMPLATE: FormTemplate = {
    id: 'REG.CKU.027',
    title: 'PRE-EMBARQUE',
    description: 'Inspección de calidad previa al embarque.',
    version: '1.0',
    status: 'Publicada',
    tags: ['Embarque', 'Exportación'],
    publishedTo: ['Trabajador CKU', 'Administrador'],
    icon: 'truck',
    sections: [
        {
            key: 'identificacion',
            title: 'Datos de Embarque',
            fields: [
                { key: 'encabezado.temporada', label: 'Temporada', type: 'text', readOnly: true },
                { key: 'planta', label: 'Planta', type: 'text', readOnly: true },
                { key: 'tipo_fruta', label: 'Tipo Fruta', type: 'select', options: ['MANZANA', 'PERA'] },
            ]
        },
        {
            key: 'detalle_pallets_presion_defectos',
            title: '2. Detalle de pallets, presión y defectos',
            fields: [
                {
                    key: 'tabla_maestra_inspeccion',
                    label: 'Detalle de pallets, presión y defectos',
                    type: 'dynamic_table',
                    user_can_add_rows: true,
                    columns: [
                        { key: 'folio_pallet', label: 'FOLIO PALLET', type: 'text', required: false },
                        { key: 'n_caja', label: 'N° DE CAJA', type: 'text', required: false },
                        { key: 'productor', label: 'PRODUCTOR', type: 'text', required: false },
                        {
                            key: 'variedad',
                            label: 'VARIEDAD ROT.',
                            type: 'select',
                            options: ['ROJAS', 'GALA', 'CRIPPS PINK', 'AMBROSIA', 'FUJI', 'KANZI', 'GRANNY SMITH'],
                            required: false
                        },
                        {
                            key: 'tipo_frio',
                            label: 'TIPO DE FRÍO',
                            type: 'select',
                            options: ['AC', 'FC'],
                            required: false
                        },
                        { key: 'categoria', label: 'CATEGORÍA ROT.', type: 'text', required: false },
                        { key: 'envase', label: 'ENV (KLS)', type: 'text', required: false },
                        { key: 'calibre', label: 'CALIBRE', type: 'text', required: false },
                        { key: 'fecha_embalaje', label: 'FECHA EMB.', type: 'date', required: false },
                        { key: 'fecha_revision', label: 'FECHA REV.', type: 'date', required: false },
                        {
                            key: 'color_fondo',
                            label: 'COLOR DE FONDO',
                            type: 'select',
                            options: ['1', '2', '3', '4', '5', '6', '7'],
                            required: false
                        },
                        {
                            key: 'n_frutos',
                            label: '# FRUTOS',
                            type: 'integer',
                            validations: { min: 1 },
                            required: false
                        },
                        {
                            key: 'presiones',
                            label: 'DETALLE DE PRESIONES',
                            type: 'pressure_button',
                            required: false
                        },
                        {
                            key: 'hallazgos',
                            label: 'DETALLE DE HALLAZGOS',
                            type: 'findings_button',
                            required: false
                        },
                        { key: 'observaciones', label: 'OBSERVACIONES', type: 'text', required: false },
                        {
                            key: 'resolucion',
                            label: 'RESOLUCIÓN',
                            type: 'select',
                            options: ['Aprobado', 'Rechazado'],
                            required: false
                        },
                    ],
                    initialRows: [{ _id: uuidv4() }]
                }
            ]
        },
        {
            key: 'observaciones_vbo',
            title: '3. Observaciones y Control de Calidad (V°B°)',
            fields: [
                {
                    key: 'observaciones_generales',
                    label: 'Observaciones generales',
                    type: 'textarea'
                },
                {
                    key: 'tecnico_responsable',
                    label: 'Técnico responsable',
                    type: 'text',
                    help: 'Control de calidad (V°B°)'
                },
                {
                    key: 'revisado_por',
                    label: 'Revisado por',
                    type: 'text',
                    help: 'Nombre y Apellido'
                },
            ]
        },
        {
            key: 'datos_embarque_final',
            title: '4. Datos de embarque',
            fields: [
                { key: 'motonave', label: 'Motonave', type: 'text' },
                { key: 'recibidor', label: 'Recibidor', type: 'text' },
                { key: 'mercado', label: 'Mercado', type: 'text' },
                { key: 'c_marca', label: 'C/Marca', type: 'text' },
                { key: 'n_orden', label: 'N° Orden', type: 'text' },
                { key: 'f_embarque', label: 'F. Embarque', type: 'date' },
                { key: 'embarque', label: 'Embarque', type: 'text' },
            ]
        }
    ]
};

export const MOCK_TEMPLATES: FormTemplate[] = [
    ANALISIS_PRECOSECHA_TEMPLATE,
    RECEPCION_MADUREZ_TEMPLATE,
    PROYECCION_EMBALAJE_TEMPLATE,
    PACKING_TEMPLATE,
    EMPAQUE_PRESIZE_TEMPLATE,
    CONDICION_POMACEAS_TEMPLATE,
    AC_RECEPCION_TEMPLATE,
    MOCK_USER.roles.includes('Administrador') ? MERCADO_INTERNO_TEMPLATE : MERCADO_INTERNO_TEMPLATE,
    PRE_EMBARQUE_TEMPLATE,
];

export const MOCK_SUBMISSIONS: FormSubmission[] = [
    {
        id: '101',
        templateId: 'REG.CKU.013',
        status: 'Borrador',
        planta: 'Planta Teno',
        data: {
            productor: 'Agrícola San José',
            variedad_rotulada_grupo: 'GALA',
            huerto_cuartel: 'Huerto 1 / Cuartel 3',
            agronomo: 'Pedro Pascal',
            fecha_muestra: '2023-10-25',
        },
        createdAt: '2023-10-25T10:00:00Z',
        updatedAt: '2023-10-25T11:30:00Z',
        submittedBy: 'Juan Pérez',
    }
];