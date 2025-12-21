import { JWTPayload } from "../src/dto/token.dto.js";

declare global {
    namespace Express {
        interface Locals {
            user?: JWTPayload;
        }
    }
}

export {};