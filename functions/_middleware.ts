// CORS middleware for all API routes
export const onRequest = async (context: any) => {
  const response = await context.next();
  const newResponse = new Response(response.body, response);
  
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: newResponse.headers });
  }
  
  return newResponse;
};
