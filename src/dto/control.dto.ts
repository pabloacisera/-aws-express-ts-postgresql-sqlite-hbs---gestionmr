// control.dto.ts
export interface dataControl {
  userId: number;
  agente: string;
  fecha: Date | null;
  lugar: string;
  conductor_nombre: string;
  licencia_tipo: string;
  licencia_numero: string;
  licencia_vencimiento: string;
  empresa_select: string;
  dominio: string;
  interno: string | null;

  c_matriculacion_venc: Date | null;
  c_matriculacion_cert: string | null;

  seguro_venc: Date | null;
  seguro_cert: string | null;

  rto_venc: Date | null;
  rto_cert: string | null;

  tacografo_venc: Date | null;
  tacografo_cert: string | null;

  isDeleted: boolean | number;
  deletedAt: string | null;
  
  // CAMPOS NUEVOS PARA CACHE
  certificates?: string; // JSON stringified
  documentSummary?: string; // JSON stringified
  user?: string; // JSON stringified
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// O puedes crear una interfaz separada para cache:
export interface dataControlCache extends dataControl {
  certificates?: string;
  documentSummary?: string;
  user?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface controlResponse {
  id: number;
  userId: number;
  agente: string;
  fecha: Date;
  lugar: string;
  conductor_nombre: string;
  licencia_tipo: string;
  licencia_numero: string;
  licencia_vencimiento: string;
  empresa_select: string;
  dominio: string;
  interno: string;
  c_matriculacion_venc: Date;
  c_matriculacion_cert: string;
  seguro_venc: Date;
  seguro_cert: string;
  rto_venc: Date;
  rto_cert: string;
  tacografo_venc: Date;
  tacografo_cert: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationResult {
  data: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}