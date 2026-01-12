// 工具函数

/**
 * 格式化时间戳
 */
export function formatTime(timestamp: number, format: string = 'HH:mm'): string {
  const date = new Date(timestamp * 1000)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  if (format === 'HH:mm') {
    return `${hours}:${minutes}`
  } else if (format === 'MM-DD HH:mm') {
    return `${month}-${day} ${hours}:${minutes}`
  }
  return `${hours}:${minutes}`
}

/**
 * 格式化数字
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals)
}

/**
 * 格式化价格
 */
export function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (num >= 1000) {
    return num.toFixed(2)
  } else if (num >= 1) {
    return num.toFixed(4)
  } else {
    return num.toFixed(6)
  }
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * 计算涨跌幅
 */
export function calculateChange(current: string, open: string): number {
  const curr = parseFloat(current)
  const op = parseFloat(open)
  return ((curr - op) / op) * 100
}

/**
 * 获取涨跌颜色
 */
export function getPriceColor(current: string, open: string): string {
  const change = calculateChange(current, open)
  return change >= 0 ? '#00c853' : '#ff5252'
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: number | null = null
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }) as T
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: number | null = null
  return ((...args: any[]) => {
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        func.apply(this, args)
      }, wait)
    }
  }) as T
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 存储数据
 */
export function setStorage(key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.setStorage({
      key,
      data: value,
      success: () => resolve(),
      fail: (err) => reject(err)
    })
  })
}

/**
 * 获取存储数据
 */
export function getStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    wx.getStorage({
      key,
      success: (res) => resolve(res.data as T),
      fail: () => resolve(null)
    })
  })
}

/**
 * 移除存储数据
 */
export function removeStorage(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.removeStorage({
      key,
      success: () => resolve(),
      fail: (err) => reject(err)
    })
  })
}

/**
 * 显示Toast提示
 */
export function showToast(title: string, icon: 'success' | 'error' | 'loading' | 'none' = 'none', duration: number = 2000): void {
  wx.showToast({
    title,
    icon,
    duration
  })
}

/**
 * 显示Loading
 */
export function showLoading(title: string = '加载中...'): void {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏Loading
 */
export function hideLoading(): void {
  wx.hideLoading()
}

/**
 * 显示确认对话框
 */
export function showConfirm(content: string, title: string = '提示'): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => resolve(false)
    })
  })
}
