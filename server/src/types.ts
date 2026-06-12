export type Role = "admin" | "user";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  excerpt: string;
  score: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}
