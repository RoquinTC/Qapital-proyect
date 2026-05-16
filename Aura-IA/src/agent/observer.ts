import { qapital } from '../services/qapital.js';
import { bot } from '../bot/telegram.js';
import { runAgentLoop } from './loop.js';
import { env } from '../config/env.js';

export async function startObserver() {
  console.log('👁️ Aura Observer iniciado. Monitoreando anomalías...');

  // El primer usuario permitido será el objetivo del monitoreo (MVP)
  const targetUserId = env.TELEGRAM_ALLOWED_USER_IDS[0];
  if (!targetUserId) {
    console.warn('⚠️ No hay IDs de usuario permitidos para monitoreo proactivo.');
    return;
  }

  // Intervalo de chequeo (ej. cada 15 minutos en producción, 1 min para test)
  const CHECK_INTERVAL = 15 * 60 * 1000; 

  setInterval(async () => {
    try {
      console.log('🔍 Aura revisando el mapa de Qapital...');
      
      const userIdStr = targetUserId.toString(); 
      // Nota: En la DB de Qapital los IDs son strings (cuid)
      // Necesitaríamos un mapeo de TelegramID -> QapitalID si no son el mismo.
      // Por ahora asumiremos que buscamos por un usuario genérico o el primero que encontremos.
      
      const anomalies = await qapital.detectAnomalies('cl1234567890'); // Placeholder ID
      
      if (anomalies.length > 0) {
        for (const anomaly of anomalies) {
          console.log(`🚨 Anomalía detectada: ${anomaly.reason}`);
          
          const systemContext = `EVENTO PROACTIVO: Se ha detectado una anomalía: ${anomaly.reason}. 
          Datos: ${JSON.stringify(anomaly.data)}.
          Instrucción: Escríbele al usuario por Telegram de forma empática y preocupada, 
          menciona que lo notaste y pregúntale si todo está bien o cómo puedes ayudarle a mejorar.`;

          const response = await runAgentLoop(targetUserId, systemContext);
          
          await bot.api.sendMessage(targetUserId, response);
        }
      }
    } catch (error) {
      console.error('❌ Error en el observador:', error);
    }
  }, CHECK_INTERVAL);
}
