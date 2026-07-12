import router, { notFoundRoute } from './router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import { isHttp } from '@/utils/validate'
import { isRelogin } from '@/utils/request'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'

NProgress.configure({ showSpinner: false })

const whiteList = ['/login', '/register']

function resolveTenantLanding(to) {
  const userStore = useUserStore()
  if (userStore.userScope !== 'tenant') {
    return null
  }
  if (to.path === '/' || to.path === '/index') {
    return '/tenant-care/device'
  }
  return null
}

function addAccessRoutes(accessRoutes) {
  accessRoutes.forEach(route => {
    if (isHttp(route.path)) return
    if (route.path && !route.path.startsWith('/')) {
      route.path = '/' + route.path
    }
    router.addRoute(route)
  })
  router.addRoute(notFoundRoute)
}

function ensureDynamicRoutes() {
  const permissionStore = usePermissionStore()
  if (permissionStore.routesLoaded) {
    return Promise.resolve(false)
  }
  return permissionStore.generateRoutes().then(accessRoutes => {
    addAccessRoutes(accessRoutes)
    permissionStore.setRoutesLoaded(true)
    return true
  })
}

router.beforeEach((to, from, next) => {
  NProgress.start()
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title)
    if (to.path === '/login') {
      next({ path: '/' })
      NProgress.done()
      return
    }

    const userStore = useUserStore()
    const loadUserInfo = userStore.roles.length === 0 ? userStore.getInfo() : Promise.resolve()

    if (userStore.roles.length === 0) {
      isRelogin.show = true
    }

    loadUserInfo
      .then(() => {
        isRelogin.show = false
        return ensureDynamicRoutes()
      })
      .then(routesJustLoaded => {
        const tenantLanding = resolveTenantLanding(to)
        if (tenantLanding) {
          next({ path: tenantLanding, replace: true })
          return
        }
        if (routesJustLoaded) {
          next({ ...to, replace: true })
          return
        }
        next()
      })
      .catch(err => {
        userStore.logOut().then(() => {
          ElMessage.error(err)
          next({ path: '/' })
        })
      })
  } else {
    if (whiteList.indexOf(to.path) !== -1) {
      next()
    } else {
      next(`/login?redirect=${to.fullPath}`)
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})
