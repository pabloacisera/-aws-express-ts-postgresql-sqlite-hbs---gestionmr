// authValidation.ts
import type { Request, Response, NextFunction } from "express";

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    // Verificar si el usuario está autenticado según attachUserData
    if (!res.locals.isAuthenticated || !res.locals.user) {
        return res.render('not_authenticated', {
            redirect: encodeURIComponent(req.originalUrl)
        });
    }

    next();
};