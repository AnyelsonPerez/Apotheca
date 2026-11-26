import { http, HttpResponse } from 'msw'

const API_URL = '/api'

export const handlers = [
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'test@example.com' && body.password === 'testpassword123') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
      })
    }
    return HttpResponse.json({ detail: 'Email o contraseña incorrectos' }, { status: 401 })
  }),

  http.post(`${API_URL}/auth/register`, async ({ request }) => {
    const body = await request.json() as { email: string }
    if (body.email === 'existing@example.com') {
      return HttpResponse.json({ detail: 'Email already registered' }, { status: 409 })
    }
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    }, { status: 201 })
  }),

  http.post(`${API_URL}/auth/refresh`, () => {
    return HttpResponse.json({
      access_token: 'new-mock-access-token',
      refresh_token: 'new-mock-refresh-token',
      token_type: 'bearer',
    })
  }),

  http.get(`${API_URL}/inventory`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_URL}/alerts`, () => {
    return HttpResponse.json({ expiry: [], depletion: [] })
  }),

  http.get(`${API_URL}/settings`, () => {
    return HttpResponse.json([
      { key: 'expiry_warning_days', value: '30' },
      { key: 'depletion_threshold_days', value: '7' },
    ])
  }),
]
