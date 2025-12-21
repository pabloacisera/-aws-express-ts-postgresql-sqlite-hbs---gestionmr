/**
 * Sistema de notificaciones Toast reutilizable con Bootstrap
 * Autor: Toast Notification System
 * Versión: 2.0.0
 */

class ToastNotification {
  constructor() {
    this.container = null;
    this.toastCounter = 0;
    this.init();
  }

  /**
   * Inicializa el contenedor de toasts
   */
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
      `;
      document.body.appendChild(this.container);
      this.injectStyles();
    }
  }

  /**
   * Inyecta los estilos CSS necesarios
   */
  injectStyles() {
    if (document.getElementById('toast-custom-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-custom-styles';
    style.textContent = `
      @keyframes fadeInSlide {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes fadeOutSlide {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }

      .toast-custom {
        animation: fadeInSlide 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .toast-custom.hiding {
        animation: fadeOutSlide 0.3s ease-in;
      }

      .toast-custom .toast-header {
        border-bottom: 2px solid rgba(0, 0, 0, 0.1);
      }

      .toast-custom.toast-info .toast-header {
        background-color: #d1ecf1;
        color: #0c5460;
        border-bottom-color: #bee5eb;
      }

      .toast-custom.toast-success .toast-header {
        background-color: #d4edda;
        color: #155724;
        border-bottom-color: #c3e6cb;
      }

      .toast-custom.toast-warning .toast-header {
        background-color: #fff3cd;
        color: #856404;
        border-bottom-color: #ffeeba;
      }

      .toast-custom.toast-error .toast-header {
        background-color: #f8d7da;
        color: #721c24;
        border-bottom-color: #f5c6cb;
      }

      .toast-custom.toast-secondary .toast-header {
        background-color: #e2e3e5;
        color: #383d41;
        border-bottom-color: #d6d8db;
      }

      .toast-custom.toast-primary .toast-header {
        background-color: #cfe2ff;
        color: #084298;
        border-bottom-color: #b6d4fe;
      }

      .toast-custom.toast-dark .toast-header {
        background-color: #d6d8d9;
        color: #1b1e21;
        border-bottom-color: #c6c8ca;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Mapea los tipos de toast a colores de Bootstrap
   */
  getTypeConfig(type) {
    const configs = {
      info: {
        class: 'toast-info',
        icon: 'ℹ️',
        bgClass: 'bg-info'
      },
      success: {
        class: 'toast-success',
        icon: '✓',
        bgClass: 'bg-success'
      },
      warning: {
        class: 'toast-warning',
        icon: '⚠',
        bgClass: 'bg-warning'
      },
      error: {
        class: 'toast-error',
        icon: '✕',
        bgClass: 'bg-danger'
      },
      secondary: {
        class: 'toast-secondary',
        icon: '◉',
        bgClass: 'bg-secondary'
      },
      primary: {
        class: 'toast-primary',
        icon: '●',
        bgClass: 'bg-primary'
      },
      dark: {
        class: 'toast-dark',
        icon: '■',
        bgClass: 'bg-dark'
      }
    };

    return configs[type] || configs.info;
  }

  /**
   * Muestra un toast
   * @param {Object} options - Opciones del toast
   * @param {string} options.header - Texto del header
   * @param {string} options.title - Título del toast
   * @param {string} options.body - Contenido del mensaje
   * @param {string} options.type - Tipo: info, success, warning, error, secondary, primary, dark
   * @param {number} options.duration - Duración en ms (default: 5000)
   * @param {string} options.icon - Icono personalizado (opcional)
   */
  show({
    header = 'Notificación',
    title = '',
    body = '',
    type = 'info',
    duration = 5000,
    icon = null
  }) {
    const toastId = `toast-${++this.toastCounter}`;
    const config = this.getTypeConfig(type);
    const displayIcon = icon || config.icon;

    const toastElement = document.createElement('div');
    toastElement.id = toastId;
    toastElement.className = `toast toast-custom ${config.class}`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');

    toastElement.innerHTML = `
      <div class="toast-header">
        <span class="me-2" style="font-size: 1.2rem;">${displayIcon}</span>
        <strong class="me-auto">${this.escapeHtml(title || header)}</strong>
        <small class="text-muted">${this.getTimeAgo()}</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${this.escapeHtml(body)}
      </div>
    `;

    this.container.appendChild(toastElement);

    // Inicializar el toast de Bootstrap si está disponible
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
      const bsToast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: duration
      });
      bsToast.show();

      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
    } else {
      // Fallback sin Bootstrap
      setTimeout(() => {
        this.hide(toastId);
      }, duration);

      const closeBtn = toastElement.querySelector('.btn-close');
      closeBtn.addEventListener('click', () => {
        this.hide(toastId);
      });
    }

    return toastId;
  }

  /**
   * Muestra un toast basado en una respuesta HTTP
   * @param {Object} response - Objeto de respuesta con status, message, data
   */
  fromResponse(response) {
    const { status, success, message, data } = response;
    
    let type = 'info';
    let title = 'Notificación';
    
    // Determinar el tipo basado en el status HTTP o success flag
    if (success === true || (status >= 200 && status < 300)) {
      type = 'success';
      title = 'Éxito';
    } else if (status === 400) {
      type = 'warning';
      title = 'Advertencia';
    } else if (status === 401 || status === 403) {
      type = 'error';
      title = 'Acceso Denegado';
    } else if (status === 404) {
      type = 'warning';
      title = 'No Encontrado';
    } else if (status >= 500) {
      type = 'error';
      title = 'Error del Servidor';
    } else if (success === false) {
      type = 'error';
      title = 'Error';
    }

    return this.show({
      title,
      body: message || 'Operación completada',
      type,
      duration: type === 'error' ? 7000 : 5000
    });
  }

  /**
   * Oculta un toast específico
   */
  hide(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
      toast.classList.add('hiding');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }

  /**
   * Escapa caracteres HTML para prevenir XSS
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Obtiene el tiempo actual en formato relativo
   */
  getTimeAgo() {
    return 'ahora';
  }

  /**
   * Métodos de conveniencia
   */
  info(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'info' });
  }

  success(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'success' });
  }

  warning(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'warning' });
  }

  error(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'error' });
  }

  secondary(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'secondary' });
  }

  primary(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'primary' });
  }

  dark(title, body, options = {}) {
    return this.show({ ...options, title, body, type: 'dark' });
  }
}

// Crear instancia global
const toast = new ToastNotification();

// Exportar para uso en módulos ES6
export { toast, ToastNotification };

// Exportar para CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toast, ToastNotification };
}

/* ============================================
   EJEMPLOS DE USO
   ============================================

// 1. Uso básico
toast.info('Sistema', 'Operación completada correctamente');

// 2. Con respuesta del backend
const response = {
  success: true,
  status: 200,
  message: 'Usuario autenticado correctamente'
};
toast.fromResponse(response);

// 3. Con error del backend
const errorResponse = {
  success: false,
  status: 400,
  message: 'Credenciales inválidas: Usuario no encontrado'
};
toast.fromResponse(errorResponse);

// 4. Métodos de conveniencia
toast.success('Éxito', 'Los datos se guardaron correctamente');
toast.error('Error', 'No se pudo conectar con el servidor');
toast.warning('Advertencia', 'El espacio en disco es bajo');

// 5. Con opciones personalizadas
toast.show({
  title: 'Notificación',
  body: 'Este es un mensaje personalizado',
  type: 'warning',
  duration: 3000,
  icon: '🔔'
});

*/