import { timeStamp } from "console";
import { environment } from "../../config/environments.js";
import prisma from "../../config/prisma.client.js";
import { JWTManager } from "../../helpers/TokenHelper.js";
import { emailService } from "./EmailService.js";
import bcrypt from "bcrypt";

export class RecoveryService {
    private jwtManager: JWTManager;

    constructor() {
        this.jwtManager = new JWTManager(environment.token_secret_key);
    }

    public async sendEmail(name: string, email: string, resetLink: string) {
        return await emailService.sendEmail({
            to: email,
            toName: name,
            subject: "Recuperación de Contraseña - Sistema de Control",
            html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Recuperación de Contraseña</h2>
                        <p>Hola <strong>${name || 'usuario'}</strong>,</p>
                        <p>Hemos recibido una solicitud para restablecer tu contraseña en el Sistema de Control.</p>
                        <p>Para continuar con el proceso, haz clic en el siguiente enlace:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" 
                               style="background-color: #007bff; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold;">
                                Restablecer Contraseña
                            </a>
                        </div>
                        <p style="color: #666; font-size: 14px;">
                            <strong>Nota:</strong> Este enlace expirará en 15 minutos por motivos de seguridad.
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            Si no solicitaste este cambio, puedes ignorar este mensaje. Tu cuenta permanecerá segura.
                        </p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px;">
                            Sistema de Control de Certificados<br>
                            Este es un mensaje automático, por favor no responder.
                        </p>
                    </div>
                `,
            text: `Para restablecer tu contraseña del Sistema de Control, visita: ${resetLink}\n\nEste enlace expira en 15 minutos.`
        });

    }


    private async comparePasswords(inputPassword: string, hashedPassword: string): Promise<boolean> {
        // Implementa la comparación de contraseñas (usando bcrypt, etc.)
        // return await bcrypt.compare(inputPassword, hashedPassword);
        return true; // Placeholder
    }

    public async verifyAndSendEmail(email: string): Promise<{ success: boolean, error?: string, token?: string }> {
        try {
            // buscar por id
            const emailExists = await prisma.user.findUnique({
                where: { email },
                select: {
                    id: true, email: true, name: true
                }
            })

            if (!emailExists) {
                return {
                    success: false,
                    error: "Email no corresponde a una cuenta activa"
                }
            }

            // crear token temporal
            const tempTokenPayload = {
                userId: emailExists.id,
                type: "reset-password",
                timestamp: Date.now()

            }

            const tempToken = this.jwtManager.createToken(tempTokenPayload, '15m')

            // crear enlace
            const resetLink = `${environment.base_url}/reset-password/${tempToken}`

            const emailResult = this.sendEmail(emailExists.name as string, emailExists.email, resetLink)

            if (!(await emailResult).success) {
                return {
                    success: false,
                    error: "Error al enviar el correo electrónico"
                };
            }

            return {
                success: true,
                token: tempToken // Token solo para debug/logs
            };

        } catch (error) {
            console.error("Error en verifyAndSendResetEmail:", error);
            return {
                success: false,
                error: "Error interno del servidor"
            };
        }
    }


    // verificar el token temporal
    public verifyResetToken(token: string): { valid: boolean, userId?: number, email?: string, error?: string } {
        try {
            const decoded = this.jwtManager.decodeToken(token, true);

            if (!decoded) {
                return {
                    valid: false,
                    error: "Token inválido"
                }
            }

            if (decoded.payload.type !== "reset-password") {
                return {
                    valid: false,
                    error: "Tipo de token incorrecto"
                }
            }

            return {
                valid: true,
                userId: decoded.payload.userId,
                email: decoded.payload.email
            }
        } catch (error: any) {
            return {
                valid: false,
                error: error.message.includes('expired')
                    ? "El enlace ha expirado"
                    : "Token inválido"
            };
        }
    }


    // actualizar contraseña
    public async updatePassword(userId: number, newPassword: string): Promise<{ success: boolean, error?: string }> {
        try {
            if (newPassword.length < 6) {
                return {
                    success: false,
                    error: "La contraseña debe tener al menos 6 carácteres"
                }
            }

            // hashear nueva contraseña
            const hash = await bcrypt.hash(newPassword, 10);

            await prisma.user.update({
                where: { id: userId },
                data: {
                    password: hash,
                    updatedAt: new Date
                }
            });

            return { success: true }
        } catch (error) {
            console.error("Error en updatePassword:", error);
            return {
                success: false,
                error: "Error al actualizar la contraseña"
            };
        }
    }
}

export const recoveryService = new RecoveryService();