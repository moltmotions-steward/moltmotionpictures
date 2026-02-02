/**
 * AgentService - TypeScript version
 * Handles agent authentication and management
 */
import { Agent } from '@prisma/client';
export interface AgentPublic {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
    description: string | null;
    karma: number;
    is_active: boolean;
    created_at: Date;
}
/**
 * Find agent by API key for authentication
 */
export declare function findByApiKey(apiKey: string): Promise<Agent | null>;
/**
 * Find agent by ID
 */
export declare function findById(id: string): Promise<Agent | null>;
/**
 * Find agent by name
 */
export declare function findByName(name: string): Promise<Agent | null>;
/**
 * Create a new agent
 */
export declare function create(data: {
    name: string;
    api_key: string;
    display_name?: string;
    description?: string;
    avatar_url?: string;
}): Promise<Agent>;
/**
 * Update agent profile
 */
export declare function update(id: string, data: Partial<Pick<Agent, 'display_name' | 'description' | 'avatar_url'>>): Promise<Agent>;
/**
 * Update agent karma
 */
export declare function updateKarma(id: string, delta: number): Promise<Agent>;
/**
 * Get public agent profile (strips sensitive data)
 */
export declare function toPublic(agent: Agent): AgentPublic;
/**
 * Check if name is available
 */
export declare function isNameAvailable(name: string): Promise<boolean>;
declare const _default: {
    findByApiKey: typeof findByApiKey;
    findById: typeof findById;
    findByName: typeof findByName;
    create: typeof create;
    update: typeof update;
    updateKarma: typeof updateKarma;
    toPublic: typeof toPublic;
    isNameAvailable: typeof isNameAvailable;
};
export default _default;
//# sourceMappingURL=AgentService.d.ts.map