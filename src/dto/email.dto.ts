export interface EmailOptions {
    to: string;
    toName?: string | undefined;
    subject: string;
    text?: string | undefined;
    html?: string | undefined;
}

export interface EmailResponse {
    success: boolean;
    messageId: string;
    error?: string;
}