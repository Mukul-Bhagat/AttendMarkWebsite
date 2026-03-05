import {
  BulkActionResponse,
  ManageEntity,
  ManageListQuery,
  ManageListResponse,
  manageEntityService,
} from './manageEntityService';

export const staffService = {
  fetchList<T extends ManageEntity = ManageEntity>(query: ManageListQuery): Promise<ManageListResponse<T>> {
    return manageEntityService.fetchList<T>('staff', query);
  },
  bulkResetDevice(userIds: string[]): Promise<BulkActionResponse> {
    return manageEntityService.bulkResetDevice('staff', userIds);
  },
  bulkDelete(userIds: string[]): Promise<BulkActionResponse> {
    return manageEntityService.bulkDelete('staff', userIds);
  },
  bulkQuota(payload: { userIds: string[]; pl?: number; cl?: number; sl?: number; resetToDefault?: boolean }): Promise<BulkActionResponse> {
    return manageEntityService.bulkQuota('staff', payload);
  },
  bulkGrace(payload: { userIds: string[]; gracePeriodMinutes?: number; resetToDefault?: boolean }): Promise<BulkActionResponse> {
    return manageEntityService.bulkGrace('staff', payload);
  },
};
