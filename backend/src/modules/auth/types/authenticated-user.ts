export interface AuthenticatedUser {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}
