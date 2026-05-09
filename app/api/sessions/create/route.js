import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { z } from 'zod'

const createSessionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  initials: z.string().min(1).max(3),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional().default('Fetching location...'),
  battery: z.number().min(0).max(100).optional().default(100),
})

function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(req) {
  try {
    const body = await req.json()
    const data = createSessionSchema.parse(body)

    // Generate a unique 6-character code
    let code = generateSessionCode()
    let exists = await redis.exists(`session:${code}`)
    
    // Ensure uniqueness
    let attempts = 0
    while (exists && attempts < 5) {
      code = generateSessionCode()
      exists = await redis.exists(`session:${code}`)
      attempts++
    }

    if (exists) {
      return NextResponse.json(
        { error: 'Failed to generate unique session code' },
        { status: 500 }
      )
    }

    const sessionData = {
      code,
      name: data.name,
      initials: data.initials,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      battery: data.battery,
      speed: '0 km/h',
      distance: '0 km',
      lastUpdated: new Date().toISOString(),
      active: true,
    }

    // Store session in Redis with an expiration of 24 hours
    const EXPIRE_IN_SECONDS = 60 * 60 * 24
    await redis.set(`session:${code}`, JSON.stringify(sessionData), {
      ex: EXPIRE_IN_SECONDS,
    })

    return NextResponse.json({ success: true, session: sessionData })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Create Session Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
