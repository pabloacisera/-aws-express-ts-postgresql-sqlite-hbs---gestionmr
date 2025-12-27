import multer from "multer";
import path from "path";
import fs from "fs";

// Directorio para archivos temporales
const uploadDir = "uploads/certificates";
const tempDir = "uploads/temp";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configuración simplificada - guardar en directorio temporal
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('📦 Multer - Guardando en directorio temporal');
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        try {
            const timestamp = Date.now();
            const random = Math.round(Math.random() * 1E9);
            const originalName = path.parse(file.originalname).name;
            const ext = path.extname(file.originalname);
            
            // Nombre temporal
            const filename = `temp_${timestamp}_${random}${ext}`;
            
            console.log(`📄 Nombre temporal generado: ${filename}`);
            
            cb(null, filename);
        } catch (error) {
            console.error('Error en filename multer:', error);
            cb(error as Error, null as any);
        }
    }
});

// Filter por tipo de archivo
const fileFilter = (
    req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    console.log(`🔍 Verificando tipo: ${file.mimetype} - ${file.originalname}`);
    
    const allowedTypes = [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        console.log(`✅ Tipo aceptado: ${file.mimetype}`);
        cb(null, true);
    } else {
        console.error(`❌ Tipo rechazado: ${file.mimetype}`);
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`) as any, false);
    }
}

export const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 200 * 1024 * 1024 // 200 MB
    }
});

// Función para mover el archivo del directorio temporal al definitivo
export function moveTempFileToDestination(
    tempFilePath: string,
    controlId: number,
    certificateType: string,
    originalFilename: string
): string {
    try {
        // Crear directorio definitivo
        const destDir = `${uploadDir}/control_${controlId}/${certificateType}`;
        
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Generar nombre definitivo
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const originalName = path.parse(originalFilename).name;
        const ext = path.extname(originalFilename);
        
        const destFilename = `${certificateType}_control_${controlId}_${timestamp}_${random}${ext}`;
        const destPath = path.join(destDir, destFilename);
        
        // Mover archivo
        fs.renameSync(tempFilePath, destPath);
        
        console.log(`📁 Archivo movido de ${tempFilePath} a ${destPath}`);
        
        return destPath;
    } catch (error) {
        console.error('Error moviendo archivo:', error);
        throw error;
    }
}