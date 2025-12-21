// auth.dto.ts o auth.interface.ts

interface authUser {
    id: number;
    name: string | null;
    email: string;
    isActive: boolean; // NUEVO
    createdAt: Date;
    updatedAt: Date;
}

interface Token {
    token: string;
}

export interface authResponseDto {
    success: boolean;
    message?: string;
    token: string;
    user: {
        id: number;
        name: string;
        email: string;
    };
}

export interface authRequestDto {
    username: string;
    password: string;
    remember?: boolean;
}

export interface ErrorResponse {
    success: false;
    status: number;
    message: string;
    error?: string;
}

// ✅ ACTUALIZADO: Agregar nuevos tipos de error
export enum AuthErrorType {
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    INVALID_PASSWORD = 'INVALID_PASSWORD',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    MISSING_FIELDS = 'MISSING_FIELDS',
    SERVER_ERROR = 'SERVER_ERROR',
    ACCOUNT_NOT_ACTIVE = 'ACCOUNT_NOT_ACTIVE', // NUEVO
    INVALID_TOKEN = 'INVALID_TOKEN' // NUEVO
}

export class AuthError extends Error {
    constructor(
        public type: AuthErrorType,
        public statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'AuthError';
    }
}

// ✅ NUEVOS DTOs para activación
export interface ActivationResponseDto {
    success: boolean;
    message: string;
    user?: {
        id: number;
        email: string;
        name: string;
    };
}

export interface ResendActivationRequestDto {
    email: string;
}

export interface ResendActivationResponseDto {
    success: boolean;
    message: string;
}

export interface DecodedTokenDto {
    id: number;
    email: string;
    name: string;
    createdAt: Date;
    iat?: number;
    exp?: number;
}