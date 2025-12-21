document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.btn-search-action');
    const searchCategory = document.querySelector('.search-category');
    
    // Solo inicializar si estamos en la página de registros
    /*if (!searchInput || !searchButton || !window.location.pathname.includes('/registers')) {
        return;
    }*/
    
    // Función para realizar la búsqueda
    function performSearch() {
        const searchTerm = searchInput.value.trim();
        const field = searchCategory ? searchCategory.value : 'all';
        
        // Si no hay término de búsqueda, redirigir a la vista normal
        if (!searchTerm) {
            window.location.href = '/registers';
            return;
        }
        
        // Construir la URL de búsqueda con los parámetros
        const url = `/api/registers/search?q=${encodeURIComponent(searchTerm)}&field=${field}`;
        
        // Navegar a la página de resultados de búsqueda
        window.location.href = url;
    }
    
    // Evento para el botón de búsqueda
    searchButton.addEventListener('click', performSearch);
    
    // Evento para presionar Enter en el input
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Cargar los valores de búsqueda si ya estaban buscando
    // (útil si el usuario refresca la página)
    const urlParams = new URLSearchParams(window.location.search);
    const searchTermFromUrl = urlParams.get('q');
    const searchFieldFromUrl = urlParams.get('field');
    
    if (searchTermFromUrl && searchInput) {
        searchInput.value = decodeURIComponent(searchTermFromUrl);
    }
    
    if (searchFieldFromUrl && searchCategory) {
        searchCategory.value = searchFieldFromUrl;
    }
});