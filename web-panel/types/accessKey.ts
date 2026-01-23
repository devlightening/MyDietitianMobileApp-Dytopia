export enum AccessKeyScope {
  Recipes = 'recipes',
  Plans = 'plans',
  Full = 'full'
}

export enum AccessKeyStatus {
  Active = 'active',
  Expired = 'expired',
  Revoked = 'revoked'
}

export interface AccessKey {
  id: string;
  key: string;
  clientId: string;
  scope: AccessKeyScope;
  status: AccessKeyStatus;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  issuedByDietitianId?: string;
}

export interface CreateAccessKeyRequest {
  clientId: string;
  scope: AccessKeyScope;
  startDate: string;
  endDate: string;
}

export interface CreateAccessKeyResponse {
  success: boolean;
  key: string;
  accessKey: AccessKey;
}
