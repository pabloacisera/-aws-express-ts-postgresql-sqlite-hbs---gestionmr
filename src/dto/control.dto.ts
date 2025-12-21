// control.dto.ts
export interface dataControl {
  userId: number;
  agente: string;
  fecha: Date | null;  // Cambiar de undefined a null
  lugar: string;
  conductor_nombre: string;
  licencia_tipo: string;
  licencia_numero: string;
  licencia_vencimiento: string;
  empresa_select: string;
  dominio: string;
  interno: string | null;  // Cambiar de undefined a null

  c_matriculacion_venc: Date | null;  // Cambiar de undefined a null
  c_matriculacion_cert: string | null;  // Cambiar de undefined a null

  seguro_venc: Date | null;  // Cambiar de undefined a null
  seguro_cert: string | null;  // Cambiar de undefined a null

  rto_venc: Date | null;  // Cambiar de undefined a null
  rto_cert: string | null;  // Cambiar de undefined a null

  tacografo_venc: Date | null;  // Cambiar de undefined a null
  tacografo_cert: string | null;  // Cambiar de undefined a null
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
