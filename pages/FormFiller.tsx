// pages/FormFiller.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
    FormTemplate,
    FormSubmission,
    FormStatus,
    FormSection,
    FormField,
    DynamicTableColumn,
    FieldDependency,
} from "../types";
import { Button } from "../components/ui/Button";
import { DynamicTable } from "../components/DynamicTable";
import { Badge } from "../components/ui/Badge";
import { SaveIcon, SendIcon, SettingsIcon } from "../components/Icons";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../context/ToastContext";
import { useNavigationBlocker } from "../context/NavigationBlockerContext";
import { useGlobalSettings } from "../context/GlobalSettingsContext";
import { v4 as uuidv4 } from "uuid";
import _ from 'lodash';
import { PressureMatrixManager, PressureEntry } from "../components/PressureMatrixManager";
import { Modal } from "../components/ui/Modal";
import VariedadSelect from '../components/variedadgrupo';
import AutoCompleteHuerto from '../components/AutoCompleteCatalog';
import AutoCompleteProductor from '../components/AutoCompleteProductor';
import { finalizeSubmission } from "../api/client";


interface FormFillerProps {
    findTemplate: (id: string) => FormTemplate | undefined;
    findSubmission: (id: string) => FormSubmission | undefined;
    initializeSubmission: (templateId: string) => FormSubmission;
    saveSubmission: (submission: FormSubmission) => void;
    isReadOnly?: boolean;
}

const FormFiller: React.FC<FormFillerProps> = ({
    findTemplate,
    findSubmission,
    initializeSubmission,
    saveSubmission,
    isReadOnly,
}) => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { blockNavigation, confirmExit, shouldConfirmExit } = useNavigationBlocker();
    const { planta, temporada, getFormattedPlanta } = useGlobalSettings();

    const [template, setTemplate] = useState<FormTemplate | null>(null);
    const [submission, setSubmission] = useState<FormSubmission | null>(null);
    const [activeSection, setActiveSection] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isDirty, setIsDirty] = useState(false);
    const fromNewRef = useRef(location.state?.fromNew || false);
    const prevDataRef = useRef<any>(null);

    // NEW: Estados para el modal de Guardar Borrador
    const [isSaveDraftModalOpen, setIsSaveDraftModalOpen] = useState(false);
    const [draftName, setDraftName] = useState("");

    // NEW: Estado para la línea activa en el Paso 3 de REG.CKU.017
    const [activeLineKey, setActiveLineKey] = useState<string>('l1');
    // NEW: Estado para el fruto activo en el Paso 4 de REG.CKU.017 (Sincronizado con Presizer)
    const [activeFrutoKey, setActiveFrutoKey] = useState<string>('f1');
    // NEW: Estado para el canal activo en el Paso 4 de REG.CKU.018 (Presizer)
    const [activeChannelKey, setActiveChannelKey] = useState<string>('ch1');
    // NEW: Estado para la fruta activa en el Paso 5 de REG.CKU.018 (Mercado Interno Presizer)
    const [activeFrutaKey, setActiveFrutaKey] = useState<string>('f1');

    const isEditable = useMemo(() => {
        return !isReadOnly && submission?.status === "Borrador";
    }, [isReadOnly, submission?.status]);

    const handleDataChange = useCallback((key: string, value: any, options?: { newColumns?: any, markAsDirty?: boolean }) => {
        setSubmission((prev) => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));

            if (key === 'variedad_rotulada_grupo' && template?.id === 'REG.CKU.013') {
                const currentVariety = _.get(next.data, key);
                if (currentVariety !== value) {
                    _.set(next.data, 'matriz_categorias_calibre', [{ _id: uuidv4(), _isFixed: true }]);
                }
            }

            if (key === 'recepcion.variedad_rotulada_grupo' && template?.id === 'REG.CKU.015') {
                const currentVariety = _.get(next.data, key);
                if (currentVariety !== value) {
                    _.set(next.data, 'tabla_color_cubrimiento', [{ _id: uuidv4(), _isFixed: true }]);
                }
            }

            _.set(next.data, key, value);

            // --- Lógica específica para REG.CKU.017 (Empaque) ---
            if (template?.id === 'REG.CKU.017') {
                // Autocompletado INDEPENDIENTE al editar 'Productor' DENTRO de la matriz 3A
                if (key === 'tabla_datos_linea') {
                    const oldTable = _.get(prev.data, 'tabla_datos_linea') || [];
                    const newTable = value as any[];

                    const oldProdRow = oldTable.find((r: any) => r.concepto === 'Productor');
                    const newProdRow = newTable.find((r: any) => r.concepto === 'Productor');

                    if (oldProdRow && newProdRow) {
                        const sourceCalibre = _.get(next.data, 'calibre') || '';
                        const sourceCategoria = _.get(next.data, 'categoria') || '';

                        for (let i = 1; i <= 30; i++) {
                            const lineKey = `l${i}`;
                            if (newProdRow[lineKey] !== oldProdRow[lineKey]) {
                                const calRow = newTable.find((r: any) => r.concepto === 'Calibre');
                                const catRow = newTable.find((r: any) => r.concepto === 'Categoría');
                                if (newProdRow[lineKey] && newProdRow[lineKey].trim() !== '') {
                                    if (calRow) calRow[lineKey] = sourceCalibre;
                                    if (catRow) catRow[lineKey] = sourceCategoria;
                                } else {
                                    if (calRow) calRow[lineKey] = '';
                                    if (catRow) catRow[lineKey] = '';
                                }
                            }
                        }
                    }
                }

                // --- LÓGICA: Conversión Unidades -> Porcentaje en 3B y 3C ---
                if (key === 'tabla_danos_defectos' || key === 'tabla_fuera_categoria') {
                    const oldTable = _.get(prev.data, key) || [];
                    const newTable = value as any[];
                    const calibreMuestra = Number(_.get(next.data, 'calibre')) || 1;

                    newTable.forEach((row, rIdx) => {
                        const oldRow = oldTable[rIdx];

                        // Evitamos procesar filas especiales que no son de ingreso numérico directo a %
                        const isSummary = row.concepto === 'Comercial' || row.concepto === '% Comercial' || row.concepto === 'Resolución';
                        if (isSummary) {
                            if (row.promedio_fila !== '') row.promedio_fila = '';
                            return;
                        }

                        let rowSumUnits = 0; let rowCount = 0;

                        for (let i = 1; i <= 30; i++) {
                            const lk = `l${i}`;
                            const currentVal = row[lk];

                            if (currentVal !== '' && currentVal !== null && currentVal !== undefined) {
                                rowCount++;
                                let units = 0;

                                // Si la celda cambió, asumimos que el usuario ingresó UNIDADES originales
                                if (!oldRow || currentVal !== oldRow[lk]) {
                                    units = parseFloat(currentVal);
                                    if (!isNaN(units)) {
                                        rowSumUnits += units;
                                        // Convertimos visualmente a porcentaje
                                        const percent = (units / calibreMuestra) * 100;
                                        row[lk] = parseFloat(percent.toFixed(1));
                                    }
                                } else {
                                    // La celda no cambió, es un porcentaje. Revertimos a unidades para el promedio
                                    const percent = parseFloat(currentVal);
                                    if (!isNaN(percent)) {
                                        units = Math.round((percent * calibreMuestra) / 100);
                                        rowSumUnits += units;
                                    }
                                }
                            }
                        }

                        // Cálculo del promedio basado en unidades (frutos)
                        row.promedio_fila = rowCount > 0 ? parseFloat((rowSumUnits / rowCount).toFixed(2)) : '';
                    });
                }
            }

            // --- Lógica específica para REG.CKU.018 (Presizer) - Conversión 4B y 4C ---
            if (template?.id === 'REG.CKU.018') {
                const table4A = _.get(next.data, 'tabla_datos_canal') || [];
                const fruitsRow4A = table4A.find((r: any) => r.concepto === 'Nº Frutos');

                // REUTILIZACIÓN DE LÓGICA DE 4B EN 4C
                if (key === 'tabla_fuera_categoria_canal' || key === 'tabla_danos_defectos_canal') {
                    const oldTable = _.get(prev.data, key) || [];
                    const newTable = value as any[];

                    if (fruitsRow4A) {
                        newTable.forEach((row, rIdx) => {
                            // Evitar procesar filas de resumen o metadatos
                            if (['Comercial', '% Comercial', 'Calibre', '% Calibre', 'Resolución'].includes(row.concepto)) return;

                            const oldRow = oldTable[rIdx];
                            for (let i = 1; i <= 50; i++) {
                                const chKey = `ch${i}`;
                                const currentVal = row[chKey];
                                const oldVal = oldRow ? oldRow[chKey] : undefined;

                                // EXACTAMENTE la misma rutina de 4B: si cambió, tratar como unidades y convertir a %
                                if (currentVal !== oldVal && currentVal !== '' && currentVal !== null && currentVal !== undefined) {
                                    const totalFrutos = parseFloat(fruitsRow4A[chKey]);
                                    if (!isNaN(totalFrutos) && totalFrutos > 0) {
                                        const units = parseFloat(currentVal);
                                        if (!isNaN(units)) {
                                            row[chKey] = parseFloat(((units / totalFrutos) * 100).toFixed(2));
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }

            if (options?.newColumns) {
                if (!next.dynamicSchemas) next.dynamicSchemas = {};
                next.dynamicSchemas[key] = options.newColumns;
            }
            return next;
        });

        if (options?.markAsDirty !== false) {
            setIsDirty(true);
            if (errors[key]) {
                setErrors(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        }
    }, [errors, template?.id]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const templateId = params.get("templateId");
        let loadedSubmission: FormSubmission | null = null;

        if (id) {
            const found = findSubmission(id);
            if (found) {
                const cloned = JSON.parse(JSON.stringify(found)) as FormSubmission;
                const tpl = findTemplate(cloned.templateId);

                if (tpl) {
                    tpl.sections.forEach(section => {
                        section.fields.forEach(field => {
                            if (field.type === 'dynamic_table' && _.get(cloned.data, field.key)) {
                                const tableData = _.get(cloned.data, field.key);
                                if (Array.isArray(tableData)) {
                                    const hydratedData = tableData.map((row: any) =>
                                        row._id ? row : { ...row, _id: uuidv4() }
                                    );
                                    _.set(cloned.data, field.key, hydratedData);
                                }
                            }
                        });
                    });
                }

                if (!cloned.status) cloned.status = "Borrador";
                loadedSubmission = cloned;
                setTemplate(tpl || null);
            } else {
                navigate("/");
                return;
            }
        } else if (templateId) {
            const tpl = findTemplate(templateId);
            if (tpl) {
                const s = initializeSubmission(tpl.id);
                const initialData: Record<string, any> = {};
                const plantaActual = getFormattedPlanta();

                if (tpl.id === 'REG.CKU.013') {
                    _.set(initialData, 'planta', plantaActual);
                    _.set(initialData, 'tipo_fruta', 'MANZANA');
                    _.set(initialData, 'temporada', temporada);
                } else if (tpl.id === 'REG.CKU.014') {
                    _.set(initialData, 'encabezado.planta', plantaActual);
                    _.set(initialData, 'encabezado.temporada', temporada);
                    _.set(initialData, 'encabezado.tipo_fruta', 'MANZANA');
                    _.set(initialData, 'madurez.calibre', 'GRANDE');
                    _.set(initialData, 'madurez_mediano.calibre', 'MEDIANO');
                    _.set(initialData, 'madurez_chico.calibre', 'CHICO');
                } else if (tpl.id === 'REG.CKU.015') {
                    _.set(initialData, 'encabezado.planta', plantaActual);
                    _.set(initialData, 'encabezado.temporada', temporada);
                    _.set(initialData, 'encabezado.tipo_fruta', 'MANZANA');
                    _.set(initialData, 'recepcion.tamano_muestra', 50);
                } else if (tpl.id === 'REG.CKU.017') {
                    _.set(initialData, 'encabezado.planta', plantaActual);
                    _.set(initialData, 'temporada', temporada);
                    _.set(initialData, 'encabezado.tipo_fruta', 'MANZANA');
                } else if (tpl.id === 'REG.CKU.018') {
                    _.set(initialData, 'planta', plantaActual);
                    _.set(initialData, 'temporada', temporada);
                    _.set(initialData, 'tipo_fruta', 'MANZANA');
                } else if (tpl.id === 'REG.CKU.027') {
                    _.set(initialData, 'planta', plantaActual);
                    _.set(initialData, 'encabezado.temporada', temporada);
                    _.set(initialData, 'tipo_fruta', 'MANZANA');
                } else if (tpl.id === 'REG.CKU.022') {
                    _.set(initialData, 'encabezado.planta', plantaActual);
                    _.set(initialData, 'encabezado.temporada', temporada);
                    _.set(initialData, 'encabezado.tipo_fruta', 'MANZANA');
                }

                tpl.sections.forEach(section => {
                    section.fields.forEach(field => {
                        if (field.type === 'dynamic_table' && field.initialRows && field.initialRows.length > 0) {
                            const hydratedRows = JSON.parse(JSON.stringify(field.initialRows)).map((row: any) => ({ ...row, _id: uuidv4() }));
                            _.set(initialData, field.key, hydratedRows);
                        } else if (field.type === 'pressure_matrix' && field.initialRows && field.initialRows.length > 0) {
                            const hydratedRows = JSON.parse(JSON.stringify(field.initialRows)).map((row: any) => ({ ...row, _id: uuidv4(), detalles: [] }));
                            _.set(initialData, field.key, hydratedRows);
                        }
                    });
                });

                s.data = initialData;
                s.planta = plantaActual;
                s.status = "Borrador";
                loadedSubmission = s;
                setTemplate(tpl);
                fromNewRef.current = true;
            } else {
                navigate("/");
                return;
            }
        }

        if (loadedSubmission) {
            setSubmission(loadedSubmission);
            setIsDirty(!id);
        }

        return () => {
            blockNavigation(false);
        };
    }, [id, location.search, findSubmission, findTemplate, initializeSubmission, getFormattedPlanta, temporada, navigate, blockNavigation]);

    useEffect(() => {
        if (!submission || !template || !isEditable) return;
        const plantaActual = getFormattedPlanta();

        // Determinación de la key de planta según la plantilla
        let plantaKey = 'planta'; // Default para 013, 018, 027
        if (template.id === 'REG.CKU.014' || template.id === 'REG.CKU.015' || template.id === 'REG.CKU.022') {
            plantaKey = 'encabezado.planta';
        } else if (template.id === 'REG.CKU.017') {
            plantaKey = 'encabezado.planta';
        }

        // Determinación de la key de temporada según la plantilla
        let temporadaKey = 'temporada'; // Default para 013, 017, 018
        if (template.id === 'REG.CKU.014' || template.id === 'REG.CKU.015' || template.id === 'REG.CKU.027' || template.id === 'REG.CKU.022') {
            temporadaKey = 'encabezado.temporada';
        }

        const currentPlanta = _.get(submission.data, plantaKey);
        const currentTemporada = _.get(submission.data, temporadaKey);

        if (currentPlanta !== plantaActual || currentTemporada !== temporada) {
            setSubmission(prev => {
                if (!prev) return prev;
                const next = JSON.parse(JSON.stringify(prev));
                _.set(next.data, plantaKey, plantaActual);
                _.set(next.data, temporadaKey, temporada);
                return next;
            });
        }
    }, [planta, temporada, template?.id, isEditable, getFormattedPlanta]);

    useEffect(() => {
        if (!template || !submission) return;

        let variety: string | undefined;
        let targetTableKey: string | undefined;

        if (template.id === 'REG.CKU.013') {
            variety = submission.data.variedad_rotulada_grupo;
            targetTableKey = 'matriz_categorias_calibre';
        } else if (template.id === 'REG.CKU.015') {
            variety = _.get(submission.data, 'recepcion.variedad_rotulada_grupo');
            targetTableKey = 'tabla_color_cubrimiento';
        }

        if (variety && targetTableKey) {
            let labels: string[] | null = null;
            if (variety === 'ROJAS') labels = ["+95", "+85", "+76", "-76"];
            else if (variety === 'GALA') labels = ["+50", "+50", "+30", "-30"];
            else if (variety === 'CRIPPS PINK') labels = ["+40", "+30", "-30"];
            else if (variety === 'AMBROSIA') labels = ["+40", "+10", "-10"];
            else if (variety === 'FUJI') labels = ["+60", "+40", "-4"];
            else if (variety === 'KANZI') labels = ["+30", "-30"];

            if (labels) {
                const newCols: DynamicTableColumn[] = labels.map((label, i) => ({
                    key: `cat_${i}`,
                    label,
                    type: 'integer',
                    required: false
                }));

                const currentSchema = submission.dynamicSchemas?.[targetTableKey];
                const currentLabels = currentSchema ? currentSchema.map(c => c.label) : [];

                if (JSON.stringify(currentLabels) !== JSON.stringify(labels)) {
                    setSubmission(prev => {
                        if (!prev) return prev;
                        const next = { ...prev };
                        if (!next.dynamicSchemas) next.dynamicSchemas = {};
                        next.dynamicSchemas[targetTableKey!] = newCols;
                        return next;
                    });
                }
            } else {
                if (submission.dynamicSchemas?.[targetTableKey]) {
                    setSubmission(prev => {
                        if (!prev) return prev;
                        const next = { ...prev };
                        if (next.dynamicSchemas) {
                            const updatedSchemas = { ...next.dynamicSchemas };
                            delete updatedSchemas[targetTableKey!];
                            next.dynamicSchemas = updatedSchemas;
                        }
                        return next;
                    });
                }
            }
        }
    }, [
        submission?.data?.variedad_rotulada_grupo,
        _.get(submission?.data, 'recepcion.variedad_rotulada_grupo'),
        template?.id
    ]);

    useEffect(() => {
        if (isEditable) {
            blockNavigation(isDirty);
        } else {
            blockNavigation(false);
        }
    }, [isDirty, isEditable, blockNavigation]);

    useEffect(() => {
        if (!submission?.data) return;

        // --- LÓGICA ESPECÍFICA PARA Control de Peso (REG.CKU.017) ---
        if (template?.id === 'REG.CKU.017' && isEditable) {
            const calibrePaso1 = _.get(submission.data, 'calibre');
            const tableCP = submission.data.tabla_control_peso || [];
            const hasCalibre = calibrePaso1 !== undefined && calibrePaso1 !== null && calibrePaso1 !== '' && calibrePaso1 !== 0;

            // 1. Manejo de aparición de la primera fila y sincronización de calibre
            if (hasCalibre && tableCP.length === 0) {
                const firstRow = {
                    _id: uuidv4(),
                    calibre: calibrePaso1.toString(),
                    n_cajas: 0,
                    promedio: ''
                };
                handleDataChange('tabla_control_peso', [firstRow], { markAsDirty: false });
            } else if (Array.isArray(tableCP) && tableCP.length > 0) {
                let changed = false;
                const nextTableCP = JSON.parse(JSON.stringify(tableCP));

                let totalSumAllWeights = 0;
                let totalCajasAllRows = 0;

                nextTableCP.forEach((row: any) => {
                    // Sincronización y Bloqueo de Calibre (mismo valor bloqueado para todas las filas)
                    const expectedCalibre = hasCalibre ? calibrePaso1.toString() : '';
                    if (row.calibre !== expectedCalibre) {
                        row.calibre = expectedCalibre;
                        changed = true;
                    }

                    // Cálculo de # CAJAS y PROMEDIO por fila (filtrado estricto de números)
                    let rowCajasCount = 0;
                    let rowSumWeights = 0;
                    for (let i = 1; i <= 10; i++) {
                        const key = `c${i}`;
                        const rawVal = row[key];
                        // Un número válido incluye decimales. Ignoramos vacíos, espacios y texto.
                        if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
                            const num = parseFloat(rawVal);
                            if (!isNaN(num)) {
                                rowCajasCount++;
                                rowSumWeights += num;
                            }
                        }
                    }

                    if (row.n_cajas !== rowCajasCount) {
                        row.n_cajas = rowCajasCount;
                        changed = true;
                    }

                    const rowAvg = rowCajasCount > 0 ? parseFloat((rowSumWeights / rowCajasCount).toFixed(2)) : '';
                    if (row.promedio !== rowAvg) {
                        row.promedio = rowAvg;
                        changed = true;
                    }

                    totalSumAllWeights += rowSumWeights;
                    totalCajasAllRows += rowCajasCount;
                });

                if (changed) {
                    handleDataChange('tabla_control_peso', nextTableCP, { markAsDirty: false });
                }

                // Promedio de Pesos General
                const globalAvg = totalCajasAllRows > 0 ? parseFloat((totalSumAllWeights / totalCajasAllRows).toFixed(2)) : '';
                if (submission.data.promedio_pesos_general !== globalAvg) {
                    handleDataChange('promedio_pesos_general', globalAvg, { markAsDirty: false });
                }
            }
        }

        if (template?.id === 'REG.CKU.014') {
            const calibreConfigs = [
                { sourceKey: 'tabla_parciales', summaryKey: 'matriz_resumen_presiones_grande', column: 'grande' },
                { sourceKey: 'tabla_parciales_mediano', summaryKey: 'matriz_resumen_presiones_mediano', column: 'mediano' },
                { sourceKey: 'tabla_parciales_chico', summaryKey: 'matriz_resumen_presiones_chico', column: 'chico' },
            ];
            calibreConfigs.forEach(conf => {
                const sourceRows = submission.data[conf.sourceKey] || [];
                const summaryRows = submission.data[conf.summaryKey] || [];
                if (summaryRows.length === 3) {
                    const values: number[] = [];
                    sourceRows.forEach((r: any) => {
                        const p1 = parseFloat(r.presion_1);
                        const p2 = parseFloat(r.presion_2);
                        if (!isNaN(p1)) values.push(p1);
                        if (!isNaN(p2)) values.push(p2);
                    });
                    const nextSummary: any = JSON.parse(JSON.stringify(summaryRows));
                    if (values.length > 0) {
                        nextSummary[0][conf.column] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
                        nextSummary[1][conf.column] = Math.max(...values);
                        nextSummary[2][conf.column] = Math.min(...values);
                    } else {
                        nextSummary[0][conf.column] = '';
                        nextSummary[1][conf.column] = '';
                        nextSummary[2][conf.column] = '';
                    }
                    if (!_.isEqual(summaryRows, nextSummary)) handleDataChange(conf.summaryKey, nextSummary, { markAsDirty: false });
                }
            });
            const summaryGrande = submission.data['matriz_resumen_presiones_grande'] || [];
            const summaryMediano = submission.data['matriz_resumen_presiones_mediano'] || [];
            const summaryChico = submission.data['matriz_resumen_presiones_chico'] || [];
            const summaryGeneral = submission.data['matriz_resumen_presion_general'] || [];
            if (summaryGeneral.length === 3) {
                const nextGeneral: any = JSON.parse(JSON.stringify(summaryGeneral));
                const xValues = [parseFloat(summaryGrande[0]?.grande), parseFloat(summaryMediano[0]?.mediano), parseFloat(summaryChico[0]?.chico)].filter(v => !isNaN(v));
                nextGeneral[0].general = xValues.length > 0 ? parseFloat((xValues.reduce((a, b) => a + b, 0) / xValues.length).toFixed(2)) : '';
                const maxValues = [parseFloat(summaryGrande[1]?.grande), parseFloat(summaryMediano[1]?.mediano), parseFloat(summaryChico[1]?.chico)].filter(v => !isNaN(v));
                nextGeneral[1].general = maxValues.length > 0 ? Math.max(...maxValues) : '';
                const minValues = [parseFloat(summaryGrande[2]?.grande), parseFloat(summaryMediano[2]?.mediano), parseFloat(summaryChico[2]?.chico)].filter(v => !isNaN(v));
                nextGeneral[2].general = minValues.length > 0 ? Math.min(...minValues) : '';
                if (!_.isEqual(summaryGeneral, nextGeneral)) handleDataChange('matriz_resumen_presion_general', nextGeneral, { markAsDirty: false });
            }
            const parcialesRows = submission.data['parciales'] || [];
            const almidonSummary = submission.data['matriz_resumen_almidon'] || [];
            if (almidonSummary.length === 3) {
                const nextAlmidonSummary: any = JSON.parse(JSON.stringify(almidonSummary));
                const calibreCols = [{ source: 'almidon_grande', target: 'grande' }, { source: 'almidon_mediano', target: 'mediano' }, { source: 'almidon_chico', target: 'chico' }];
                calibreCols.forEach(cc => {
                    const values = parcialesRows.map((r: any) => parseFloat(r[cc.source])).filter((v: number) => !isNaN(v));
                    if (values.length > 0) {
                        nextAlmidonSummary[0][cc.target] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
                        nextAlmidonSummary[1][cc.target] = Math.max(...values);
                        nextAlmidonSummary[2][cc.target] = Math.min(...values);
                    } else {
                        nextAlmidonSummary[0][cc.target] = '';
                        nextAlmidonSummary[1][cc.target] = '';
                        nextAlmidonSummary[2][cc.target] = '';
                    }
                });
                if (!_.isEqual(almidonSummary, nextAlmidonSummary)) handleDataChange('matriz_resumen_almidon', nextAlmidonSummary, { markAsDirty: false });
            }
            const starchSummaryByCalibre = submission.data['matriz_resumen_almidon'] || [];
            const starchGlobalSummary = submission.data['matriz_resumen_almidon_global'] || [];
            if (starchGlobalSummary.length === 3 && starchSummaryByCalibre.length === 3) {
                const nextStarchGlobal: any = JSON.parse(JSON.stringify(starchGlobalSummary));
                const xVals = [parseFloat(starchSummaryByCalibre[0]?.grande), parseFloat(starchSummaryByCalibre[0]?.mediano), parseFloat(starchSummaryByCalibre[0]?.chico)].filter(v => !isNaN(v));
                nextStarchGlobal[0].global = xVals.length > 0 ? parseFloat((xVals.reduce((a, b) => a + b, 0) / xVals.length).toFixed(2)) : '';
                const maxVals = [parseFloat(starchSummaryByCalibre[1]?.grande), parseFloat(starchSummaryByCalibre[1]?.mediano), parseFloat(starchSummaryByCalibre[1]?.chico)].filter(v => !isNaN(v));
                nextStarchGlobal[1].global = maxVals.length > 0 ? Math.max(...maxVals) : '';
                const minVals = [parseFloat(starchSummaryByCalibre[2]?.grande), parseFloat(starchSummaryByCalibre[2]?.mediano), parseFloat(starchSummaryByCalibre[2]?.chico)].filter(v => !isNaN(v));
                nextStarchGlobal[2].global = minVals.length > 0 ? Math.min(...minVals) : '';
                if (!_.isEqual(starchGlobalSummary, nextStarchGlobal)) handleDataChange('matriz_resumen_almidon_global', nextStarchGlobal, { markAsDirty: false });
            }
            const heartWaterRows = submission.data['matriz_corazon_acuoso'] || [];
            const sampleSizeValue = _.get(submission.data, 'identificacion.tamano_muestra');
            const sampleSize = Number(sampleSizeValue);
            if (heartWaterRows.length === 4) {
                const nextHeartWater: any = JSON.parse(JSON.stringify(heartWaterRows));
                const cols = ['g1', 'g2', 'g3', 'g4'];
                let changed = false;
                cols.forEach(c => {
                    const totalCol = (Number(nextHeartWater[0][c]) || 0) + (Number(nextHeartWater[1][c]) || 0) + (Number(nextHeartWater[2][c]) || 0);
                    let avg: any = (!isNaN(sampleSize) && sampleSize > 0) ? parseFloat(((totalCol / sampleSize) * 100).toFixed(1)) : '';
                    if (nextHeartWater[3][c] !== avg) { nextHeartWater[3][c] = avg; changed = true; }
                });
                if (changed) handleDataChange('matriz_corazon_acuoso', nextHeartWater, { markAsDirty: false });
            }
            const promediosRows = submission.data['matriz_promedios_cor_acuoso'] || [];
            if (heartWaterRows.length >= 3 && promediosRows.length === 3) {
                const nextPromedios: any = JSON.parse(JSON.stringify(promediosRows));
                const cols = ['g1', 'g2', 'g3', 'g4'];
                let changed = false;
                for (let i = 0; i < 3; i++) {
                    let rowSum = 0;
                    cols.forEach(c => { rowSum += Number(heartWaterRows[i][c]) || 0; });
                    let avg: any = (!isNaN(sampleSize) && sampleSize > 0) ? parseFloat(((rowSum / sampleSize) * 100).toFixed(1)) : '';
                    if (nextPromedios[i].promedio !== avg) { nextPromedios[i].promedio = avg; changed = true; }
                }
                if (changed) handleDataChange('matriz_promedios_cor_acuoso', nextPromedios, { markAsDirty: false });
            }
        }

        if (template?.id === 'REG.CKU.017' && isEditable) {
            const calibrePaso1 = submission.data.calibre;
            const matrix = (submission.data.presiones_por_calibre || []) as PressureEntry[];
            const calibreStr = (calibrePaso1 !== undefined && calibrePaso1 !== null && calibrePaso1 !== '') ? calibrePaso1.toString() : '';

            if (calibreStr !== '') {
                if (matrix.length === 0) {
                    const newRow: PressureEntry = { _id: uuidv4(), calibre: calibreStr, n_frutos: 0, detalles: [] };
                    handleDataChange('presiones_por_calibre', [newRow], { markAsDirty: false });
                } else if (matrix[0].calibre !== calibreStr) {
                    const nextMatrix = [...matrix];
                    nextMatrix[0] = { ...nextMatrix[0], calibre: calibreStr };
                    handleDataChange('presiones_por_calibre', nextMatrix, { markAsDirty: false });
                }
            } else {
                if (matrix.length === 1 && (matrix[0].calibre || '') !== '' && (matrix[0].n_frutos === 0 || !matrix[0].n_frutos)) {
                    handleDataChange('presiones_por_calibre', [], { markAsDirty: false });
                } else if (matrix.length > 0 && (matrix[0].calibre || '') !== '') {
                    const nextMatrix = [...matrix];
                    nextMatrix[0] = { ...nextMatrix[0], calibre: '' };
                    handleDataChange('presiones_por_calibre', nextMatrix, { markAsDirty: false });
                }
            }

            // --- Cálculo de "Comercial" y "% Comercial" en 3B ---
            const table3B = submission.data.tabla_danos_defectos;
            const calibreMuestra = Number(submission.data.calibre) || 1;
            if (Array.isArray(table3B)) {
                const comRow = table3B.find(r => r.concepto === 'Comercial');
                const pComRow = table3B.find(r => r.concepto === '% Comercial');

                if (comRow && pComRow) {
                    let changed = false;
                    const nextTable3B = JSON.parse(JSON.stringify(table3B));
                    const nextComRow = nextTable3B.find((r: any) => r.concepto === 'Comercial');
                    const nextPComRow = nextTable3B.find((r: any) => r.concepto === '% Comercial');

                    for (let i = 1; i <= 30; i++) {
                        const lk = `l${i}`;
                        let totalUnits = 0;
                        let hasAnyValue = false;

                        nextTable3B.forEach((r: any) => {
                            if (r.concepto === 'Comercial' || r.concepto === '% Comercial') return;

                            const raw = r[lk];

                            // si el usuario NO ha escrito nada en ninguna fila de esa columna -> NO rellenar con 0
                            if (raw !== '' && raw !== null && raw !== undefined) {
                                hasAnyValue = true;

                                const pVal = parseFloat(raw);
                                if (!isNaN(pVal)) {
                                    totalUnits += Math.round((pVal * calibreMuestra) / 100);
                                }
                            }
                        });

                        const comercialOut: any = hasAnyValue ? totalUnits : '';
                        if (nextComRow[lk] !== comercialOut) {
                            nextComRow[lk] = comercialOut;
                            changed = true;
                        }

                        const pctOut: any =
                            hasAnyValue && calibreMuestra > 0
                                ? parseFloat(((totalUnits / calibreMuestra) * 100).toFixed(1))
                                : '';

                        if (nextPComRow[lk] !== pctOut) {
                            nextPComRow[lk] = pctOut;
                            changed = true;
                        }
                    }


                    if (changed) {
                        handleDataChange('tabla_danos_defectos', nextTable3B, { markAsDirty: false });
                    }
                }
            }

            // --- NEW: Lógica Sincronizada para Paso 4 Mercado Interno (REPLICA PRESIZER PASO 5) ---
            const tableMI = submission.data.tabla_mercado_interno;
            if (Array.isArray(tableMI)) {
                const nextTableMI = JSON.parse(JSON.stringify(tableMI));
                let changedMI = false;

                const fruitsRow = nextTableMI.find((r: any) => r.defecto === 'N° frutos');

                if (fruitsRow) {
                    // 1. Sumas Verticales (Fila N° frutos)
                    for (let i = 1; i <= 30; i++) {
                        const colKey = `f${i}`;
                        let colSum = 0;
                        let hasAnyValue = false;

                        nextTableMI.forEach((row: any) => {
                            if (row.defecto === 'N° frutos') return;

                            const raw = row[colKey];

                            // si el usuario escribió algo (incluye 0), la columna cuenta como usada
                            if (raw !== '' && raw !== null && raw !== undefined) {
                                const num = parseFloat(raw);
                                if (!isNaN(num)) {
                                    colSum += num;
                                    hasAnyValue = true;
                                }
                            }
                        });

                        const out: any = hasAnyValue ? colSum : '';
                        if (fruitsRow[colKey] !== out) {
                            fruitsRow[colKey] = out;
                            changedMI = true;
                        }
                    }


                    // 2. Cálculo de "Total N° de Frutos" (Suma de la fila N° frutos)
                    // 2. Cálculo de "Total N° de Frutos" (Suma de la fila N° frutos) -> NO dejar 0 si toda la fila está vacía
                    let totalFrutosGeneral = 0;
                    let hasAnyFruitTotal = false;

                    for (let i = 1; i <= 30; i++) {
                        const raw = fruitsRow[`f${i}`];
                        if (raw !== '' && raw !== null && raw !== undefined) {
                            const val = parseFloat(raw);
                            if (!isNaN(val)) {
                                totalFrutosGeneral += val;
                                hasAnyFruitTotal = true;
                            }
                        }
                    }

                    const totalOut: any = hasAnyFruitTotal ? totalFrutosGeneral : '';
                    if (submission.data.total_frutos_mercado_interno !== totalOut) {
                        handleDataChange('total_frutos_mercado_interno', totalOut, { markAsDirty: false });
                    }

                }

                // 3. Cálculos Horizontales (X PROMEDIO por fila)
                nextTableMI.forEach((row: any) => {
                    let rowSum = 0;
                    let rowCount = 0;
                    for (let i = 1; i <= 30; i++) {
                        const colKey = `f${i}`;
                        const val = parseFloat(row[colKey]);
                        if (!isNaN(val)) {
                            rowSum += val;
                            rowCount++;
                        }
                    }
                    const rowAvg = rowCount > 0 ? parseFloat((rowSum / rowCount).toFixed(2)) : '';
                    if (row.promedio_x !== rowAvg) {
                        row.promedio_x = rowAvg;
                        changedMI = true;
                    }
                });

                if (changedMI) {
                    handleDataChange('tabla_mercado_interno', nextTableMI, { markAsDirty: false });
                }
            }
        }

        if (template?.id === 'REG.CKU.017') {
            const matrix = submission.data.presiones_por_calibre as PressureEntry[];
            if (matrix) {
                let sumPressures = 0;
                let sumNFrutos = 0;
                let allPressures: number[] = [];

                matrix.forEach(row => {
                    const n = parseInt(row.n_frutos?.toString() || '0');
                    if (!isNaN(n)) sumNFrutos += n;
                    if (row.detalles) {
                        row.detalles.forEach(det => {
                            if (det.p1 !== null && det.p1 !== undefined && typeof det.p1 === 'number' && !isNaN(det.p1)) {
                                sumPressures += det.p1;
                                allPressures.push(det.p1);
                            }
                            if (det.p2 !== null && det.p2 !== undefined && typeof det.p2 === 'number' && !isNaN(det.p2)) {
                                sumPressures += det.p2;
                                allPressures.push(det.p2);
                            }
                        });
                    }
                });

                if (sumNFrutos > 0 && allPressures.length > 0) {
                    const avg = parseFloat((sumPressures / (allPressures.length)).toFixed(2));
                    const max = Math.max(...allPressures);
                    const min = Math.min(...allPressures);
                    if (submission.data.presion_promedio !== avg) handleDataChange('presion_promedio', avg, { markAsDirty: false });
                    if (submission.data.presion_max !== max) handleDataChange('presion_max', max, { markAsDirty: false });
                    if (submission.data.presion_min !== min) handleDataChange('presion_min', min, { markAsDirty: false });
                } else {
                    if (submission.data.presion_promedio !== '') handleDataChange('presion_promedio', '', { markAsDirty: false });
                    if (submission.data.presion_max !== '') handleDataChange('presion_max', '', { markAsDirty: false });
                    if (submission.data.presion_min !== '') handleDataChange('presion_min', '', { markAsDirty: false });
                }
            }
        }

        if (template?.id === 'REG.CKU.013') {
            if (submission.data.matriz_frutos_externo && isEditable) {
                const calibresFromStep2 = _.uniq((submission.data.matriz_frutos_externo || [])
                    .map((r: any) => (r.calibre || '').trim())
                    .filter(Boolean));

                const currentPressureRows = (submission.data.matriz_presiones || []) as PressureEntry[];
                const syncedPressureRows = calibresFromStep2.map(cal => {
                    const existing = currentPressureRows.find(r => (r.calibre || '').trim() === cal);
                    return existing || { _id: uuidv4(), calibre: cal, n_frutos: 0, brix: 0, detalles: [] };
                });
                const manualEmptyPressureRows = currentPressureRows.filter(r => !(r.calibre || '').trim());
                const finalPressureRows = [...syncedPressureRows, ...manualEmptyPressureRows];

                if (!_.isEqual(currentPressureRows, finalPressureRows)) {
                    handleDataChange('matriz_presiones', finalPressureRows, { markAsDirty: false });
                }

                const currentSemillaRows = submission.data.matriz_color_semilla || [];
                const syncedSemillaRows = calibresFromStep2.map(cal => {
                    const existing = currentSemillaRows.find((r: any) => (r.calibre || '').trim() === cal);
                    if (existing) return existing;
                    return {
                        _id: uuidv4(),
                        calibre: cal,
                        sem_0: '', sem_1_8: '', sem_1_4: '', sem_1_2: '', sem_3_4: '', sem_1: ''
                    };
                });
                const manualEmptySemillaRows = currentSemillaRows.filter((r: any) => !(r.calibre || '').trim());
                const finalSemillaRows = [...syncedSemillaRows, ...manualEmptySemillaRows];
                if (!_.isEqual(currentSemillaRows, finalSemillaRows)) {
                    handleDataChange('matriz_color_semilla', finalSemillaRows, { markAsDirty: false });
                }
            }

            if (submission.data.matriz_presiones) {
                const entries = submission.data.matriz_presiones as PressureEntry[];
                const allPressures: number[] = [];
                const brixValues: number[] = [];

                entries.forEach(entry => {
                    if (entry.detalles) {
                        entry.detalles.forEach(det => {
                            if (det.p1 !== null && det.p1 !== undefined && typeof det.p1 === 'number' && !isNaN(det.p1)) allPressures.push(det.p1);
                            if (det.p2 !== null && det.p2 !== undefined && typeof det.p2 === 'number' && !isNaN(det.p2)) allPressures.push(det.p2);
                        });
                    }
                    if (entry.brix !== null && entry.brix !== undefined && typeof entry.brix === 'number' && !isNaN(entry.brix)) {
                        brixValues.push(entry.brix);
                    }
                });

                if (allPressures.length > 0) {
                    const avg = parseFloat((allPressures.reduce((a, b) => a + b, 0) / allPressures.length).toFixed(2));
                    const max = Math.max(...allPressures);
                    const min = Math.min(...allPressures);
                    if (submission.data.presion_promedio !== avg) handleDataChange('presion_promedio', avg, { markAsDirty: false });
                    if (submission.data.presion_max !== max) handleDataChange('presion_max', max, { markAsDirty: false });
                    if (submission.data.presion_min !== min) handleDataChange('presion_min', min, { markAsDirty: false });
                } else {
                    if (submission.data.presion_promedio !== '') handleDataChange('presion_promedio', '', { markAsDirty: false });
                    if (submission.data.presion_max !== '') handleDataChange('presion_max', '', { markAsDirty: false });
                    if (submission.data.presion_min !== '') handleDataChange('presion_min', '', { markAsDirty: false });
                }

                if (brixValues.length > 0) {
                    const brixAvg = parseFloat((brixValues.reduce((a, b) => a + b, 0) / brixValues.length).toFixed(1));
                    if (submission.data.sol_promedio !== brixAvg) handleDataChange('sol_promedio', brixAvg, { markAsDirty: false });
                } else {
                    if (submission.data.sol_promedio !== '') handleDataChange('sol_promedio', '', { markAsDirty: false });
                }

                const calibreInStep3 = _.uniq(entries.map(e => (e.calibre || '').trim()).filter(Boolean));
                const currentAlmidonRows = submission.data.matriz_almidon_sol || [];

                const syncedAlmidonRows = calibreInStep3.map(cal => {
                    const existing = currentAlmidonRows.find((r: any) => (r.calibre || '').trim() === cal);
                    if (existing) return existing;
                    return {
                        _id: uuidv4(),
                        calibre: cal,
                        f1: '', f2: '', f3: '', f4: '', f5: '', f6: '', f7: '', f8: '', f9: '', f10: ''
                    };
                });
                const manualEmptyAlmidonRows = currentAlmidonRows.filter((r: any) => !(r.calibre || '').trim());
                const finalAlmidonRows = [...syncedAlmidonRows, ...manualEmptyAlmidonRows];

                if (!_.isEqual(currentAlmidonRows, finalAlmidonRows) && isEditable) {
                    handleDataChange('matriz_almidon_sol', finalAlmidonRows, { markAsDirty: false });
                }
            }

            if (submission.data.matriz_color_semilla) {
                const semillaRows = submission.data.matriz_color_semilla;
                const sums = {
                    sem_0: 0, sem_1_8: 0, sem_1_4: 0, sem_1_2: 0, sem_3_4: 0, sem_1: 0
                };
                semillaRows.forEach((r: any) => {
                    sums.sem_0 += parseInt(r.sem_0) || 0;
                    sums.sem_1_8 += parseInt(r.sem_1_8) || 0;
                    sums.sem_1_4 += parseInt(r.sem_1_4) || 0;
                    sums.sem_1_2 += parseInt(r.sem_1_2) || 0;
                    sums.sem_3_4 += parseInt(r.sem_3_4) || 0;
                    sums.sem_1 += parseInt(r.sem_1) || 0;
                });
                const currentSumaRows = submission.data.suma_color_semilla || [];
                const updatedSumaRows = [{ ...sums, _id: currentSumaRows[0]?._id || uuidv4() }];
                if (!_.isEqual(currentSumaRows, updatedSumaRows)) {
                    handleDataChange('suma_color_semilla', updatedSumaRows, { markAsDirty: false });
                }
            }

            if (submission.data.matriz_frutos_externo) {
                const rows = submission.data.matriz_frutos_externo;
                const validDiameters = rows.map((r: any) => parseFloat(r.diametro)).filter((n: number) => !isNaN(n));
                const avgDiam = validDiameters.length ? parseFloat((validDiameters.reduce((a: number, b: number) => a + b, 0) / validDiameters.length).toFixed(2)) : '';
                const validWeights = rows.map((r: any) => parseFloat(r.peso)).filter((n: number) => !isNaN(n));
                const avgWeight = validWeights.length ? parseFloat((validWeights.reduce((a: number, b: number) => a + b, 0) / validWeights.length).toFixed(2)) : '';
                if (submission.data.promedio_diametro !== avgDiam) handleDataChange('promedio_diametro', avgDiam, { markAsDirty: false });
                if (submission.data.promedio_peso !== avgWeight) handleDataChange('promedio_peso', avgWeight, { markAsDirty: false });
            }

            if (submission.data.matriz_color_cubrimiento) {
                const rows = submission.data.matriz_color_cubrimiento;
                const validColors = rows.map((r: any) => parseFloat(r.color_cubrimiento)).filter((n: number) => !isNaN(n));
                const avgColor = validColors.length ? parseFloat((validColors.reduce((a: number, b: number) => a + b, 0) / validColors.length).toFixed(1)) : '';
                if (submission.data.promedio_color_cubrimiento !== avgColor) handleDataChange('promedio_color_cubrimiento', avgColor, { markAsDirty: false });
            }

            if (submission.data.gasto_ml !== undefined) {
                const gasto = parseFloat(submission.data.gasto_ml);
                const calc = !isNaN(gasto) ? parseFloat((gasto * 0.067).toFixed(3)) : '';
                if (submission.data.ac_malico_pct !== calc) handleDataChange('ac_malico_pct', calc, { markAsDirty: false });
            }

            if (submission.data.matriz_almidon_sol) {
                const starchRows = submission.data.matriz_almidon_sol;
                const allStarchValues: number[] = [];
                starchRows.forEach((r: any) => {
                    for (let i = 1; i <= 10; i++) {
                        const val = parseFloat(r[`f${i}`]);
                        if (!isNaN(val)) allStarchValues.push(val);
                    }
                });
                if (allStarchValues.length > 0) {
                    const avg = parseFloat((allStarchValues.reduce((a, b) => a + b, 0) / allStarchValues.length).toFixed(2));
                    const max = Math.max(...allStarchValues);
                    const min = Math.min(...allStarchValues);
                    if (submission.data.almidon_promedio !== avg) handleDataChange('almidon_promedio', avg, { markAsDirty: false });
                    if (submission.data.almidon_max !== max) handleDataChange('almidon_max', max, { markAsDirty: false });
                    if (submission.data.almidon_min !== min) handleDataChange('almidon_min', min, { markAsDirty: false });
                } else {
                    if (submission.data.almidon_promedio !== '') handleDataChange('almidon_promedio', '', { markAsDirty: false });
                    if (submission.data.almidon_max !== '') handleDataChange('almidon_max', '', { markAsDirty: false });
                    if (submission.data.almidon_min !== '') handleDataChange('almidon_min', '', { markAsDirty: false });
                }
            }
        }

        if (template?.id === 'REG.CKU.015') {
            const sampleSize = Number(_.get(submission.data, 'recepcion.tamano_muestra'));
            const tableKeys = ['danos_defectos', 'plagas_enfermedades'];
            tableKeys.forEach(tableKey => {
                const rows = submission.data[tableKey] || [];
                if (rows.length > 0) {
                    const nextRows: any = JSON.parse(JSON.stringify(rows));
                    let changed = false;
                    nextRows.forEach((row: any) => {
                        let l_pct: any = '', g_pct: any = '';
                        if (!isNaN(sampleSize) && sampleSize > 0) {
                            const l_val = row.leve_unidades !== '' ? Number(row.leve_unidades) : 0;
                            const g_val = row.grave_unidades !== '' ? Number(row.grave_unidades) : 0;

                            if (row.leve_unidades !== '') {
                                l_pct = parseFloat(((l_val / sampleSize) * 100).toFixed(1));
                            }
                            if (row.grave_unidades !== '') {
                                g_pct = parseFloat(((g_val / sampleSize) * 100).toFixed(1));
                            }
                        }
                        if (row.leve_pct !== l_pct) { row.leve_pct = l_pct; changed = true; }
                        if (row.grave_pct !== g_pct) { row.grave_pct = g_pct; changed = true; }
                    });
                    if (changed) handleDataChange(tableKey, nextRows, { markAsDirty: false });
                }
            });
            const projectionRows = submission.data['tabla_proyeccion_embalaje'] || [];
            if (projectionRows.length > 0) {
                const nextRows: any = JSON.parse(JSON.stringify(projectionRows));
                let changedProj = false;
                nextRows.forEach((row: any) => {
                    let pct: any = (!isNaN(sampleSize) && sampleSize > 0 && row.n_frutos !== '') ? parseFloat(((Number(row.n_frutos) / sampleSize) * 100).toFixed(1)) : (row.n_frutos === '0' ? 0 : '');
                    if (row.porcentaje !== pct) { row.porcentaje = pct; changedProj = true; }
                });
                if (changedProj) handleDataChange('tabla_proyeccion_embalaje', nextRows, { markAsDirty: false });
            }
            const resumenExportable = submission.data['resumen_fruta_exportable'] || [];
            if (resumenExportable.length > 0) {
                const comercialRow = (submission.data['tabla_proyeccion_embalaje'] || []).find((r: any) => r.categoria === 'Comercial');
                const comercialFrutosRaw = comercialRow?.n_frutos;
                const comercialFrutos = (comercialFrutosRaw === '' || comercialFrutosRaw === undefined) ? NaN : Number(comercialFrutosRaw);
                let qty: any = '', pct: any = '';
                if (!isNaN(sampleSize) && sampleSize > 0 && !isNaN(comercialFrutos)) {
                    qty = Math.max(0, sampleSize - comercialFrutos);
                    pct = parseFloat(((qty / sampleSize) * 100).toFixed(1));
                }
                if (resumenExportable[0].cantidad_exportable !== qty || resumenExportable[0].porcentaje_exportable !== pct) {
                    const nextResumen = JSON.parse(JSON.stringify(resumenExportable));
                    nextResumen[0].cantidad_exportable = qty; nextResumen[0].porcentaje_exportable = pct;
                    handleDataChange('resumen_fruta_exportable', nextResumen, { markAsDirty: false });
                }
            }
        }

        // --- LÓGICA ESPECÍFICA PARA ATMÓSFERA CONTROLADA (REG.CKU.022) ---
        if (template?.id === 'REG.CKU.022') {
            const matrix = submission.data.matriz_presiones as PressureEntry[];
            if (Array.isArray(matrix)) {
                let matrixChanged = false;
                const nextMatrix = matrix.map(row => {
                    const validPressures: number[] = [];
                    if (row.detalles) {
                        row.detalles.forEach(det => {
                            if (typeof det.p1 === 'number' && !isNaN(det.p1)) validPressures.push(det.p1);
                            if (typeof det.p2 === 'number' && !isNaN(det.p2)) validPressures.push(det.p2);
                        });
                    }
                    const avg = validPressures.length > 0
                        ? parseFloat((validPressures.reduce((a, b) => a + b, 0) / validPressures.length).toFixed(2))
                        : '';
                    if (row.x !== avg) {
                        matrixChanged = true;
                        return { ...row, x: avg };
                    }
                    return row;
                });
                if (matrixChanged) {
                    handleDataChange('matriz_presiones', nextMatrix, { markAsDirty: false });
                }
            }
        }

        // --- LÓGICA ESPECÍFICA PARA C.K.U Presizer (REG.CKU.018) ---
        if (template?.id === 'REG.CKU.018') {
            // 1. Lógica de Tarjas de Entrada
            if (isEditable) {
                const cantTEStr = _.get(submission.data, 'cant_te');
                const cantTE = (cantTEStr === '' || cantTEStr === undefined) ? 0 : parseInt(cantTEStr);
                const currentTable = _.get(submission.data, 'te') || [];

                if (!isNaN(cantTE) && currentTable.length !== cantTE) {
                    let nextTable = Array.isArray(currentTable) ? [...currentTable] : [];
                    if (nextTable.length < cantTE) {
                        for (let i = nextTable.length; i < cantTE; i++) {
                            nextTable.push({
                                _id: uuidv4(),
                                n_tarja: (i + 1).toString(),
                                tarja_entrada: '',
                                _isFixed: true
                            });
                        }
                    } else {
                        nextTable = nextTable.slice(0, cantTE);
                    }
                    handleDataChange('te', nextTable, { markAsDirty: false });
                }
            }

            // 2. Lógica de Cálculo de Presiones por Fila (Paso 2)
            const pressureMatrix = submission.data.matriz_presiones as PressureEntry[];
            if (Array.isArray(pressureMatrix)) {
                let matrixChanged = false;
                const nextMatrix = pressureMatrix.map(row => {
                    const validPressures: number[] = [];
                    // Para presiones (Paso 2), se consideran ambos lados (p1 y p2)
                    if (row.detalles) {
                        row.detalles.forEach(det => {
                            if (det.p1 !== null && det.p1 !== undefined && !isNaN(det.p1)) validPressures.push(det.p1);
                            if (det.p2 !== null && det.p2 !== undefined && !isNaN(det.p2)) validPressures.push(det.p2);
                        });
                    }

                    const max = validPressures.length > 0 ? Math.max(...validPressures) : '';
                    const min = validPressures.length > 0 ? Math.min(...validPressures) : '';
                    const avg = validPressures.length > 0
                        ? parseFloat((validPressures.reduce((a, b) => a + b, 0) / validPressures.length).toFixed(2))
                        : '';

                    if (row.max !== max || row.min !== min || row.x !== avg) {
                        matrixChanged = true;
                        return { ...row, max, min, x: avg };
                    }
                    return row;
                });

                if (matrixChanged) {
                    handleDataChange('matriz_presiones', nextMatrix, { markAsDirty: false });
                }
            }

            // 3. Lógica de Cálculo de Control de Peso por Fila (Paso 3)
            const weightMatrix = submission.data.tabla_control_peso as PressureEntry[];
            if (Array.isArray(weightMatrix)) {
                let weightMatrixChanged = false;
                const nextWeightMatrix = weightMatrix.map(row => {
                    const validWeights: number[] = [];
                    // Para pesos (Paso 3), según requerimiento de aislamiento, se usa solo 1 valor por fruto (p1)
                    // Se ignora p2 ya que la columna única del modal mapea a p1
                    if (row.detalles) {
                        row.detalles.forEach(det => {
                            if (det.p1 !== null && det.p1 !== undefined && !isNaN(det.p1)) {
                                validWeights.push(det.p1);
                            }
                        });
                    }

                    const max = validWeights.length > 0 ? Math.max(...validWeights) : '';
                    const min = validWeights.length > 0 ? Math.min(...validWeights) : '';
                    const avg = validWeights.length > 0
                        ? parseFloat((validWeights.reduce((a, b) => a + b, 0) / validWeights.length).toFixed(2))
                        : '';

                    if (row.max !== max || row.min !== min || row.x !== avg) {
                        weightMatrixChanged = true;
                        return { ...row, max, min, x: avg };
                    }
                    return row;
                });

                if (weightMatrixChanged) {
                    handleDataChange('tabla_control_peso', nextWeightMatrix, { markAsDirty: false });
                }
            }

            // 4. Lógica de Cálculo de "Comercial" y "% Comercial" en 4C (Paso 4 - Presizer)
            const table4A = submission.data.tabla_datos_canal;
            const table4C = submission.data.tabla_danos_defectos_canal;
            if (Array.isArray(table4A) && Array.isArray(table4C)) {
                const fruitsRow4A = table4A.find((r: any) => r.concepto === 'Nº Frutos');
                const prevData = prevDataRef.current;
                const oldTable4A = prevData ? prevData.tabla_datos_canal : null;
                const oldFruitsRow4A = Array.isArray(oldTable4A) ? oldTable4A.find((r: any) => r.concepto === 'Nº Frutos') : null;
                const oldTable4C = prevData ? prevData.tabla_danos_defectos_canal : null;

                const nextTable4C = JSON.parse(JSON.stringify(table4C));
                let changed4C = false;

                const comercialRow = nextTable4C.find((r: any) => r.concepto === 'Comercial');
                const percentComercialRow = nextTable4C.find((r: any) => r.concepto === '% Comercial');
                const percentCalibreRow = nextTable4C.find((r: any) => r.concepto === '% Calibre');
                const calibreRow4C = nextTable4C.find((r: any) => r.concepto === 'Comercial'); // Fixed concept check
                const calibreRow4A = table4A.find((r: any) => r.concepto === 'Calibre');

                if (comercialRow || percentComercialRow || percentCalibreRow) {
                    for (let i = 1; i <= 50; i++) {
                        const chKey = `ch${i}`;
                        const currentTotalFrutos = fruitsRow4A ? parseFloat(fruitsRow4A[chKey]) : 0;
                        const oldTotalFrutos = oldFruitsRow4A ? parseFloat(oldFruitsRow4A[chKey]) : currentTotalFrutos;

                        // --- PASO A: Sumar unidades de defectos (reversión de % a unidades si es necesario) ---
                        let colSumUnits = 0;
                        let hasDefectsValue = false;

                        nextTable4C.forEach((row: any, rIdx: number) => {
                            if (['Comercial', '% Comercial', 'Calibre', '% Calibre'].includes(row.concepto)) return;

                            const currentVal = row[chKey];
                            const oldRow = Array.isArray(oldTable4C) ? oldTable4C[rIdx] : null;
                            const oldVal = oldRow ? oldRow[chKey] : undefined;

                            if (currentVal !== '' && currentVal !== undefined && currentVal !== null) {
                                let units = 0;
                                // Si el valor cambió en esta celda específica, el input es UNIDADES
                                if (currentVal !== oldVal) {
                                    units = parseFloat(currentVal);
                                    colSumUnits += units;
                                    hasDefectsValue = true;
                                }
                                else if (currentTotalFrutos !== oldTotalFrutos && currentTotalFrutos > 0 && oldTotalFrutos > 0) {
                                    units = (parseFloat(currentVal) * oldTotalFrutos) / 100;
                                    colSumUnits += units;
                                    hasDefectsValue = true;
                                }
                                else if (currentTotalFrutos > 0) {
                                    units = (parseFloat(currentVal) * currentTotalFrutos) / 100;
                                    colSumUnits += units;
                                    hasDefectsValue = true;
                                }
                            }
                        });

                        // --- PASO B: Actualizar Comercial (Suma de Unidades) ---
                        const finalComercialUnits = hasDefectsValue ? Math.round(colSumUnits) : '';
                        if (comercialRow && comercialRow[chKey] !== finalComercialUnits) {
                            comercialRow[chKey] = finalComercialUnits;
                            changed4C = true;
                        }

                        // --- PASO C: Actualizar % Comercial ---
                        if (percentComercialRow && fruitsRow4A) {
                            const comercialVal = parseFloat((finalComercialUnits || 0).toString());
                            let pctValue: any = '';
                            if (!isNaN(currentTotalFrutos) && currentTotalFrutos > 0) {
                                pctValue = parseFloat(((comercialVal / currentTotalFrutos) * 100).toFixed(2));
                            }
                            if (percentComercialRow[chKey] !== pctValue) {
                                percentComercialRow[chKey] = pctValue;
                                changed4C = true;
                            }
                        }
                    }
                }
                if (changed4C) {
                    handleDataChange('tabla_danos_defectos_canal', nextTable4C, { markAsDirty: false });
                }
            }

            // 5. LÓGICA EXCLUSIVA: Recálculo en 4B cuando cambia la base en 4A (Paso 4 - Presizer)
            const table4B = submission.data.tabla_fuera_categoria_canal;
            if (Array.isArray(table4A) && Array.isArray(table4B)) {
                const fruitsRow4A = table4A.find((r: any) => r.concepto === 'Nº Frutos');
                const prevData = prevDataRef.current;
                const oldFruitsRow4A = (prevData && Array.isArray(prevData.tabla_datos_canal))
                    ? prevData.tabla_datos_canal.find((r: any) => r.concepto === 'Nº Frutos')
                    : null;

                if (fruitsRow4A && oldFruitsRow4A) {
                    let changed4B = false;
                    const nextTable4B = JSON.parse(JSON.stringify(table4B));
                    const targetRows = ['Superior %', 'Inferior %', 'Choice %'];

                    for (let i = 1; i <= 50; i++) {
                        const chKey = `ch${i}`;
                        const currentBase = parseFloat(fruitsRow4A[chKey]);
                        const oldBase = parseFloat(oldFruitsRow4A[chKey]);

                        if (!isNaN(currentBase) && currentBase > 0 && currentBase !== oldBase && !isNaN(oldBase) && oldBase > 0) {
                            targetRows.forEach(rowName => {
                                const rowIdx = nextTable4B.findIndex((r: any) => r.concepto === rowName);
                                if (rowIdx === -1) return;

                                const currentPercent = parseFloat(nextTable4B[rowIdx][chKey]);
                                if (!isNaN(currentPercent)) {
                                    const originalUnits = (currentPercent * oldBase) / 100;
                                    const newPercent = parseFloat(((originalUnits / currentBase) * 100).toFixed(2));

                                    if (nextTable4B[rowIdx][chKey] !== newPercent) {
                                        nextTable4B[rowIdx][chKey] = newPercent;
                                        changed4B = true;
                                    }
                                }
                            });
                        }
                    }

                    if (changed4B) {
                        handleDataChange('tabla_fuera_categoria_canal', nextTable4B, { markAsDirty: false });
                    }
                }
            }

            // --- NEW: Lógica para Paso 5 de C.K.U Presizer (Mercado Interno) ---
            const table5 = submission.data.tabla_mercado_interno;
            if (Array.isArray(table5)) {
                const nextTable5 = JSON.parse(JSON.stringify(table5));
                let changed5 = false;

                const fruitsRow = nextTable5.find((r: any) => r.defecto === 'N° frutos');

                if (fruitsRow) {
                    // 1) Sumas Verticales (Fila N° frutos) -> NO poner 0 si no hay datos en esa columna
                    for (let i = 1; i <= 30; i++) {
                        const colKey = `f${i}`;
                        let colSum = 0;
                        let hasAnyValue = false;

                        nextTable5.forEach((row: any) => {
                            if (row.defecto === 'N° frutos') return;

                            const raw = row[colKey];
                            if (raw !== '' && raw !== null && raw !== undefined) {
                                const num = parseFloat(raw);
                                if (!isNaN(num)) {
                                    colSum += num;
                                    hasAnyValue = true;
                                }
                            }
                        });

                        const out: any = hasAnyValue ? colSum : '';
                        if (fruitsRow[colKey] !== out) {
                            fruitsRow[colKey] = out;
                            changed5 = true;
                        }
                    }

                    // 2) Total N° de Frutos -> NO dejar 0 si toda la fila está vacía
                    let totalFrutosGeneral = 0;
                    let hasAnyFruitTotal = false;

                    for (let i = 1; i <= 30; i++) {
                        const raw = fruitsRow[`f${i}`];
                        if (raw !== '' && raw !== null && raw !== undefined) {
                            const val = parseFloat(raw);
                            if (!isNaN(val)) {
                                totalFrutosGeneral += val;
                                hasAnyFruitTotal = true;
                            }
                        }
                    }

                    const totalOut: any = hasAnyFruitTotal ? totalFrutosGeneral : '';
                    if (submission.data.total_frutos_mercado_interno !== totalOut) {
                        handleDataChange('total_frutos_mercado_interno', totalOut, { markAsDirty: false });
                    }
                }

                // 3) Promedio por fila (esto lo puedes dejar tal cual)
                nextTable5.forEach((row: any) => {
                    let rowSum = 0;
                    let rowCount = 0;
                    for (let i = 1; i <= 30; i++) {
                        const colKey = `f${i}`;
                        const val = parseFloat(row[colKey]);
                        if (!isNaN(val)) {
                            rowSum += val;
                            rowCount++;
                        }
                    }
                    const rowAvg = rowCount > 0 ? parseFloat((rowSum / rowCount).toFixed(2)) : '';
                    if (row.promedio_x !== rowAvg) {
                        row.promedio_x = rowAvg;
                        changed5 = true;
                    }
                });

                if (changed5) {
                    handleDataChange('tabla_mercado_interno', nextTable5, { markAsDirty: false });
                }
            }

        }

        prevDataRef.current = JSON.parse(JSON.stringify(submission.data));
    }, [submission?.data, template?.id, handleDataChange, isEditable]);

    const handleSafeNavigate = useCallback(
        async (to: string | number) => {
            if (shouldConfirmExit()) {
                const ok = await confirmExit();
                if (!ok) return;
            }
            blockNavigation(false);
            if (typeof to === "number") {
                if (fromNewRef.current) { navigate("/"); return; }
                if (window.history.length > 2) navigate(to); else navigate("/");
            } else navigate(to);
        },
        [confirmExit, shouldConfirmExit, navigate, blockNavigation]
    );

    const checkVisibility = (dependency?: FieldDependency) => {
        if (!dependency || !submission) return true;
        const currentValue = _.get(submission.data, dependency.key);
        if (Array.isArray(dependency.value)) return dependency.value.includes(currentValue);
        return currentValue === dependency.value;
    };

    const validateCurrentSection = (): boolean => {
        if (!template || !submission) return false;
        const currentSection = template.sections[activeSection];
        if (!checkVisibility(currentSection.dependency)) return true;
        const newErrors: Record<string, string> = {};
        let isValid = true;
        currentSection.fields.forEach(field => {
            if (field.readOnly || !checkVisibility(field.dependency)) return;
            const value = _.get(submission.data, field.key);
            if (field.required && (value === null || value === undefined || value === '')) {
                newErrors[field.key] = 'Este campo es obligatorio.'; isValid = false;
            }
        });
        setErrors(newErrors);
        if (!isValid) addToast({ message: 'Por favor complete los campos requeridos.', type: 'error' });
        return isValid;
    };

    const handleNextSection = () => {
        if (isReadOnly) { setActiveSection(p => Math.min(template?.sections?.length ? template.sections.length - 1 : 0, p + 1)); return; }
        if (validateCurrentSection()) { setActiveSection(p => p + 1); window.scrollTo(0, 0); }
    };

    const handleOpenDraftModal = () => {
        if (!submission) return;
        setDraftName(submission.customName || template?.title || "");
        setIsSaveDraftModalOpen(true);
    };

    const handleManualSave = async () => {
        if (!submission || isSaving || !draftName.trim()) return;
        setIsSaving(true);
        setIsSaveDraftModalOpen(false);

        const toPersist: FormSubmission = {
            ...submission,
            customName: draftName.trim(),
            updatedAt: new Date().toISOString()
        };

        saveSubmission(toPersist);
        if (!id) navigate(`/forms/fill/${toPersist.id}?templateId=${toPersist.templateId}`, { replace: true });
        setIsDirty(false); setErrors({});
        addToast({ message: "Borrador guardado", type: "success" });
        setTimeout(() => setIsSaving(false), 400);
    };

    const handleSubmit = async (newStatus: FormStatus) => {
        if (!submission || !template) return;
        if (!validateCurrentSection()) return;

        const finalSubmission: FormSubmission = {
            ...submission,
            status: newStatus,
            updatedAt: new Date().toISOString(),
        };

        try {
            // Solo cuando es FINALIZAR (Ingresado) enviamos al backend
            if (newStatus === "Ingresado") {
                const payload = {
                    ...finalSubmission,
                    template: { title: template.title, version: template.version },
                    user: {
                        id: "frontend-local",
                        name: finalSubmission.submittedBy,
                        email: "",
                    },
                };

                await finalizeSubmission(payload);
            }

            // Si backend OK (o era borrador), seguimos como antes:
            saveSubmission(finalSubmission);
            setIsDirty(false);
            blockNavigation(false);
            addToast({ message: `Registro ${newStatus.toLowerCase()}`, type: "success" });
            navigate(isReadOnly ? "/records" : "/");
        } catch (e) {
            console.error(e);
            addToast({ message: "Error al finalizar. Revisa Teams / backend.", type: "error" });
        }
    };


    if (!template || !submission || !template.sections) {
        return <div className="text-center p-10">Cargando formulario...</div>;
    }

    const currentSection: FormSection = template.sections[activeSection];

    const isEmpaqueStep3 = template.id === 'REG.CKU.017' && activeSection === 2;
    const isEmpaqueStep4 = template.id === 'REG.CKU.017' && activeSection === 3;
    const isPresizerStep4 = template.id === 'REG.CKU.018' && activeSection === 3;
    const isPresizerStep5 = template.id === 'REG.CKU.018' && activeSection === 4;

    const lineOptions = Array.from({ length: 30 }, (_, i) => (i + 1).toString());
    const fruitOptions = Array.from({ length: 30 }, (_, i) => (i + 1).toString());
    const channelOptions = Array.from({ length: 50 }, (_, i) => (i + 1).toString());

    const activeLineNumber = activeLineKey.substring(1);
    const activeFrutoNumber = activeFrutoKey.substring(1);
    const activeChannelNumber = activeChannelKey.substring(2);

    return (
        <>
            <div className="max-w-5xl mx-auto pb-24">
                <PageHeader title={template.title} breadcrumbs={[{ label: "Inicio", path: "/" }, { label: template.title }]}>
                    <Badge status={submission.status} />
                </PageHeader>

                <div className="bg-cku-white p-8 rounded-2xl shadow-md border border-gray-200">
                    {(!checkVisibility(currentSection.dependency)) ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500">Esta sección no aplica para la configuración seleccionada.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8 overflow-x-auto pb-2">
                                <nav aria-label="Progress" className="min-w-[600px]">
                                    <ol role="list" className="flex space-x-4">
                                        {template.sections.map((section, sectionIdx) => {
                                            const isHidden = !checkVisibility(section.dependency);
                                            return (
                                                <li key={section.key} className={`flex-1 min-w-[100px] ${isHidden ? 'opacity-40' : ''}`}>
                                                    <button type="button" onClick={() => (isReadOnly || sectionIdx < activeSection) && !isHidden && setActiveSection(sectionIdx)} disabled={(!isReadOnly && sectionIdx > activeSection) || isHidden} className={`group flex flex-col w-full border-t-4 py-2 transition-colors ${sectionIdx === activeSection ? 'border-cku-blue' : sectionIdx < activeSection ? 'border-cku-blue hover:border-blue-600' : 'border-gray-200'} disabled:cursor-not-allowed`}>
                                                        <span className={`text-xs font-bold uppercase tracking-wide ${sectionIdx === activeSection ? 'text-cku-blue' : 'text-gray-500'}`}>Paso {sectionIdx + 1}</span>
                                                        <span className="text-sm font-medium truncate" title={section.title}>{section.title}</span>
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ol>
                                </nav>
                            </div>

                            {isEmpaqueStep3 && (
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <SettingsIcon className="w-6 h-6 text-cku-blue" />
                                        <span className="font-bold text-cku-blue text-sm">Gestión de Línea</span>
                                    </div>
                                    <div className="w-full sm:w-64">
                                        <Select
                                            label="Línea activa"
                                            value={activeLineNumber}
                                            onChange={(e) => setActiveLineKey(`l${e.target.value}`)}
                                            className="text-sm font-semibold"
                                        >
                                            {lineOptions.map(n => <option key={n} value={n}>Línea {n}</option>)}
                                        </Select>
                                    </div>
                                    <p className="text-xs text-blue-700 max-w-xs text-center sm:text-left">
                                        El resaltado se actualiza automáticamente al seleccionar o enfocar una celda de línea.
                                    </p>
                                </div>
                            )}

                            {isEmpaqueStep4 && (
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <SettingsIcon className="w-6 h-6 text-cku-blue" />
                                        <span className="font-bold text-cku-blue text-sm">Gestión de Fruta</span>
                                    </div>
                                    <div className="w-full sm:w-64">
                                        <Select
                                            label="Fruta activa"
                                            value={activeFrutoNumber}
                                            onChange={(e) => setActiveFrutoKey(`f${e.target.value}`)}
                                            className="text-sm font-semibold"
                                        >
                                            {fruitOptions.map(n => <option key={n} value={n}># Fruta {n}</option>)}
                                        </Select>
                                    </div>
                                    <p className="text-xs text-blue-700 max-w-xs text-center sm:text-left">
                                        Seleccione el número de fruta para resaltar su columna. Al hacer clic en cualquier celda de la tabla, el selector se actualizará automáticamente.
                                    </p>
                                </div>
                            )}

                            {isPresizerStep4 && (
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <SettingsIcon className="w-6 h-6 text-cku-blue" />
                                        <span className="font-bold text-cku-blue text-sm">Gestión de Canal</span>
                                    </div>
                                    <div className="w-full sm:w-64">
                                        <Select
                                            label="Canal activa"
                                            value={activeChannelNumber}
                                            onChange={(e) => setActiveChannelKey(`ch${e.target.value}`)}
                                            className="text-sm font-semibold"
                                        >
                                            {channelOptions.map(n => <option key={n} value={n}>Canal {n}</option>)}
                                        </Select>
                                    </div>
                                    <p className="text-xs text-blue-700 max-w-xs text-center sm:text-left">
                                        El canal seleccionado se sincroniza y resalta en las matrices 4A, 4B y 4C simultáneamente.
                                    </p>
                                </div>
                            )}

                            {isPresizerStep5 && (
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <SettingsIcon className="w-6 h-6 text-cku-blue" />
                                        <span className="font-bold text-cku-blue text-sm">Gestión de Fruta</span>
                                    </div>
                                    <div className="w-full sm:w-64">
                                        <Select
                                            label="Fruta activa"
                                            value={activeFrutaKey.replace('f', '')}
                                            onChange={(e) => setActiveFrutaKey(`f${e.target.value}`)}
                                            className="text-sm font-semibold"
                                        >
                                            {fruitOptions.map(n => <option key={n} value={n}># Fruta {n}</option>)}
                                        </Select>
                                    </div>
                                    <p className="text-xs text-blue-700 max-w-xs text-center sm:text-left">
                                        Seleccione el número de fruta para resaltar su columna. Al hacer clic en cualquier celda de la tabla, el selector se actualizará automáticamente.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-6">
                                <div className="border-b pb-4 mb-4">
                                    <h2 className="text-xl font-bold text-cku-black">{currentSection.title}</h2>
                                    {currentSection.description && <p className="text-gray-500">{currentSection.description}</p>}
                                </div>

                                {currentSection.fields.map((field) => {
                                    if (!checkVisibility(field.dependency)) return null;

                                    let fieldLabel = field.label;
                                    if (isEmpaqueStep3 && (field.key === 'tabla_datos_linea' || field.key === 'tabla_danos_defectos' || field.key === 'tabla_fuera_categoria')) {
                                        fieldLabel = `${field.label} (Línea activa: ${activeLineNumber})`;
                                    } else if (isPresizerStep4 && (field.key === 'tabla_datos_canal' || field.key === 'tabla_fuera_categoria_canal' || field.key === 'tabla_danos_defectos_canal')) {
                                        fieldLabel = `${field.label} (Canal activa: ${activeChannelNumber})`;
                                    }

                                    const isActiveFrutoField = (isEmpaqueStep4 && field.key === 'tabla_mercado_interno' || isPresizerStep5 && field.key === 'tabla_mercado_interno');
                                    const activeKey = isPresizerStep5 ? activeFrutaKey : activeFrutoKey;
                                    const activeNum = activeKey?.replace(/^\D+/, '') || '';

                                    return (
                                        <div key={field.key}>
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                                                <label htmlFor={field.key} className="block text-md font-semibold text-cku-black">
                                                    {fieldLabel} {field.required && <span className="text-cku-red">*</span>}
                                                </label>
                                                {isActiveFrutoField && activeNum && (
                                                    <div className="inline-flex items-center bg-blue-50 text-cku-blue border border-blue-200 px-3 py-1 rounded-full text-xs font-bold animate-fade-in shadow-sm">
                                                        <span className="w-2 h-2 bg-cku-blue rounded-full mr-2 animate-pulse"></span>
                                                        # Fruta activo: {activeNum}
                                                    </div>
                                                )}
                                            </div>
                                            {field.help && <p className="text-sm text-gray-500 mt-1 mb-2">{field.help}</p>}
                                            <RenderField
                                                field={field}
                                                value={_.get(submission.data, field.key)}
                                                onChange={(key, val, extra) => handleDataChange(key, val, extra)}
                                                isEditable={isEditable}
                                                dynamicSchema={submission.dynamicSchemas?.[field.key]}
                                                error={errors[field.key]}
                                                activeColumnKey={
                                                    isEmpaqueStep3 ? activeLineKey :
                                                        (isEmpaqueStep4 && field.key === 'tabla_mercado_interno' ? activeFrutoKey :
                                                            (isPresizerStep4 && (field.key === 'tabla_datos_canal' || field.key === 'tabla_fuera_categoria_canal' || field.key === 'tabla_danos_defectos_canal') ? activeChannelKey :
                                                                (isPresizerStep5 && field.key === 'tabla_mercado_interno' ? activeFrutaKey : undefined)))
                                                }
                                                onActiveColumnChange={
                                                    isEmpaqueStep3 ? setActiveLineKey :
                                                        (isEmpaqueStep4 && field.key === 'tabla_mercado_interno' ? setActiveFrutoKey :
                                                            (isPresizerStep4 && (field.key === 'tabla_datos_canal' || field.key === 'tabla_fuera_categoria_canal' || field.key === 'tabla_danos_defectos_canal') ? setActiveChannelKey :
                                                                (isPresizerStep5 && field.key === 'tabla_mercado_interno' ? (key) => setActiveFrutaKey(key) : undefined)))
                                                }
                                                highlightThreshold={field.key === 'tabla_control_peso' ? submission.data.umbral_peso : undefined}
                                            />
                                        </div>
                                    )
                                })}

                                {(isEmpaqueStep4 || isPresizerStep5) && (
                                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mt-6 animate-fade-in">
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-cku-blue/10 rounded-full flex items-center justify-center text-cku-blue">
                                                    <SettingsIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase">Resumen de Muestra</p>
                                                    <p className="text-sm font-semibold text-cku-black">C.K.U Mercado Interno</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 px-6 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total N° de Frutos</p>
                                                    <p className={`text-2xl font-bold ${Math.abs((submission.data.total_frutos_mercado_interno || 0) - 100) < 5 ? 'text-green-600' : 'text-cku-blue'}`}>
                                                        {submission.data.total_frutos_mercado_interno === '' || submission.data.total_frutos_mercado_interno === null || submission.data.total_frutos_mercado_interno === undefined
                                                            ? ''
                                                            : submission.data.total_frutos_mercado_interno}

                                                    </p>
                                                </div>
                                                <div className="w-px h-10 bg-gray-200"></div>
                                                <div className="text-xs text-gray-500 max-w-[140px] italic leading-tight text-[11px]">
                                                    * Se espera que este total se aproxime a 100 frutos según la muestra.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal para Guardar Borrador */}
            <Modal
                isOpen={isSaveDraftModalOpen}
                onClose={() => setIsSaveDraftModalOpen(false)}
                title="Guardar borrador"
            >
                <div className="space-y-4">
                    <Input
                        label="Nombre del borrador"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        required
                        autoFocus
                    />
                    <p className="text-xs text-gray-600">
                        <strong>Identifique su borrador con alguna Fecha–Hora–Nombre para poder buscarlo fácilmente.</strong>
                    </p>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="secondary" onClick={() => setIsSaveDraftModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleManualSave}
                            disabled={!draftName.trim() || isSaving}
                        >
                            {isSaving ? "Guardando..." : "Guardar borrador"}
                        </Button>
                    </div>
                </div>
            </Modal>

            <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="hidden sm:block">
                        <span className="text-sm text-gray-500">{isDirty ? "Cambios sin guardar." : "Listo."}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-end w-full sm:w-auto">
                        <Button variant="secondary" onClick={() => handleSafeNavigate(-1)}>Cancelar</Button>
                        {activeSection > 0 && <Button variant="secondary" onClick={() => setActiveSection(p => p - 1)}>Anterior</Button>}
                        {activeSection < template.sections.length - 1 && <Button onClick={handleNextSection}>Siguiente</Button>}
                        {isEditable && <Button variant="secondary" onClick={handleOpenDraftModal} disabled={!isDirty || isSaving}>{isSaving ? "Guardando..." : "Guardar Borrador"}</Button>}
                        {isEditable && activeSection === template.sections.length - 1 && <Button onClick={() => handleSubmit("Ingresado")}><SendIcon className="w-5 h-5 mr-2" /> Finalizar Ingreso</Button>}
                    </div>
                </div>
            </footer>
        </>
    );
};

const RenderField: React.FC<{
    field: FormField;
    value: any;
    onChange: (key: string, value: any, extraData?: any) => void;
    isEditable?: boolean;
    dynamicSchema?: DynamicTableColumn[];
    error?: string;
    activeColumnKey?: string;
    onActiveColumnChange?: (key: string) => void;
    highlightThreshold?: number;
}> = ({ field, value, onChange, isEditable, dynamicSchema, error, activeColumnKey, onActiveColumnChange, highlightThreshold }) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(field.key, e.target.value);
    const disabled = !isEditable || !!field.readOnly;

    switch (field.type) {
        case "text":
            if (field.type === 'text' && field.series_count && field.series_count > 1) {
                const values = Array.isArray(value) ? value : Array(field.series_count).fill("");
                return (
                    <div className="flex flex-col gap-2">
                        {values.map((v, i) => (
                            <Input
                                key={i}
                                id={`${field.key}_${i}`}
                                name={`${field.key}_${i}`}
                                value={v || ""}
                                onChange={(e) => {
                                    const newValues = [...values];
                                    newValues[i] = e.target.value;
                                    onChange(field.key, newValues);
                                }}
                                disabled={disabled}
                                error={i === 0 ? error : undefined}
                                autoComplete="off"
                                className="text-sm"
                            />
                        ))}
                    </div>
                );
            }
            return <Input id={field.key} name={field.key} type="text" value={value ?? ""} onChange={handleInputChange} disabled={disabled} error={error} autoComplete="off" className="text-sm" />;
        case "date":
        case "time":
            return <Input id={field.key} name={field.key} type={field.type} value={value ?? ""} onChange={handleInputChange} disabled={disabled} error={error} autoComplete="off" className="text-sm" />;
        case "integer":
        case "decimal":
            return <Input
                id={field.key}
                name={field.key}
                type="number"
                step={field.type === 'integer' ? '1' : 'any'}
                value={value ?? ""}
                onChange={handleInputChange}
                disabled={disabled}
                error={error}
                autoComplete="off"
                min={field.validations?.min}
                max={field.validations?.max}
                className="text-sm"
            />;
                case "select": {
            const selectValue = String(value ?? "");

            // ✅ Detectar el campo de variedad correctamente
            if (field.dynamicOptions === "variedades") {
                // ✅ Si la variedad viene con prefijo (ej: "recepcion.variedad" / "identificacion.variedad"),
                // el grupo debe guardarse en el mismo prefijo: "recepcion.variedad_rotulada_grupo"
                const prefix = field.key.includes(".")
                    ? field.key.split(".").slice(0, -1).join(".")
                    : "";

                const grupoKey = prefix
                    ? `${prefix}.variedad_rotulada_grupo`
                    : "variedad_rotulada_grupo";

                return (
                    <VariedadSelect
                        value={selectValue}
                        onChange={(variedad, grupo) => {
                            // Actualizar la variedad seleccionada
                            onChange(field.key, variedad);

                            // Auto-asignar el grupo (en el mismo path del field.key)
                            onChange(grupoKey, grupo);

                            // Si ya no quieres logs, borra estas líneas:
                            console.log("Variedad seleccionada:", variedad);
                            console.log("Grupo asignado:", grupo);
                            console.log("Campo variedad key:", field.key);
                            console.log("Campo grupo key:", grupoKey);
                        }}
                        disabled={field.readOnly || !isEditable}
                    />
                );
            }

            // ✅ SELECT NORMAL (todos los demás selects)
            return (
                <Select
                    label={field.label}
                    name={field.key}
                    value={selectValue}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    required={field.required}
                    disabled={field.readOnly || !isEditable}
                >
                    <option value="">-- Seleccionar --</option>
                    {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </Select>
            );
        }
        case "boolean":
            return <input id={field.key} name={field.key} type="checkbox" className="h-5 w-5 rounded border-gray-300 text-cku-blue focus:ring-cku-blue disabled:opacity-50" checked={!!value} onChange={(e) => onChange(field.key, e.target.checked)} disabled={disabled} />;
        case "textarea":
            return <textarea id={field.key} name={field.key} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-cku-blue focus:border-cku-blue text-sm disabled:bg-gray-100" rows={4} value={value ?? ""} onChange={handleInputChange} disabled={disabled} />;
        case "dynamic_table":
            return <DynamicTable columns={dynamicSchema || field.columns || []} data={value || []} onChange={(data, cols) => onChange(field.key, data, { newColumns: cols })} canAddRows={field.user_can_add_rows} canAddCols={field.user_can_add_columns} isReviewMode={!isEditable || !!field.readOnly} label={field.label} activeColumnKey={activeColumnKey} onActiveColumnChange={onActiveColumnChange} highlightThreshold={highlightThreshold} />;
        case 'autocomplete': {
            const autocompleteValue = String(value ?? '');  // ✅ Usar 'value' directamente

            if (field.key === 'huerto_cuartel' || field.key.includes('huerto')) {
                return (
                    <AutoCompleteHuerto
                        value={autocompleteValue}
                        onChange={(val) => onChange(field.key, val)}  // ✅ Usar 'onChange'
                        disabled={field.readOnly || !isEditable}
                    />
                );
            }

            if (field.key === 'productor' || field.key.includes('productor')) {
                return (
                    <AutoCompleteProductor
                        value={autocompleteValue}
                        onChange={(val) => onChange(field.key, val)}  // ✅ Usar 'onChange'
                        disabled={field.readOnly || !isEditable}
                    />
                );
            }

            return (
                <Input
                    label={field.label}
                    value={autocompleteValue}
                    onChange={(e) => onChange(field.key, e.target.value)}  // ✅ Usar 'onChange'
                    disabled={field.readOnly || !isEditable}
                />
            );
        }
        case "pressure_matrix":
            return <PressureMatrixManager
                value={value || []}
                onChange={(val) => onChange(field.key, val)}
                isEditable={!disabled}
                hideBrix={field.hideBrix}
                hideCalibre={field.hideCalibre}
                showSummaryColumns={field.showSummaryColumns}
                showOnlyAverage={field.showOnlyAverage}
                isWeightMode={field.isWeightMode}
            />;
        default:
            return <p className="text-sm text-gray-500">Campo tipo '{field.type}' no implementado.</p>;
    }
};

export default FormFiller;