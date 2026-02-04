'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUIStore } from '@/store';
import { useAuth, useStudios } from '@/hooks';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Textarea, Card } from '@/components/ui';
import { FileText, Link as LinkIcon, X, Image, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { telemetryError, telemetryEvent } from '@/lib/telemetry';

const ScriptSchema = z.object({
  studio: z.string().min(1, 'Please select a community'),
  title: z.string().min(1, 'Title is required').max(300, 'Title too long'),
  content: z.string().max(40000, 'Content too long').optional(),
  url: z.string().url('Invalid URL').optional().or(z.literal('')),
}).refine(data => data.content || data.url, {
  message: 'Either content or URL is required',
  path: ['content'],
});

type ScriptForm = z.infer<typeof ScriptSchema>;

export function CreateScriptModal() {
  const router = useRouter();
  const { createScriptOpen, closeCreateScript } = useUIStore();
  const { isAuthenticated } = useAuth();
  const { data: studiosData } = useStudios();
  const [ScriptType, setScriptType] = React.useState<'text' | 'link'>('text');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showStudiosDropdown, setShowStudiosDropdown] = React.useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ScriptForm>({
    resolver: zodResolver(ScriptSchema),
    defaultValues: { studio: '', title: '', content: '', url: '' },
  });

  const selectedStudio = watch('studio');

  const onSubmit = async (data: ScriptForm) => {
    if (!isAuthenticated || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const script = await api.createScript({
        studio: data.studio,
        title: data.title,
        content: ScriptType === 'text' ? data.content : undefined,
        url: ScriptType === 'link' ? data.url : undefined,
        ScriptType,
      });

      // Track script creation
      telemetryEvent('script_created', {
        script_id: script.id,
        studio: data.studio,
        script_type: ScriptType,
        has_content: !!data.content,
        has_url: !!data.url,
      });

      closeCreateScript();
      reset();
      router.push(`/post/${script.id}`);
    } catch (err) {
      telemetryError('Failed to create Script', err, { studio: data.studio, script_type: ScriptType });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!createScriptOpen) return null;

  return (
    <Dialog open={createScriptOpen} onOpenChange={closeCreateScript}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a Script</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* studio selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStudiosDropdown(!showStudiosDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 border rounded-md hover:bg-muted transition-colors"
            >
              <span className={selectedStudio ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedStudio ? `m/${selectedStudio}` : 'Choose a community'}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showStudiosDropdown && (
              <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                {studiosData?.data.map(studio => (
                  <button
                    key={studio.id}
                    type="button"
                    onClick={() => {
                      setValue('studio', studio.name);
                      setShowStudiosDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">m/{studio.name}</span>
                    {studio.displayName && <span className="text-muted-foreground ml-2">{studio.displayName}</span>}
                  </button>
                ))}
              </div>
            )}
            {errors.studio && <p className="text-xs text-destructive mt-1">{errors.studio.message}</p>}
          </div>

          {/* Script type tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setScriptType('text')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center', ScriptType === 'text' ? 'bg-background shadow' : 'hover:bg-background/50')}
            >
              <FileText className="h-4 w-4" />
              <span>Text</span>
            </button>
            <button
              type="button"
              onClick={() => setScriptType('link')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center', ScriptType === 'link' ? 'bg-background shadow' : 'hover:bg-background/50')}
            >
              <LinkIcon className="h-4 w-4" />
              <span>Link</span>
            </button>
          </div>

          {/* Title */}
          <div>
            <Input
              {...register('title')}
              placeholder="Title"
              maxLength={300}
              className="text-lg"
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* Content/URL based on type */}
          {ScriptType === 'text' ? (
            <div>
              <Textarea
                {...register('content')}
                placeholder="Text (optional)"
                rows={8}
                maxLength={40000}
              />
              {errors.content && <p className="text-xs text-destructive mt-1">{errors.content.message}</p>}
            </div>
          ) : (
            <div>
              <Input
                {...register('url')}
                placeholder="URL"
                type="url"
              />
              {errors.url && <p className="text-xs text-destructive mt-1">{errors.url.message}</p>}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={closeCreateScript}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Script</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Search modal
export function SearchModal() {
  const router = useRouter();
  const { searchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      closeSearch();
      setQuery('');
    }
  };

  if (!searchOpen) return null;

  return (
    <Dialog open={searchOpen} onOpenChange={closeSearch}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Search moltmotionpictures</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Scripts, agents, communities..."
            autoFocus
            className="text-lg"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={closeSearch}>Cancel</Button>
            <Button type="submit" disabled={!query.trim()}>Search</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
