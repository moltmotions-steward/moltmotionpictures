'use client';

import { Card, Separator } from '@/components/ui';
import type { PilotScript } from '@/types';

interface ScriptContentProps {
  scriptData: PilotScript;
}

export function ScriptContent({ scriptData }: ScriptContentProps) {
  if (!scriptData) return null;

  return (
    <div className="space-y-6">
      {/* Logline */}
      {scriptData.logline && (
        <Card className="p-4 bg-muted/50">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Logline</h3>
          <p className="text-base leading-relaxed">{scriptData.logline}</p>
        </Card>
      )}

      {/* Genre & Format */}
      <div className="flex gap-4 text-sm">
        {scriptData.genre && (
          <div>
            <span className="font-semibold text-muted-foreground">Genre:</span>{' '}
            <span className="text-foreground capitalize">{scriptData.genre.replace(/_/g, ' ')}</span>
          </div>
        )}
        {scriptData.format && (
          <div>
            <span className="font-semibold text-muted-foreground">Format:</span>{' '}
            <span className="text-foreground capitalize">{scriptData.format.replace(/_/g, ' ')}</span>
          </div>
        )}
      </div>

      {/* Story Arc */}
      {scriptData.arc && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Story Arc</h2>

          <Card className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Act I: Setup
            </h3>
            <p className="text-base leading-relaxed">{scriptData.arc.beat_1}</p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Act II: Confrontation
            </h3>
            <p className="text-base leading-relaxed">{scriptData.arc.beat_2}</p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Act III: Resolution
            </h3>
            <p className="text-base leading-relaxed">{scriptData.arc.beat_3}</p>
          </Card>
        </div>
      )}

      {/* Shots */}
      {scriptData.shots && scriptData.shots.length > 0 && (
        <div className="space-y-4">
          <Separator />
          <h2 className="text-xl font-bold">Shots ({scriptData.shots.length})</h2>

          <div className="space-y-4">
            {scriptData.shots.map((shot, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold">
                    Shot {index + 1}
                    {shot.audio?.type && (
                      <span className="ml-2 text-xs px-2 py-1 rounded bg-muted text-muted-foreground uppercase">
                        {shot.audio.type}
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    {shot.gen_clip_seconds}s gen / {shot.duration_seconds}s total
                  </div>
                </div>

                {/* Camera & Scene */}
                {shot.prompt && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-semibold text-muted-foreground">Camera:</span>{' '}
                      <span className="text-sm capitalize">{shot.prompt.camera.replace(/_/g, ' ')}</span>
                      {shot.prompt.motion && (
                        <>
                          {' '}• <span className="text-sm capitalize">{shot.prompt.motion.replace(/_/g, ' ')}</span>
                        </>
                      )}
                    </div>

                    <div className="mt-2">
                      <p className="text-sm font-semibold text-muted-foreground mb-1">Scene:</p>
                      <p className="text-base leading-relaxed">{shot.prompt.scene}</p>
                    </div>

                    {shot.prompt.details && (
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Details:</p>
                        <p className="text-base leading-relaxed text-muted-foreground">{shot.prompt.details}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Audio */}
                {shot.audio && (
                  <div className="mt-3 pt-3 border-t">
                    {shot.audio.description && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Audio:</p>
                        <p className="text-base leading-relaxed italic">{shot.audio.description}</p>
                      </div>
                    )}

                    {shot.audio.dialogue && (
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-muted-foreground mb-1">Dialogue:</p>
                        <div className="pl-4 border-l-2 border-primary">
                          <p className="text-sm font-semibold">{shot.audio.dialogue.speaker}</p>
                          <p className="text-base leading-relaxed italic">&quot;{shot.audio.dialogue.line}&quot;</p>
                        </div>
                      </div>
                    )}

                    {shot.audio.voice_id && (
                      <p className="text-xs text-muted-foreground mt-2">Voice: {shot.audio.voice_id}</p>
                    )}
                  </div>
                )}

                {shot.edit_extend_strategy && shot.duration_seconds > shot.gen_clip_seconds && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Extension: {shot.edit_extend_strategy} ({shot.duration_seconds - shot.gen_clip_seconds}s)
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Series Bible */}
      {scriptData.series_bible && (
        <div className="space-y-4">
          <Separator />
          <h2 className="text-xl font-bold">Series Bible</h2>

          {/* Global Style Bible */}
          {scriptData.series_bible.global_style_bible && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Global Style
              </h3>
              <p className="text-base leading-relaxed">{scriptData.series_bible.global_style_bible}</p>
            </Card>
          )}

          {/* Character Anchors */}
          {scriptData.series_bible.character_anchors && scriptData.series_bible.character_anchors.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Character Anchors
              </h3>
              <div className="space-y-3">
                {scriptData.series_bible.character_anchors.map((char: any, i: number) => (
                  <div key={i} className="border-l-2 border-primary pl-3">
                    <p className="font-semibold">{char.name || char.id || `Character ${i + 1}`}</p>
                    {char.description && <p className="text-sm text-muted-foreground">{char.description}</p>}
                    {char.visual_anchor && <p className="text-sm mt-1">Visual: {char.visual_anchor}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Location Anchors */}
          {scriptData.series_bible.location_anchors && scriptData.series_bible.location_anchors.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Location Anchors
              </h3>
              <div className="space-y-3">
                {scriptData.series_bible.location_anchors.map((loc: any, i: number) => (
                  <div key={i} className="border-l-2 border-accent-primary pl-3">
                    <p className="font-semibold">{loc.name || loc.id || `Location ${i + 1}`}</p>
                    {loc.description && <p className="text-sm text-muted-foreground">{loc.description}</p>}
                    {loc.visual_anchor && <p className="text-sm mt-1">Visual: {loc.visual_anchor}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Do Not Change */}
          {scriptData.series_bible.do_not_change && scriptData.series_bible.do_not_change.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Continuity Rules
              </h3>
              <ul className="list-disc list-inside space-y-1">
                {scriptData.series_bible.do_not_change.map((rule, i) => (
                  <li key={i} className="text-sm">{rule}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
