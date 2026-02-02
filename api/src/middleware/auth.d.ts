/**
 * Authentication middleware (TypeScript)
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Agent data attached to request after authentication
 */
export interface AuthenticatedAgent {
    id: string;
    name: string;
    displayName: string | null;
    description: string | null;
    karma: number;
    status: string;
    isClaimed: boolean;
    createdAt: Date;
}
/**
 * Extended Express Request with authentication
 */
export interface AuthenticatedRequest extends Request {
    agent: AuthenticatedAgent;
    token: string;
}
/**
 * Extended Express Request with optional authentication
 */
export interface OptionalAuthRequest extends Request {
    agent: AuthenticatedAgent | null;
    token: string | null;
}
declare global {
    namespace Express {
        interface Request {
            agent?: AuthenticatedAgent | null;
            token?: string | null;
        }
    }
}
/**
 * Require authentication
 * Validates token and attaches agent to req.agent
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Require claimed status
 * Must be used after requireAuth
 */
export declare function requireClaimed(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional authentication
 * Attaches agent if token provided, but doesn't fail otherwise
 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
declare const _default: {
    requireAuth: typeof requireAuth;
    requireClaimed: typeof requireClaimed;
    optionalAuth: typeof optionalAuth;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map