import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { PLATFORM_USER_SCOPE, UserScope } from './tenant.constants';

export type TenantContextStore = {
  tenantId?: string | null;
  userId?: number | null;
  userScope?: UserScope | null;
};

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextStore>();

  run<T>(store: TenantContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getStore(): TenantContextStore {
    return this.storage.getStore() || {};
  }

  setTenantContext(input: TenantContextStore) {
    const store = this.getStore();
    Object.assign(store, input);
  }

  getTenantId(): string | null {
    return this.getStore().tenantId ?? null;
  }

  getUserId(): number | null {
    return this.getStore().userId ?? null;
  }

  getUserScope(): UserScope {
    return this.getStore().userScope || PLATFORM_USER_SCOPE;
  }

  isPlatformUser(): boolean {
    return this.getUserScope() === PLATFORM_USER_SCOPE;
  }
}
