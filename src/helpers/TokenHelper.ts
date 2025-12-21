import jwt from 'jsonwebtoken';

interface TokenPayload {
  [key: string]: any;
}

interface DecodedToken {
  payload: TokenPayload;
  header: any;
  signature: string;
}

export class JWTManager {
  private secretKey: string;
  private blacklistedTokens: Set<string>;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
    this.blacklistedTokens = new Set();
  }

  /**
   * Crea un token JWT
   * @param payload - Datos a incluir en el token
   * @param expiresIn - Tiempo de expiración (ej: '1h', '7d', '30m')
   * @returns Token JWT firmado
   */
  createToken(payload: TokenPayload, expiresIn: string | number = '1h'): string {
    try {
      const token = jwt.sign(payload, this.secretKey, {
        expiresIn: expiresIn as any,
        algorithm: 'HS256'
      });
      return token;
    } catch (error) {
      throw new Error(`Error al crear el token: ${error}`);
    }
  }

  /**
   * Elimina un token (lo añade a la lista negra)
   * @param token - Token a invalidar
   * @returns true si se eliminó correctamente
   */
  deleteToken(token: string): boolean {
    try {
      // Verificar que el token sea válido antes de añadirlo a la blacklist
      jwt.verify(token, this.secretKey);
      this.blacklistedTokens.add(token);
      return true;
    } catch (error) {
      throw new Error(`Error al eliminar el token: ${error}`);
    }
  }

  /**
   * Decodifica un token JWT
   * @param token - Token a decodificar
   * @param verify - Si se debe verificar la firma (por defecto true)
   * @returns Información decodificada del token
   */
  decodeToken(token: string, verify: boolean = true): DecodedToken | null {
    try {
      // Verificar si el token está en la blacklist
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token invalidado');
      }

      if (verify) {
        // Decodificar y verificar
        const decoded = jwt.verify(token, this.secretKey) as TokenPayload;
        const decodedComplete = jwt.decode(token, { complete: true }) as any;
        
        return {
          payload: decoded,
          header: decodedComplete.header,
          signature: decodedComplete.signature
        };
      } else {
        // Solo decodificar sin verificar
        const decoded = jwt.decode(token, { complete: true }) as any;
        return decoded ? {
          payload: decoded.payload,
          header: decoded.header,
          signature: decoded.signature
        } : null;
      }
    } catch (error) {
      throw new Error(`Error al decodificar el token: ${error}`);
    }
  }

  /**
   * Verifica si un token está en la blacklist
   * @param token - Token a verificar
   * @returns true si está invalidado
   */
  isTokenBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }
}

// Ejemplo de uso
/*const jwtManager = new JWTManager('mi_clave_secreta_super_segura');

// Crear token
const token = jwtManager.createToken(
  { userId: 123, email: 'usuario@example.com' },
  '2h'
);
console.log('Token creado:', token);

// Decodificar token
try {
  const decoded = jwtManager.decodeToken(token);
  console.log('Token decodificado:', decoded?.payload);
} catch (error) {
  console.error(error);
}

// Eliminar token
try {
  jwtManager.deleteToken(token);
  console.log('Token eliminado correctamente');
} catch (error) {
  console.error(error);
}

// Intentar decodificar token eliminado
try {
  jwtManager.decodeToken(token);
} catch (error) {
  console.error('Error esperado:', error);
}

export default JWTManager;*/