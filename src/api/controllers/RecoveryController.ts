import { recoveryService } from "../services/RecoveryService.js";
import { Request, Response } from "express";

class RecoveryController {
    public async passwordRecovery(req: Request, res: Response) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: "El email es requerido"
                })
            }

            const result = await recoveryService.verifyAndSendEmail(email);

            if (result.success) {
                res.json({
                    success: true,
                    message: "Email valido"
                })
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                })
            }
        } catch (error) {
            console.error("Error en passwordRecoveryController:", error);
            res.status(500).json({
                success: false,
                error: "Error interno del servidor"
            });
        }
    }

    // GET /reset-password/:token
    public async showResetPasswordForm(req: Request, res: Response) {
        try {
            const { token } = req.params;

            if (!token) {
                return res.render("error", {
                    error: "Token no proporcionado"
                });
            }

            // Verificar token
            const verification = recoveryService.verifyResetToken(token);

            if (!verification.valid) {
                return res.render("error", {
                    error: verification.error || "Enlace inválido o expirado"
                });
            }

            // Renderizar formulario con token en hidden input
            res.render("reset_password", {
                token: token,
                email: verification.email
            });

        } catch (error) {
            console.error("Error en showResetPasswordForm:", error);
            res.render("error", {
                error: "Error al cargar la página"
            });
        }
    }

    
    // POST /api/auth/reset-password
    public async resetPasswordController(req: Request, res: Response) {
        try {
            const { token, newPassword, confirmPassword } = req.body;

            if (!token || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: "Todos los campos son requeridos"
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: "Las contraseñas no coinciden"
                });
            }

            // Verificar token
            const verification = recoveryService.verifyResetToken(token);

            if (!verification.valid || !verification.userId) {
                return res.status(401).json({
                    success: false,
                    error: verification.error || "Token inválido"
                });
            }

            // Actualizar contraseña
            const result = await recoveryService.updatePassword(
                verification.userId,
                newPassword
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: "Contraseña actualizada correctamente"
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }

        } catch (error) {
            console.error("Error en resetPasswordController:", error);
            res.status(500).json({
                success: false,
                error: "Error al actualizar la contraseña"
            });
        }
    }

    
}

export const recoveryController = new RecoveryController();