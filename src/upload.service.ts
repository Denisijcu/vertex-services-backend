import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  constructor() {
    // Configuración de Cloudinary (usa las mismas credenciales de tu perfil)
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'ds6ynq5ll',
      api_key: process.env.CLOUDINARY_API_KEY || 'tu_api_key',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'tu_api_secret'
    });
  }

  /**
   * Subir archivo a Cloudinary
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    type: 'image' | 'video' | 'audio' | 'file'
  ): Promise<{ url: string; publicId: string; thumbnail?: string }> {
    
    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder: `vertex-chat/${type}s`,
        resource_type: 'auto',
        public_id: `${Date.now()}_${fileName.replace(/\s+/g, '_')}`,
      };

      // Configuraciones específicas por tipo
      if (type === 'image') {
        uploadOptions.transformation = [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' }
        ];
      }

      if (type === 'video') {
        uploadOptions.resource_type = 'video';
        uploadOptions.eager = [
          { width: 300, height: 300, crop: 'thumb', gravity: 'center' }
        ];
      }

      if (type === 'audio') {
        uploadOptions.resource_type = 'video'; // Cloudinary maneja audio como video
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Error subiendo a Cloudinary:', error);
            reject(error);
          } else {
            resolve({
              url: result!.secure_url,
              publicId: result!.public_id,
              thumbnail: result?.eager?.[0]?.secure_url
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Eliminar archivo de Cloudinary
   */
  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      console.log('🗑️ Archivo eliminado de Cloudinary:', publicId);
    } catch (error) {
      console.error('❌ Error eliminando archivo:', error);
    }
  }
}