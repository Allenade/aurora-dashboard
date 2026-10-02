import { getRequestProtocol, useSession } from '@tanstack/react-start/server'
import { sessionSecret } from '@/services/api/api.instance'

export type AppSessionData = {
  accessToken?: string
  refreshToken?: string
  rememberMe?: boolean
}

export async function getAppSession() {
  const protocol = getRequestProtocol()
  return useSession<AppSessionData>({
    password: sessionSecret(),
    name: 'aurora_session',
    maxAge: 60 * 60 * 24 * 14,
    cookie: {
      httpOnly: true,
      secure: protocol === 'https',
      sameSite: 'lax',
      path: '/',
    },
  })
}
