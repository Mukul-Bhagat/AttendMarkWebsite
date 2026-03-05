import {
  BulkActionResponse,
  ManageEntity,
  ManageListQuery,
  ManageListResponse,
  manageEntityService,
} from './manageEntityService';

export const userService = {
  fetchList<T extends ManageEntity = ManageEntity>(query: ManageListQuery): Promise<ManageListResponse<T>> {
    return manageEntityService.fetchList<T>('users', query);
  },
  bulkResetDevice(userIds: string[]): Promise<BulkActionResponse> {
    return manageEntityService.bulkResetDevice('users', userIds);
  },
  bulkDelete(userIds: string[]): Promise<BulkActionResponse> {
    return manageEntityService.bulkDelete('users', userIds);
  },
  bulkQuota(payload: { userIds: string[]; pl?: number; cl?: number; sl?: number; resetToDefault?: boolean }): Promise<BulkActionResponse> {
    return manageEntityService.bulkQuota('users', payload);
  },
  bulkGrace(payload: { userIds: string[]; gracePeriodMinutes?: number; resetToDefault?: boolean }): Promise<BulkActionResponse> {
    return manageEntityService.bulkGrace('users', payload);
  },
};
