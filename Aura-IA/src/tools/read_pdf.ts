import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export const readPdfDefinition = {
  type: 'function',
  function: {
    name: 'read_pdf',
    description: 'Extrae texto de un PDF. IMPORTANTE: Acepta y procesa URLs de Telegram (api.telegram.org) sin problemas.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL del PDF (incluyendo URLs de Telegram api.telegram.org).' }
      },
      required: ['url']
    }
  }
};

export async function readPdf(url: string) {
  let parser;
  try {
    parser = new PDFParse({ url });
    const result = await parser.getText();
    return `📄 Contenido del PDF:\n\n${result.text.substring(0, 5000)}`;
  } catch (error: any) {
    console.error('Error leyendo PDF:', error.message);
    return '❌ No pude leer el archivo PDF. Verifica que el enlace sea accesible.';
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}
