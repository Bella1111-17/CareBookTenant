import request from '@/utils/request'

// 璁惧涓绘。鍒楄〃
export function deviceList(query) {
  return request({ url: '/hardware/badge/device/list', method: 'get', params: query })
}

// 鏂板璁惧涓绘。
export function createDevice(data) {
  return request({ url: '/hardware/badge/device', method: 'post', data })
}

// 缂栬緫璁惧涓绘。
export function updateDevice(data) {
  return request({ url: '/hardware/badge/device/update', method: 'post', data })
}

// 澶氱骇鏍￠獙鍒犻櫎璁惧涓绘。
export function deleteDevice(data) {
  return request({ url: '/hardware/badge/device/delete-review', method: 'post', data })
}

// Restore deleted device
export function restoreDevice(id) {
  return request({ url: '/hardware/badge/device/restore/' + id, method: 'post' })
}

// 璁惧缁戝畾鍒楄〃
export function bindingList(query) {
  return request({ url: '/hardware/badge/binding/list', method: 'get', params: query })
}

// 璁惧缁戝畾姒傝
export function bindingDeviceSummary(query) {
  return request({ url: '/hardware/badge/binding/device-summary', method: 'get', params: query })
}

// 缁戝畾璁惧
export function bindDevice(data) {
  return request({ url: '/hardware/badge/bind', method: 'post', data })
}

// 瑙ｇ粦璁惧
export function unbindDevice(data) {
  return request({ url: '/hardware/badge/unbind', method: 'post', data })
}

// 褰曢煶璁板綍鍒楄〃
export function recordList(query) {
  return request({ url: '/hardware/badge/record/list', method: 'get', params: query })
}

// 鍒犻櫎褰曢煶璁板綍
export function delRecord(id) {
  return request({ url: '/hardware/badge/record/' + id, method: 'delete' })
}

// 鎵嬪姩瑙﹀彂ASR杞啓
export function transcribeRecord(id) {
  return request({ url: '/hardware/badge/transcribe/' + id, method: 'post' })
}

// 浠庡師濮婮SON閲嶇粍transcriptText
export function rebuildTranscriptText(data) {
  return request({ url: '/hardware/badge/record/rebuild-text', method: 'post', data })
}

// GPS瀹氫綅鍒楄〃
export function gpsLogList(query) {
  return request({ url: '/hardware/badge/gps/list', method: 'get', params: query })
}

// 璁惧浜嬩欢鍒楄〃
export function eventLogList(query) {
  return request({ url: '/hardware/badge/event/list', method: 'get', params: query })
}

// AI鏃ユ姤鍒楄〃
export function reportList(query) {
  return request({ url: '/hardware/badge/audit/report/list', method: 'get', params: query })
}

// AI鏃ユ姤璇︽儏(鍚ぇ鏂囨湰)
export function reportDetail(id) {
  return request({ url: '/hardware/badge/audit/report/detail/' + id, method: 'get' })
}

// 鐢熸垚鎶ゅ伐鏃ユ姤
export function generateReport(data) {
  return request({ url: '/hardware/badge/audit/report/generate', method: 'post', data })
}
