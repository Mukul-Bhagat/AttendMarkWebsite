// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import api from '../../api';
import ResetPassword from '../ResetPassword';

vi.mock('../../api', () => ({
  default: {
    post: vi.fn(),
  },
}));

const renderResetPassword = (path: string, initialEntry: string) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={path} element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('ResetPassword token resolution', () => {
  beforeEach(() => {
    (api.post as any).mockResolvedValue({
      data: { msg: 'Password reset successful.' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('submits reset using token from query route', async () => {
    renderResetPassword('/reset-password', '/reset-password?token=query-token-123');

    const passwordInputs = screen.getAllByRole('textbox');
    fireEvent.change(passwordInputs[0], { target: { value: 'NewPass123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'NewPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/reset-password', {
        token: 'query-token-123',
        newPassword: 'NewPass123',
      });
    });
  });

  test('submits reset using token from legacy path route', async () => {
    renderResetPassword(
      '/reset-password/:collectionPrefix/:token',
      '/reset-password/org_demo/path-token-456',
    );

    const passwordInputs = screen.getAllByRole('textbox');
    fireEvent.change(passwordInputs[0], { target: { value: 'NewPass123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'NewPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set New Password' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/reset-password', {
        token: 'path-token-456',
        newPassword: 'NewPass123',
      });
    });
  });
});
