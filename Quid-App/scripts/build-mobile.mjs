import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const apiPath = path.join(rootDir, 'src', 'app', 'api');
const backupPath = path.join(rootDir, 'api-backup'); // Fuera de src/app para evitar escaneo de rutas de Next.js
const nextPath = path.join(rootDir, '.next');

console.log('🏁 Iniciando proceso de compilación móvil estática...');

// Limpiar la carpeta .next para evitar conflictos con tipos de rutas autogeneradas obsoletas
if (fs.existsSync(nextPath)) {
  console.log('🧹 Limpiando directorio de compilación anterior (.next)...');
  try {
    fs.rmSync(nextPath, { recursive: true, force: true });
    console.log('✅ Directorio .next eliminado.');
  } catch (err) {
    console.warn('⚠️ No se pudo limpiar .next por completo, continuando de todos modos:', err.message);
  }
}

// Autocuración: si la compilación anterior falló y dejó el backup, lo restauramos
if (fs.existsSync(backupPath) && !fs.existsSync(apiPath)) {
  console.log('🔄 Detectado respaldo de API residual. Restaurando...');
  fs.renameSync(backupPath, apiPath);
}

let apiMoved = false;

try {
  if (fs.existsSync(apiPath)) {
    console.log('📦 Moviendo temporalmente la carpeta de rutas API fuera de src/app...');
    fs.renameSync(apiPath, backupPath);
    apiMoved = true;
  }

  console.log('🚀 Ejecutando Next.js build con STATIC_EXPORT=true usando Webpack...');
  // Ejecutamos la compilación estática forzando el motor Webpack
  execSync('npx cross-env STATIC_EXPORT=true next build --webpack', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      STATIC_EXPORT: 'true',
    }
  });

  console.log('✅ Compilación estática completada exitosamente.');

} catch (error) {
  console.error('❌ Error durante la compilación:', error.message);
  process.exitCode = 1;
} finally {
  if (apiMoved && fs.existsSync(backupPath)) {
    console.log('🔄 Restaurando carpeta de rutas API...');
    fs.renameSync(backupPath, apiPath);
    console.log('✅ Estructura del repositorio restaurada.');
  }
}
