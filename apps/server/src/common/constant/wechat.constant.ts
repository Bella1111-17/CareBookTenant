/**
 * 微信相关常量
 */

/** 微信 stable_token API 地址（推荐使用，避免 40001 错误） */
export const WECHAT_STABLE_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/stable_token';

/** 微信小程序 code2Session 接口 - 用 wx.login() 的 code 换取 openid */
export const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

/**
 * Redis TTL 常量（毫秒）
 * 微信 access_token 有效期 7200 秒，预留 300 秒缓冲 → 6900 秒
 */
export const RedisTTL = {
  /** 微信 access_token 缓存 TTL：6900 秒 = 6,900,000 毫秒 */
  WECHAT_ACCESS_TOKEN: 6900 * 1000,
} as const;
