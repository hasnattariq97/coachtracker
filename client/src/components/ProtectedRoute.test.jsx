import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import * as AuthModule from '../context/AuthContext';

vi.mock('../context/AuthContext');

const DummyComponent = () => <div>Protected Content</div>;

describe('ProtectedRoute', () => {
  test('renders component if user is authenticated', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, email: 'coach@tracker.com', role: 'coach' },
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} />
      </Router>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects to login if user is not authenticated', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} />
      </Router>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('renders component if requiredRole matches user role', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, email: 'admin@tracker.com', role: 'admin' },
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} requiredRole="admin" />
      </Router>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects to login if requiredRole does not match user role', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: 2, email: 'coach@tracker.com', role: 'coach' },
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} requiredRole="admin" />
      </Router>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('accepts role check with multiple allowed roles', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: 2, email: 'coach@tracker.com', role: 'coach' },
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} requiredRole={['admin', 'coach']} />
      </Router>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects if user role not in allowed roles array', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: 2, email: 'unknown@tracker.com', role: 'guest' },
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} requiredRole={['admin', 'coach']} />
      </Router>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('displays loading state while authentication is loading', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true,
    });

    render(
      <Router>
        <ProtectedRoute component={DummyComponent} />
      </Router>
    );

    expect(screen.getByText(/Loading|Authenticating/i)).toBeInTheDocument();
  });

  test('accepts custom fallback component for unauthorized access', () => {
    const UnauthorizedComponent = () => <div>Access Denied</div>;

    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { id: 2, email: 'coach@tracker.com', role: 'coach' },
    });

    render(
      <Router>
        <ProtectedRoute
          component={DummyComponent}
          requiredRole="admin"
          fallback={UnauthorizedComponent}
        />
      </Router>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });
});
