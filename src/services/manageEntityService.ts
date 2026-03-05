import api from '../api';

export type ManageEntityType = 'users' | 'staff';

export interface ManageEntity {
  _id?: string;
  id?: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  profileImageUrl?: string;
  profilePicture?: string;
  registeredDeviceId?: string;
  customLeaveQuota?: {
    pl: number;
    cl: number;
    sl: number;
  } | null;
  createdAt?: string;
}

export interface ManageListQuery {
  search?: string;
  status?: 'Locked' | 'Unlocked' | 'All Status';
  role?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'role' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ManageListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface BulkActionResponse {
  success: boolean;
  action: string;
  requestedCount: number;
  updatedCount: number;
  failedCount: number;
  failedIds: string[];
  failed: Array<{ id: string; reason: string }>;
}

const LIST_CATEGORY: Record<ManageEntityType, string> = {
  users: 'users',
  staff: 'staff',
};

const BULK_ENDPOINTS: Record<ManageEntityType, {
  resetDevice: string;
  delete: string;
  quota: string;
  grace: string;
}> = {
  users: {
    resetDevice: '/api/users/bulk-reset-device',
    delete: '/api/users/bulk-delete',
    quota: '/api/users/bulk-quota',
    grace: '/api/users/bulk-grace',
  },
  staff: {
    resetDevice: '/api/staff/bulk-reset-device',
    delete: '/api/staff/bulk-delete',
    quota: '/api/staff/bulk-leave-quota',
    grace: '/api/staff/bulk-grace',
  },
};

const normalizeStatus = (status?: ManageListQuery['status']): string | undefined => {
  if (!status || status === 'All Status') {
    return undefined;
  }
  return status;
};

export const manageEntityService = {
  async fetchList<T extends ManageEntity>(
    entityType: ManageEntityType,
    query: ManageListQuery,
  ): Promise<ManageListResponse<T>> {
    const params = {
      paginate: true,
      category: LIST_CATEGORY[entityType],
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      search: query.search || undefined,
      status: normalizeStatus(query.status),
      role: query.role || undefined,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };

    const { data } = await api.get<ManageListResponse<T>>('/api/users/my-organization', { params });
    return data;
  },

  async bulkResetDevice(entityType: ManageEntityType, userIds: string[]): Promise<BulkActionResponse> {
    const { data } = await api.post<BulkActionResponse>(BULK_ENDPOINTS[entityType].resetDevice, { userIds });
    return data;
  },

  async bulkDelete(entityType: ManageEntityType, userIds: string[]): Promise<BulkActionResponse> {
    const { data } = await api.delete<BulkActionResponse>(BULK_ENDPOINTS[entityType].delete, { data: { userIds } });
    return data;
  },

  async bulkQuota(
    entityType: ManageEntityType,
    payload: { userIds: string[]; pl?: number; cl?: number; sl?: number; resetToDefault?: boolean },
  ): Promise<BulkActionResponse> {
    const { data } = await api.patch<BulkActionResponse>(BULK_ENDPOINTS[entityType].quota, payload);
    return data;
  },

  async bulkGrace(
    entityType: ManageEntityType,
    payload: { userIds: string[]; gracePeriodMinutes?: number; resetToDefault?: boolean },
  ): Promise<BulkActionResponse> {
    const { data } = await api.patch<BulkActionResponse>(BULK_ENDPOINTS[entityType].grace, payload);
    return data;
  },
};
