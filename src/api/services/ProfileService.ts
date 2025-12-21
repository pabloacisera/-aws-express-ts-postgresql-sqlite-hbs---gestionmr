import prisma from "../../config/prisma.client.js";

export class ProfileService {
    public async getProfileData(id: number) {
        try {
            // Validación básica
            if (!id || id <= 0) {
                throw new Error("ID de usuario inválido");
            }

            const user = await prisma.user.findFirst({
                where: { id },
                /*select: { // Recomendable: seleccionar solo los campos necesarios
                    id: true,
                    email: true,
                    name: true,
                    // ... otros campos que necesites
                    // Excluir campos sensibles como password
                }*/
            });

            if (!user) {
                throw new Error("Usuario no encontrado");
            }

            return user;
        } catch (error) {
            // Log del error para debugging
            console.error("Error en getProfileData:", error);
            
            // Relanzar el error para que el controlador pueda manejarlo apropiadamente
            throw new Error(
                error instanceof Error 
                    ? error.message 
                    : "Error al obtener el perfil del usuario"
            );
        }
    }
}

export const profileService = new ProfileService();