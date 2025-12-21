// AuthService.ts - CORREGIDO

import { environment } from "../../config/environments.js";
import prisma from "../../config/prisma.client.js";
import { JWTManager } from "../../helpers/TokenHelper.js";
import {
  authRequestDto,
  authResponseDto,
  AuthError,
  AuthErrorType,
  ActivationResponseDto,
  ResendActivationResponseDto,
  DecodedTokenDto,
} from "../../dto/auth.dto.js";
import { User } from "@prisma/client";
import bcrypt from "bcrypt";
import { emailService } from "./EmailService.js";

export class AuthService {
  /**
   * Servicio de login
   */
  static async loginService(data: authRequestDto): Promise<authResponseDto> {
    // 1. Validar datos de entrada
    if (!data.username || !data.password) {
      throw new AuthError(
        AuthErrorType.MISSING_FIELDS,
        400,
        "Usuario y contraseña son requeridos",
      );
    }

    let user: User | null = null;

    // 2. Determinar tipo de búsqueda (email o username)
    const isEmail = data.username.includes("@");

    try {
      if (isEmail) {
        user = await prisma.user.findUnique({
          where: { email: data.username },
        });
      } else {
        user = await prisma.user.findFirst({
          where: { name: data.username },
        });
      }
    } catch (dbError) {
      console.error("Error de base de datos:", dbError);
      throw new AuthError(
        AuthErrorType.SERVER_ERROR,
        500,
        "Error al consultar la base de datos",
      );
    }

    // 3. Verificar si el usuario existe
    if (!user) {
      throw new AuthError(
        AuthErrorType.USER_NOT_FOUND,
        401,
        "Credenciales inválidas: Usuario no encontrado",
      );
    }

    // 4. Verificar si la cuenta está activa
    if (!user.isActive) {
      throw new AuthError(
        AuthErrorType.ACCOUNT_NOT_ACTIVE,
        401,
        "La cuenta no está activada. Por favor, verifica tu correo electrónico.",
      );
    }

    // 5. Verificar contraseña con bcrypt (CORREGIDO: bcrypt, NO berycpt)
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new AuthError(
        AuthErrorType.INVALID_PASSWORD,
        401,
        "Credenciales inválidas: Contraseña incorrecta",
      );
    }

    // 6. Generar token JWT
    let payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };

    const jwtManager = new JWTManager(environment.token_secret_key);
    const expiresIn = data.remember ? "7d" : "24h";
    const token = jwtManager.createToken(payload, expiresIn);

    // 7. Preparar respuesta exitosa
    const userName: string =
      user.name ?? (user.email.split("@")[0] || "Usuario");

    return {
      success: true,
      message: "Inicio de sesión exitoso",
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: userName,
      },
    };
  }

  /**
   * Servicio para registrar un nuevo usuario
   */
  static async registerService(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<authResponseDto> {
    // si las contraseñas no coinciden
    if (!data.confirmPassword || data.password !== data.confirmPassword) {
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        409,
        "Las contraseñas no coinciden",
      );
    }

    // Validar que el email no exista
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AuthError(
        AuthErrorType.INVALID_CREDENTIALS,
        409,
        "El email ya está registrado",
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Crear usuario con isActive: false por defecto
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        isActive: false, // NUEVO: por defecto false
      },
    });

    // Generar token de activación
    let payload = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      createdAt: newUser.createdAt,
    };

    const jwtManager = new JWTManager(environment.token_secret_key);
    const token = jwtManager.createToken(payload, "24h"); // 24 horas para activación

    const userName: string = newUser.name ?? data.name;

    // CORRECCIÓN: usar environment.base_url (como está en el archivo environments.js)
    const activateLink = `${environment.base_url}/api/activate-account/${token}`;

    let emailResult = await emailService.sendEmail({
      to: newUser.email,
      toName: newUser.name!,
      subject: "Bienvenido a TransitAPP - Activa tu cuenta",
      text: `Hola ${newUser.name}, gracias por registrarte. Para activar tu cuenta haz clic en: ${activateLink}`,
      html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>¡Bienvenido ${newUser.name}!</h2>
                    <p>Gracias por registrarte en nuestra plataforma.</p>
                    <p>Estamos emocionados de tenerte con nosotros.</p>
                    <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
                    <p>
                        <a href="${activateLink}" 
                           style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Activar Cuenta
                        </a>
                    </p>
                    <p>O copia y pega esta URL en tu navegador:</p>
                    <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        ${activateLink}
                    </p>
                    <p>Este enlace expirará en 24 horas.</p>
                </div>
            `,
    });

    if (!emailResult.success) {
      throw new Error("No se ha podido enviar el email de activación");
    }

    // NO crear sesión aquí - solo registro exitoso
    return {
      success: true,
      message:
        "Usuario registrado exitosamente. Por favor, verifica tu correo electrónico para activar tu cuenta.",
      token: "", // Token vacío porque no se inicia sesión automáticamente
      user: {
        id: newUser.id,
        email: newUser.email,
        name: userName,
      },
    };
  }

  /**
   * Activa una cuenta de usuario usando un token JWT
   */
  static async activateAccount(token: string): Promise<ActivationResponseDto> {
    try {
      // 1. Verificar que el token no esté vacío
      if (!token || token === "guest") {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          400,
          "Token de activación inválido",
        );
      }

      // 2. Decodificar y verificar el token
      const jwtManager = new JWTManager(environment.token_secret_key);
      const decoded = jwtManager.decodeToken(token);

      if (!decoded || !decoded.payload || !decoded.payload.id) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          400,
          "Token de activación inválido o expirado",
        );
      }

      const userId = decoded.payload.id;
      const tokenData = decoded.payload as DecodedTokenDto;

      // 3. Buscar el usuario en la base de datos
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          404,
          "Usuario no encontrado",
        );
      }

      // 4. Verificar si la cuenta ya está activa
      if (user.isActive) {
        return {
          success: true,
          message: "La cuenta ya está activada",
          user: {
            id: user.id,
            email: user.email,
            name: user.name || tokenData.name || user.email.split("@")[0] as string,
          },
        };
      }

      // 5. Activar la cuenta
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });

      return {
        success: true,
        message: "¡Cuenta activada exitosamente! Ya puedes iniciar sesión.",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name:
            updatedUser.name ||
            tokenData.name ||
            updatedUser.email.split("@")[0] as string,
        },
      };
    } catch (error: any) {
      console.error("Error en activateAccount:", error);

      // Manejar errores específicos
      if (
        error.message.includes("jwt expired") ||
        error.message.includes("TokenExpiredError")
      ) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          400,
          "El enlace de activación ha expirado. Por favor, solicita un nuevo enlace.",
        );
      }

      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError(
        AuthErrorType.SERVER_ERROR,
        500,
        "Error al activar la cuenta",
      );
    }
  }

  /**
   * Reenvía el enlace de activación
   */
  static async resendActivationLink(
    email: string,
  ): Promise<ResendActivationResponseDto> {
    try {
      // 1. Buscar usuario por email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          404,
          "Usuario no encontrado",
        );
      }

      // 2. Verificar si ya está activo
      if (user.isActive) {
        return {
          success: true,
          message: "La cuenta ya está activa",
        };
      }

      // 3. Generar nuevo token
      const jwtManager = new JWTManager(environment.token_secret_key);
      const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      };

      const token = jwtManager.createToken(payload, "24h");

      // 4. Enviar email - CORRECCIÓN: usar environment.base_url
      const activateLink = `${environment.base_url || "http://localhost:3000"}/api/activate-account/${token}`;

      await emailService.sendEmail({
        to: user.email,
        toName: user.name || user.email.split("@")[0],
        subject: "Reenvío de enlace de activación - TransitAPP",
        text: `Hola, para activar tu cuenta haz clic en el siguiente enlace: ${activateLink}`,
        html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Hola ${user.name || ""}!</h2>
                        <p>Hemos recibido una solicitud para reenviar el enlace de activación de tu cuenta.</p>
                        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
                        <p><a href="${activateLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activar Cuenta</a></p>
                        <p>O copia y pega esta URL en tu navegador:</p>
                        <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">${activateLink}</p>
                        <p>Este enlace expirará en 24 horas.</p>
                        <p>Si no solicitaste este reenvío, puedes ignorar este correo.</p>
                    </div>
                `,
      });

      return {
        success: true,
        message:
          "Enlace de activación reenviado. Por favor, revisa tu correo electrónico.",
      };
    } catch (error: any) {
      console.error("Error en resendActivationLink:", error);

      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError(
        AuthErrorType.SERVER_ERROR,
        500,
        "Error al reenviar el enlace de activación",
      );
    }
  }
}
