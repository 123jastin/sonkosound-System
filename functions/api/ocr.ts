
// functions/api/ocr.ts - Fixed Groq Vision

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

    // Clean the base64 image
    let cleanImage = image;
    if (image.includes('data:image')) {
      cleanImage = image.split(';base64,')[1] || image;
    }

    console.log('Image type:', typeof image);
    console.log('Image length:', image.length);

    // Try the correct Groq vision model
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at this image and extract ALL text information. Return as JSON: {"name":"","number":"","deni":0,"maelezo_ya_bidhaa":"","notes":""}. Numbers only for deni (no TSh or commas).'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${cleanImage}`
                }
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 1000
      })
    });

    const result = await response.json();
    
    if (result.error) {
      console.error('Groq error:', result.error);
      return Response.json({
        success: false,
        error: result.error.message,
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      });
    }

    const content = result.choices?.[0]?.message?.content || '';
    console.log('Groq response:', content);

    // Try to parse JSON from response
    let data;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('JSON parse failed, using fallback');
    }

    if (!data) {
      data = { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' };
    }

    return Response.json({
      success: true,
      data: {
        name: String(data.name || '').trim(),
        number: String(data.number || '').trim(),
        deni: Number(data.deni) || 0,
        maelezo_ya_bidhaa: String(data.maelezo_ya_bidhaa || '').trim(),
        notes: String(data.notes || '').trim()
      }
    });

  } catch (error: any) {
    console.error('OCR Error:', error);
    return Response.json({
      success: false,
      error: error.message,
      data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
    });
  }
};
