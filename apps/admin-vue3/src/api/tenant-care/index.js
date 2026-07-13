import request from '@/utils/request'

export function listTenantOrgUnits(query) {
  return request({ url: '/tenant-care/org-unit/list', method: 'get', params: query })
}

export function createTenantOrgUnit(data) {
  return request({ url: '/tenant-care/org-unit', method: 'post', data })
}

export function updateTenantOrgUnit(data) {
  return request({ url: '/tenant-care/org-unit/update', method: 'post', data })
}

export function listTenantCaregivers(query) {
  return request({ url: '/tenant-care/caregiver/list', method: 'get', params: query })
}

export function createTenantCaregiver(data) {
  return request({ url: '/tenant-care/caregiver', method: 'post', data })
}

export function updateTenantCaregiver(data) {
  return request({ url: '/tenant-care/caregiver/update', method: 'post', data })
}

export function deleteTenantCaregiver(id) {
  return request({ url: '/tenant-care/caregiver/' + id, method: 'delete' })
}

export function createTenantDevice(data) {
  return request({ url: '/tenant-care/device', method: 'post', data })
}

export function updateTenantDevice(data) {
  return request({ url: '/tenant-care/device/update', method: 'post', data })
}

export function listTenantDevices(query) {
  return request({ url: '/tenant-care/device/list', method: 'get', params: query })
}

export function deleteTenantDevice(id) {
  return request({ url: '/tenant-care/device/' + id, method: 'delete' })
}

export function bindTenantBadge(data) {
  return request({ url: '/tenant-care/badge/bind', method: 'post', data })
}

export function unbindTenantBadge(data) {
  return request({ url: '/tenant-care/badge/unbind', method: 'post', data })
}

export function listTenantBadgeBindings(query) {
  return request({ url: '/tenant-care/badge/binding/list', method: 'get', params: query })
}

export function listTenantRecords(query) {
  return request({ url: '/tenant-care/record/list', method: 'get', params: query })
}

export function listTenantGpsLogs(query) {
  return request({ url: '/tenant-care/gps/list', method: 'get', params: query })
}

export function listTenantDeviceEvents(query) {
  return request({ url: '/tenant-care/event/list', method: 'get', params: query })
}

export function generateTenantDailyReport(data) {
  return request({ url: '/tenant-care/daily-report/generate', method: 'post', data })
}

export function listTenantDailyReports(query) {
  return request({ url: '/tenant-care/daily-report/list', method: 'get', params: query })
}

export function tenantDailyReportDetail(id) {
  return request({ url: '/tenant-care/daily-report/detail/' + id, method: 'get' })
}
