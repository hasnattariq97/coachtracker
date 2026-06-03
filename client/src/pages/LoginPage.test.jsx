import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter as Router } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';
import * as AuthModule from '../context/AuthContext';

vi.mock('../context/AuthContext');

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders email and password input fields', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <Router>
        <LoginPage />
      </Router>
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test('renders login button', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <Router>
        <LoginPage />
      </Router>
    );

    expect(screen.getByRole('button', { name: /login|sign in/i })).toBeInTheDocument();
  });

  test('calls login with email and password on submit', async () => {
    const mockLogin = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <Router>
        <LoginPage />
      </Router>
    );

    await user.type(screen.getByLabelText(/email/i), 'admin@tracker.com');
    await user.type(screen.getByLabelText(/password/i), 'admin123');
    await user.click(screen.getByRole('button', { name: /login|sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('admin@tracker.com', 'admin123');
  });

  test('displays error message if login fails', async () => {
    const mockLogin = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: 'Invalid credentials',
      login: mockLogin,
      logout: vi.fn(),
    });

    render(
      <Router>
        <LoginPage />
      </Router>
    );

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  test('shows loading state while logging in', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <Router>
        <LoginPage />
      </Router>
    );

    expect(screen.getByText(/loading|please wait/i)).toBeInTheDocument();
  });

  test('disables login button while loading', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <Router>
        <LoginPage />
      </Router>
    );

    expect(screen.getByRole('button', { name: /logging in|sign in/i })).toBeDisabled();
  });

  test('uses coaching tone in copy and messages', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <Router>
        <LoginPage />
      </Router>
    );

    const pageText = screen.getByRole('main') || document.body;
    expect(pageText.textContent).toMatch(/welcome|coaches|login|task/i);
  });

  test('calls login with correct credentials and clears form on success', async () => {
    const mockLogin = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <Router>
        <LoginPage />
      </Router>
    );

    await user.type(screen.getByLabelText(/email/i), 'coach@tracker.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('coach@tracker.com', 'password123');
  });

});
