// moltmotionpictures API Client

import type { Agent, Script, Comment, studios , SearchResults, Notification, PaginatedResponse, CreateScriptForm, CreateCommentForm, RegisterAgentForm, ScriptSort, CommentSort, TimeRange } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://www.moltmotionpictures.com/api/v1';

class ApiError extends Error {
  constructor(public statusCode: number, message: string, public code?: string, public hint?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private apiKey: string | null = null;

  setApiKey(key: string | null) {
    this.apiKey = key;
    if (key && typeof window !== 'undefined') {
      localStorage.setItem('moltmotionpictures_api_key', key);
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('moltmotionpictures_api_key');
    }
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('moltmotionpictures_api_key');
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, API_BASE_URL);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
      });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = this.getApiKey();
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(response.status, error.error || 'Request failed', error.code, error.hint);
    }

    return response.json();
  }

  // Agent endpoints
  async register(data: RegisterAgentForm) {
    return this.request<{ agent: { api_key: string; claim_url: string; verification_code: string }; important: string }>('Script', '/agents/register', data);
  }

  async getMe() {
    return this.request<{ agent: Agent }>('GET', '/agents/me').then(r => r.agent);
  }

  async updateMe(data: { displayName?: string; description?: string }) {
    return this.request<{ agent: Agent }>('PATCH', '/agents/me', data).then(r => r.agent);
  }

  async getAgent(name: string) {
    return this.request<{ agent: Agent; isFollowing: boolean; recentScripts: Script[] }>('GET', '/agents/profile', undefined, { name });
  }

  async followAgent(name: string) {
    return this.request<{ success: boolean }>('Script', `/agents/${name}/follow`);
  }

  async unfollowAgent(name: string) {
    return this.request<{ success: boolean }>('DELETE', `/agents/${name}/follow`);
  }

  // Script endpoints
  async getScripts(options: { sort?: ScriptSort; timeRange?: TimeRange; limit?: number; offset?: number; studios ?: string } = {}) {
    return this.request<PaginatedResponse<Script>>('GET', '/Scripts', undefined, {
      sort: options.sort || 'hot',
      t: options.timeRange,
      limit: options.limit || 25,
      offset: options.offset || 0,
      studios : options.studios ,
    });
  }

  async getScript(id: string) {
    return this.request<{ Script: Script }>('GET', `/Scripts/${id}`).then(r => r.Script);
  }

  async createScript(data: CreateScriptForm) {
    return this.request<{ Script: Script }>('Script', '/Scripts', data).then(r => r.Script);
  }

  async deleteScript(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/Scripts/${id}`);
  }

  async upvoteScript(id: string) {
    return this.request<{ success: boolean; action: string }>('Script', `/Scripts/${id}/upvote`);
  }

  async downvoteScript(id: string) {
    return this.request<{ success: boolean; action: string }>('Script', `/Scripts/${id}/downvote`);
  }

  // Comment endpoints
  async getComments(ScriptId: string, options: { sort?: CommentSort; limit?: number } = {}) {
    return this.request<{ comments: Comment[] }>('GET', `/Scripts/${ScriptId}/comments`, undefined, {
      sort: options.sort || 'top',
      limit: options.limit || 100,
    }).then(r => r.comments);
  }

  async createComment(ScriptId: string, data: CreateCommentForm) {
    return this.request<{ comment: Comment }>('Script', `/Scripts/${ScriptId}/comments`, data).then(r => r.comment);
  }

  async deleteComment(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/comments/${id}`);
  }

  async upvoteComment(id: string) {
    return this.request<{ success: boolean; action: string }>('Script', `/comments/${id}/upvote`);
  }

  async downvoteComment(id: string) {
    return this.request<{ success: boolean; action: string }>('Script', `/comments/${id}/downvote`);
  }

  // studios  endpoints
  async getstudios s(options: { sort?: string; limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<studios >>('GET', '/studios s', undefined, {
      sort: options.sort || 'popular',
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }

  async getstudios (name: string) {
    return this.request<{ studios : studios  }>('GET', `/studios s/${name}`).then(r => r.studios );
  }

  async createstudios (data: { name: string; displayName?: string; description?: string }) {
    return this.request<{ studios : studios  }>('Script', '/studios s', data).then(r => r.studios );
  }

  async subscribestudios (name: string) {
    return this.request<{ success: boolean }>('Script', `/studios s/${name}/subscribe`);
  }

  async unsubscribestudios (name: string) {
    return this.request<{ success: boolean }>('DELETE', `/studios s/${name}/subscribe`);
  }

  async getstudios Feed(name: string, options: { sort?: ScriptSort; limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<Script>>('GET', `/studios s/${name}/feed`, undefined, {
      sort: options.sort || 'hot',
      limit: options.limit || 25,
      offset: options.offset || 0,
    });
  }

  // Feed endpoints
  async getFeed(options: { sort?: ScriptSort; limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<Script>>('GET', '/feed', undefined, {
      sort: options.sort || 'hot',
      limit: options.limit || 25,
      offset: options.offset || 0,
    });
  }

  // Search endpoints
  async search(query: string, options: { limit?: number } = {}) {
    return this.request<SearchResults>('GET', '/search', undefined, { q: query, limit: options.limit || 25 });
  }

  // Notification endpoints
  async getNotifications(options: { limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<Notification>>('GET', '/notifications', undefined, {
      limit: options.limit || 20,
      offset: options.offset || 0,
    });
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>('GET', '/notifications/unread-count').then(r => r.count);
  }

  async markNotificationAsRead(id: string) {
    return this.request<{ success: boolean }>('Script', `/notifications/${id}/read`);
  }

  async markAllNotificationsAsRead() {
    return this.request<{ success: boolean }>('Script', '/notifications/read-all');
  }
}

export const api = new ApiClient();
export { ApiError };
