import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AgentDashboard from '../pages/admin/AgentDashboard';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from 'axios';

const mockAgentStatus = {
  groq_queue_pending: 5,
  monitoring: { timestamp: new Date().toISOString(), status: 'success', snapshots_created: 3, coaches_at_risk: 1 },
  support: { timestamp: new Date().toISOString(), status: 'success', actions_taken: 2 },
  reporting: { timestamp: new Date().toISOString(), status: 'success', report_generated: true },
};

const mockDecisions = {
  summary: {
    total_decisions: 42,
    groq_vs_fallback: { groq_confidence_avg: 0.87, fallback_count: 2 },
  },
  decisions: [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      agent_type: 'support_agent',
      coach_id: 1,
      groq_recommendation: 'email',
      final_action: 'email',
      groq_confidence: '0.92',
      overridden: false,
    },
  ],
};

const mockPatterns = {
  patterns: {
    procrastinator: { coaches: [1, 2], detections: 3 },
    steady: { coaches: [3], detections: 7 },
  },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AgentDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgentDashboard', () => {
  it('renders loading state initially', () => {
    axios.get.mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders 3 agent status cards after data loads', async () => {
    axios.get
      .mockResolvedValueOnce({ data: mockAgentStatus })
      .mockResolvedValueOnce({ data: mockDecisions })
      .mockResolvedValueOnce({ data: mockPatterns });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Monitoring Agent')).toBeTruthy();
      expect(screen.getByText('Support Agent')).toBeTruthy();
      expect(screen.getByText('Reporting Agent')).toBeTruthy();
    });
  });

  it('renders Groq queue pending count', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { ...mockAgentStatus, groq_queue_pending: 5 } })
      .mockResolvedValueOnce({ data: mockDecisions })
      .mockResolvedValueOnce({ data: mockPatterns });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('queue shows amber color when pending > 10', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { ...mockAgentStatus, groq_queue_pending: 15 } })
      .mockResolvedValueOnce({ data: mockDecisions })
      .mockResolvedValueOnce({ data: mockPatterns });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Monitor — approaching limit')).toBeTruthy();
    });
  });

  it('renders decision stats with total count', async () => {
    axios.get
      .mockResolvedValueOnce({ data: mockAgentStatus })
      .mockResolvedValueOnce({ data: mockDecisions })
      .mockResolvedValueOnce({ data: mockPatterns });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();
    });
  });

  it('renders coach patterns', async () => {
    axios.get
      .mockResolvedValueOnce({ data: mockAgentStatus })
      .mockResolvedValueOnce({ data: mockDecisions })
      .mockResolvedValueOnce({ data: mockPatterns });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Procrastinator')).toBeTruthy();
      expect(screen.getByText('3 detections')).toBeTruthy();
    });
  });

  it('renders decisions table with rows', async () => {
    axios.get
      .mockResolvedValueOnce({ data: mockAgentStatus })
      .mockResolvedValueOnce({ data: mockDecisions })
      .mockResolvedValueOnce({ data: mockPatterns });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Coach 1')).toBeTruthy();
    });
  });

  it('handles API error gracefully', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Failed to load agent data. Check backend connection.')).toBeTruthy();
    });
  });
});
