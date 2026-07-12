import { login, logout, getInfo, refreshToken } from '@/api/login'
import { getToken, getRefreshToken, setToken, setRefreshToken, removeToken } from '@/utils/auth'
import usePermissionStore from '@/store/modules/permission'
import defAva from '@/assets/images/profile.png'

function resolveAvatarUrl(avatar) {
  if (!avatar) return defAva
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar
  return import.meta.env.VITE_APP_BASE_API + avatar
}

const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    refreshToken: getRefreshToken(),
    name: '',
    avatar: '',
    userScope: '',
    tenantId: '',
    tenantName: '',
    roles: [],
    permissions: []
  }),
  actions: {
    // 登录
    login(userInfo) {
      const userName = userInfo.userName.trim()
      const password = userInfo.password
      const code = userInfo.code
      const uuid = userInfo.uuid
      return new Promise((resolve, reject) => {
        login(userName, password, code, uuid)
          .then((res) => {
            const permissionStore = usePermissionStore()
            const token = res.data?.accessToken || res.data?.token
            const refresh = res.data?.refreshToken
            setToken(token)
            if (refresh) {
              setRefreshToken(refresh)
            }
            this.token = token
            this.refreshToken = refresh || ''
            this.roles = []
            this.permissions = []
            permissionStore.setRoutesLoaded(false)
            resolve()
          })
          .catch((error) => {
            reject(error)
          })
      })
    },
    refreshTokenAction() {
      return new Promise((resolve, reject) => {
        if (!this.refreshToken) {
          reject(new Error('missing refresh token'))
          return
        }
        refreshToken(this.refreshToken)
          .then((res) => {
            const token = res.data?.accessToken
            const refresh = res.data?.refreshToken
            setToken(token)
            if (refresh) {
              setRefreshToken(refresh)
            }
            this.token = token
            this.refreshToken = refresh || ''
            resolve(res.data || res)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },
    // 获取用户信息
    getInfo() {
      return new Promise((resolve, reject) => {
        getInfo()
          .then((res) => {
            const data = res.data || res
            const user = data.user
            const avatar = resolveAvatarUrl(user.avatar)

            if (data.roles && data.roles.length > 0) {
              // 验证返回的roles是否是一个非空数组
              this.roles = data.roles
              this.permissions = data.permissions
            } else {
              this.roles = ['ROLE_DEFAULT']
            }
            this.name = user.userName
            this.avatar = avatar
            this.userScope = user.userScope || ''
            this.tenantId = user.tenantId || ''
            this.tenantName = user.tenantName || ''
            resolve(data)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },
    // 退出系统
    logOut() {
      return new Promise((resolve, reject) => {
        logout(this.token)
          .then(() => {
            const permissionStore = usePermissionStore()
            this.token = ''
            this.refreshToken = ''
            this.roles = []
            this.permissions = []
            this.userScope = ''
            this.tenantId = ''
            this.tenantName = ''
            permissionStore.setRoutesLoaded(false)
            removeToken()
            resolve()
          })
          .catch((error) => {
            reject(error)
          })
      })
    }
  }
})

export default useUserStore
