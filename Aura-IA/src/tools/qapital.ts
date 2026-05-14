import { qapital } from '../services/qapital.js';

export const qapitalTools = {
  get_my_finances: {
    definition: {
      type: 'function',
      function: {
        name: 'get_my_finances',
        description: 'Obtiene el balance total y las transacciones recientes del usuario desde la base de datos de Qapital App.',
        parameters: {
          type: 'object',
          properties: {},
        },
      }
    },
    handler: async () => {
      const data = await qapital.getUserFinances('cl1234567890');
      if (!data) return "No se pudo conectar a la base de datos de Qapital.";
      return JSON.stringify(data);
    },
  },
  get_my_health_profile: {
    definition: {
      type: 'function',
      function: {
        name: 'get_my_health_profile',
        description: 'Obtiene el perfil de salud, enfermedades, restricciones alimenticias y medicamentos del usuario.',
        parameters: {
          type: 'object',
          properties: {},
        },
      }
    },
    handler: async () => {
      const data = await qapital.getUserHealth('cl1234567890');
      if (!data) return "No se encontró perfil de salud.";
      return JSON.stringify(data);
    },
  },
};
