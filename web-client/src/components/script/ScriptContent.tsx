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
            <span className="text-foreground">{scriptData.genre}</span>
          </div>
        )}
        {scriptData.format && (
          <div>
            <span className="font-semibold text-muted-foreground">Format:</span>{' '}
            <span className="text-foreground">{scriptData.format}</span>
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
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {shot.scene_number}. {shot.title}
                    </h3>
                    {shot.location_id && (
                      <p className="text-sm text-muted-foreground">Location: {shot.location_id}</p>
                    )}
                  </div>
                  {shot.audio_type && (
                    <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground uppercase">
                      {shot.audio_type}
                    </span>
                  )}
                </div>

                {shot.visual_prompt && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Visual:</p>
                    <p className="text-base leading-relaxed">{shot.visual_prompt}</p>
                  </div>
                )}

                {shot.narration && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Narration:</p>
                    <p className="text-base leading-relaxed italic">{shot.narration}</p>
                  </div>
                )}

                {shot.dialogue && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Dialogue:</p>
                    <div className="text-base leading-relaxed">
                      {typeof shot.dialogue === 'string' ? (
                        <p className="italic">{shot.dialogue}</p>
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans italic">
                          {JSON.stringify(shot.dialogue, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {shot.character_ids && shot.character_ids.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Characters:</p>
                    <div className="flex flex-wrap gap-2">
                      {shot.character_ids.map((charId, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                          {charId}
                        </span>
                      ))}
                    </div>
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

          {/* Characters */}
          {scriptData.series_bible.characters && Object.keys(scriptData.series_bible.characters).length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Characters
              </h3>
              <div className="space-y-3">
                {Object.entries(scriptData.series_bible.characters).map(([id, char]: [string, any]) => (
                  <div key={id} className="border-l-2 border-primary pl-3">
                    <p className="font-semibold">{id}</p>
                    {char.name && <p className="text-sm">Name: {char.name}</p>}
                    {char.description && <p className="text-sm text-muted-foreground">{char.description}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Locations */}
          {scriptData.series_bible.locations && Object.keys(scriptData.series_bible.locations).length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Locations
              </h3>
              <div className="space-y-3">
                {Object.entries(scriptData.series_bible.locations).map(([id, loc]: [string, any]) => (
                  <div key={id} className="border-l-2 border-accent-primary pl-3">
                    <p className="font-semibold">{id}</p>
                    {loc.name && <p className="text-sm">Name: {loc.name}</p>}
                    {loc.description && <p className="text-sm text-muted-foreground">{loc.description}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Themes */}
          {scriptData.series_bible.themes && scriptData.series_bible.themes.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Themes
              </h3>
              <div className="flex flex-wrap gap-2">
                {scriptData.series_bible.themes.map((theme, i) => (
                  <span key={i} className="text-sm px-3 py-1 rounded-full bg-muted text-foreground">
                    {theme}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
