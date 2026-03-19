import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const SYSTEM_INSTRUCTION = `
Wòl: Ou se yon Asistan Administratif ekspè nan dosye vwayaj, paspò, ak viza pou sit entènèt "Asistan Piblik".

Objektif: Reponn kesyon itilizatè yo sou pwosesis imigrasyon ak dokiman administratif (viza, paspò, legalizasyon) nan lang Kreyòl Ayisyen.
`;

// API ChatPDF Proxy
app.post('/api/chatpdf/upload', async (req, res) => {
  try {
    const { url } = req.body;
    const apiKey = process.env.CHATPDF_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "CHATPDF_API_KEY pa konfigire nan env." });
    }

    if (!url) {
      return res.status(400).json({ error: "Tanpri bay yon URL pou dokiman an." });
    }

    const response = await axios.post('https://api.chatpdf.com/v1/sources/add-url', { url }, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('ChatPDF Upload Error:', error.response?.data || error.message);
    res.status(500).json({ error: "Erè nan monte dokiman an sou ChatPDF." });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, referenceSources } = req.body;
    const apiKey = process.env.CHATPDF_API_KEY;
    let sourceId = process.env.CHATPDF_SOURCE_ID;

    if (!apiKey) {
      return res.status(500).json({ error: "CHATPDF_API_KEY pa konfigire nan 'Secrets'." });
    }
    if (!sourceId || sourceId.includes('xxxxxx')) {
      return res.status(500).json({ error: "CHATPDF_SOURCE_ID pa konfigire kòrèkteman nan 'Secrets'." });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Istwa konvèsasyon an pa valab." });
    }

    // Clean sourceId
    let cleanId = sourceId.trim().replace(/\s+/g, '');
    const chaMatch = cleanId.match(/cha_[a-zA-Z0-9]+/i);
    sourceId = chaMatch ? chaMatch[0] : ('cha_' + cleanId.replace(/^cha[:\s_]*/i, ''));

    const formattedMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').trim()
    })).filter(m => m.content.length > 0);

    if (formattedMessages.length === 0) {
      return res.status(400).json({ error: "Istwa konvèsasyon an pa gen okenn kontni valab." });
    }

    if (formattedMessages[0].role !== 'user') {
      formattedMessages.unshift({
        role: 'user',
        content: "Bonjou, mwen bezwen enfòmasyon nan dokiman sa a."
      });
    }

    const response = await axios.post('https://api.chatpdf.com/v1/chats/message', {
      sourceId,
      messages: formattedMessages,
      referenceSources: referenceSources === true
    }, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    res.json(response.data);
  } catch (error: any) {
    let status = 500;
    let errorData = error.response?.data;
    if (error.response) status = error.response.status;

    console.error('AI Chat Error:', error.message);

    let errorMessage = "Mwen regret sa, sèvis AI a gen yon ti pwoblèm kounye a.";

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorMessage = "Mwen regret sa, gen yon ti pwoblèm nan koneksyon entènèt la. Tanpri asire w ou gen entènèt epi eseye ankò nan kèk segonn.";
      status = 503;
    } else if (errorData) {
      errorMessage = typeof errorData === 'string' ? errorData : (errorData.error || errorData.message || "Sèvis AI a pa disponib kounye a.");
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(status).json({ error: String(errorMessage), code: error.code || 'UNKNOWN_ERROR' });
  }
});

// Production static serving
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Development Vite serving
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Sèvè a ap mache sou http://localhost:${PORT}`);
    });
  });
}

export default app;
