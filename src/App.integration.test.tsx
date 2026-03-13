import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings';

describe('App Integration Test', () => {
  it('shows connecting state initially', async () => {
    const connectionBuilder = DbConnection.builder()
      .withUri('ws://localhost:3000')
      .withDatabaseName('discord-clono')
      .withToken(
        localStorage.getItem(
          'ws://localhost:3000/discord-clono/auth_token'
        ) || ''
      );
    render(
      <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
        <App />
      </SpacetimeDBProvider>
    );

    expect(screen.getByText(/Connecting to server.../i)).toBeInTheDocument();
  });
});
