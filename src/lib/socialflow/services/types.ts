export interface EmpresaService {
  id: string;
  tenantId: string;
  saasId: string;
  name: string;
  description: string | null;
  category: string | null;
  zona: string | null;
  tarifa: string | null;
  credentialDeclared: boolean;
  credentialDescription: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateServiceInput {
  name: string;
  description?: string | null;
  category?: string | null;
  zona?: string | null;
  tarifa?: string | null;
  credentialDeclared?: boolean;
  credentialDescription?: string | null;
  active?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  category?: string | null;
  zona?: string | null;
  tarifa?: string | null;
  credentialDeclared?: boolean;
  credentialDescription?: string | null;
  active?: boolean;
}
