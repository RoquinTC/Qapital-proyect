import { db } from "@/lib/db";

export type CoreMessage = { role: "user" | "assistant" | "system" | "data"; content: string };

export const AURA_MODEL = process.env.AURA_MODEL || "llama3.2";
const OLLAMA_API_BASE = process.env.OLLAMA_URL || "http://localhost:11434/api";

function shouldIncludeBalanceContext(messages: CoreMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const text = lastUserMessage?.content.toLowerCase() || "";
  return ["saldo", "balance", "cuenta", "dinero", "plata", "cuanto tengo", "cuánto tengo"].some((term) =>
    text.includes(term)
  );
}

async function getBalanceSnapshot(userId: string) {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { name: true, balance: true },
  });
  const subAccounts = await db.subAccount.findMany({
    where: { account: { userId } },
    select: { name: true, balance: true, account: { select: { name: true } } },
  });

  const totalAccounts = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalSubAccounts = subAccounts.reduce((sum, account) => sum + Number(account.balance), 0);

  return {
    totalBalance: totalAccounts + totalSubAccounts,
    currency: "COP",
    accounts: accounts.map((account) => ({
      name: account.name,
      balance: Number(account.balance),
    })),
    subAccounts: subAccounts.map((account) => ({
      name: account.name,
      parentAccount: account.account.name,
      balance: Number(account.balance),
    })),
  };
}

export async function askAura(userId: string, messages: CoreMessage[]) {
  try {
    const systemPrompt = `Eres Aura, el copiloto inteligente de la aplicación financiera Quid. 
Eres amable, concisa y experta en finanzas personales, transporte y organización.
El usuario actual tiene el ID: ${userId}. 
Siempre responde de forma muy natural y conversacional. 
Puedes responder a cualquier pregunta general que el usuario te haga, ya sea de recetas, consejos financieros, o simplemente charlar.
Si recibes contexto interno de Quid, úsalo para responder con precisión.
Si el usuario pide guardar, pagar, mover o modificar información y falta algún dato, pregunta solo por lo que falta antes de confirmar.
No inventes datos financieros. Si no tienes el dato, dilo y pide revisar o conectar el módulo correspondiente.
No des explicaciones técnicas ni menciones herramientas internas a menos que ocurra un error.`;

    const ollamaMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (shouldIncludeBalanceContext(messages)) {
      const balance = await getBalanceSnapshot(userId);
      ollamaMessages.push({
        role: "system",
        content: `Contexto interno de Quid para esta respuesta: ${JSON.stringify(balance)}`,
      });
    }

    for (const message of messages) {
      if (message.role === "user" || message.role === "assistant" || message.role === "system") {
        ollamaMessages.push({ role: message.role, content: message.content });
      }
    }

    const response = await fetch(`${OLLAMA_API_BASE.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AURA_MODEL,
        stream: false,
        messages: ollamaMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama respondió con estado ${response.status}: ${await response.text()}`);
    }

    const result = (await response.json()) as {
      message?: { content?: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };
    const text = result.message?.content?.trim() || "No pude generar una respuesta clara.";

    return {
      text,
      usage: {
        completionTokens: result.eval_count,
        promptTokens: result.prompt_eval_count,
      },
      responseMessages: [...messages, { role: "assistant", content: text }],
    };
  } catch (error: any) {
    console.error("Error en Aura Engine:", error);
    return {
      text: "Ups, tuve un pequeño problema procesando eso. ¿Podrías intentar de nuevo?",
      error: error.message,
    };
  }
}
