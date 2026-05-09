import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

/**
 * Server-side Pusher instance for triggering events.
 * Only use this in API routes and Server Components.
 */
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
})

/**
 * Client-side Pusher instance for subscribing to channels.
 * Only use this in Client Components.
 */
export const getPusherClient = () => {
  // Return existing instance if available to avoid multiple connections
  if (typeof window !== 'undefined' && window.pusherClient) {
    return window.pusherClient
  }

  const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  })

  if (typeof window !== 'undefined') {
    window.pusherClient = pusherClient
  }

  return pusherClient
}
