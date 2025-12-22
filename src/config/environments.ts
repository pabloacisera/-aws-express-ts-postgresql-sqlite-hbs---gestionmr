import dotenv from "dotenv";
import type { Environments } from "../interface/envs.interface.js";
import path from "path";

const envFile = process.env.NODE_ENV === "development" ? ".env.development" : ".env";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export const environment: Environments = {
  port: process.env.PORT || "",
  base_url: process.env.BASE_URL || "",
  node_env: process.env.NODE_ENV || "development",
  token_secret_key: process.env.TOKEN_SECRET_KEY || "",
  mailjet_api_key: process.env.MAILJET_API_KEY || "",
  mailjet_secret_key: process.env.MAILJET_SECRET_KEY || "",
  mailjet_from_email: process.env.MAILJET_FROM_EMAIL || "",
  mailjet_from_name: process.env.MAILJET_FROM_NAME || "",
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY || "",
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET || "",
  cloudinary_upload_folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "ROMERITO",
  sqlite_path: process.env.SQLITE_PATH || "",
};
