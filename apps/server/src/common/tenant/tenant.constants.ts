export const PLATFORM_USER_SCOPE = 'platform';
export const TENANT_USER_SCOPE = 'tenant';
export const PLATFORM_SELF_TENANT_ID = '1';

export type UserScope = typeof PLATFORM_USER_SCOPE | typeof TENANT_USER_SCOPE;
