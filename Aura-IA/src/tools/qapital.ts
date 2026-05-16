import { qapital } from '../services/qapital.js';

export const qapitalTools = {
  get_my_finances: {
    definition: {
      type: 'function',
      function: {
        name: 'get_my_finances',
        description: 'Obtiene el balance total, saldos de cuentas y metas de ahorro. Úsala para una visión general rápida.',
        parameters: {
          type: 'object',
          properties: {},
        },
      }
    },
    handler: async () => {
      const userId = await qapital.getDefaultUser();
      if (!userId) return "No se encontró usuario.";
      const data = await qapital.getUserFinances(userId);
      return JSON.stringify(data, null, 2);
    },
  },
  analyze_financial_performance: {
    definition: {
      type: 'function',
      function: {
        name: 'analyze_financial_performance',
        description: 'HERRAMIENTA DE ANÁLISIS PROFUNDO. Úsala para responder "¿Cómo me fue?", "¿Cuánto gasté?" o para detectar fugas de dinero. SIEMPRE debes pasar days=30 (para el mes) o days=7 (para la semana). Nunca pases menos de 7 días porque perderás contexto.',
        parameters: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Número de días hacia atrás (SIEMPRE usa 30 para el mes actual o 7 para la semana).',
              default: 30
            }
          },
        },
      }
    },
    handler: async (args: any) => {
      let days = args?.days ? parseInt(args.days) : 30;
      if (days < 7) days = 7; // Forzar un mínimo de contexto para evitar respuestas vacías
      
      const userId = await qapital.getDefaultUser();
      if (!userId) return "No se encontró usuario.";
      const data = await qapital.getFinancialSummary(userId, days);
      return `Análisis de los últimos ${days} días (Usa esta info real, NO INVENTES NÚMEROS):\n${JSON.stringify(data, null, 2)}`;
    },
  },
  get_my_health_profile: {
    definition: {
      type: 'function',
      function: {
        name: 'get_my_health_profile',
        description: 'Obtiene salud, restricciones y medicamentos.',
        parameters: {
          type: 'object',
          properties: {},
        },
      }
    },
    handler: async () => {
      const userId = await qapital.getDefaultUser();
      if (!userId) return "No se encontró usuario.";
      const data = await qapital.getUserHealth(userId);
      return JSON.stringify(data, null, 2);
    },
  },
};
