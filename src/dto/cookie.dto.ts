    export interface CookieDto {
        maxAge?: number;
        expires?: Date;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite: 'strict' | 'lax' | 'none' | boolean;
    }