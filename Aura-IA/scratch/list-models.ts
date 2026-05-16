import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GOOGLE_AI_KEY;

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const res = await axios.get(url);
    console.log('--- Modelos Disponibles ---');
    res.data.models.forEach((m: any) => {
      console.log(`${m.name} - ${m.displayName}`);
    });
  } catch (error: any) {
    console.error('Error al listar modelos:', error.response?.data || error.message);
  }
}

listModels();
