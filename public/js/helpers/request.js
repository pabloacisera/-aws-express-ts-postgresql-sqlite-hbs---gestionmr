/**
 * Helper para realizar peticiones HTTP
 * Retorna un objeto estructurado para manejo consistente de respuestas
 */

/**
 * Realiza una petición POST
 * @param {string} url - URL del endpoint
 * @param {Object} data - Datos a enviar
 * @returns {Promise<Object>} Objeto con { success, status, message, data }
 */
export async function POST(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        // Intentar parsear el JSON de la respuesta
        let responseData = null;
        try {
            responseData = await response.json();
        } catch (jsonError) {
            // Si no se puede parsear, usar null
            responseData = { message: response.statusText };
        }

        // Estructura de respuesta consistente
        const result = {
            success: response.ok,
            status: response.status,
            message: responseData?.message || response.statusText,
            data: responseData
        };

        return result;

    } catch (error) {
        // Error de red o error inesperado
        return {
            success: false,
            status: 0,
            message: error.message || 'Error de conexión con el servidor',
            data: null
        };
    }
}

/**
 * Realiza una petición GET
 * @param {string} url - URL del endpoint
 * @returns {Promise<Object>} Objeto con { success, status, message, data }
 */
export async function GET(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        let responseData = null;
        try {
            responseData = await response.json();
        } catch (jsonError) {
            responseData = { message: response.statusText };
        }

        const result = {
            success: response.ok,
            status: response.status,
            message: responseData?.message || response.statusText,
            data: responseData
        };

        return result;

    } catch (error) {
        return {
            success: false,
            status: 0,
            message: error.message || 'Error de conexión con el servidor',
            data: null
        };
    }
}

/**
 * Realiza una petición PUT
 * @param {string} url - URL del endpoint
 * @param {Object} data - Datos a enviar
 * @returns {Promise<Object>} Objeto con { success, status, message, data }
 */
export async function PUT(url, data) {
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        let responseData = null;
        try {
            responseData = await response.json();
        } catch (jsonError) {
            responseData = { message: response.statusText };
        }

        const result = {
            success: response.ok,
            status: response.status,
            message: responseData?.message || response.statusText,
            data: responseData
        };

        return result;

    } catch (error) {
        return {
            success: false,
            status: 0,
            message: error.message || 'Error de conexión con el servidor',
            data: null
        };
    }
}

/**
 * Realiza una petición DELETE
 * @param {string} url - URL del endpoint
 * @returns {Promise<Object>} Objeto con { success, status, message, data }
 */
export async function DELETE(url) {
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        let responseData = null;
        try {
            responseData = await response.json();
        } catch (jsonError) {
            responseData = { message: response.statusText };
        }

        const result = {
            success: response.ok,
            status: response.status,
            message: responseData?.message || response.statusText,
            data: responseData
        };

        return result;

    } catch (error) {
        return {
            success: false,
            status: 0,
            message: error.message || 'Error de conexión con el servidor',
            data: null
        };
    }
}