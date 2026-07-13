import { SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from './tenant-context.service';
import { TENANT_USER_SCOPE } from './tenant.constants';

type TenantScopeOptions = {
  tenantColumn?: string;
  requestedTenantId?: string | null;
};

export function applyTenantScope<T>(qb: SelectQueryBuilder<T>, alias: string, tenantContextService: TenantContextService, options: TenantScopeOptions = {}): SelectQueryBuilder<T> {
  const tenantColumn = options.tenantColumn || 'tenantId';
  const requestedTenantId = String(options.requestedTenantId || '').trim();
  const tenantId = tenantContextService.getTenantId();

  if (tenantContextService.isPlatformUser()) {
    if (!requestedTenantId) {
      return qb;
    }
    return qb.andWhere(`${alias}.${tenantColumn} = :tenantScopeTenantId`, {
      tenantScopeTenantId: requestedTenantId,
    });
  }

  if (!tenantId) {
    if (tenantContextService.getUserScope() === TENANT_USER_SCOPE) {
      return qb.andWhere('1 = 0');
    }
    return qb;
  }

  return qb.andWhere(`${alias}.${tenantColumn} = :tenantScopeTenantId`, {
    tenantScopeTenantId: tenantId,
  });
}
