export interface Environments {
  port: string;
  base_url: string;
  token_secret_key: string;
  node_env: string;

  mailjet_api_key: string;
  mailjet_secret_key: string;
  mailjet_from_email: string;
  mailjet_from_name: string;
  cloudinary_cloud_name: string;
  cloudinary_api_key: string;
  cloudinary_api_secret: string;
  cloudinary_upload_folder: string;

  sqlite_path: string;
}
