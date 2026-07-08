import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api', // I changed this to 3000 because our backend runs on 3000
  withCredentials: true,  // sends the httpOnly cookie automatically
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, try refreshing once then redirect to login
let isRefreshing = false
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) return Promise.reject(error)
      original._retry = true
      isRefreshing = true
      try {
        const { data } = await api.post('/auth/refresh')
        useAuthStore.getState().setAccessToken(data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// Avoid circular import — import store after defining interceptors
import { useAuthStore } from '../store/auth.store'

export default api
