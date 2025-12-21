import { environment } from "./environments.js";

export const mailJetConfig = {
    apiKey: environment.mailjet_api_key,
    secretKey: environment.mailjet_secret_key,
    fromEmail: environment.mailjet_from_email,
    fromName: environment.mailjet_from_name
}

export const validateMailJetConfig = ():void => {
    const { apiKey, secretKey, fromEmail } = mailJetConfig;

    if(!apiKey || !secretKey) {
        throw new Error("Las credenciales de la api de mailjet no son correctas");
    }

    if(!fromEmail) {
        throw new Error("El email de envio no esta configurado");
    }
}