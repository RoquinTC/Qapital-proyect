import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/accounts — list accounts for authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const accounts = await db.account.findMany({
      where: { userId: session.user.id },
      orderBy: { order: 'asc' },
      include: {
        subAccounts: { orderBy: { order: 'asc' } },
      },
    })
    return NextResponse.json(accounts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/accounts — create an account
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, balance, color, isHighYield, yieldPercentage, isShared, excludeFromAvailable, icon } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    // Verify user exists first to avoid P2003
    const userExists = await db.user.findUnique({ where: { id: session.user.id } });
    if (!userExists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const account = await db.account.create({
      data: {
        userId: session.user.id,
        name,
        type,
        balance: balance || 0,
        color: color || "#10B981",
        isHighYield: isHighYield || false,
        yieldPercentage: isHighYield ? (yieldPercentage || null) : null,
        isShared: isShared || false,
        excludeFromAvailable: excludeFromAvailable || false,
        icon: icon || null,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
