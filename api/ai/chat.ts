import axios from 'axios';

const SYSTEM_INSTRUCTION = `
Wòl: Ou se yon Asistan Administratif ekspè nan dosye vwayaj, paspò, ak viza pou sit entènèt "Asistan Piblik".

Objektif: Reponn kesyon itilizatè yo sou pwosesis imigrasyon ak dokiman administratif (viza, paspò, legalizasyon) nan lang Kreyòl Ayisyen.
`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metòd pa otorize' });
  }

  try {
    const { messages, referenceSources } = req.body;
    const apiKey = process.env.CHATPDF_API_KEY;
    let sourceId = process.env.CHATPDF_SOURCE_ID;

    // Check environment variables
    if (!apiKey) {
      console.error('CHATPDF_API_KEY is missing');
      return res.status(500).json({ error: "Sèvè a pa konfigire kòrèkteman (Missing API Key)." });
    }
    if (!sourceId || sourceId.includes('xxxxxx')) {
      console.error('CHATPDF_SOURCE_ID is missing or invalid');
      return res.status(500).json({ error: "Sèvè a pa konfigire kòrèkteman (Missing Source ID)." });
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

    // ChatPDF requires first message to be "user"
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
      timeout: 25000 // Vercel has a 30s limit for hobby, so 25s is safe
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    let status = 500;
    const errorData = error.response?.data;
    if (error.response) status = error.response.status;

    console.error('AI Chat Error:', error.message);

    let errorMessage = "Mwen regret sa, sèvis AI a gen yon ti pwoblèm kounye a.";

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorMessage = "Mwen regret sa, gen yon ti pwoblèm nan koneksyon entènèt la. Tanpri eseye ankò nan kèk segonn.";
      status = 503;
    } else if (errorData) {
      errorMessage = typeof errorData === 'string' ? errorData : (errorData.error || errorData.message || "Sèvis AI a pa disponib kounye a.");
    }

    return res.status(status).json({ 
      error: String(errorMessage), 
      code: error.code || 'UNKNOWN_ERROR' 
    });
  }
}
