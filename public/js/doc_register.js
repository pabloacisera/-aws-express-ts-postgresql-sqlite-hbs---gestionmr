// /js/doc_register.js

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('certificates-form');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const controlId = document.getElementById('control-id').value;

    if (!form || !controlId) {
        console.error('Formulario o controlId no encontrado');
        return;
    }

    console.log('Control ID encontrado:', controlId);

    // Mapeo de los campos del formulario a los tipos de certificado
    const fieldMapping = {
        'doc_c_matriculacion_cert': {
            type: 'C_MATRICULACION',
            enabled: true,
            dateField: 'c_matriculacion_venc'
        },
        'doc_seguro_cert': {
            type: 'SEGURO',
            enabled: true,
            dateField: 'seguro_venc'
        },
        'doc_rto_cert': {
            type: 'RTO',
            enabled: true,
            dateField: 'rto_venc'
        },
        'doc_tacografo_cert': {
            type: 'TACOGRAFO',
            enabled: true,
            dateField: 'tacografo_venc'
        }
    };

    // NUEVO: Obtener parámetros de URL para renovación
    const urlParams = new URLSearchParams(window.location.search);
    const tipoVencimiento = urlParams.get('tipo'); // c_matriculacion, seguro, rto, tacografo
    const estadoVencimiento = urlParams.get('estado'); // proximos, vencidos
    
    console.log('Parámetros de URL para renovación:', {
        tipo: tipoVencimiento,
        estado: estadoVencimiento
    });

    // NUEVO: Manejar botón cancelar
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (tipoVencimiento && estadoVencimiento) {
                window.location.href = '/stats';
            } else {
                window.location.href = '/registers';
            }
        });
    }

    // Función para verificar si un input de fecha está realmente habilitado
    function isDateInputEnabled(dateFieldId) {
        const dateInput = document.getElementById(dateFieldId);
        if (!dateInput) return false;
        
        // Verificar si está deshabilitado por atributo
        if (dateInput.disabled) return false;
        
        // Verificar si el padre (.cert-card) está deshabilitado
        const card = dateInput.closest('.cert-card');
        if (card && card.classList.contains('disabled')) return false;
        
        return true;
    }

    // Obtener todos los campos de archivo activos
    function getActiveFileInputs() {
        const activeInputs = [];

        Object.keys(fieldMapping).forEach(fieldName => {
            const input = document.getElementById(fieldName);

            if (input && !input.disabled) {
                const file = input.files[0];

                if (file) {
                    const dateField = fieldMapping[fieldName].dateField;
                    const dateInput = document.getElementById(dateField);
                    let expirationDate = null;

                    // ✅ VERIFICAR que el input de fecha esté habilitado y tenga valor
                    if (dateInput && isDateInputEnabled(dateField) && dateInput.value) {
                        expirationDate = dateInput.value;
                        console.log(`📅 Fecha de vencimiento capturada para ${fieldMapping[fieldName].type}: ${expirationDate}`);
                    }

                    activeInputs.push({
                        input: input,
                        file: file,
                        type: fieldMapping[fieldName].type,
                        fieldName: fieldName,
                        expirationDate
                    });
                }
            }
        });

        console.log('Archivos activos encontrados:', activeInputs.length);
        return activeInputs;
    }

    // Validar archivos antes de enviar - MODIFICADO: Permitir envío sin archivos
    function validateFiles() {
        const activeInputs = getActiveFileInputs();

        // ✅ MODIFICADO: Permitir enviar el formulario sin archivos
        // El usuario puede solo actualizar fechas sin subir nuevos archivos
        if (activeInputs.length === 0) {
            // Verificar si hay fechas ingresadas sin archivos
            const hasDatesWithoutFiles = Object.keys(fieldMapping).some(fieldName => {
                const dateField = fieldMapping[fieldName].dateField;
                const dateInput = document.getElementById(dateField);
                return dateInput && dateInput.value && isDateInputEnabled(dateField);
            });

            if (hasDatesWithoutFiles) {
                if (!confirm('⚠️ Has ingresado fechas de vencimiento pero no has seleccionado archivos.\n\n¿Deseas actualizar solo las fechas?')) {
                    return false;
                }
                console.log('✅ Continuando con solo actualización de fechas');
                return true;
            }
            
            // Si no hay archivos ni fechas, preguntar si quiere continuar
            if (!confirm('⚠️ No has seleccionado ningún archivo para subir.\n\n¿Deseas continuar sin subir documentos?')) {
                return false;
            }
            
            console.log('✅ Continuando sin archivos (solo para navegar)');
            return true;
        }

        const maxSize = 10 * 1024 * 1024;

        for (const item of activeInputs) {
            // Validar tamaño
            if (item.file.size > maxSize) {
                alert(`El archivo "${item.file.name}" excede el tamaño máximo de 10MB`);
                return false;
            }

            // Validar tipo
            const allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allowedTypes.includes(item.file.type)) {
                alert(`Tipo de archivo no permitido: "${item.file.name}". Solo se aceptan PDF, JPG, PNG, DOC, DOCX`);
                return false;
            }

            // ✅ VALIDAR FECHA DE VENCIMIENTO (si se proporcionó)
            if (item.expirationDate) {
                // Verificar que sea una fecha válida
                const expirationDate = new Date(item.expirationDate);
                if (isNaN(expirationDate.getTime())) {
                    alert(`Fecha de vencimiento inválida para "${item.file.name}". Formato: YYYY-MM-DD`);
                    return false;
                }

                // Verificar que no sea una fecha pasada (opcional)
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                
                if (expirationDate < todayDate) {
                    if (!confirm(`⚠️ La fecha de vencimiento para "${item.file.name}" es una fecha pasada (${item.expirationDate}). ¿Deseas continuar?`)) {
                        return false;
                    }
                }

                console.log(`✅ Fecha validada: ${item.expirationDate} para ${item.file.name}`);
            }
        }

        return true;
    }

    // Función para obtener números de certificado
    async function getCertificateNumber(certificateType) {
        try {
            console.log(`Obteniendo número de certificado para: ${certificateType}`);

            const response = await fetch(`/api/registers/${controlId}/certificates`);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log("Datos completos de API:", data);

            if (!data.success) {
                throw new Error(data.message || "Error en la respuesta de la API");
            }

            const certificates = data.data;
            console.log("Certificados recibidos:", certificates);

            let certNumber;
            switch (certificateType) {
                case 'C_MATRICULACION':
                    certNumber = certificates.c_matriculacion_cert;
                    break;
                case 'SEGURO':
                    certNumber = certificates.seguro_cert;
                    break;
                case 'RTO':
                    certNumber = certificates.rto_cert;
                    break;
                case 'TACOGRAFO':
                    certNumber = certificates.tacografo_cert;
                    break;
                default:
                    throw new Error(`Tipo de certificado desconocido: ${certificateType}`);
            }

            console.log(`Número encontrado para ${certificateType}:`, certNumber);

            if (!certNumber || certNumber.toString().trim() === '') {
                throw new Error(`El número de certificado para ${certificateType} no está registrado o está vacío`);
            }

            return certNumber.toString().trim();
        } catch (error) {
            console.error('Error obteniendo número de certificado:', error);
            throw error;
        }
    }

    // Mostrar estado de carga
    function showLoading() {
        submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        submitBtn.innerHTML = `
            <span>⏳ Subiendo documentos...</span>
            <div class="spinner-border spinner-border-sm ms-2" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
        `;
    }

    // Ocultar estado de carga
    function hideLoading() {
        submitBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        submitBtn.innerHTML = `
            <span>📤 Subir Documentos</span>
            <span>→</span>
        `;
    }

    // Mostrar mensaje de éxito
    function showSuccessMessage(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show mt-3';
        alertDiv.innerHTML = `
            <strong>✅ Éxito!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        form.parentNode.insertBefore(alertDiv, form.nextSibling);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Mostrar mensaje de error
    function showErrorMessage(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
        alertDiv.innerHTML = `
            <strong>❌ Error!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        form.parentNode.insertBefore(alertDiv, form.nextSibling);
    }

    // Función para enviar un archivo individual
    async function uploadSingleFile(item, certificateNumber) {
        console.log(`Subiendo archivo: ${item.file.name}, Tipo: ${item.type}, Certificado: ${certificateNumber}`);

        const formData = new FormData();
        formData.append('certificateFile', item.file);
        formData.append('controlId', controlId);
        formData.append('certificateType', item.type);
        formData.append('certificateNumber', certificateNumber);
        formData.append('description', `Documento de ${item.type}`);

        // ✅ Añadir fecha de vencimiento si existe y está habilitada
        if (item.expirationDate) {
            formData.append('expirationDate', item.expirationDate);
            console.log(`📅 Enviando fecha de vencimiento: ${item.expirationDate}`);
        }

        // Debug: Mostrar contenido de FormData
        console.log('Contenido de FormData:');
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ', pair[1]);
        }

        try {
            const response = await fetch('/api/upload/cert', {
                method: 'POST',
                body: formData
            });

            console.log('Respuesta del servidor:', response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.log('Datos de error:', errorData);
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    console.log('No se pudo parsear respuesta como JSON');
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Resultado exitoso:', result);
            return result;

        } catch (error) {
            console.error('Error en uploadSingleFile:', error);
            throw error;
        }
    }

    // Subir archivos en secuencia - MODIFICADO: Manejar caso sin archivos
    async function uploadFilesSequentially(activeInputs) {
        console.log('Iniciando subida secuencial para', activeInputs.length, 'archivos');

        // ✅ MODIFICADO: Si no hay archivos, solo redirigir
        if (activeInputs.length === 0) {
            console.log('✅ No hay archivos para subir, solo redirigiendo');
            return { 
                results: [], 
                successCount: 0, 
                errorCount: 0 
            };
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const item of activeInputs) {
            try {
                console.log(`Subiendo ${successCount + errorCount + 1}/${activeInputs.length}: ${item.file.name}`);

                // Obtener número de certificado
                const certificateNumber = await getCertificateNumber(item.type);

                if (!certificateNumber) {
                    throw new Error(`No se encontró número de certificado para ${item.type}`);
                }

                // Subir archivo
                const result = await uploadSingleFile(item, certificateNumber);

                results.push({
                    file: item.file.name,
                    type: item.type,
                    success: true,
                    message: result.message
                });
                successCount++;

                // Actualizar barra de progreso
                updateProgressBar(activeInputs.length, successCount + errorCount);

                console.log(`✓ Subida exitosa para ${item.file.name}`);

            } catch (error) {
                console.error(`✗ Error subiendo ${item.file.name}:`, error.message);

                results.push({
                    file: item.file.name,
                    type: item.type,
                    success: false,
                    message: error.message
                });
                errorCount++;

                // Actualizar barra de progreso
                updateProgressBar(activeInputs.length, successCount + errorCount);
            }
        }

        console.log('Resultados finales:', {
            total: activeInputs.length,
            success: successCount,
            errors: errorCount
        });

        return { results, successCount, errorCount };
    }

    // Crear barra de progreso
    function createProgressBar() {
        removeProgressBar();

        const activeInputs = getActiveFileInputs();
        
        // ✅ MODIFICADO: Solo mostrar barra si hay archivos
        if (activeInputs.length === 0) {
            return null;
        }

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container mt-3';
        progressContainer.innerHTML = `
            <div class="d-flex justify-content-between mb-1">
                <span class="progress-text">Progreso: <span class="progress-percent">0%</span></span>
                <span class="progress-count">0/${activeInputs.length}</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     role="progressbar" 
                     style="width: 0%">
                </div>
            </div>
        `;

        form.parentNode.insertBefore(progressContainer, form.nextSibling);
        return progressContainer;
    }

    // Actualizar barra de progreso
    function updateProgressBar(total, completed) {
        const progressContainer = document.querySelector('.progress-container');
        if (!progressContainer) return;

        const percent = Math.round((completed / total) * 100);
        const progressBar = progressContainer.querySelector('.progress-bar');
        const progressPercent = progressContainer.querySelector('.progress-percent');
        const progressCount = progressContainer.querySelector('.progress-count');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.setAttribute('aria-valuenow', percent);
        }

        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }

        if (progressCount) {
            progressCount.textContent = `${completed}/${total}`;
        }
    }

    // Eliminar barra de progreso
    function removeProgressBar() {
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    // Manejar envío del formulario - MODIFICADO: Permitir envío sin archivos
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        console.log('==== INICIANDO PROCESO DE SUBIDA ====');

        // Validar archivos (ahora permite sin archivos)
        if (!validateFiles()) {
            return;
        }

        const activeInputs = getActiveFileInputs();

        // ✅ MODIFICADO: Ya no requerimos al menos un archivo
        // Crear barra de progreso solo si hay archivos
        const progressBar = activeInputs.length > 0 ? createProgressBar() : null;

        // Mostrar estado de carga
        showLoading();

        try {
            // Usar subida secuencial (maneja caso sin archivos)
            const uploadResult = await uploadFilesSequentially(activeInputs);

            console.log('Procesando resultados finales...');

            // Procesar resultados
            if (uploadResult.errorCount > 0) {
                // Hubo errores
                const errorMessages = uploadResult.results
                    .filter(r => !r.success)
                    .map(r => `${r.file}: ${r.message}`)
                    .join('\n');

                if (uploadResult.successCount > 0) {
                    showErrorMessage(`Se completaron ${uploadResult.successCount} de ${activeInputs.length} archivos. Errores:\n${errorMessages}`);
                } else {
                    showErrorMessage(`No se pudo subir ningún archivo. Errores:\n${errorMessages}`);
                }

            } else {
                // Todo exitoso o sin archivos
                if (activeInputs.length > 0) {
                    showSuccessMessage(`¡Todos los archivos (${activeInputs.length}) se subieron correctamente!`);
                } else {
                    showSuccessMessage('✅ Operación completada');
                }

                // Redirigir después de 2 segundos
                setTimeout(() => {
                    // Redirigir a stats si venía de renovación
                    if (tipoVencimiento && estadoVencimiento) {
                        window.location.href = '/stats';
                    } else {
                        window.location.href = '/registers';
                    }
                }, 2000);
            }

        } catch (error) {
            console.error('Error en la subida:', error);
            showErrorMessage(`Error general: ${error.message}`);
        } finally {
            // Ocultar estado de carga y barra de progreso
            hideLoading();
            setTimeout(removeProgressBar, 3000);
        }
    });

    // Manejar cambio en los inputs de archivo
    Object.keys(fieldMapping).forEach(fieldName => {
        const input = document.getElementById(fieldName);
        const dateField = fieldMapping[fieldName].dateField;
        const dateInput = document.getElementById(dateField);

        if (input && !input.disabled) {
            input.addEventListener('change', function () {
                const file = this.files[0];
                const card = this.closest('.cert-card');

                if (file && card) {
                    // Actualizar estado de la tarjeta
                    const statusDiv = card.querySelector('.cert-status');
                    if (statusDiv) {
                        statusDiv.innerHTML = `
                            <span>✅ Archivo seleccionado:</span>
                            <small class="d-block text-truncate">${file.name}</small>
                            <small class="d-block">${(file.size / 1024 / 1024).toFixed(2)} MB</small>
                        `;
                        statusDiv.className = 'cert-status status-selected';
                    }

                    // ✅ MOSTRAR input de fecha si existe y la tarjeta está habilitada
                    if (dateInput && !card.classList.contains('disabled')) {
                        const dateGroup = dateInput.closest('.date-input-group');
                        if (dateGroup) {
                            dateGroup.style.display = 'block';
                            dateInput.disabled = false;
                            console.log(`📅 Input de fecha habilitado para ${fieldName}`);
                        }
                    }

                    // Actualizar contador de archivos seleccionados
                    updateSelectedCount();
                } else if (card) {
                    // Si se quitó el archivo
                    const statusDiv = card.querySelector('.cert-status');
                    if (statusDiv && !statusDiv.innerHTML.includes('Disponible')) {
                        statusDiv.innerHTML = `✅ Disponible para subir`;
                        statusDiv.className = 'cert-status status-available';
                    }
                    
                    // Actualizar contador
                    updateSelectedCount();
                }
            });
        }
    });

    // Actualizar contador de archivos seleccionados
    function updateSelectedCount() {
        const activeInputs = getActiveFileInputs();
        const submitBtn = document.getElementById('submit-btn');

        if (submitBtn) {
            const span = submitBtn.querySelector('span:first-child');
            if (span) {
                if (activeInputs.length > 0) {
                    span.textContent = `📤 Subir Documentos (${activeInputs.length})`;
                } else {
                    span.textContent = `📤 Subir Documentos`;
                }
            }
        }
    }

    // Inicializar contador
    updateSelectedCount();

    // Debug: Verificar que todo esté cargado
    console.log('doc_register.js cargado correctamente');
});