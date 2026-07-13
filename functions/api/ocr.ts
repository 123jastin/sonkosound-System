// functions/api/ocr.ts

export const onRequestPost = async (context: any) => {
  try {
    const { image } = await context.request.json();
    
    // Get Groq API key from environment variables
    const GROQ_API_KEY = context.env.GROQ_API_KEY;
    
    console.log('OCR Request received');
    console.log('API Key exists:', !!GROQ_API_KEY);
    console.log('API Key length:', GROQ_API_KEY ? GROQ_API_KEY.length : 0);
    console.log('API Key prefix:', GROQ_API_KEY ? GROQ_API_KEY.substring(0, 10) + '...' : 'none');
    
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY not configured');
      return Response.json({
        success: false,
        error: 'API key not configured. Please add GROQ_API_KEY to environment variables.',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    // Check if image is valid
    if (!image || typeof image !== 'string') {
      return Response.json({
        success: false,
        error: 'No valid image provided',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    console.log('Image data length:', image.length);
    console.log('Image starts with:', image.substring(0, 30));

    // Call Groq Vision API
    const requestBody = {
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
    };

    console.log('Sending request to Groq...');
    
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Groq response status:', groqResponse.status);
    
    const result = await groqResponse.json();

    // Log the full response for debugging (remove in production)
    if (groqResponse.status !== 200) {
      console.error('Groq API error response:', JSON.stringify(result));
    }

    // Check for API errors
    if (result.error) {
      console.error('Groq API error:', result.error);
      return Response.json({
        success: false,
        error: `AI Error: ${result.error.message || 'Unknown error'}`,
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    // Extract content from response
    const content = result.choices?.[0]?.message?.content || '';
    console.log('Groq extracted content:', content);

    if (!content) {
      console.error('No content in Groq response');
      return Response.json({
        success: false,
        error: 'AI did not return any content',
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    // Parse the JSON from response
    let extractedData;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      extractedData = JSON.parse(jsonStr);
      console.log('Parsed JSON successfully');
    } catch (parseError) {
      console.error('Failed to parse JSON, content was:', content);
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

    console.log('Final extracted data:', cleanData);

    return Response.json({
      success: true,
      data: cleanData
    });

  } catch (error: any) {
    console.error('OCR Error:', error);
    console.error('Error stack:', error.stack);
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
