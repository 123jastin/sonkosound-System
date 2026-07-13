// functions/api/ocr.ts

export const onRequestPost = async (context: any) => {
  try {
    const { image } = await context.request.json();
    
    // Get Groq API key from Cloudflare environment variables
    const GROQ_API_KEY = context.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY not configured');
      return Response.json({
        success: false,
        error: 'API key not configured',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    // Call Groq Vision API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract these fields from this document/image (Swahili/Tanzania context). Return ONLY a valid JSON object, no other text:

{
  "name": "full name of person or business",
  "number": "phone number",
  "deni": debt amount as number only (remove TSh, commas, spaces),
  "maelezo_ya_bidhaa": "product or service description",
  "notes": "any additional notes"
}

Rules:
- Leave empty string "" for fields not found
- deni must be a number (not string)
- number should be digits only (e.g., 0712345678)
- Return ONLY the JSON object, no markdown, no explanation`
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    const result = await groqResponse.json();

    // Check for API errors
    if (result.error) {
      console.error('Groq API error:', result.error);
      return Response.json({
        success: false,
        error: result.error.message || 'AI processing failed',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    // Extract content from response
    const content = result.choices?.[0]?.message?.content || '';
    console.log('Groq response:', content);

    // Parse the JSON from response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse JSON from Groq response:', parseError);
      // Try manual extraction from text
      extractedData = {
        name: extractValue(content, 'name'),
        number: extractValue(content, 'number'),
        deni: extractNumber(content, 'deni'),
        maelezo_ya_bidhaa: extractValue(content, 'maelezo_ya_bidhaa'),
        notes: extractValue(content, 'notes')
      };
    }

    // Clean and validate the data
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
      data: cleanData
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

// Helper: Extract string value from text using regex
function extractValue(text: string, field: string): string {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`${field}\\s*:\\s*"([^"]*)"`, 'i'),
    new RegExp(`"${field}"\\s*:\\s*'([^']*)'`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return '';
}

// Helper: Extract number from text using regex
function extractNumber(text: string, field: string): number {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'i'),
    new RegExp(`${field}\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return 0;
}
