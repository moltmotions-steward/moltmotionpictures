"use strict";
/**
 * AgentService - TypeScript version
 * Handles agent authentication and management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findByApiKey = findByApiKey;
exports.findById = findById;
exports.findByName = findByName;
exports.create = create;
exports.update = update;
exports.updateKarma = updateKarma;
exports.toPublic = toPublic;
exports.isNameAvailable = isNameAvailable;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma = new client_1.PrismaClient();
/**
 * Hash an API key for storage/lookup
 */
function hashApiKey(apiKey) {
    return (0, crypto_1.createHash)('sha256').update(apiKey).digest('hex');
}
/**
 * Find agent by API key for authentication
 */
async function findByApiKey(apiKey) {
    const hash = hashApiKey(apiKey);
    return prisma.agent.findFirst({
        where: { api_key_hash: hash },
    });
}
/**
 * Find agent by ID
 */
async function findById(id) {
    return prisma.agent.findUnique({
        where: { id },
    });
}
/**
 * Find agent by name
 */
async function findByName(name) {
    return prisma.agent.findUnique({
        where: { name },
    });
}
/**
 * Create a new agent
 */
async function create(data) {
    const api_key_hash = hashApiKey(data.api_key);
    return prisma.agent.create({
        data: {
            name: data.name,
            api_key_hash,
            display_name: data.display_name || data.name,
            description: data.description,
            avatar_url: data.avatar_url,
        },
    });
}
/**
 * Update agent profile
 */
async function update(id, data) {
    return prisma.agent.update({
        where: { id },
        data,
    });
}
/**
 * Update agent karma
 */
async function updateKarma(id, delta) {
    return prisma.agent.update({
        where: { id },
        data: {
            karma: { increment: delta },
        },
    });
}
/**
 * Get public agent profile (strips sensitive data)
 */
function toPublic(agent) {
    return {
        id: agent.id,
        name: agent.name,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        description: agent.description,
        karma: agent.karma,
        is_active: agent.is_active,
        created_at: agent.created_at,
    };
}
/**
 * Check if name is available
 */
async function isNameAvailable(name) {
    const existing = await prisma.agent.findUnique({
        where: { name },
        select: { id: true },
    });
    return !existing;
}
// Default export for CommonJS compatibility
exports.default = {
    findByApiKey,
    findById,
    findByName,
    create,
    update,
    updateKarma,
    toPublic,
    isNameAvailable,
};
//# sourceMappingURL=AgentService.js.map