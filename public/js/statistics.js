
document.addEventListener("DOMContentLoaded", function () {
    // Obtener datos del elemento HTML
    const statsElement = document.getElementById('statsData');

    if (statsElement && statsElement.dataset.stats) {
        try {
            const statsData = JSON.parse(statsElement.dataset.stats);


            // CREAR GRÁFICO DE REGISTROS POR MES
            if (document.getElementById('registriesChart')) {
                const registriesCtx = document.getElementById('registriesChart').getContext('2d');
                const registriesByMonth = statsData.registriesByMonth || {};

                // Convertir keys de inglés a español si es necesario
                const monthsMap = {
                    'Jan': 'Ene', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Abr',
                    'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago',
                    'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dic'
                };

                const labels = Object.keys(registriesByMonth).map(label => {
                    // Si el formato es "Dec-2025", convertirlo
                    if (label.includes('-')) {
                        const [monthEng, year] = label.split('-');
                        const monthEsp = monthsMap[monthEng] || monthEng;
                        return `${monthEsp}-${year}`;
                    }
                    return label;
                });

                const values = Object.values(registriesByMonth);

                if (labels.length > 0 && values.length > 0) {
                    new Chart(registriesCtx, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Registros',
                                data: values,
                                borderColor: '#3498db',
                                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                                borderWidth: 2,
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                }
                            }
                        }
                    });
                } else {
                    document.getElementById('registriesChart').parentElement.innerHTML +=
                        '<p class="text-muted text-center mt-3">No hay datos de registros por mes</p>';
                }
            }

            // CREAR GRÁFICO DE DOCUMENTOS
            if (document.getElementById('documentsChart')) {
                const documentsCtx = document.getElementById('documentsChart').getContext('2d');
                const documentosPorTipo = statsData.documentos?.porTipo || {};

                // Mapear nombres de tipos a español
                const tipoMap = {
                    'C_MATRICULACION': 'C. Matriculación',
                    'SEGURO': 'Seguro',
                    'RTO': 'RTO',
                    'TACOGRAFO': 'Tacógrafo'
                };

                const labels = Object.keys(documentosPorTipo).map(key => tipoMap[key] || key);
                const values = Object.values(documentosPorTipo);
                const colors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f'];

                if (labels.length > 0 && values.length > 0) {
                    new Chart(documentsCtx, {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: values,
                                backgroundColor: colors.slice(0, labels.length),
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                legend: {
                                    position: 'right'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function (context) {
                                            return `${context.label}: ${context.parsed} documentos`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                } else {
                    document.getElementById('documentsChart').parentElement.innerHTML +=
                        '<p class="text-muted text-center mt-3">No hay documentos cargados</p>';
                }
            }

        } catch (error) {
            console.error('❌ Error en gráficos:', error);

            // Mostrar mensaje de error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger mt-3';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error al cargar gráficos: ${error.message}
            `;
            document.querySelector('.container-fluid').appendChild(errorDiv);
        }
    } else {
        console.error('❌ No se encontraron datos de estadísticas');

        // Mostrar mensaje de error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-warning mt-3';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle me-2"></i>
            No se pudieron cargar los datos de estadísticas
        `;
        document.querySelector('.container-fluid').appendChild(errorDiv);
    }
});
