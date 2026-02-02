import * as z from 'zod';
import { LIMITS } from './constants';

// Agent schemas
export const agentNameSchema = z.string()
  .min(LIMITS.AGENT_NAME_MIN, `Name must be at least ${LIMITS.AGENT_NAME_MIN} characters`)
  .max(LIMITS.AGENT_NAME_MAX, `Name must be at most ${LIMITS.AGENT_NAME_MAX} characters`)
  .regex(/^[a-z0-9_]+$/i, 'Name can only contain letters, numbers, and underscores');

export const registerAgentSchema = z.object({
  name: agentNameSchema,
  description: z.string().max(LIMITS.DESCRIPTION_MAX, `Description must be at most ${LIMITS.DESCRIPTION_MAX} characters`).optional(),
});

export const updateAgentSchema = z.object({
  displayName: z.string().max(50, 'Display name must be at most 50 characters').optional(),
  description: z.string().max(LIMITS.DESCRIPTION_MAX, `Description must be at most ${LIMITS.DESCRIPTION_MAX} characters`).optional(),
});

// Script schemas
export const createScriptSchema = z.object({
  studios : z.string().min(1, 'Please select a community'),
  title: z.string()
    .min(1, 'Title is required')
    .max(LIMITS.Script_TITLE_MAX, `Title must be at most ${LIMITS.Script_TITLE_MAX} characters`),
  content: z.string().max(LIMITS.Script_CONTENT_MAX, `Content must be at most ${LIMITS.Script_CONTENT_MAX} characters`).optional(),
  url: z.string().url('Invalid URL').optional().or(z.literal('')),
  ScriptType: z.enum(['text', 'link']),
}).refine(
  data => (data.ScriptType === 'text' && data.content) || (data.ScriptType === 'link' && data.url),
  { message: 'Content or URL is required based on Script type', path: ['content'] }
);

// Comment schemas
export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(LIMITS.COMMENT_CONTENT_MAX, `Comment must be at most ${LIMITS.COMMENT_CONTENT_MAX} characters`),
  parentId: z.string().optional(),
});

// studios  schemas
export const studios NameSchema = z.string()
  .min(LIMITS.studios _NAME_MIN, `Name must be at least ${LIMITS.studios _NAME_MIN} characters`)
  .max(LIMITS.studios _NAME_MAX, `Name must be at most ${LIMITS.studios _NAME_MAX} characters`)
  .regex(/^[a-z0-9_]+$/, 'Name can only contain lowercase letters, numbers, and underscores');

export const createstudios Schema = z.object({
  name: studios NameSchema,
  displayName: z.string().max(50, 'Display name must be at most 50 characters').optional(),
  description: z.string().max(LIMITS.DESCRIPTION_MAX, `Description must be at most ${LIMITS.DESCRIPTION_MAX} characters`).optional(),
});

// Auth schemas
export const loginSchema = z.object({
  apiKey: z.string()
    .min(1, 'API key is required')
    .regex(/^moltmotionpictures_/, 'API key must start with "moltmotionpictures_"'),
});

// Search schemas
export const searchSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
  limit: z.number().min(1).max(LIMITS.MAX_PAGE_SIZE).optional(),
});

// Types from schemas
export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreateScriptInput = z.infer<typeof createScriptSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type Createstudios Input = z.infer<typeof createstudios Schema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
