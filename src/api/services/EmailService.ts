import Mailjet from "node-mailjet";
import { mailJetConfig, validateMailJetConfig } from "../../config/mailjet.config.js";
import { EmailOptions, EmailResponse } from "../../dto/email.dto.js";

export class EmailService {
    private mailjet: ReturnType<typeof Mailjet.Client.apiConnect>;

    constructor() {
        // traemos la configuracion
        validateMailJetConfig();

        // En la versión 6.x se usa Client.apiConnect
        this.mailjet = Mailjet.Client.apiConnect(
            mailJetConfig.apiKey,
            mailJetConfig.secretKey
        );
    }

    async sendEmail(options: EmailOptions): Promise<EmailResponse> {
        try {
            const { to, toName, subject, text, html } = options;

            // Construir el contenido del mensaje
            const messageContent: any = {};

            if (text) {
                messageContent.TextPart = text;
            }

            if (html) {
                messageContent.HTMLPart = html;
            }

            const result: any = await this.mailjet
                .post("send", { version: "v3.1" })
                .request({
                    Messages: [
                        {
                            From: {
                                Email: mailJetConfig.fromEmail,
                                Name: mailJetConfig.fromName,
                            },
                            To: [
                                {
                                    Email: to,
                                    Name: toName || to,
                                },
                            ],
                            Subject: subject,
                            ...messageContent,
                        },
                    ],
                });

            // Simplemente retornamos éxito sin extraer el messageId
            return {
                success: true,
                messageId: "sent",
            };
        } catch (error: any) {
            console.error("Error sending email:", error);
            return {
                success: false,
                messageId: "",
                error: error.message || "Failed to send email",
            };
        }
    }
}

// Exportar una instancia única (singleton)
export const emailService = new EmailService();


/**
 * EJEMPLO DE USO
 */

/**
 * const emailResult = await emailService.sendEmail({
                to: email,
                toName: name,
                subject: "¡Bienvenido a nuestra plataforma!",
                text: `Hola ${name}, gracias por registrarte.`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>¡Bienvenido ${name}!</h2>
                        <p>Gracias por registrarte en nuestra plataforma.</p>
                        <p>Estamos emocionados de tenerte con nosotros.</p>
                    </div>
                `,
            });

            if (!emailResult.success) {
                console.error("Error al enviar email:", emailResult.error);
                // Puedes decidir si continuar o lanzar error
            }
 */