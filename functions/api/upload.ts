// functions/api/upload.ts

export const onRequestPost = async (context: any) => {
  try {
    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No file provided' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'File too large. Maximum size: 10MB' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `uploads/${timestamp}-${randomStr}.${extension}`;

    // Upload to R2 bucket
    await context.env.MEDIA_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
      }
    });

    // Construct the public URL using custom domain
    const publicUrl = `https://pics.sonkosound.store/${fileName}`;

    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      fileName: fileName,
      size: file.size,
      type: file.type
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Upload failed' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// Handle GET requests - serve files or list info
export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const fileName = url.searchParams.get('file');

  if (fileName) {
    try {
      // Retrieve file from R2
      const object = await context.env.MEDIA_BUCKET.get(fileName);
      
      if (!object) {
        return new Response('File not found', { status: 404 });
      }

      // Return the file with proper headers
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000');
      
      return new Response(object.body, { headers });
    } catch (error) {
      return new Response('Error retrieving file', { status: 500 });
    }
  }

  // List recent uploads (optional)
  try {
    const objects = await context.env.MEDIA_BUCKET.list({
      limit: 20,
      prefix: 'uploads/'
    });

    return new Response(JSON.stringify({
      success: true,
      files: objects.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        url: `https://pics.sonkosound.store/${obj.key}`
      }))
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to list files' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// Handle CORS preflight
export const onRequestOptions = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
};
