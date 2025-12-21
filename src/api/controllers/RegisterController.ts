import { Request, Response } from "express";
import { RegistersService } from "../services/RegistersService.js";
import { dataControl } from "../../dto/control.dto.js";

export class RegisterController {
  static async searchRegistries(req: Request, res: Response) {
    try {
      const searchTerm = (req.query.q as string) || "";
      const searchField = (req.query.field as string) || "all";
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;

      const results = await RegistersService.searchRegistries(
        searchTerm,
        searchField,
        page,
        limit,
      );

      console.log("Resultado de la búsqueda:", {
        searchTerm,
        searchField,
        page: results.pagination.currentPage,
        total: results.pagination.totalRecords,
        records: results.data.length,
      });

      // EXACTAMENTE IGUAL QUE EL ORIGINAL
      res.render("registers", {
        data: results.data,
        pagination: results.pagination,
      });
    } catch (error) {
      console.error("Error al buscar registros:", error);
      res.render("registers", {
        data: [],
        pagination: null,
        error: "Error al buscar registros",
      });
    }
  }

  static async getAllRegisters(req: Request, res: Response) {
    try {
      // Obtener parámetros de paginación desde query params
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Validar que los valores sean positivos
      if (page < 1 || limit < 1) {
        return res.status(400).json({
          success: false,
          message: "Los parámetros page y limit deben ser mayores a 0",
        });
      }

      const results = await RegistersService.getAllRegistries(page, limit);

      return res.status(200).json({
        success: true,
        ...results,
      });
    } catch (error) {
      console.error("Error en getAllRegisters:", error);
      return res.status(500).json({
        success: false,
        message: "Error al obtener los registros",
      });
    }
  }

  // RegisterController.ts - Método createRegister CORREGIDO
  static async createRegister(req: Request, res: Response) {
    try {
      // Obtener el userId desde res.locals.user (agregado por el middleware)
      const userId = res.locals.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      // FUNCIÓN AUXILIAR PARA CONVERTIR FECHAS (para propiedades Date | null)
      const parseDate = (dateString: string): Date | null => {
        if (!dateString || dateString.trim() === '') {
          return null;
        }
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      };

      // Preparar los datos del registro - CORREGIDO
      const registerData: dataControl = {
        userId: userId,
        agente: req.body.agente,
        fecha: parseDate(req.body.fecha), // Date | null
        lugar: req.body.lugar,
        conductor_nombre: req.body.conductor_nombre,
        licencia_tipo: req.body.licencia_tipo,
        licencia_numero: req.body.licencia_numero,
        // licencia_vencimiento es STRING, no Date - mantener como string
        licencia_vencimiento: req.body.licencia_vencimiento || '', // string
        empresa_select: req.body.empresa_select,
        dominio: req.body.dominio,
        interno: req.body.interno || null, // string | null
        c_matriculacion_venc: parseDate(req.body.c_matriculacion_venc), // Date | null
        c_matriculacion_cert: req.body.c_matriculacion_cert || null, // string | null
        seguro_venc: parseDate(req.body.seguro_venc), // Date | null
        seguro_cert: req.body.seguro_cert || null, // string | null
        rto_venc: parseDate(req.body.rto_venc), // Date | null
        rto_cert: req.body.rto_cert || null, // string | null
        tacografo_venc: parseDate(req.body.tacografo_venc), // Date | null
        tacografo_cert: req.body.tacografo_cert || null, // string | null
      };

      const newRegister = await RegistersService.createNewRegister(registerData);

      return res.status(201).json({
        success: true,
        message: "Registro creado exitosamente",
        data: newRegister,
      });
    } catch (error) {
      console.error("Error en createRegister:", error);
      return res.status(500).json({
        success: false,
        message: "Error al crear el registro",
      });
    }
  }

  // NUEVO: Obtener registro por ID
  static async getRegistryById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "ID de registro inválido",
        });
      }

      const registry = await RegistersService.getRegistryById(parseInt(id));

      return res.status(200).json({
        success: true,
        data: registry,
      });
    } catch (error: any) {
      console.error("Error en getRegistryById:", error);

      if (error.message === "Registro no encontrado") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al obtener el registro",
      });
    }
  }

  // NUEVO: Obtener solo números de certificado
  static async getCertificateNumbers(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: "ID de registro inválido",
        });
      }

      const certificateNumbers =
        await RegistersService.getCertificateNumbersById(parseInt(id));

      return res.status(200).json({
        success: true,
        data: certificateNumbers,
      });
    } catch (error: any) {
      console.error("Error en getCertificateNumbers:", error);

      if (error.message === "Registro no encontrado") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al obtener los números de certificado",
      });
    }
  }

  // RegisterController.ts - Método deleteRegistry
  static async deleteRegistry(req: Request, res: Response) {
    try {
      const controlId = parseInt(req.params.controlId as string);

      if (isNaN(controlId)) {
        return res.status(400).json({
          success: false,
          message: "Id inválido",
        });
      }

      await RegistersService.deleteRegistry(controlId);

      // CORREGIDO: Usar return para enviar UNA SOLA respuesta
      return res.status(200).json({
        success: true,
        message: "Registro eliminado",
      });

    } catch (err: any) {
      console.error("Error al borrar registro: ", err);

      // CORREGIDO: Usar return para enviar UNA SOLA respuesta de error
      if (err.message === "Registro no encontrado") {
        return res.status(404).json({
          success: false,
          message: "Registro no encontrado",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al eliminar registro",
      });
    }
  }
}
