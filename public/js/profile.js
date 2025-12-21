// profile.js - Funcionalidad JavaScript para el formulario de perfil

const profileJS = {
    // Datos originales del formulario
    originalFormData: null,
    
    // Inicializar
    init: function() {
        if (!document.getElementById('user-data-json')) {
            console.log('No hay datos de usuario para inicializar');
            return;
        }
        
        try {
            // Guardar datos originales
            this.saveOriginalData();
            
            // Configurar eventos
            this.setupEventListeners();
            
            // Inicializar contador de biografía
            this.initBioCounter();
            
            console.log('Profile JS inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando profile.js:', error);
        }
    },
    
    // Guardar datos originales del formulario
    saveOriginalData: function() {
        this.originalFormData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone')?.value || '',
            bio: document.getElementById('bio').value
        };
    },
    
    // Configurar event listeners
    setupEventListeners: function() {
        const profileForm = document.getElementById('profileForm');
        const avatarInput = document.getElementById('avatarInput');
        
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
        
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => this.handleAvatarChange(e));
        }
        
        // Validación en tiempo real
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        
        if (nameInput) {
            nameInput.addEventListener('input', () => this.validateName());
        }
        
        if (emailInput) {
            emailInput.addEventListener('input', () => this.validateEmail());
        }
    },
    
    // Inicializar contador de biografía
    initBioCounter: function() {
        const bioTextarea = document.getElementById('bio');
        const bioCounter = document.getElementById('bioCounter');
        
        if (!bioTextarea || !bioCounter) return;
        
        const updateCounter = () => {
            const length = bioTextarea.value.length;
            bioCounter.textContent = length;
            
            if (length > 250) {
                bioCounter.classList.add('text-danger');
                bioTextarea.classList.add('is-invalid');
            } else {
                bioCounter.classList.remove('text-danger');
                bioTextarea.classList.remove('is-invalid');
            }
        };
        
        bioTextarea.addEventListener('input', updateCounter);
        updateCounter(); // Contador inicial
    },
    
    // Manejar envío del formulario
    handleFormSubmit: function(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }
        
        // Mostrar estado de carga
        this.showLoading(true);
        
        // Enviar formulario
        e.target.submit();
    },
    
    // Validar formulario completo
    validateForm: function() {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const bio = document.getElementById('bio').value;
        
        // Validar nombre
        if (!name || name.length < 2) {
            this.showAlert('Por favor, ingresa un nombre válido (mínimo 2 caracteres)', 'danger');
            document.getElementById('name').focus();
            return false;
        }
        
        // Validar email
        if (!this.isValidEmail(email)) {
            this.showAlert('Por favor, ingresa un email válido', 'danger');
            document.getElementById('email').focus();
            return false;
        }
        
        // Validar biografía
        if (bio.length > 250) {
            this.showAlert('La biografía no puede superar los 250 caracteres', 'danger');
            document.getElementById('bio').focus();
            return false;
        }
        
        return true;
    },
    
    // Validar nombre
    validateName: function() {
        const nameInput = document.getElementById('name');
        const name = nameInput.value.trim();
        
        if (name.length < 2 && name.length > 0) {
            nameInput.classList.add('is-invalid');
        } else {
            nameInput.classList.remove('is-invalid');
        }
    },
    
    // Validar email
    validateEmail: function() {
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim();
        
        if (email && !this.isValidEmail(email)) {
            emailInput.classList.add('is-invalid');
        } else {
            emailInput.classList.remove('is-invalid');
        }
    },
    
    // Validar formato de email
    isValidEmail: function(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Abrir selector de avatar
    openAvatarPicker: function() {
        document.getElementById('avatarInput').click();
    },
    
    // Manejar cambio de avatar
    handleAvatarChange: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            this.showAlert('La imagen no debe superar los 5MB', 'warning');
            return;
        }
        
        // Validar tipo de archivo
        if (!file.type.match('image.*')) {
            this.showAlert('Por favor, selecciona una imagen válida', 'warning');
            return;
        }
        
        // Mostrar preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview) {
                avatarPreview.src = e.target.result;
                this.showAlert('Imagen cargada correctamente. Recuerda guardar los cambios.', 'success');
            }
        };
        reader.readAsDataURL(file);
    },
    
    // Restaurar formulario a valores originales
    resetForm: function() {
        if (!this.originalFormData) {
            this.showAlert('No hay datos originales para restaurar', 'info');
            return;
        }
        
        document.getElementById('name').value = this.originalFormData.name;
        document.getElementById('email').value = this.originalFormData.email;
        
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.value = this.originalFormData.phone;
        }
        
        const bioTextarea = document.getElementById('bio');
        if (bioTextarea) {
            bioTextarea.value = this.originalFormData.bio;
            bioTextarea.dispatchEvent(new Event('input'));
        }
        
        // Restaurar avatar original
        const userData = this.getUserData();
        if (userData && userData.avatar) {
            const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview) {
                avatarPreview.src = userData.avatar;
            }
        }
        
        this.showAlert('Formulario restaurado a los valores originales', 'info');
    },
    
    // Obtener datos del usuario desde JSON
    getUserData: function() {
        try {
            const userDataElement = document.getElementById('user-data-json');
            if (userDataElement && userDataElement.value) {
                return JSON.parse(userDataElement.value);
            }
        } catch (error) {
            console.error('Error parseando datos de usuario:', error);
        }
        return null;
    },
    
    // Mostrar alerta
    showAlert: function(message, type = 'info') {
        // Icono según el tipo
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'danger' || type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        // Crear alerta
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            <i class="fas fa-${icon} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        `;
        
        // Insertar en el DOM
        const cardBody = document.querySelector('.card-body');
        if (cardBody) {
            // Remover alertas existentes
            const existingAlerts = cardBody.querySelectorAll('.alert-dismissible');
            existingAlerts.forEach(alert => alert.remove());
            
            // Insertar nueva alerta
            const firstChild = cardBody.firstChild;
            if (firstChild) {
                cardBody.insertBefore(alertDiv, firstChild);
            } else {
                cardBody.appendChild(alertDiv);
            }
            
            // Auto-ocultar después de 5 segundos
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                    bsAlert.close();
                }
            }, 5000);
        }
    },
    
    // Mostrar/ocultar estado de carga
    showLoading: function(show) {
        const submitBtn = document.querySelector('#profileForm button[type="submit"]');
        const form = document.getElementById('profileForm');
        
        if (show) {
            form.classList.add('loading');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Guardando...';
            submitBtn.disabled = true;
        } else {
            form.classList.remove('loading');
            submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar cambios';
            submitBtn.disabled = false;
        }
    },
    
    // Verificar si hay cambios sin guardar
    hasUnsavedChanges: function() {
        if (!this.originalFormData) return false;
        
        const currentName = document.getElementById('name').value;
        const currentEmail = document.getElementById('email').value;
        const currentBio = document.getElementById('bio').value;
        
        return currentName !== this.originalFormData.name ||
               currentEmail !== this.originalFormData.email ||
               currentBio !== this.originalFormData.bio;
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    profileJS.init();
    
    // Advertencia antes de abandonar la página si hay cambios sin guardar
    window.addEventListener('beforeunload', function(e) {
        if (profileJS.hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = 'Tienes cambios sin guardar. ¿Seguro que quieres abandonar la página?';
        }
    });
});

// Hacer funciones disponibles globalmente
window.profileJS = profileJS;