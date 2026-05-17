import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import axios from 'axios';

vi.mock('axios');

// Clear localStorage and mocks before each test
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthContext', () => {

  test('useAuth provides login, logout, isAuthenticated, user, loading, error', () => {
    const TestComponent = () => {
      const { login, logout, isAuthenticated, user, loading, error } = useAuth();
      return (
        <div>
          {isAuthenticated ? <span>Logged in</span> : <span>Logged out</span>}
          {loading && <span>Loading...</span>}
          {error && <span>Error: {error}</span>}
          {user && <span>User: {user.email}</span>}
          <button onClick={() => login('test@example.com', 'password')}>Login</button>
          <button onClick={logout}>Logout</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Logged out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  test('login() calls POST /api/auth/login with credentials and stores token', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0cmFja2VyLmNvbSIsInJvbGUiOiJhZG1pbiJ9.signature';

    axios.post.mockResolvedValue({ data: { token: mockToken } });

    const TestComponent = () => {
      const { login, isAuthenticated, user } = useAuth();
      return (
        <div>
          {isAuthenticated && <span>Authenticated: {user.role}</span>}
          <button onClick={() => login('admin@tracker.com', 'admin123')}>Login</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByRole('button', { name: 'Login' });
    await user.click(loginButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'admin@tracker.com',
        password: 'admin123',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Authenticated: admin')).toBeInTheDocument();
    });

    expect(localStorage.getItem('token')).toBe(mockToken);
  });

  test('logout() clears token and isAuthenticated becomes false', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0cmFja2VyLmNvbSIsInJvbGUiOiJhZG1pbiJ9.signature';
    localStorage.setItem('token', mockToken);

    const TestComponent = () => {
      const { logout, isAuthenticated } = useAuth();
      return (
        <div>
          {isAuthenticated ? <span>Logged in</span> : <span>Logged out</span>}
          <button onClick={logout}>Logout</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Logged in')).toBeInTheDocument();

    const logoutButton = screen.getByRole('button', { name: 'Logout' });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByText('Logged out')).toBeInTheDocument();
    });

    expect(localStorage.getItem('token')).toBeNull();
  });

  test('AuthContext restores token from localStorage on mount', () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJjb2FjaEB0cmFja2VyLmNvbSIsInJvbGUiOiJjb2FjaCJ9.signature';
    localStorage.setItem('token', mockToken);

    const TestComponent = () => {
      const { isAuthenticated, user } = useAuth();
      return (
        <div>
          {isAuthenticated && <span>User: {user.email}, Role: {user.role}</span>}
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('User: coach@tracker.com, Role: coach')).toBeInTheDocument();
  });

  test('login() sets loading=true during API call, false after', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0cmFja2VyLmNvbSIsInJvbGUiOiJhZG1pbiJ9.signature';

    let resolveLogin;
    const loginPromise = new Promise(resolve => { resolveLogin = resolve; });
    axios.post.mockReturnValue(loginPromise);

    const TestComponent = () => {
      const { login, loading } = useAuth();
      return (
        <div>
          {loading ? <span>Loading...</span> : <span>Not loading</span>}
          <button onClick={() => login('admin@tracker.com', 'admin123')}>Login</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Not loading')).toBeInTheDocument();

    const loginButton = screen.getByRole('button', { name: 'Login' });
    await user.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    resolveLogin({ data: { token: mockToken } });

    await waitFor(() => {
      expect(screen.getByText('Not loading')).toBeInTheDocument();
    });
  });

  test('login() sets error state if POST fails', async () => {
    axios.post.mockRejectedValue(new Error('Invalid credentials'));

    const TestComponent = () => {
      const { login, error } = useAuth();
      return (
        <div>
          {error && <span>Error: {error}</span>}
          <button onClick={() => login('wrong@example.com', 'wrong')}>Login</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByRole('button', { name: 'Login' });
    await user.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  test('useAuth decodes JWT payload correctly', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJzYXJhaEB0cmFja2VyLmNvbSIsInJvbGUiOiJjb2FjaCJ9.signature';

    axios.post.mockResolvedValue({ data: { token: mockToken } });

    const TestComponent = () => {
      const { login, user } = useAuth();
      return (
        <div>
          <button onClick={() => login('sarah@tracker.com', 'password')}>Login</button>
          {user && (
            <div>
              <span>ID: {user.id}</span>
              <span>Email: {user.email}</span>
              <span>Role: {user.role}</span>
            </div>
          )}
        </div>
      );
    };

    const userSetup = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByRole('button', { name: 'Login' });
    await userSetup.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('ID: 2')).toBeInTheDocument();
      expect(screen.getByText('Email: sarah@tracker.com')).toBeInTheDocument();
      expect(screen.getByText('Role: coach')).toBeInTheDocument();
    });
  });

  test('logout() clears user data and sets isAuthenticated to false', async () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0cmFja2VyLmNvbSIsInJvbGUiOiJhZG1pbiJ9.signature';
    localStorage.setItem('token', mockToken);

    const TestComponent = () => {
      const { logout, user, isAuthenticated } = useAuth();
      return (
        <div>
          {isAuthenticated && user && <span>User: {user.email}</span>}
          {!isAuthenticated && <span>No user</span>}
          <button onClick={logout}>Logout</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('User: admin@tracker.com')).toBeInTheDocument();

    const logoutButton = screen.getByRole('button', { name: 'Logout' });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument();
    });
  });
});
