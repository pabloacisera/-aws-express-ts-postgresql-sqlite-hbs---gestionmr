import { Router } from "express";
import { AuthController } from "./controllers/AuthController.js";
import { RegisterController } from "./controllers/RegisterController.js";
import { PdfController } from "./controllers/PdfController.js";
import { upload } from "../config/multer.config.js";
import { CertificateController } from "./controllers/DocumentController.js";
import { recoveryController } from "./controllers/RecoveryController.js";
import { statsDetailController } from "./controllers/StatsDetailController.js";

const r = Router();

const certificateController = new CertificateController();

const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "El archivo es demasiado grande. Tamaño máximo: 10MB",
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message || "Error al subir el archivo",
    });
  }
  next();
};

// ============ RUTAS DE AUTENTICACIÓN ============
r.post("/auth/login", (req, res) => {
  AuthController.loginController(req, res);
});

r.post("/auth/register", (req, res) => {
  AuthController.registerController(req, res);
});

r.get("/logout", (req, res) => {
  AuthController.logoutController(req, res);
});

// ============ RUTAS DE SUBIDA DE CERTIFICADOS ============
r.post(
  "/upload/cert",
  upload.single("certificateFile"),
  handleMulterError,
  certificateController.upload,
);

// ============ RUTAS DE CONSULTA DE CERTIFICADOS ============
// Obtener certificado por ID
r.get("/cert/:id", certificateController.getById);

// Obtener certificado por tipo y control
r.get(
  "/cert/:controlId/type/:certificateType",
  certificateController.getByType,
);

// Obtener todos los certificados de un control
r.get("/cert/:controlId/all", certificateController.getAllByControlId);

// Obtener estado de certificados de un control
r.get("/cert/:controlId/status", certificateController.getStatus);

// ============ RUTAS DE DESCARGA Y VISUALIZACIÓN ============
// Descargar archivo
r.get("/cert/:id/download", certificateController.download);

// Previsualizar archivo (solo imágenes y PDFs) - DEBE IR ANTES DE LAS RUTAS CON PATRONES SIMILARES
r.get("/cert/:id/preview", certificateController.preview);

// ============ RUTAS DE ELIMINACIÓN ============
// Eliminar certificado por ID
r.delete("/cert/:id", certificateController.delete);

// Eliminar certificado por tipo
r.delete(
  "/cert/:controlId/type/:certificateType",
  certificateController.deleteByType,
);

// ============ RUTAS DE REGISTROS ============
// Obtener todos los registros (paginados)
r.get("/registers-control", (req, res) => {
  RegisterController.getAllRegisters(req, res);
});

// Crear nuevo registro
r.post("/registers-control/new", (req, res) => {
  RegisterController.createRegister(req, res);
});

// Obtener registro por ID
r.get("/registers-control/:id", (req, res) => {
  RegisterController.getRegistryById(req, res);
});

// Obtener números de certificado por ID de control
r.get("/registers/:id/certificates", (req, res) => {
  RegisterController.getCertificateNumbers(req, res);
});

// Generar PDF del registro - ESTA RUTA VA AL FINAL PARA NO INTERFERIR
r.get("/registers-control/pdf/:id", (req, res) => {
  PdfController.downloadRegistryPDF(req, res);
});

r.delete("/registers-control/:controlId", (req, res) => {
  RegisterController.deleteRegistry(req, res);
});

// En router.ts, cambiar todas las referencias de ActivationController a AuthController:

// ============ RUTAS DE ACTIVACIÓN DE CUENTA ============
// Activar cuenta desde enlace de email
r.get("/activate-account/:token", (req, res) => {
  AuthController.activateAccount(req, res);
});

// Mostrar página para reenviar enlace de activación
r.get("/resend-activation", (req, res) => {
  AuthController.showResendPage(req, res);
});

// Mostrar página de activación exitosa
r.get("/activation-success", (req, res) => {
  AuthController.showActivationSuccess(req, res);
});

// Mostrar página de activación pendiente
r.get("/activation-pending", (req, res) => {
  AuthController.showActivationPending(req, res);
});

// Reenviar enlace de activación (API)
r.post("/resend-activation", (req, res) => {
  AuthController.resendActivationLink(req, res);
});

// Solicitar recuperación (API)
r.post("/auth/password-recovery", (req, res) => {
  recoveryController.passwordRecovery(req, res);
});

// Resetear contraseña con token (API)
r.post("/auth/reset-password", (req, res) => {
  recoveryController.resetPasswordController(req, res);
});

r.get(
  "/stats/detail/vencimiento/:tipo/:estado",
  statsDetailController.renderVencimientoDetail,
);

// Detalle de documentos por tipo
r.get(
  "/stats/detail/documentos/:tipo",
  statsDetailController.renderDocumentosDetail,
);

// Detalle por empresa
r.get("/stats/detail/empresas", statsDetailController.renderEmpresasDetail);

// Detalle por lugar
r.get("/stats/detail/lugares", statsDetailController.renderLugaresDetail);

// API endpoints (para AJAX si es necesario)
r.get(
  "/stats/detail/vencimiento/:tipo/:estado",
  statsDetailController.getVencimientoDetailApi,
);

r.get("/doc-register/:controlId", (req, res) => {
  // Esta ruta renderiza la vista doc_register.hbs con el controlId
  const { controlId } = req.params;
  const { tipo, estado } = req.query;
  
  // Redirigir al controlador existente que renderiza doc_register.hbs
  // NOTA: Asumo que tienes un controlador que maneja /doc-register/:id
  // Si no existe, necesitarás crearlo o usar RegisterController.getRegistryById
  res.redirect(`/registers-control/${controlId}?tipo=${tipo || ''}&estado=${estado || ''}`);
});

export default r;
