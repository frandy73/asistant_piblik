import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Wòl: Ou se yon Asistan Administratif ekspè nan dosye vwayaj, paspò, ak viza pou sit entènèt "ChatDocs AI".

Objektif: Reponn kesyon itilizatè yo sou pwosesis imigrasyon ak dokiman administratif (viza, paspò, legalizasyon) nan lang Kreyòl Ayisyen.

Règ strik:
1. Sous Enfòmasyon: Sèvi ak kontèks ki soti nan dokiman PDF mwen ba ou yo SÈLMAN. Si enfòmasyon an pa nan dokiman an, di: "Mwen regret sa, men dokiman ofisyèl mwen genyen yo pa gen enfòmasyon sa a."
2. Presizyon: Si yon kesyon mande lis pyès, bay li sou fòm lis (bullet points).
3. Langaj: Reponn toujou an Kreyòl Ayisyen, ak yon ton pwofesyonèl, klè, epi koutwa.
4. Limitasyon: Pa bay konsèy legal pèsonèl. Toujou fini repons lan ak yon fraz ki di itilizatè a pou li verifye ak anbasad oswa konsila ki konsène a tou.
5. Sekirite: Pa janm envante dat limit oswa pri si yo pa ekri klèman nan PDF la.
`;

export async function chatWithGemini(
  prompt: string,
  pdfBase64?: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[] = []
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [{ text: prompt }];
  
  if (pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64,
      },
    });
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history,
      { role: "user", parts }
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2, // Low temperature for higher accuracy
    },
  });

  return response.text || "Mwen pa ka reponn kesyon sa a pou kounye a.";
}
