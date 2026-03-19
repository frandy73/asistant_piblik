import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3002;

  app.use(express.json({ limit: '50mb' }));

  // API ChatPDF Proxy
  app.post('/api/chatpdf/upload', async (req, res) => {
    try {
      const { url, fileBase64 } = req.body;
      const apiKey = process.env.CHATPDF_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "CHATPDF_API_KEY pa konfigire nan env." });
      }

      let data;
      if (url) {
        data = { url };
      } else {
        // ChatPDF API expects a file upload or a URL. 
        // For base64, we'd normally use their multipart upload, 
        // but for this example, let's assume URL or handle as needed.
        return res.status(400).json({ error: "Tanpri bay yon URL pou dokiman an." });
      }

      const response = await axios.post('https://api.chatpdf.com/v1/sources/add-url', data, {
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

      // Netwaye sourceId a pou l ka kòrèk pou ChatPDF
      let cleanId = sourceId.trim().replace(/\s+/g, '');

      const chaMatch = cleanId.match(/cha_[a-zA-Z0-9]+/i);
      if (chaMatch) {
        sourceId = chaMatch[0];
      } else {
        sourceId = cleanId.replace(/^cha[:\s_]*/i, 'cha_');
        if (!sourceId.startsWith('cha_')) {
          sourceId = 'cha_' + sourceId;
        }
      }

      const formattedMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').trim()
      })).filter(m => m.content.length > 0);

      if (formattedMessages.length === 0) {
        return res.status(400).json({ error: "Istwa konvèsasyon an pa gen okenn kontni valab." });
      }

      // ChatPDF mande pou premye mesaj la se yon "user"
      if (formattedMessages[0].role !== 'user') {
        formattedMessages.unshift({
          role: 'user',
          content: "Bonjou, mwen bezwen enfòmasyon nan dokiman sa a."
        });
      }

      console.log('Sending to ChatPDF - SourceId:', sourceId);

      const requestBody = {
        sourceId,
        messages: formattedMessages,
        referenceSources: referenceSources === true
      };

      console.log('ChatPDF Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post('https://api.chatpdf.com/v1/chats/message', requestBody, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 segonn timeout
      });

      if (!response || !response.data) {
        throw new Error("ChatPDF pa voye okenn done nan repons lan.");
      }

      res.json(response.data);
    } catch (error: any) {
      let status = 500;
      let errorData = null;

      if (error.response) {
        status = error.response.status || 500;
        errorData = error.response.data;
      }

      console.error('AI Chat Error Details:', {
        status,
        data: errorData,
        message: error.message,
        stack: error.stack,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          headers: { ...error.config.headers, 'x-api-key': '***' },
          data: error.config.data
        } : null
      });

      let errorMessage = "Mwen regret sa, sèvis AI a gen yon ti pwoblèm kounye a.";

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorMessage = "Mwen regret sa, gen yon ti pwoblèm nan koneksyon entènèt la. Tanpri asire w ou gen entènèt epi eseye ankò nan kèk segonn.";
        status = 503;
      } else if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (typeof errorData === 'object') {
          errorMessage = errorData.error || errorData.message || "Sèvis la pa ka reponn kounye a.";
        }
      } else if (error.message && !error.message.includes('getaddrinfo')) {
        errorMessage = error.message;
      }

      res.status(status).json({ error: String(errorMessage) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Sèvè a ap mache sou http://localhost:${PORT}`);
    });
  }

  return app;
}

export default startServer();
