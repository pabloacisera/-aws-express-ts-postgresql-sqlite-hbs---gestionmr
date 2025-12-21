import { POST } from './helpers/request.js';
import { toast } from './components/custom-toast.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const rememberMeCheckbox = document.querySelector('input[name="rememberMe"]');
    const submitButton = form.querySelector('button[type="submit"]');

    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = decodeURIComponent(urlParams.get('redirect') || '/registers');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Deshabilitar el botón para evitar múltiples envíos
        submitButton.disabled = true;
        submitButton.textContent = 'Iniciando sesión...';

        try {
            // Obtener datos del formulario
            const formData = new FormData(form);

            const userData = {
                username: formData.get('emailOrUsername'),
                password: formData.get('password'),
                remember: rememberMeCheckbox?.checked || false
            };

            // Realizar la petición
            const result = await POST('/api/auth/login', userData);

            // Mostrar notificación basada en la respuesta
            // result.data contiene la respuesta real del servidor
            if (result.success && result.data) {
                toast.success('Éxito', result.data.message || 'Inicio de sesión exitoso');
                
                console.log('Login exitoso:', result.data);
                
                // Guardar token si existe
                if (result.data.token) {
                    if (userData.remember) {
                        localStorage.setItem('authToken', result.data.token);
                    } else {
                        sessionStorage.setItem('authToken', result.data.token);
                    }
                }

                // Redirigir después de un breve delay para que se vea el toast
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1500);

            } else {
                // Manejo de errores específicos
                console.error('Error en login:', result.message);
                toast.error('Error', result.data?.message || result.message || 'Error al iniciar sesión');
                
                // Limpiar el campo de contraseña en caso de error
                form.querySelector('input[name="password"]').value = '';
            }

        } catch (error) {
            // Error inesperado
            console.error('Error crítico:', error);
            toast.error('Error', 'Ocurrió un error inesperado. Por favor, intenta nuevamente.');
        } finally {
            // Re-habilitar el botón
            submitButton.disabled = false;
            submitButton.textContent = 'Ingresar';
        }
    });

    // Opcional: Validación en tiempo real
    const emailInput = form.querySelector('input[name="emailOrUsername"]');
    const passwordInput = form.querySelector('input[name="password"]');

    emailInput?.addEventListener('input', () => {
        if (emailInput.value.trim()) {
            emailInput.classList.remove('is-invalid');
        }
    });

    passwordInput?.addEventListener('input', () => {
        if (passwordInput.value.trim()) {
            passwordInput.classList.remove('is-invalid');
        }
    });
});