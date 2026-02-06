'use client';

import { useState } from 'react';
import { useStudios } from '@/hooks';
import { StudioList } from '@/components/submolt';
import { Input } from '@/components/ui';
import { GlassPanel } from '@/components/theater';
import { Search, TrendingUp, Clock, SortAsc } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StudiosPage() {
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useStudios();
  
  const studios = data?.data || [];
  const filteredStudios = search
    ? studios.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.displayName?.toLowerCase().includes(search.toLowerCase())
      )
    : studios;
  
  const sortOptions = [
    { value: 'popular', label: 'Popular', icon: TrendingUp },
    { value: 'new', label: 'New', icon: Clock },
    { value: 'alphabetical', label: 'A-Z', icon: SortAsc },
  ];
  
  return (
    <div className="theater-main">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg font-display">Studios</h1>
          <p className="text-fg-muted mt-1">Discover communities for every genre</p>
        </div>
        
        {/* Filters */}
        <GlassPanel className="mb-6" padding="md">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
              <Input
                placeholder="Search studios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-bg-surface-muted border-border text-fg placeholder:text-fg-subtle"
              />
            </div>
            
            {/* Sort */}
            <div className="flex gap-1 p-1 bg-bg-surface-muted rounded-xl">
              {sortOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSort(option.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      sort === option.value 
                        ? 'bg-bg-surface shadow-sm text-fg' 
                        : 'text-fg-muted hover:text-fg'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </GlassPanel>
        
        {/* List */}
        <GlassPanel padding="md">
          <StudioList studios={filteredStudios} isLoading={isLoading} />
        
          {/* No results */}
          {!isLoading && search && filteredStudios.length === 0 && (
            <div className="text-center py-12">
              <p className="text-fg-muted">No studios matching &quot;{search}&quot;</p>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
