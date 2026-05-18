// Cloudflare Worker for API Gateway and Security
// This handles all write operations and proxies to GitHub and Backblaze

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // API Routes
      if (path === '/api/posts') {
        if (request.method === 'GET') {
          return await getPosts(env);
        } else if (request.method === 'POST') {
          return await createPost(request, env);
        }
      } else if (path.match(/^\/api\/posts\/[^\/]+$/)) {
        const id = path.split('/').pop();
        if (request.method === 'PUT') {
          return await updatePost(request, id, env);
        } else if (request.method === 'DELETE') {
          return await deletePost(id, env);
        }
      } else if (path === '/api/pages') {
        if (request.method === 'GET') {
          return await getPages(env);
        } else if (request.method === 'POST') {
          return await createPage(request, env);
        }
      } else if (path.match(/^\/api\/pages\/[^\/]+$/)) {
        const id = path.split('/').pop();
        if (request.method === 'PUT') {
          return await updatePage(request, id, env);
        } else if (request.method === 'DELETE') {
          return await deletePage(id, env);
        }
      } else if (path === '/api/media') {
        if (request.method === 'GET') {
          return await getMedia(env);
        }
      } else if (path === '/api/media/upload') {
        if (request.method === 'POST') {
          return await uploadMedia(request, env);
        }
      } else if (path.match(/^\/api\/media\/[^\/]+$/)) {
        const id = path.split('/').pop();
        if (request.method === 'DELETE') {
          return await deleteMedia(id, env);
        }
      } else if (path === '/api/settings') {
        if (request.method === 'GET') {
          return await getSettings(env);
        } else if (request.method === 'PUT') {
          return await updateSettings(request, env);
        }
      } else if (path === '/api/theme') {
        if (request.method === 'GET') {
          return await getTheme(env);
        } else if (request.method === 'PUT') {
          return await updateTheme(request, env);
        }
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

// GitHub API helpers
async function getGitHubContent(env, path) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'StaticCMS',
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.content) {
    return JSON.parse(atob(data.content));
  }
  return data;
}

async function updateGitHubContent(env, path, content, message) {
  // Get current file SHA if exists
  let sha = null;
  const existing = await getGitHubContent(env, path);
  if (existing && existing.sha) {
    sha = existing.sha;
  }
  
  const body = {
    message: message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))), // Base64 encode
    branch: 'main'
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'StaticCMS',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub update failed: ${error.message}`);
  }
  
  return response.json();
}

// Posts handlers
async function getPosts(env) {
  const posts = await getGitHubContent(env, 'content/posts.json');
  return new Response(JSON.stringify(posts || []), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createPost(request, env) {
  const post = await request.json();
  const posts = await getGitHubContent(env, 'content/posts.json') || [];
  
  post.id = Date.now().toString();
  const newPosts = [...posts, post];
  
  await updateGitHubContent(env, 'content/posts.json', newPosts, `Create post: ${post.title}`);
  
  return new Response(JSON.stringify(post), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updatePost(request, id, env) {
  const updatedPost = await request.json();
  const posts = await getGitHubContent(env, 'content/posts.json') || [];
  
  const index = posts.findIndex(p => p.id === id);
  if (index === -1) {
    return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404 });
  }
  
  posts[index] = { ...posts[index], ...updatedPost, id };
  await updateGitHubContent(env, 'content/posts.json', posts, `Update post: ${updatedPost.title}`);
  
  return new Response(JSON.stringify(posts[index]), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function deletePost(id, env) {
  const posts = await getGitHubContent(env, 'content/posts.json') || [];
  const filteredPosts = posts.filter(p => p.id !== id);
  
  await updateGitHubContent(env, 'content/posts.json', filteredPosts, `Delete post: ${id}`);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Pages handlers
async function getPages(env) {
  const pages = await getGitHubContent(env, 'content/pages.json');
  return new Response(JSON.stringify(pages || []), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function createPage(request, env) {
  const page = await request.json();
  const pages = await getGitHubContent(env, 'content/pages.json') || [];
  
  page.id = Date.now().toString();
  const newPages = [...pages, page];
  
  await updateGitHubContent(env, 'content/pages.json', newPages, `Create page: ${page.title}`);
  
  return new Response(JSON.stringify(page), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updatePage(request, id, env) {
  const updatedPage = await request.json();
  const pages = await getGitHubContent(env, 'content/pages.json') || [];
  
  const index = pages.findIndex(p => p.id === id);
  if (index === -1) {
    return new Response(JSON.stringify({ error: 'Page not found' }), { status: 404 });
  }
  
  pages[index] = { ...pages[index], ...updatedPage, id };
  await updateGitHubContent(env, 'content/pages.json', pages, `Update page: ${updatedPage.title}`);
  
  return new Response(JSON.stringify(pages[index]), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function deletePage(id, env) {
  const pages = await getGitHubContent(env, 'content/pages.json') || [];
  const filteredPages = pages.filter(p => p.id !== id);
  
  await updateGitHubContent(env, 'content/pages.json', filteredPages, `Delete page: ${id}`);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Media handlers with Backblaze B2
async function getMedia(env) {
  const media = await getGitHubContent(env, 'content/media.json');
  return new Response(JSON.stringify(media || []), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function uploadMedia(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  const alt = formData.get('alt') || '';
  
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }
  
  // Get B2 upload URL and authorization
  const fileName = `${Date.now()}-${file.name}`;
  const uploadUrl = `https://${env.B2_BUCKET_NAME}.s3.${env.B2_REGION}.backblazeb2.com/${fileName}`;
  
  // Upload to Backblaze B2
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': env.B2_API_KEY,
      'Content-Type': file.type,
    },
    body: file
  });
  
  if (!uploadResponse.ok) {
    throw new Error('Failed to upload to Backblaze B2');
  }
  
  // Save media metadata to GitHub
  const media = await getGitHubContent(env, 'content/media.json') || [];
  const mediaItem = {
    id: Date.now().toString(),
    filename: file.name,
    url: uploadUrl,
    type: file.type.split('/')[0],
    size: file.size,
    alt: alt,
    uploadedAt: new Date().toISOString()
  };
  
  media.push(mediaItem);
  await updateGitHubContent(env, 'content/media.json', media, `Add media: ${file.name}`);
  
  return new Response(JSON.stringify(mediaItem), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function deleteMedia(id, env) {
  const media = await getGitHubContent(env, 'content/media.json') || [];
  const filteredMedia = media.filter(m => m.id !== id);
  
  await updateGitHubContent(env, 'content/media.json', filteredMedia, `Delete media: ${id}`);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Settings handlers
async function getSettings(env) {
  const settings = await getGitHubContent(env, 'config/settings.json');
  return new Response(JSON.stringify(settings || {}), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateSettings(request, env) {
  const settings = await request.json();
  await updateGitHubContent(env, 'config/settings.json', settings, 'Update site settings');
  
  return new Response(JSON.stringify(settings), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getTheme(env) {
  const theme = await getGitHubContent(env, 'config/active-theme.json');
  return new Response(JSON.stringify(theme || { active: 'classic' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateTheme(request, env) {
  const theme = await request.json();
  await updateGitHubContent(env, 'config/active-theme.json', theme, 'Update active theme');
  
  return new Response(JSON.stringify(theme), {
    headers: { 'Content-Type': 'application/json' }
  });
}
