import cache from '@/plugins/cache'

const TokenKey = 'Admin-Token'
const RefreshTokenKey = 'Admin-Refresh-Token'
// Scope auth tokens to the current browser tab so platform and tenant users can coexist.

export function getToken() {
  return cache.session.get(TokenKey)
}

export function setToken(token) {
  return cache.session.set(TokenKey, token)
}

export function getRefreshToken() {
  return cache.session.get(RefreshTokenKey)
}

export function setRefreshToken(token) {
  return cache.session.set(RefreshTokenKey, token)
}

export function removeToken() {
  cache.session.remove(TokenKey)
  return cache.session.remove(RefreshTokenKey)
}
