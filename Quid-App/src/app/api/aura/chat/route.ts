import { NextResponse } from "next/server";
import { askAura } from "@/lib/aura";
import { db } from "@/lib/db";
import { headers } from "next/headers";

// Aseguramos que la ruta se evalúe dinámicamente y no se sirva en caché
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, prompt, telegramId } = body;
    const headersList = await headers();
    const requestUserId = headersList.get("x-user-id");
    const auraToken = headersList.get("x-aura-token");
    const isTrustedAuraClient =
      Boolean(process.env.AURA_API_KEY) && auraToken === process.env.AURA_API_KEY;

    // Aceptamos tanto un arreglo de mensajes como un prompt simple (por compatibilidad)
    const finalMessages = messages || [{ role: "user", content: prompt }];

    // Validación básica
    if (!finalMessages || finalMessages.length === 0 || !finalMessages[0].content) {
      return NextResponse.json(
        { error: "Se requiere un prompt o un arreglo de messages." },
        { status: 400 }
      );
    }

    // La app usa la sesión autenticada. Telegram solo puede entrar con token interno
    // y se resuelve por telegramId; nunca confiamos en un userId recibido del cliente.
    let internalUserId = requestUserId;

    if (!internalUserId && isTrustedAuraClient && telegramId) {
      const user = await db.user.findUnique({
        where: { telegramId: String(telegramId) },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json(
          {
            error:
              "No encontré ninguna cuenta vinculada a este Telegram ID. Por favor vincula tu cuenta primero en la app.",
          },
          { status: 404 }
        );
      }
      internalUserId = user.id;
    }

    if (!internalUserId) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión o usa el canal seguro de Aura." },
        { status: 401 }
      );
    }

    // 🧠 Ejecutamos el Motor de Aura (pasándole el historial de conversación)
    const auraResponse = await askAura(internalUserId, finalMessages);

    return NextResponse.json({
      success: true,
      text: auraResponse.text || auraResponse,
      responseMessages: auraResponse.responseMessages, // Para que el cliente pueda actualizar su historial
    });
  } catch (error: any) {
    console.error("Error en /api/aura/chat:", error);
    return NextResponse.json(
      { error: error.message || "Error interno procesando con Aura." },
      { status: 500 }
    );
  }
}
