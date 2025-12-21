// ConfigService.js
import prisma from "../../config/prisma.client.js";

class ConfigService {
    public async allConfigs(userId: number): 
    Promise<{success: boolean, data?: any, error?: string}> {
        try {
            console.log("ConfigService - Buscando config para userId:", userId);
            
            let configs = await prisma.userConfig.findFirst({
                where: { userId }
            });

            if(!configs) {
                configs = await prisma.userConfig.create({
                    data: {
                        userId: userId,
                        pdfGenerate: true,
                        showAllRegistries: false,
                        cacheRegistries: false
                    }
                });
            }

            return {
                success: true,
                ...configs  // ¡IMPORTANTE! Spread operator para que los datos estén en el nivel superior
            }
        } catch (error: any) {
            console.error("Error en ConfigService.allConfigs:", error);
            return {
                success: false,
                error: error.message || "Error en el servidor"
            }
        }
    }
}

export const configService = new ConfigService();