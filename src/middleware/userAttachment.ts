// userAttachment.ts
import { Request, Response, NextFunction } from "express";
import { environment } from "../config/environments.js";
import { CookieHelper } from "../helpers/CookieHelper.js";
import { JWTManager } from "../helpers/TokenHelper.js";

// Crear una instancia de JWTManager como lo tenías originalmente
const jwtManager = new JWTManager(environment.token_secret_key);

export function attachUserData(req: Request, res: Response, next: NextFunction) {
    try {
        let token = CookieHelper.getCookie(req, 'auth');
        
        //console.log('🔍 [attachUserData] Token recibido:', token);

        if (!token || token === 'guest') {
            //console.log('⚠️ [attachUserData] Token es guest o no existe');
            res.locals.user = null;
            res.locals.isAuthenticated = false;
            return next();
        }

        // Usar la instancia jwtManager, no la clase JWTManager
        let decoded = jwtManager.decodeToken(token, true);
        
        if (decoded && decoded.payload) {
            res.locals.user = decoded.payload;
            res.locals.isAuthenticated = true;
            //console.log('✅ [attachUserData] Usuario establecido:', res.locals.user);
        } else {
            res.locals.user = null;
            res.locals.isAuthenticated = false;
            //console.log('⚠️ [attachUserData] No se pudo decodificar');
        }

    } catch (error: any) {
        //console.error('Error decodificando el token[userAttachment.ts]: ', error);
        
        // Si el token está expirado, también limpiar la cookie
        if (error.message.includes('jwt expired') || error.message.includes('TokenExpiredError')) {
            console.log('🔴 [attachUserData] Token expirado, limpiando cookie');
            res.clearCookie('auth');
        }
        
        res.locals.user = null;
        res.locals.isAuthenticated = false;
    }
    
    next();
}