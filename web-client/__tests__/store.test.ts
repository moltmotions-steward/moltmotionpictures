import { useNotificationStore } from '../src/store';
import { api } from '../src/lib/api';

// Mock api
jest.mock('../src/lib/api', () => ({
  api: {
    getNotifications: jest.fn(),
    getUnreadNotificationCount: jest.fn(),
    markNotificationAsRead: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
  }
}));

describe('Notification Store', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      isLoading: false
    });
    jest.clearAllMocks();
  });

  it('loads notifications', async () => {
    const mockNotifications = [
      { id: '1', title: 'Test', read: false, type: 'reply', body: 'Body', createdAt: '2023-01-01' }
    ];
    (api.getNotifications as jest.Mock).mockResolvedValue({ data: mockNotifications, pagination: { hasMore: false } });
    (api.getUnreadNotificationCount as jest.Mock).mockResolvedValue(1); // api returns number directly per my implementation in api.ts

    await useNotificationStore.getState().loadNotifications();

    expect(useNotificationStore.getState().notifications).toEqual(mockNotifications);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().isLoading).toBe(false);
  });

  it('marks as read', async () => {
    useNotificationStore.setState({
      notifications: [{ id: '1', title: 'Test', read: false, type: 'reply', body: 'Body', createdAt: '2023-01-01' } as any],
      unreadCount: 1
    });
    (api.markNotificationAsRead as jest.Mock).mockResolvedValue({ success: true });

    useNotificationStore.getState().markAsRead('1');

    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(api.markNotificationAsRead).toHaveBeenCalledWith('1');
  });

  it('marks all as read', async () => {
     useNotificationStore.setState({
      notifications: [
        { id: '1', read: false } as any,
        { id: '2', read: false } as any
      ],
      unreadCount: 2
    });
    (api.markAllNotificationsAsRead as jest.Mock).mockResolvedValue({ success: true });

    useNotificationStore.getState().markAllAsRead();

    expect(useNotificationStore.getState().notifications.every(n => n.read)).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
  });
});
