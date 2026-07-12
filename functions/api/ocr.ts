export const onRequestPost = async (context: any) => {
  const { image } = await context.request.json();
  
  try {
    // Here you would integrate with an AI vision service
    // For now, return structure expected by FormAIOCR
    return Response.json({
      success: true,
      data: {
        name: '',
        number: '',
        deni: 0,
        maelezo_ya_bidhaa: '',
        notes: ''
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'AI processing failed' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
