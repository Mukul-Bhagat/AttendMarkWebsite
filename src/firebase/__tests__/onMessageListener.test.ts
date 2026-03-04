import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOnMessage, mockGetMessagingInstance } = vi.hoisted(() => ({
  mockOnMessage: vi.fn(),
  mockGetMessagingInstance: vi.fn(),
}));

vi.mock('../firebase', () => ({
  getMessagingInstance: mockGetMessagingInstance,
}));

vi.mock('firebase/messaging', () => ({
  onMessage: mockOnMessage,
}));

import { onMessageListener } from '../onMessageListener';

describe('onMessageListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires callback to firebase onMessage handler', async () => {
    const payload = { notification: { title: 'Hello' } };
    const callback = vi.fn();

    mockGetMessagingInstance.mockResolvedValue({});
    mockOnMessage.mockImplementation((_messaging, handler) => {
      handler(payload);
      return vi.fn();
    });

    await onMessageListener(callback);

    expect(callback).toHaveBeenCalledWith(payload);
    expect(mockOnMessage).toHaveBeenCalledTimes(1);
  });
});
