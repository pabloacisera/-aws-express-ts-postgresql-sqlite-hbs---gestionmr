export interface TokenPayload {
    [key: string]:any
}

export interface DecodeToken {
    payload: TokenPayload,
    header: any,
    signature: string
}

export interface JWTPayload {
    id: number;
    name: string | null;
    email: string;
    createdAt: Date;
}