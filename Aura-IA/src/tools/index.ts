import { getCurrentTimeDefinition, getCurrentTime } from './getCurrentTime.js';
import { googleToolDefinitions, executeGoogleTool } from './google.js';
import { webSearchDefinition, webSearch } from './research.js';
import { proposeNewSkillDefinition, proposeNewSkill, applyNewSkillDefinition, applyNewSkill, selfDeployDefinition, selfDeploy } from './meta.js';
import { createImageDefinition, createImageHandler } from './create_image.js';
import { getCryptoPriceDefinition, getCryptoPrice } from './get_crypto_price.js';
import { readPdfDefinition, readPdf } from './read_pdf.js';
import { qapitalTools } from './qapital.js';

export const toolDefinitions = [
  getCurrentTimeDefinition,
  // webSearchDefinition, // <-- Desactivado para evitar alucinaciones
  proposeNewSkillDefinition,
  applyNewSkillDefinition,
  selfDeployDefinition,
  createImageDefinition,
  getCryptoPriceDefinition,
  readPdfDefinition,
  qapitalTools.get_my_finances.definition,
  qapitalTools.analyze_financial_performance.definition, // <-- NUEVA HERRAMIENTA
  qapitalTools.get_my_health_profile.definition,
  ...googleToolDefinitions,
];

export async function executeTool(name: string, args: any, userId: number, ctx?: any) {
  if (name.startsWith('gmail_') || name.startsWith('calendar_')) {
    return await executeGoogleTool(name, args, userId);
  }
  
  switch (name) {
    case 'get_current_time':
      return await getCurrentTime();
    case 'web_search':
      return await webSearch(args.query);
    case 'propose_new_skill':
      return await proposeNewSkill(args.skill_name, args.description, args.code);
    case 'apply_new_skill':
      return await applyNewSkill(args.skill_name);
    case 'self_deploy':
      return await selfDeploy(args.commit_message);
    case 'create_image':
      if (!ctx) throw new Error('Se requiere el contexto del bot.');
      return await createImageHandler(ctx, args);
    case 'get_crypto_price':
      return await getCryptoPrice();
    case 'read_pdf':
      return await readPdf(args.url);
    case 'get_my_finances':
      return await qapitalTools.get_my_finances.handler();
    case 'get_my_health_profile':
      return await qapitalTools.get_my_health_profile.handler();
    case 'analyze_financial_performance':
      return await qapitalTools.analyze_financial_performance.handler(args);
    default:
      throw new Error(`Herramienta no encontrada: ${name}`);
  }
}
