import request from '@/utils/request'

// 文件列表
export function listUpload(query) {
  return request({
    url: '/common/upload/list',
    method: 'get',
    params: query
  })
}

// 文件详情
export function getUpload(uploadId) {
  return request({
    url: '/common/upload/detail/' + uploadId,
    method: 'get'
  })
}

// 删除文件
export function delUpload(uploadId) {
  return request({
    url: '/common/upload/' + uploadId,
    method: 'delete'
  })
}

// 批量删除
export function batchDelUpload(uploadIds) {
  return request({
    url: '/common/upload/batch',
    method: 'delete',
    data: { uploadIds }
  })
}

// 单文件上传
export function uploadFile(data) {
  return request({
    url: '/common/upload',
    method: 'post',
    data: data,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
