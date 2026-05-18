const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');

class StaticSiteBuilder {
  constructor() {
    this.contentDir = './content';
    this.themesDir = './themes';
    this.distDir = './dist';
    this.configDir = './config';
  }

  async build() {
    console.log('🚀 Starting build process...');
    
    // Create dist directory if it doesn't exist
    await this.ensureDir(this.distDir);
    
    // Load configuration
    const settings = await this.loadJSON(path.join(this.configDir, 'settings.json'));
    const activeTheme = await this.loadJSON(path.join(this.configDir, 'active-theme.json'));
    const themeConfig = await this.loadJSON(path.join(this.themesDir, activeTheme.active, 'theme.json'));
    
    // Load content
    const posts = await this.loadJSON(path.join(this.contentDir, 'posts.json'));
    const pages = await this.loadJSON(path.join(this.contentDir, 'pages.json'));
    
    // Build pages
    await this.buildHomePage(posts, settings, themeConfig);
    await this.buildPostsPages(posts, settings, themeConfig);
    await this.buildIndividualPosts(posts, themeConfig);
    await this.buildPages(pages, themeConfig);
    
    // Copy theme assets
    await this.copyThemeAssets(activeTheme.active);
    
    console.log('✅ Build completed successfully!');
  }
  
  async loadJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Warning: Could not load ${filePath}`, error.message);
      return [];
    }
  }
  
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
  
  async buildHomePage(posts, settings, themeConfig) {
    const template = await this.loadTemplate('template.html');
    const paginatedPosts = posts.slice(0, settings.postsPerPage || 10);
    
    const html = this.renderTemplate(template, {
      title: settings.siteTitle || 'Home',
      description: settings.siteDescription,
      content: this.renderPostsList(paginatedPosts),
      year: new Date().getFullYear()
    });
    
    await fs.writeFile(path.join(this.distDir, 'index.html'), html);
    console.log('📄 Built home page');
  }
  
  async buildPostsPages(posts, settings, themeConfig) {
    const template = await this.loadTemplate('template.html');
    const postsPerPage = settings.postsPerPage || 10;
    const totalPages = Math.ceil(posts.length / postsPerPage);
    
    for (let i = 0; i < totalPages; i++) {
      const start = i * postsPerPage;
      const end = start + postsPerPage;
      const pagePosts = posts.slice(start, end);
      
      const html = this.renderTemplate(template, {
        title: `Page ${i + 1} - ${settings.siteTitle}`,
        description: settings.siteDescription,
        content: this.renderPostsList(pagePosts),
        year: new Date().getFullYear()
      });
      
      const pagePath = i === 0 ? 'index.html' : `page/${i + 1}/index.html`;
      const fullPath = path.join(this.distDir, pagePath);
      await this.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, html);
    }
    
    console.log(`📄 Built ${totalPages} post pages`);
  }
  
  async buildIndividualPosts(posts, themeConfig) {
    const template = await this.loadTemplate('template.html');
    
    for (const post of posts) {
      const html = this.renderTemplate(template, {
        title: post.title,
        description: post.excerpt || post.title,
        content: this.renderSinglePost(post),
        year: new Date().getFullYear()
      });
      
      const postPath = path.join(this.distDir, 'posts', post.slug, 'index.html');
      await this.ensureDir(path.dirname(postPath));
      await fs.writeFile(postPath, html);
    }
    
    console.log(`📄 Built ${posts.length} individual posts`);
  }
  
  async buildPages(pages, themeConfig) {
    const template = await this.loadTemplate('template.html');
    
    for (const page of pages) {
      const html = this.renderTemplate(template, {
        title: page.title,
        description: page.title,
        content: this.renderPage(page),
        year: new Date().getFullYear()
      });
      
      const pagePath = path.join(this.distDir, page.slug, 'index.html');
      await this.ensureDir(path.dirname(pagePath));
      await fs.writeFile(pagePath, html);
    }
    
    console.log(`📄 Built ${pages.length} pages`);
  }
  
  async loadTemplate(templateName) {
    const activeTheme = await this.loadJSON(path.join(this.configDir, 'active-theme.json'));
    const templatePath = path.join(this.themesDir, activeTheme.active, templateName);
    return fs.readFile(templatePath, 'utf-8');
  }
  
  renderTemplate(template, data) {
    return template
      .replace(/{{title}}/g, data.title)
      .replace(/{{description}}/g, data.description)
      .replace(/{{content}}/g, data.content)
      .replace(/{{year}}/g, data.year);
  }
  
  renderPostsList(posts) {
    return `
      <div class="posts-list">
        ${posts.map(post => `
          <article class="post-preview">
            ${post.featuredImage ? `<img src="${post.featuredImage}" alt="${post.title}" class="featured-image">` : ''}
            <h2><a href="/posts/${post.slug}/">${post.title}</a></h2>
            <div class="post-meta">
              <time datetime="${post.createdAt}">${new Date(post.createdAt).toLocaleDateString()}</time>
              ${post.tags ? `<div class="tags">${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
            </div>
            <p class="excerpt">${post.excerpt || post.content.substring(0, 200)}...</p>
            <a href="/posts/${post.slug}/" class="read-more">Read More →</a>
          </article>
        `).join('')}
      </div>
    `;
  }
  
  renderSinglePost(post) {
    const content = marked.parse(post.content);
    
    return `
      <article class="single-post">
        ${post.featuredImage ? `<img src="${post.featuredImage}" alt="${post.title}" class="featured-image">` : ''}
        <h1>${post.title}</h1>
        <div class="post-meta">
          <time datetime="${post.createdAt}">${new Date(post.createdAt).toLocaleDateString()}</time>
          ${post.tags ? `<div class="tags">${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
        </div>
        <div class="post-content">
          ${content}
        </div>
      </article>
    `;
  }
  
  renderPage(page) {
    const content = marked.parse(page.content);
    
    return `
      <article class="page">
        <h1>${page.title}</h1>
        <div class="page-content">
          ${content}
        </div>
      </article>
    `;
  }
  
  async copyThemeAssets(themeName) {
    const themePath = path.join(this.themesDir, themeName);
    const cssPath = path.join(themePath, 'style.css');
    const distCssPath = path.join(this.distDir, 'style.css');
    
    try {
      await fs.copyFile(cssPath, distCssPath);
      console.log('🎨 Copied theme CSS');
    } catch (error) {
      console.warn('Could not copy theme CSS:', error.message);
    }
  }
}

// Run the build
const builder = new StaticSiteBuilder();
builder.build().catch(console.error);
