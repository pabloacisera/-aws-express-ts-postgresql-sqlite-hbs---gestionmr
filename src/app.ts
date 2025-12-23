import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { engine } from "express-handlebars";
//import type { HandlebarsHelpers } from "./types/handlebars.js"; // Si tienes tipos definidos

import { environment } from "./config/environments.js";
import { requireAuth } from "./middleware/authValidation.js";
import { attachUserData } from "./middleware/userAttachment.js";

// rutas de api
import apiRoutes from "./api/router.js";

// servicios
import { RegistersService } from "./api/services/RegistersService.js";
import { StatsController } from "./api/controllers/StatsController.js";
import { profileService } from "./api/services/ProfileService.js";
import { recoveryController } from "./api/controllers/RecoveryController.js";
import { configService } from "./api/services/ConfigService.js";
import { statsDetailController } from "./api/controllers/StatsDetailController.js";
import { RegistersCacheService } from "./api/services/RegistersCacheService.js";

// configuración rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = environment.node_env === "production";
const viewsDir = isProduction
  ? path.join(__dirname, "views")
  : path.join(process.cwd(), "src/views");

const app: Application = express();
const port = environment.port;

app.set('trust proxy', 1);

// configuración handlebars
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layout"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
      gt: function (a: any, b: any) {
        return a > b;
      },
      eq: function (a: string, b: string) {
        return a === b;
      },
      json: function (context: any) {
        return JSON.stringify(context);
      },
      // HELPER MATH
      math: function (lvalue: any, operator: string, rvalue: any) {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);

        switch (operator) {
          case "+":
            return lvalue + rvalue;
          case "-":
            return lvalue - rvalue;
          case "*":
            return lvalue * rvalue;
          case "/":
            return lvalue / rvalue;
          case "%":
            return lvalue % rvalue;
          default:
            return 0;
        }
      },
      // HELPER PARA FORMATEAR FECHA (solo fecha)
      formatearFecha: function (fechaString: string) {
        if (!fechaString) return "";

        try {
          const fecha = new Date(fechaString);

          // Verificar si la fecha es válida
          if (isNaN(fecha.getTime())) {
            return "";
          }

          // Formato corto (ej: 07/12/2025)
          return fecha.toLocaleDateString("es-AR");
        } catch (error) {
          console.error("Error al formatear la fecha:", error);
          return "";
        }
      },
      // HELPER PARA FORMATEAR FECHA CON HORA
      formatearFechaConHora: function (fechaString: string) {
        if (!fechaString) return "";

        try {
          const fecha = new Date(fechaString);

          if (isNaN(fecha.getTime())) {
            return "";
          }

          const opciones: Intl.DateTimeFormatOptions = {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false, // Para formato 24 horas
          };

          return fecha.toLocaleDateString("es-AR", opciones);
        } catch (error) {
          console.error("Error al formatear la fecha:", error);
          return "";
        }
      },
      startsWith: function (str: string, prefix: string) {
        return str?.startsWith(prefix) || false;
      },
      // NUEVOS HELPERS PARA DEBUG
      typeof: function (value: any) {
        return typeof value;
      },

      // Helper para checkboxes booleanos
      isChecked: function (value: any) {
        console.log(
          "Helper isChecked - valor recibido:",
          value,
          "tipo:",
          typeof value,
        );
        if (value === true) return "checked";
        if (value === "true") return "checked";
        if (value === 1) return "checked";
        if (value === "1") return "checked";
        if (typeof value === "string" && value.toLowerCase() === "true")
          return "checked";
        if (typeof value === "boolean" && value === true) return "checked";
        return "";
      },

      // Helper para debugging
      debug: function (value: any) {
        console.log("Handlebars Debug:", value);
        return "";
      },

      // Helper para convertir a booleano
      toBoolean: function (value: any) {
        if (value === true) return true;
        if (value === "true") return true;
        if (value === 1) return true;
        if (value === "1") return true;
        return false;
      },
    },
  }),
);
app.set("view engine", "hbs");
app.set("views", viewsDir);

// Servir archivos estáticos de manera condicional
if (isProduction) {
  app.use(express.static(path.join(__dirname, "public")));
} else {
  app.use(express.static(path.join(process.cwd(), "public")));
}

// Inicializar estructura de tabla
RegistersCacheService.ensureTableStructure?.().catch(err => {
  console.error("Error inicializando estructura de cache:", err);
});

// configuración de middlewares
app.use(cors());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// middleware para obtener datos del peticionante
app.use(attachUserData);

// middleware para pasar ruta actual
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// rutas de renderizado publicas
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login-user", (req, res) => {
  res.render("login_user");
});

app.get("/register-user", (req, res) => {
  res.render("register_user");
});

app.get("/recovery-password", (req, res) => {
  res.render("recovery_password");
});

app.get("/reset-password/:token", (req, res) => {
  recoveryController.showResetPasswordForm(req, res);
});

// app.ts - Agrega logs para debuggear
app.get("/profile", requireAuth, async (req, res) => {
  // Si no hay usuario autenticado
  if (!res.locals.user?.id) {
    console.log("ERROR: No hay usuario autenticado");
    return res.redirect("/login");
  }

  let userId = res.locals.user.id;

  try {
    const userData = await profileService.getProfileData(userId);
    console.log("5. Datos obtenidos del servicio:", userData);

    res.render("profile", {
      userData, // Asegúrate que se llama userData aquí
      // Temporalmente para debug
    });
  } catch (error: any) {
    console.error("6. Error en servicio:", error);
    res.render("profile", {
      userData: null,
      error: error.message,
    });
  }
});

// rutas de renderizado privado
app.get("/registers", requireAuth, async (req, res) => {
  try {
    // Obtener el número de página desde query params (default: 1)
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10; // Registros por página

    const results = await RegistersService.getAllRegistries(page, limit);

    res.render("registers", {
      data: results.data,
      pagination: results.pagination,
    });
  } catch (error) {
    res.render("registers", {
      data: [],
      pagination: null,
      error: "Error al cargar los registros",
    });
  }
});

app.get("/stats", requireAuth, async (req, res) => {
  try {
    const statsController = new StatsController();
    await statsController.renderStatsPage(req, res);
  } catch (error) {
    //console.error('Error en ruta /stats:', error);
    res.status(500).render("error", {
      error: "Error al cargar las estadísticas",
    });
  }
});

// Ruta para detalle de vencimientos
app.get(
  "/stats/detail/vencimiento/:tipo/:estado",
  requireAuth,
  async (req, res) => {
    try {
      await statsDetailController.renderVencimientoDetail(req, res);
    } catch (error) {
      console.error("Error en ruta /stats/detail/vencimiento:", error);
      res.status(500).render("error", {
        error: "Error al cargar el detalle de vencimientos",
      });
    }
  },
);

// Ruta para detalle de documentos
app.get("/stats/detail/documentos/:tipo", requireAuth, async (req, res) => {
  try {
    await statsDetailController.renderDocumentosDetail(req, res);
  } catch (error) {
    console.error("Error en ruta /stats/detail/documentos:", error);
    res.status(500).render("error", {
      error: "Error al cargar el detalle de documentos",
    });
  }
});

// Ruta para detalle por empresa
app.get("/stats/detail/empresas", requireAuth, async (req, res) => {
  try {
    await statsDetailController.renderEmpresasDetail(req, res);
  } catch (error) {
    console.error("Error en ruta /stats/detail/empresas:", error);
    res.status(500).render("error", {
      error: "Error al cargar el detalle por empresa",
    });
  }
});

// Ruta para detalle por lugar
app.get("/stats/detail/lugares", requireAuth, async (req, res) => {
  try {
    await statsDetailController.renderLugaresDetail(req, res);
  } catch (error) {
    console.error("Error en ruta /stats/detail/lugares:", error);
    res.status(500).render("error", {
      error: "Error al cargar el detalle por lugar",
    });
  }
});

app.get("/new-register", requireAuth, (req, res) => {
  //console.log("id de usuario: ", res.locals.user.id);
  res.render("new_registers");
});

app.get("/doc-register/:id", async (req, res) => {
  let controlId = Number(req.params.id);

  // consultar que campos estan marcados
  const statusCertificates =
    await RegistersService.checkCertificatesStatus(controlId);

  res.render("doc_register", {
    controlId,
    statusCertificates,
  });
});

app.get("/config", requireAuth, async (req, res) => {
  const userId = res.locals.user?.id;
  const configs = await configService.allConfigs(userId);

  console.log(configs);
  res.render("config", {
    configs,
  });
});

/**
 * RUTAS DE LA API
 */
app.use("/api", apiRoutes);

// levantar servidor
app.listen(port);
console.log(`SERVIDOR CORRIENDO EN http://localhost:${port}`);
