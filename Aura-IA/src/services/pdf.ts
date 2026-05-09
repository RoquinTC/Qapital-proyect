import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export const pdfService = {
  /**
   * Descarga y extrae el texto de un archivo PDF desde una URL.
   * @param url URL del archivo PDF
   * @returns El texto extraído (limitado para evitar saturar el contexto)
   */
  async extractText(url: string): Promise<string> {
    let parser;
    try {
      parser = new PDFParse({ url });
      const result = await parser.getText();
      
      // Limpiamos un poco el texto (quitar espacios excesivos)
      const cleanText = result.text
        .replace(/\n\s*\n/g, '\n')
        .substring(0, 10000); // Límite de 10k caracteres
        
      return cleanText || 'El PDF parece estar vacío o no tiene texto extraíble.';
    } catch (error: any) {
      console.error('Error en pdfService:', error.message);
      throw new Error('No se pudo procesar el archivo PDF.');
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }
  }
};
