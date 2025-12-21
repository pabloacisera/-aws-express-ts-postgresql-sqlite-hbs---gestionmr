import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configurar Cloudinary con tus credenciales
cloudinary.config({
  cloud_name: 'dg6q6wbva',
  api_key: '664676494491175',
  api_secret: 'vk5QkTmZujyFG64nVLyFtHb_dsg',
  secure: true
});

export { cloudinary };

// Función para subir archivo a Cloudinary
export async function uploadToCloudinary(filePath: string, options: any) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

// FunciÃ³n para eliminar archivo de Cloudinary - VERSIÓN MEJORADA
export async function deleteFromCloudinary(publicId: string) {
  return new Promise((resolve, reject) => {
    // Determinar el resource_type basado en la extensión del publicId
    let resourceType: 'image' | 'raw' = 'raw';
    
    // Si el publicId contiene extensiones de imagen, usar 'image'
    if (publicId.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      resourceType = 'image';
    }
    
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}
