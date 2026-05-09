import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'
import { z } from 'zod'

const locationUpdateSchema = z.object({
  code: z.string().length(6),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.string().optional().default('0 km/h'),
  distance: z.string().optional().default('0 km'),
  battery: z.number().min(0).max(100).optional(),
  address: z.string().optional(),
})

export async function POST(req) {
  try {
    const body = await req.json()
    const data = locationUpdateSchema.parse(body)

    const code = data.code.toUpperCase()
    
    // Validate session exists
    const sessionStr = await redis.get(`session:${code}`)
    if (!sessionStr) {
      return NextResponse.json(
        { error: 'Session not found or has expired' },
        { status: 404 }
      )
    }

    const session = typeof sessionStr === 'string' ? JSON.parse(sessionStr) : sessionStr
    
    // Update session data
    const updatedSession = {
      ...session,
      latitude: data.latitude,
      longitude: data.longitude,
      lastUpdated: new Date().toISOString(),
    }

    if (data.speed) updatedSession.speed = data.speed
    if (data.distance) updatedSession.distance = data.distance
    if (data.battery !== undefined) updatedSession.battery = data.battery
    if (data.address) updatedSession.address = data.address

    // Save back to Redis (keep expiration TTL, we don't reset TTL on every update to enforce hard limits, 
    // or we could use 'KEEPTTL' option in Redis)
    await redis.set(`session:${code}`, JSON.stringify(updatedSession), {
      keepttl: true
    })

    // Trigger Pusher event for real-time tracking
    // Channel name: session-[CODE]
    // Event name: location-update
    await pusherServer.trigger(
      `session-${code}`,
      'location-update',
      {
        latitude: updatedSession.latitude,
        longitude: updatedSession.longitude,
        speed: updatedSession.speed,
        distance: updatedSession.distance,
        battery: updatedSession.battery,
        address: updatedSession.address,
        lastUpdated: updatedSession.lastUpdated,
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Location Update Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
