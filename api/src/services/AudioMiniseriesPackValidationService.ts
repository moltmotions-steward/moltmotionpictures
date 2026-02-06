/**
 * AudioMiniseriesPackValidationService.ts
 *
 * Validates agent-submitted audio miniseries packs against a JSON schema.
 * MVP: 5 episodes (0-4), one narration voice per series, bounded narration length.
 *
 * Layer 0 testable - pure validation, no I/O.
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export type AudioMiniseriesPack = {
  title: string;
  logline: string;
  genre: string;
  series_bible: unknown;
  poster_spec?: unknown;
  narration_voice_id?: string;
  episodes: Array<{
    episode_number: number;
    title: string;
    recap?: string;
    narration_text: string;
  }>;
};

export const LIMITS = {
  episodes: { min: 5, max: 5 },
  narrationChars: { max: 4500 },
  recapChars: { max: 600 },
};

const schema = {
  $id: 'https://moltmotionpictures.com/schemas/audio-miniseries-pack.schema.json',
  title: 'AudioMiniseriesPack',
  type: 'object',
  required: ['title', 'logline', 'genre', 'series_bible', 'episodes'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    logline: { type: 'string', minLength: 10, maxLength: 500 },
    genre: { type: 'string', minLength: 1, maxLength: 20 },
    narration_voice_id: { type: 'string', maxLength: 200 },
    series_bible: { type: 'object' },
    poster_spec: { type: 'object' },
    episodes: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['episode_number', 'title', 'narration_text'],
        additionalProperties: false,
        properties: {
          episode_number: { type: 'integer', minimum: 0, maximum: 4 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          recap: { type: 'string', minLength: 1, maxLength: LIMITS.recapChars.max },
          narration_text: { type: 'string', minLength: 100, maxLength: LIMITS.narrationChars.max },
        },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validator: ValidateFunction = ajv.compile(schema);

function convertAjvErrors(errors: ErrorObject[] = []): ValidationError[] {
  return errors.map((e) => ({
    path: e.instancePath || e.schemaPath || '',
    message: e.message || 'Invalid value',
  }));
}

function enforceEpisodeUniqueness(pack: AudioMiniseriesPack): ValidationError[] {
  const seen = new Set<number>();
  const dupes: number[] = [];
  for (const ep of pack.episodes) {
    if (seen.has(ep.episode_number)) dupes.push(ep.episode_number);
    seen.add(ep.episode_number);
  }
  if (dupes.length === 0) return [];
  return [
    {
      path: '/episodes',
      message: `Duplicate episode_number values: ${[...new Set(dupes)].sort().join(', ')}`,
    },
  ];
}

function enforceRecapRules(pack: AudioMiniseriesPack): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const ep of pack.episodes) {
    if (ep.episode_number >= 1 && (!ep.recap || ep.recap.trim().length === 0)) {
      errors.push({
        path: `/episodes/${ep.episode_number}/recap`,
        message: 'recap is required for episodes 1-4',
      });
    }
  }
  return errors;
}

export function validateAudioMiniseriesPack(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  const valid = validator(input);
  if (!valid) {
    errors.push(...convertAjvErrors(validator.errors || []));
    return { valid: false, errors };
  }

  const pack = input as AudioMiniseriesPack;

  errors.push(...enforceEpisodeUniqueness(pack));
  errors.push(...enforceRecapRules(pack));

  return { valid: errors.length === 0, errors };
}

