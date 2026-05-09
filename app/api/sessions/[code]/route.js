import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'

export async function GET(req, { params }) {
  try {
    const { code } = params

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid session code' },
        { status: 400 }
      )
    }

    const sessionStr = await redis.get(`session:${code.toUpperCase()}`)

    if (!sessionStr) {
      return NextResponse.json(
        { error: 'Session not found or has expired' },
        { status: 404 }
      )
    }

    const session = typeof sessionStr === 'string' ? JSON.parse(sessionStr) : sessionStr

    return NextResponse.json({ success: true, session })
  } catch (error) {
    console.error('Get Session Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { code } = params

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid session code' },
        { status: 400 }
      )
    }

    // Notify all trackers that the session ended
    await pusherServer.trigger(
      `session-${code.toUpperCase()}`,
      'session-ended',
      { message: 'Session has been ended by the sharer.' }
    )

    // Delete session from Redis
    await redis.del(`session:${code.toUpperCase()}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete Session Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
