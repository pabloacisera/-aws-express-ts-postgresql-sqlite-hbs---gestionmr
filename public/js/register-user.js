import { toast } from './components/custom-toast.js';
import { POST } from './helpers/request.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');
    const submitButton = form.querySelector('button[type="submit"]');
    
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = decodeURIComponent(urlParams.get('redirect') || '/registers');

    form.addEventListener("submit", async(e) => {
        e.preventDefault();

        // Deshabilitar el botón
        submitButton.disabled = true;
        submitButton.textContent = 'Registrando...';

        try {
            const data = new FormData(form);

            let dataRegister = {
                name: data.get('name'), // ✅ Corregido: era 'username'
                email: data.get('email'),
                password: data.get('password'),
                confirmPassword: data.get('confirmPassword')
            };

            let result = await POST('/api/auth/register', dataRegister);

            // Mostrar notificación correctamente
            if (result.success && result.data) {
                toast.success('Éxito', result.data.message || 'Registro exitoso');
                
                console.log('Resultado de registro: ', result.data);
                
                // Redirigir después de un breve delay
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1500);

            } else {
                // Manejo de errores específicos
                console.error('Error en registro:', result.message);
                toast.error('Error', result.data?.message || result.message || 'Error al registrar');
                
                // Limpiar los campos de contraseña en caso de error
                form.querySelector('input[name="password"]').value = '';
                form.querySelector('input[name="confirmPassword"]').value = '';
            }

        } catch (error) {
            // Error inesperado
            console.error('Error crítico:', error);
            toast.error('Error', 'Ocurrió un error inesperado. Por favor, intenta nuevamente.');
        } finally {
            // Re-habilitar el botón
            submitButton.disabled = false;
            submitButton.textContent = 'Registrarse';
        }
    });
});