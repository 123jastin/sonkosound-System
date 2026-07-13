// functions/api/parse-text.ts

export const onRequestPost = async (context: any) => {
  try {
    const { text } = await context.request.json();
    const GROQ_API_KEY = context.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      return Response.json({
        success: false,
        error: 'API key not configured',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    if (!text || text.trim().length < 2) {
      return Response.json({
        success: false,
        error: 'No text to parse',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a Swahili debt record parser. Extract structured data from text. Return ONLY valid JSON, no markdown, no explanation.'
          },
          {
            role: 'user',
            content: `Extract from this Swahili/Tanzania debt record. Return ONLY JSON:
{
  "name": "full name of person/business",
  "number": "phone number (digits only, e.g., 0712345678)",
  "deni": debt amount as number (remove TSh, commas, spaces),
  "maelezo_ya_bidhaa": "product or service description",
  "notes": "any additional information"
}

Text: ${text}`
          }
        ],
        temperature: 0,
        max_tokens: 500
      })
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    const content = result.choices?.[0]?.message?.content || '';
    
    let data;
    try {
      const jsonStr = content.replace(/```json|```/g, '').trim();
      data = JSON.parse(jsonStr);
    } catch {
      // Fallback: try regex extraction
      data = {
        name: extractField(text, 'jina|name', true),
        number: extractPhone(text),
        deni: extractAmount(text),
        maelezo_ya_bidhaa: '',
        notes: ''
      };
    }

    return Response.json({
      success: true,
      data: {
        name: String(data?.name || '').trim(),
        number: String(data?.number || '').trim(),
        deni: Number(data?.deni) || 0,
        maelezo_ya_bidhaa: String(data?.maelezo_ya_bidhaa || '').trim(),
        notes: String(data?.notes || '').trim()
      }
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
    });
  }
};

// Fallback extractors
function extractField(text: string, pattern: string, isName: boolean): string {
  const regex = new RegExp(`${pattern}\\s*:?\\s*([^\\n,]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function extractPhone(text: string): string {
  const phoneRegex = /0\d{9}/;
  const match = text.match(phoneRegex);
  return match ? match[0] : '';
}

function extractAmount(text: string): number {
  const amountRegex = /(?:TSh|tsh)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
  const match = text.match(amountRegex);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''));
  }
  // Try plain numbers
  const numRegex = /(\d{4,})/;
  const numMatch = text.match(numRegex);
  return numMatch ? parseInt(numMatch[1]) : 0;
}
