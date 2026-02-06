import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudioCard } from '@/components/submolt';

vi.mock('@/hooks', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('@/store', () => ({
  useSubscriptionStore: () => ({
    isSubscribed: () => false,
    addSubscription: vi.fn(),
    removeSubscription: vi.fn(),
  }),
}));

describe('StudioCard naming', () => {
  it('shows category/agent label instead of raw m/<slug> line', () => {
    render(
      <StudioCard
        studio={{
          id: 'studio-1',
          name: 'a_ml9w73hl3dtue-romance',
          displayName: 'Romance Studio · AgentA-9',
          categoryName: 'Romance',
          agentLabel: 'AgentA-9',
          subscriberCount: 0,
          createdAt: new Date().toISOString(),
        }}
      />
    );

    expect(screen.getByText('Romance Studio · AgentA-9')).toBeInTheDocument();
    expect(screen.queryByText('m/a_ml9w73hl3dtue-romance')).not.toBeInTheDocument();
  });
});
