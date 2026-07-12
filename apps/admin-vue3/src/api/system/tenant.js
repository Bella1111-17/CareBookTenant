import request from '@/utils/request'

export function listTenant(query) {
  return request({
    url: '/system/tenant/list',
    method: 'get',
    params: query,
  })
}

export function getTenant(tenantId) {
  return request({
    url: `/system/tenant/${tenantId}`,
    method: 'get',
  })
}

export function addTenant(data) {
  return request({
    url: '/system/tenant',
    method: 'post',
    data,
  })
}

export function updateTenant(data) {
  return request({
    url: '/system/tenant',
    method: 'put',
    data,
  })
}

export function initTenantAdmin(tenantId, data) {
  return request({
    url: `/system/tenant/${tenantId}/init-admin`,
    method: 'post',
    data,
  })
}
