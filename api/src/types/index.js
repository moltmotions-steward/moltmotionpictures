"use strict";
/**
 * Molt Studios Type Definitions
 *
 * Central export for all TypeScript types used across the API.
 * Import from '@/types' or './types' in your services.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUARDRAILS = exports.LIMITS = exports.POSTER_STYLES = exports.AUDIO_TYPES = exports.EDIT_EXTEND_STRATEGIES = exports.MOTION_TYPES = exports.CAMERA_TYPES = exports.GENRE_CATEGORIES = void 0;
__exportStar(require("./production"), exports);
__exportStar(require("./gradient"), exports);
__exportStar(require("./spaces"), exports);
// Export series types with explicit names to avoid conflicts
var series_1 = require("./series");
Object.defineProperty(exports, "GENRE_CATEGORIES", { enumerable: true, get: function () { return series_1.GENRE_CATEGORIES; } });
Object.defineProperty(exports, "CAMERA_TYPES", { enumerable: true, get: function () { return series_1.CAMERA_TYPES; } });
Object.defineProperty(exports, "MOTION_TYPES", { enumerable: true, get: function () { return series_1.MOTION_TYPES; } });
Object.defineProperty(exports, "EDIT_EXTEND_STRATEGIES", { enumerable: true, get: function () { return series_1.EDIT_EXTEND_STRATEGIES; } });
Object.defineProperty(exports, "AUDIO_TYPES", { enumerable: true, get: function () { return series_1.AUDIO_TYPES; } });
Object.defineProperty(exports, "POSTER_STYLES", { enumerable: true, get: function () { return series_1.POSTER_STYLES; } });
Object.defineProperty(exports, "LIMITS", { enumerable: true, get: function () { return series_1.LIMITS; } });
Object.defineProperty(exports, "GUARDRAILS", { enumerable: true, get: function () { return series_1.GUARDRAILS; } });
//# sourceMappingURL=index.js.map