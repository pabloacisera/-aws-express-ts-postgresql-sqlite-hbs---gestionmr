import { type Response, type Request } from "express";
import type { CookieDto } from "../dto/cookie.dto.js";

export class CookieHelper {

    static getCookie(req: Request, name: string): string {
        return req.cookies[name] || 'guest'
    }

    static deleteCookie(res: Response, name: string): boolean {
        res.clearCookie(name);
        return true;
    }

    static setCookie(res: Response, name: string, value: string, options?: CookieDto): void {
        res.cookie( name, value, options as any );
    }
}