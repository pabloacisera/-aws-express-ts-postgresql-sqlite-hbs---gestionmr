// AuthController.ts

import { type Request, type Response } from 'express';
import { AuthService } from "../services/AuthService.js";
import { AuthError } from "../../dto/auth.dto.js";
import { CookieHelper } from '../../helpers/CookieHelper.js';
import { environment } from '../../config/environments.js';
import { JWTManager } from '../../helpers/TokenHelper.js';

export class AuthController {
    /**
     * Controlador de login
     */
    static async loginController(req: Request, res: Response): Promise<void> {
        try {
            // Llamar al servicio
            const result = await AuthService.loginService(req.body);
            
            /**
             * ✅ GENERAR LA COOKIE - SOLO EL TOKEN
             */
            CookieHelper.setCookie(res, 'auth', result.token, {
                httpOnly: true,
                secure: environment.node_env === 'production',
                maxAge: req.body.remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
                sameSite: 'lax'
            });
            
            // ✅ Respuesta exitosa con estructura consistente
            res.status(200).json({
                status: 200,
                ...result
            });

        } catch (error: any) {
            console.error('Error en login:', error);

            if (error instanceof AuthError) {
                res.status(error.statusCode).json({
                    success: false,
                    status: error.statusCode,
                    message: error.message,
                    error: error.type
                });
                return;
            }

            res.status(500).json({
                success: false,
                status: 500,
                message: 'Error interno del servidor',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Controlador de registro
     */
    static async registerController(req: Request, res: Response): Promise<void> {
        try {
            const result = await AuthService.registerService(req.body);
            
            // IMPORTANTE: NO crear cookie de sesión aquí
            // Solo registrar, la activación viene por email
            
            // Redirigir a página de activación pendiente
            res.status(201).json({
                status: 201,
                ...result,
                redirectTo: `/activation-pending?email=${req.body.email}`
            });

        } catch (error: any) {
            console.error('Error en registro:', error);

            if (error instanceof AuthError) {
                res.status(error.statusCode).json({
                    success: false,
                    status: error.statusCode,
                    message: error.message,
                    error: error.type
                });
                return;
            }

            res.status(500).json({
                success: false,
                status: 500,
                message: 'Error interno del servidor',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Controlador de logout
     */
    static async logoutController(req: Request, res: Response): Promise<void> {
        try {
            /**
             * ELIMINAR LA COOKIE
             */
            CookieHelper.deleteCookie(res, 'auth');
            
            res.redirect('/');

        } catch (error: any) {
            console.error('Error en logout:', error);
            
            res.status(500).json({
                success: false,
                status: 500,
                message: 'Error al cerrar sesión',
                error: 'SERVER_ERROR'
            });
        }
    }

    /**
     * Controlador para activar cuenta desde enlace de email
     */
    static async activateAccount(req: Request, res: Response) {
        try {
            const { token } = req.params;

            if (!token) {
                return res.status(400).render('activation_result', {
                    success: false,
                    message: 'Token de activación no proporcionado'
                });
            }

            const result = await AuthService.activateAccount(token);

            if (result.success && result.user) {
                // Crear un token de sesión para el usuario recién activado
                const jwtManager = new JWTManager(environment.token_secret_key);
                const sessionToken = jwtManager.createToken({
                    id: result.user.id,
                    email: result.user.email,
                    name: result.user.name
                }, '24h');

                // Establecer la cookie de autenticación
                CookieHelper.setCookie(res, 'auth', sessionToken, {
                    httpOnly: true,
                    secure: environment.node_env === 'production',
                    maxAge: 24 * 60 * 60 * 1000, // 24 horas
                    sameSite: 'strict'
                });

                // Redirigir a home con mensaje de éxito
                return res.redirect('/?activated=true');
            } else {
                return res.status(400).render('activation_result', {
                    success: false,
                    message: result.message
                });
            }

        } catch (error: any) {
            console.error('Error en activateAccount controller:', error);

            let errorMessage = 'Error al activar la cuenta';
            let statusCode = 500;

            if (error.message.includes('Token de activación')) {
                errorMessage = error.message;
                statusCode = 400;
            } else if (error.message.includes('Usuario no encontrado')) {
                errorMessage = error.message;
                statusCode = 404;
            } else if (error instanceof AuthError) {
                errorMessage = error.message;
                statusCode = error.statusCode;
            }

            return res.status(statusCode).render('activation_result', {
                success: false,
                message: errorMessage
            });
        }
    }

    /**
     * Controlador para reenviar enlace de activación
     */
    static async resendActivationLink(req: Request, res: Response) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email es requerido'
                });
            }

            const result = await AuthService.resendActivationLink(email);

            return res.status(200).json(result);

        } catch (error: any) {
            console.error('Error en resendActivationLink controller:', error);

            let errorMessage = 'Error al reenviar el enlace de activación';
            let statusCode = 500;

            if (error.message.includes('Usuario no encontrado')) {
                errorMessage = error.message;
                statusCode = 404;
            } else if (error.message.includes('La cuenta ya está activa')) {
                errorMessage = error.message;
                statusCode = 400;
            } else if (error instanceof AuthError) {
                errorMessage = error.message;
                statusCode = error.statusCode;
            }

            return res.status(statusCode).json({
                success: false,
                message: errorMessage
            });
        }
    }

    /**
     * Mostrar página para solicitar reenvío de enlace
     */
    static showResendPage(req: Request, res: Response) {
        const { email } = req.query;
        res.render('resend_activation', { 
            email: email || '',
            message: '' 
        });
    }

    /**
     * Mostrar página de activación exitosa
     */
    static showActivationSuccess(req: Request, res: Response) {
        const { name } = req.query;
        res.render('activation_success', { 
            name: name || 'Usuario',
            message: '¡Tu cuenta ha sido activada exitosamente!' 
        });
    }

    /**
     * Mostrar página de activación pendiente
     */
    static showActivationPending(req: Request, res: Response) {
        const { email } = req.query;
        res.render('activation_pending', { 
            email: email || '',
            message: 'Por favor, verifica tu correo electrónico para activar tu cuenta.' 
        });
    }
}