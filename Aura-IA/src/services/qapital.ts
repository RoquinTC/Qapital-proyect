import Database from 'better-sqlite3';
import { env } from '../config/env.js';

class QapitalService {
  private db: Database.Database | null = null;

  constructor() {
    this.connect();
  }

  // Obtener el ID del primer usuario registrado (para desarrollo local)
  async getDefaultUser() {
    if (!this.db) return null;
    // Buscamos específicamente al usuario principal para evitar datos de prueba
    const user = this.db.prepare("SELECT id FROM User WHERE email = 'rqcquintero@gmail.com' OR name = 'Robin' LIMIT 1").get();
    return user ? (user as any).id : null;
  }

  private connect() {
    try {
      const dbPath = env.DATABASE_URL.replace('file:', '');
      console.log(`🔌 Aura conectando a Qapital DB en: ${dbPath}`);
      this.db = new Database(dbPath, { readonly: true });
    } catch (error) {
      console.error('❌ Error conectando a Qapital DB:', error);
    }
  }

  // Obtener el estado financiero general de un usuario
  async getUserFinances(userId: string) {
    if (!this.db) return null;
    
    const accounts = this.db.prepare('SELECT * FROM accounts WHERE userId = ?').all(userId);
    const totalBalance = accounts.reduce((acc: any, curr: any) => acc + Number(curr.balance), 0);
    
    const savingsGoals = this.db.prepare('SELECT * FROM savings_goals WHERE userId = ? AND isActive = 1').all(userId);
    const budgets = this.db.prepare('SELECT * FROM budgets WHERE userId = ?').all(userId);

    const recentTransactions = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE userId = ? 
      ORDER BY date DESC 
      LIMIT 100
    `).all(userId);

    return {
      accounts,
      totalBalance,
      savingsGoals,
      budgets,
      recentTransactions
    };
  }

  // Obtener el perfil de salud y restricciones
  async getUserHealth(userId: string) {
    if (!this.db) return null;

    const profile = this.db.prepare('SELECT * FROM health_profiles WHERE userId = ?').get(userId);
    const medications = this.db.prepare('SELECT * FROM medications WHERE userId = ? AND isActive = 1').all(userId);

    return {
      profile,
      medications
    };
  }

  // Detectar anomalías (Gasto excesivo o comida prohibida)
  async detectAnomalies(userId: string) {
    if (!this.db) return [];

    const anomalies = [];
    
    // Ejemplo: Gasto en categoría 'Comida' en las últimas 24h
    const recentFoodExpenses = this.db.prepare(`
      SELECT * FROM transactions 
      WHERE userId = ? 
      AND category = 'Comida' 
      AND date > datetime('now', '-1 day')
    `).all(userId);

    // Si hay más de 3 gastos de comida en un día, es una anomalía de comportamiento
    if (recentFoodExpenses.length > 3) {
      anomalies.push({
        type: 'behavioral',
        reason: 'Múltiples gastos en comida detectados hoy',
        data: recentFoodExpenses
      });
    }

    return anomalies;
  }

  // Resumen estadístico exacto para que el LLM no tenga que sumar
  async getFinancialSummary(userId: string, days: number = 7) {
    if (!this.db) return null;

    const summary = this.db.prepare(`
      SELECT 
        type,
        category,
        SUM(CAST(amount AS DECIMAL)) as total,
        COUNT(*) as count
      FROM transactions 
      WHERE userId = ? 
      AND date > datetime('now', '-' || ? || ' days')
      GROUP BY type, category
    `).all(userId, days);

    const dailySpend = this.db.prepare(`
      SELECT 
        date(date) as day,
        SUM(CAST(amount AS DECIMAL)) as total
      FROM transactions 
      WHERE userId = ? 
      AND type = 'expense'
      AND date > datetime('now', '-' || ? || ' days')
      GROUP BY day
      ORDER BY day DESC
    `).all(userId, days);

    return {
      periodDays: days,
      byCategory: summary,
      dailySpend
    };
  }
}

export const qapital = new QapitalService();
