import { toast } from "./components/custom-toast.js";

document.addEventListener("DOMContentLoaded", function () {

    const empresaSelect = document.getElementById('empresa_select');
    const containerManual = document.getElementById('container_empresa_manual');
    const empresaManualInput = document.getElementById('empresa_manual');

    // Lógica para mostrar/ocultar "Otros"
    empresaSelect.addEventListener('change', function () {
        if (this.value === 'otros') {
            containerManual.style.display = 'block';
            empresaManualInput.required = true;
        } else {
            containerManual.style.display = 'none';
            empresaManualInput.required = false;
            empresaManualInput.value = '';
        }
    });

    // Manejar habilitación/deshabilitación de campos según checkboxes
    const checkboxes = [
        { check: 'c_matriculacion_check', fields: ['c_matriculacion_venc', 'c_matriculacion_cert'] },
        { check: 'seguro_check', fields: ['seguro_venc', 'seguro_cert'] },
        { check: 'rto_check', fields: ['rto_venc', 'rto_cert'] },
        { check: 'tacografo_check', fields: ['tacografo_venc', 'tacografo_cert'] }
    ];

    // Inicializar campos deshabilitados
    checkboxes.forEach(item => {
        const checkbox = document.getElementById(item.check);
        const fields = item.fields.map(id => document.getElementById(id));

        // Deshabilitar campos inicialmente
        fields.forEach(field => field.disabled = true);

        // Evento para habilitar/deshabilitar campos
        checkbox.addEventListener('change', function () {
            fields.forEach(field => {
                field.disabled = !this.checked;
                if (!this.checked) {
                    field.value = ''; // Limpiar valor si se desmarca
                }
            });
        });
    });

    // Establecer fecha y hora actual
    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    document.getElementById("fecha").value = fechaLocal;

    // Manejar envío del formulario
    document.getElementById("controlForm").addEventListener('submit', async (e) => {
        e.preventDefault();

        const form = document.getElementById("controlForm");
        const formData = new FormData(form);

        // Determinar el nombre final de la empresa
        let empresaFinal = formData.get('empresa_select');
        if (empresaFinal === 'otros') {
            empresaFinal = formData.get('empresa_manual');
        }

        try {
            // Crear objeto con datos en formato plano (según espera el backend)
            const dataForSend = {
                // Datos del Control
                agente: formData.get('agente'),
                fecha: formData.get('fecha'),
                lugar: formData.get('lugar'),

                // Datos del Conductor
                conductor_nombre: formData.get('conductor_nombre'),
                licencia_numero: formData.get('licencia_numero'),
                licencia_tipo: formData.get('licencia_tipo'),
                licencia_vencimiento: formData.get('licencia_vencimiento') || null,

                // Datos de Empresa y Vehículo
                empresa_select: empresaFinal,
                dominio: formData.get('dominio').toUpperCase(),
                interno: formData.get('interno') || null,

                // Documentación del Vehículo (solo si están marcados los checkboxes)
                c_matriculacion_venc: document.getElementById('c_matriculacion_check').checked
                    ? formData.get('c_matriculacion_venc') : null,
                c_matriculacion_cert: document.getElementById('c_matriculacion_check').checked
                    ? formData.get('c_matriculacion_cert') : null,

                seguro_venc: document.getElementById('seguro_check').checked
                    ? formData.get('seguro_venc') : null,
                seguro_cert: document.getElementById('seguro_check').checked
                    ? formData.get('seguro_cert') : null,

                rto_venc: document.getElementById('rto_check').checked
                    ? formData.get('rto_venc') : null,
                rto_cert: document.getElementById('rto_check').checked
                    ? formData.get('rto_cert') : null,

                tacografo_venc: document.getElementById('tacografo_check').checked
                    ? formData.get('tacografo_venc') : null,
                tacografo_cert: document.getElementById('tacografo_check').checked
                    ? formData.get('tacografo_cert') : null
            };

            // Enviar petición al servidor
            const response = await fetch('/api/registers-control/new', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataForSend)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success('Éxito', 'Los datos se guardaron correctamente')

                form.reset();

                window.location.href = "/registers";
            } else {
                alert(result.message || 'Error al guardar el registro');
            }

        } catch (error) {
            console.error("Error al intentar enviar datos de control:", error);
            toast.warning('Advertencia', 'No se ha podido guardar nuevo registro');
        }
    });

    // Limpiar formulario
    document.getElementById("btn-clean-control").addEventListener('click', function () {
        // Resetear checkboxes y deshabilitar campos
        checkboxes.forEach(item => {
            document.getElementById(item.check).checked = false;
            item.fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                field.disabled = true;
                field.value = '';
            });
        });

        // Restablecer fecha actual
        const ahora = new Date();
        const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        document.getElementById("fecha").value = fechaLocal;
    });
});