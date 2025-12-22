import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { environment } from "../config/environments.js";

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SQLiteCache {
  private db: Database.Database;

  constructor() {
    // Ruta para el archivo SQLite
    const dbPath =
      environment.node_env === "production"
        ? environment.sqlite_path
        : path.join(__dirname, "../../gestionMR_cache.db");

    this.db = new Database(dbPath);

    // 🔴 IMPORTANTE: Deshabilitar claves foráneas para caché
    this.db.pragma("foreign_keys = OFF");

    this.initSchema();
  }

  private initSchema(): void {
    // SOLO las tablas que NECESITAS para el cache

    // Tabla ControlRegister - campo userId como INTEGER sin FK
    this.db.exec(`
    CREATE TABLE IF NOT EXISTS "ControlRegister" (
      id INTEGER PRIMARY KEY,
      userId INTEGER,  -- Solo un número, sin relación
      agente TEXT,
      fecha DATETIME,
      lugar TEXT,
      conductor_nombre TEXT,
      licencia_tipo TEXT,
      licencia_numero TEXT,
      licencia_vencimiento DATETIME,
      empresa_select TEXT,
      dominio TEXT,
      interno TEXT,
      c_matriculacion_venc DATETIME,
      c_matriculacion_cert TEXT,
      seguro_venc DATETIME,
      seguro_cert TEXT,
      rto_venc DATETIME,
      rto_cert TEXT,
      tacografo_venc DATETIME,
      tacografo_cert TEXT,
      createdAt DATETIME,
      updatedAt DATETIME,

      -- NUEVOS CAMPOS PARA SOFT DELETE --
      isDeleted INTEGER DEFAULT 0, -- 0 para false, 1 para true
      deletedAt DATETIME,
      ------------------------------------
      
      _cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      _expires_at DATETIME,
      _source TEXT DEFAULT 'postgres'
    );
    
    CREATE INDEX IF NOT EXISTS idx_control_user ON ControlRegister(userId);
    CREATE INDEX IF NOT EXISTS idx_control_dominio ON ControlRegister(dominio);
    CREATE INDEX IF NOT EXISTS idx_control_isdeleted ON ControlRegister(isDeleted); -- Indexamos para búsquedas rápidas
  `);

    // En SqliteCache.ts, en la tabla CertificateDocument, agregar:
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "CertificateDocument" (
        id INTEGER PRIMARY KEY,
        controlId INTEGER,
        certificateType TEXT CHECK(certificateType IN ('C_MATRICULACION', 'SEGURO', 'RTO', 'TACOGRAFO')),
        certificateNumber TEXT,
        fileName TEXT,
        filePath TEXT,
        fileSize INTEGER,
        mimeType TEXT,
        description TEXT,  -- Cambiar a TEXT (no nullable si quieres búsquedas)
        uploadedAt DATETIME,

        -- NUEVOS CAMPOS PARA SOFT DELETE --
        isDeleted INTEGER DEFAULT 0,
        deletedAt DATETIME,
        ------------------------------------
        
        _cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        _expires_at DATETIME,
        _source TEXT DEFAULT 'postgres'
      );
      
      CREATE INDEX IF NOT EXISTS idx_cert_number ON CertificateDocument(certificateNumber);
      CREATE INDEX IF NOT EXISTS idx_cert_filename ON CertificateDocument(fileName);
      CREATE INDEX IF NOT EXISTS idx_cert_description ON CertificateDocument(description);
      CREATE INDEX IF NOT EXISTS idx_cert_isdeleted ON CertificateDocument(isDeleted);
    `);

    // NO crear tabla User ni UserConfig
    // Tu autenticación SIEMPRE debe ir a PostgreSQL

    console.log("✅ Schema SQLite cache inicializado (solo tablas necesarias)");
  }

  getConnection(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

export const sqliteCacheSync = new SQLiteCache();
