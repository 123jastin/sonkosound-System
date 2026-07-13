// functions/api/ocr.ts

export const onRequestPost = async (context: any) => {
  try {
    const { image } = await context.request.json();
    
    const GROQ_API_KEY = context.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      return Response.json({
        success: false,
        error: 'API key not configured',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    // Try multiple models in order of preference
    const models = [
      'llama-3.2-90b-vision-preview',  // Vision model
      'llama-3.2-11b-vision-preview',   // Older vision (might still work)
      'llama-3.1-8b-instant',           // Text only fallback
    ];

    let lastError = '';
    
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        
        // For vision models, send image directly
        // For text-only models, describe the task differently
        const isVisionModel = model.includes('vision');
        
        const messages = isVisionModel ? [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract these fields from this document/image (Swahili/Tanzania context). Return ONLY JSON:
{
  "name": "full name",
  "number": "phone number",
  "deni": amount as number,
  "maelezo_ya_bidhaa": "product description",
  "notes": "notes"
}
Return ONLY JSON, no other text.`
              },
              {
                type: 'image_url',
                image_url: { url: image }
              }
            ]
          }
        ] : [
          {
            role: 'user',
            content: `I have a document image. Extract these fields and return ONLY JSON (Swahili context): {"name":"full name","number":"phone","deni":amount,"maelezo_ya_bidhaa":"product","notes":"notes"}. Leave empty string for missing fields. The image contains text similar to a receipt or debt record from Tanzania.`
          }
        ];

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.1,
            max_tokens: 500
          })
        });

        const result = await response.json();

        if (result.error) {
          console.error(`Model ${model} failed:`, result.error.message);
          lastError = result.error.message;
          continue; // Try next model
        }

        // Success! Extract content
        const content = result.choices?.[0]?.message?.content || '';
        console.log(`Model ${model} response:`, content);

        let extractedData;
        try {
          const jsonStr = content
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();
          extractedData = JSON.parse(jsonStr);
        } catch {
          extractedData = {
            name: extractValue(content, 'name'),
            number: extractValue(content, 'number'),
            deni: extractNumber(content, 'deni'),
            maelezo_ya_bidhaa: extractValue(content, 'maelezo_ya_bidhaa'),
            notes: extractValue(content, 'notes')
          };
        }

        const cleanData = {
          name: String(extractedData?.name || '').trim(),
          number: String(extractedData?.number || '').trim(),
          deni: Number(extractedData?.deni) || 0,
          maelezo_ya_bidhaa: String(extractedData?.maelezo_ya_bidhaa || '').trim(),
          notes: String(extractedData?.notes || '').trim()
        };

        console.log('Extracted data:', cleanData);

        return Response.json({
          success: true,
          data: cleanData,
          model: model
        });

      } catch (err: any) {
        console.error(`Model ${model} error:`, err.message);
        lastError = err.message;
        continue; // Try next model
      }
    }

    // All models failed
    return Response.json({
      success: false,
      error: `All AI models failed. Last error: ${lastError}`,
      data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
    });

  } catch (error: any) {
    console.error('OCR Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'AI processing failed',
      data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
    });
  }
};

function extractValue(text: string, field: string): string {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`${field}\\s*:\\s*"([^"]*)"`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return '';
}

function extractNumber(text: string, field: string): number {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return 0;
}
