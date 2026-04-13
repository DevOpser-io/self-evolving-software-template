/**
 * DevOpser Site Renderer
 *
 * A stateless container that renders websites from JSON configuration.
 * Receives site configuration via SITE_CONFIG environment variable.
 *
 * Security: This container runs with minimal privileges and serves only
 * static content generated from the provided configuration.
 */

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 80;

// Platform API URL for form submissions (leads capture)
// PLATFORM_API_URL must be set via environment variable
const PLATFORM_API_URL = process.env.PLATFORM_API_URL || '';
const SITE_ID = process.env.SITE_ID || '';

// Parse site configuration from environment
let siteConfig = {};
try {
  siteConfig = JSON.parse(process.env.SITE_CONFIG || '{}');
  console.log(`[Renderer] Loaded site config for: ${siteConfig.siteName || 'Unknown Site'}`);
} catch (error) {
  console.error('[Renderer] Failed to parse SITE_CONFIG:', error.message);
  siteConfig = { siteName: 'Error', sections: [] };
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for form handling
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", PLATFORM_API_URL]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// Health check endpoint (required for Lightsail)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function getIconClass(iconName) {
  const iconMap = {
    'rocket': 'fa-rocket', 'star': 'fa-star', 'heart': 'fa-heart', 'check': 'fa-check',
    'shield': 'fa-shield', 'lightning-charge': 'fa-bolt', 'globe': 'fa-globe',
    'people': 'fa-users', 'clock': 'fa-clock', 'bar-chart': 'fa-chart-bar',
    'lock': 'fa-lock', 'cloud': 'fa-cloud', 'code-slash': 'fa-code',
    'phone': 'fa-phone', 'gear': 'fa-gear', 'headset': 'fa-headset',
    'book': 'fa-book', 'gift': 'fa-gift', 'cpu': 'fa-microchip',
    'database': 'fa-database', 'envelope': 'fa-envelope', 'eye': 'fa-eye',
    'wrench': 'fa-wrench', 'trophy': 'fa-trophy', 'map': 'fa-map'
  };
  return iconMap[iconName] || 'fa-star';
}

// Generate CSS
function generateCSS(config) {
  const theme = config.theme || {};
  const primaryColor = theme.primaryColor || '#3B82F6';
  const secondaryColor = theme.secondaryColor || '#10B981';
  const textColor = theme.textColor || '#1F2937';
  const bgColor = theme.backgroundColor || '#FFFFFF';
  const fontFamily = theme.fontFamily || 'Inter, system-ui, sans-serif';

  return `
    :root {
      --primary-color: ${primaryColor};
      --secondary-color: ${secondaryColor};
      --text-color: ${textColor};
      --bg-color: ${bgColor};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      color: var(--text-color);
      background: var(--bg-color);
      line-height: 1.6;
    }
    a { color: inherit; text-decoration: none; }

    /* Navigation */
    .site-nav {
      background: #fff;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .site-nav-logo {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--primary-color);
    }
    .site-nav-links {
      display: flex;
      gap: 1.5rem;
      list-style: none;
    }
    .site-nav-links a {
      color: #374151;
      font-weight: 500;
      transition: color 0.2s;
    }
    .site-nav-links a:hover { color: var(--primary-color); }

    /* Hero Section */
    .section-hero {
      padding: 5rem 2rem;
      text-align: center;
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      position: relative;
    }
    .section-hero.has-bg-image {
      background-size: cover;
      background-position: center;
    }
    .section-hero.has-bg-image::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(135deg, rgba(59,130,246,0.8), rgba(16,185,129,0.8));
      z-index: 0;
    }
    .section-hero > * { position: relative; z-index: 1; }
    .section-hero h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    .section-hero p {
      font-size: 1.25rem;
      opacity: 0.9;
      margin-bottom: 2rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    .cta-btn {
      display: inline-block;
      background: white;
      color: var(--primary-color);
      padding: 0.875rem 2rem;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    /* Features Section */
    .section-features {
      padding: 5rem 2rem;
      background: #fff;
    }
    .section-features h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 1rem;
    }
    .section-features .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 3rem;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .feature-item {
      text-align: center;
      padding: 2rem;
      border-radius: 0.75rem;
      transition: box-shadow 0.2s;
    }
    .feature-item:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .feature-icon {
      font-size: 2.5rem;
      color: var(--primary-color);
      margin-bottom: 1rem;
    }
    .feature-item h3 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    .feature-item p {
      color: #6b7280;
    }
    .feature-image {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }

    /* About Section */
    .section-about {
      padding: 5rem 2rem;
      background: #f9fafb;
    }
    .about-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      max-width: 1200px;
      margin: 0 auto;
      align-items: center;
    }
    .about-container.image-left { direction: rtl; }
    .about-container.image-left > * { direction: ltr; }
    .about-content h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    .about-content p {
      color: #4b5563;
      line-height: 1.8;
    }
    .about-image img {
      width: 100%;
      border-radius: 0.75rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }

    /* Testimonials Section */
    .section-testimonials {
      padding: 5rem 2rem;
      background: #fff;
    }
    .section-testimonials h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 3rem;
    }
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .testimonial-item {
      background: #f9fafb;
      padding: 2rem;
      border-radius: 0.75rem;
    }
    .testimonial-quote {
      font-style: italic;
      color: #4b5563;
      margin-bottom: 1.5rem;
      line-height: 1.7;
    }
    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .testimonial-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
    }
    .testimonial-name {
      font-weight: 600;
    }
    .testimonial-role {
      font-size: 0.875rem;
      color: #6b7280;
    }

    /* Pricing Section */
    .section-pricing {
      padding: 5rem 2rem;
      background: #f9fafb;
    }
    .section-pricing h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .section-pricing .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 3rem;
    }
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    .pricing-item {
      background: #fff;
      padding: 2.5rem;
      border-radius: 0.75rem;
      text-align: center;
      border: 2px solid transparent;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .pricing-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    }
    .pricing-item.highlighted {
      border-color: var(--primary-color);
    }
    .pricing-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .pricing-price {
      font-size: 3rem;
      font-weight: 700;
      color: var(--primary-color);
    }
    .pricing-period {
      color: #6b7280;
      margin-bottom: 1.5rem;
    }
    .pricing-features {
      list-style: none;
      text-align: left;
      margin-bottom: 2rem;
    }
    .pricing-features li {
      padding: 0.5rem 0;
      color: #4b5563;
    }
    .pricing-features li::before {
      content: '\\2713';
      color: var(--primary-color);
      margin-right: 0.75rem;
    }
    .pricing-cta {
      display: inline-block;
      background: var(--primary-color);
      color: white;
      padding: 0.875rem 2rem;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: background 0.2s;
    }
    .pricing-cta:hover {
      background: color-mix(in srgb, var(--primary-color) 85%, black);
    }

    /* Contact Section */
    .section-contact {
      padding: 5rem 2rem;
      background: #fff;
    }
    .section-contact h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .section-contact .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 2rem;
    }
    .contact-info {
      text-align: center;
      max-width: 600px;
      margin: 0 auto;
    }
    .contact-info p {
      margin-bottom: 0.5rem;
      color: #4b5563;
    }

    /* Contact Form Section */
    .section-contactForm {
      padding: 5rem 2rem;
      background: #f9fafb;
    }
    .section-contactForm h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .section-contactForm .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 2rem;
    }
    .contact-form-container {
      max-width: 600px;
      margin: 0 auto;
      background: #fff;
      padding: 2.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .contact-form .form-group {
      margin-bottom: 1.5rem;
    }
    .contact-form label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #374151;
    }
    .contact-form input,
    .contact-form textarea,
    .contact-form select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .contact-form input:focus,
    .contact-form textarea:focus,
    .contact-form select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .contact-form textarea {
      min-height: 120px;
      resize: vertical;
    }
    .contact-form .form-submit {
      display: block;
      width: 100%;
      background: var(--primary-color);
      color: white;
      padding: 0.875rem 2rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
    }
    .contact-form .form-submit:hover {
      background: color-mix(in srgb, var(--primary-color) 85%, black);
      transform: translateY(-1px);
    }
    .contact-form .form-submit:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }
    .form-message {
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      display: none;
    }
    .form-message.success {
      display: block;
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .form-message.error {
      display: block;
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    /* Services Section */
    .section-services {
      padding: 5rem 2rem;
      background: #fff;
    }
    .section-services h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .section-services .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 3rem;
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .service-item {
      background: #f9fafb;
      padding: 2rem;
      border-radius: 0.75rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .service-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    }
    .service-icon {
      font-size: 2.5rem;
      color: var(--primary-color);
      margin-bottom: 1rem;
    }
    .service-image {
      width: 100%;
      height: 160px;
      object-fit: cover;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }
    .service-item h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }
    .service-item p {
      color: #6b7280;
      margin-bottom: 1rem;
    }
    .service-item .service-price {
      font-weight: 600;
      color: var(--primary-color);
    }

    /* Team Section */
    .section-team {
      padding: 5rem 2rem;
      background: #f9fafb;
    }
    .section-team h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .section-team .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 3rem;
    }
    .team-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .team-member {
      background: #fff;
      padding: 2rem;
      border-radius: 0.75rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .team-photo {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      margin: 0 auto 1rem;
    }
    .team-member h3 {
      font-size: 1.125rem;
      margin-bottom: 0.25rem;
    }
    .team-member .role {
      color: var(--primary-color);
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }
    .team-member .bio {
      color: #6b7280;
      font-size: 0.875rem;
    }

    /* Gallery Section */
    .section-gallery {
      padding: 5rem 2rem;
      background: #fff;
    }
    .section-gallery h2 {
      text-align: center;
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .section-gallery .subtitle {
      text-align: center;
      color: #6b7280;
      margin-bottom: 3rem;
    }
    .gallery-grid {
      display: grid;
      gap: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .gallery-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .gallery-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
    .gallery-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
    .gallery-item {
      aspect-ratio: 1;
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .gallery-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .gallery-item:hover img {
      transform: scale(1.05);
    }

    /* Footer */
    .section-footer {
      padding: 3rem 2rem;
      background: #111827;
      color: #fff;
      text-align: center;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
      list-style: none;
    }
    .footer-links a {
      color: #9ca3af;
      transition: color 0.2s;
    }
    .footer-links a:hover { color: #fff; }
    .footer-copyright {
      color: #6b7280;
      font-size: 0.875rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .site-nav {
        flex-direction: column;
        gap: 1rem;
      }
      .site-nav-links {
        flex-wrap: wrap;
        justify-content: center;
      }
      .section-hero h1 { font-size: 2rem; }
      .about-container { grid-template-columns: 1fr; }
      .gallery-grid.cols-3, .gallery-grid.cols-4 {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;
}

// Generate navigation HTML
function generateNav(config) {
  const sections = (config.sections || []).filter(s => s.visible !== false);
  const navLinks = sections
    .filter(s => ['features', 'about', 'pricing', 'contact', 'contactForm', 'team', 'testimonials', 'services'].includes(s.type))
    .map(s => {
      const label = s.content?.title || s.type.charAt(0).toUpperCase() + s.type.slice(1);
      return `<li><a href="#${s.id || s.type}">${escapeHtml(label)}</a></li>`;
    })
    .join('');

  return `
    <nav class="site-nav">
      <a href="/" class="site-nav-logo">${escapeHtml(config.siteName || 'My Site')}</a>
      <ul class="site-nav-links">${navLinks}</ul>
    </nav>
  `;
}

// Generate section HTML
function generateSection(section, config) {
  const content = section.content || {};
  const sectionId = section.id || section.type;

  switch (section.type) {
    case 'hero': {
      const bgImage = content.backgroundImage;
      const bgClass = bgImage ? 'section-hero has-bg-image' : 'section-hero';
      const bgStyle = bgImage ? `background-image: url('${escapeHtml(bgImage)}');` : '';
      return `
        <section class="${bgClass}" id="${sectionId}" style="${bgStyle}">
          <h1>${escapeHtml(content.headline || '')}</h1>
          <p>${escapeHtml(content.subheadline || '')}</p>
          ${content.ctaText ? `<a href="${escapeHtml(content.ctaLink || '#')}" class="cta-btn">${escapeHtml(content.ctaText)}</a>` : ''}
        </section>
      `;
    }

    case 'features': {
      const items = (content.items || []).map(item => {
        const visual = item.image
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="feature-image">`
          : `<div class="feature-icon"><i class="fa-solid ${getIconClass(item.icon)}"></i></div>`;
        return `
          <div class="feature-item">
            ${visual}
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
          </div>
        `;
      }).join('');

      return `
        <section class="section-features" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Features')}</h2>
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="features-grid">${items}</div>
        </section>
      `;
    }

    case 'about': {
      const imagePos = content.imagePosition || 'right';
      const containerClass = imagePos === 'left' ? 'about-container image-left' : 'about-container';
      return `
        <section class="section-about" id="${sectionId}">
          <div class="${containerClass}">
            <div class="about-content">
              <h2>${escapeHtml(content.title || 'About Us')}</h2>
              <p>${escapeHtml(content.content || '')}</p>
            </div>
            ${content.image ? `<div class="about-image"><img src="${escapeHtml(content.image)}" alt="About"></div>` : ''}
          </div>
        </section>
      `;
    }

    case 'testimonials': {
      const items = (content.items || []).map(item => `
        <div class="testimonial-item">
          <p class="testimonial-quote">"${escapeHtml(item.quote)}"</p>
          <div class="testimonial-author">
            ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.author)}" class="testimonial-avatar">` : ''}
            <div>
              <div class="testimonial-name">${escapeHtml(item.author)}</div>
              ${item.role ? `<div class="testimonial-role">${escapeHtml(item.role)}</div>` : ''}
            </div>
          </div>
        </div>
      `).join('');

      return `
        <section class="section-testimonials" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Testimonials')}</h2>
          <div class="testimonials-grid">${items}</div>
        </section>
      `;
    }

    case 'pricing': {
      const items = (content.items || []).map(item => {
        const features = (item.features || []).map(f => `<li>${escapeHtml(f)}</li>`).join('');
        return `
          <div class="pricing-item ${item.highlighted ? 'highlighted' : ''}">
            ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" style="width:100%;border-radius:0.5rem;margin-bottom:1rem;">` : ''}
            <div class="pricing-name">${escapeHtml(item.name)}</div>
            <div class="pricing-price">${escapeHtml(item.price)}<span class="pricing-period">${escapeHtml(item.period || '')}</span></div>
            <ul class="pricing-features">${features}</ul>
            ${item.ctaText ? `<a href="${escapeHtml(item.ctaLink || '#')}" class="pricing-cta">${escapeHtml(item.ctaText)}</a>` : ''}
          </div>
        `;
      }).join('');

      return `
        <section class="section-pricing" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Pricing')}</h2>
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="pricing-grid">${items}</div>
        </section>
      `;
    }

    case 'contact': {
      return `
        <section class="section-contact" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Contact')}</h2>
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="contact-info">
            ${content.email ? `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(content.email)}">${escapeHtml(content.email)}</a></p>` : ''}
            ${content.phone ? `<p><strong>Phone:</strong> ${escapeHtml(content.phone)}</p>` : ''}
            ${content.address ? `<p><strong>Address:</strong> ${escapeHtml(content.address)}</p>` : ''}
          </div>
        </section>
      `;
    }

    case 'contactForm': {
      // Build form fields from configuration
      const fields = content.fields || [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'message', label: 'Message', type: 'textarea', required: true }
      ];

      const formFields = fields.map(field => {
        const required = field.required ? 'required' : '';
        const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '';

        if (field.type === 'textarea') {
          return `
            <div class="form-group">
              <label for="field-${escapeHtml(field.name)}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
              <textarea
                id="field-${escapeHtml(field.name)}"
                name="${escapeHtml(field.name)}"
                ${placeholder}
                ${required}
              ></textarea>
            </div>
          `;
        } else if (field.type === 'select' && field.options) {
          const options = field.options.map(opt =>
            `<option value="${escapeHtml(opt.value || opt)}">${escapeHtml(opt.label || opt)}</option>`
          ).join('');
          return `
            <div class="form-group">
              <label for="field-${escapeHtml(field.name)}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
              <select
                id="field-${escapeHtml(field.name)}"
                name="${escapeHtml(field.name)}"
                ${required}
              >
                <option value="">Select an option</option>
                ${options}
              </select>
            </div>
          `;
        } else {
          return `
            <div class="form-group">
              <label for="field-${escapeHtml(field.name)}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
              <input
                type="${escapeHtml(field.type || 'text')}"
                id="field-${escapeHtml(field.name)}"
                name="${escapeHtml(field.name)}"
                ${placeholder}
                ${required}
              >
            </div>
          `;
        }
      }).join('');

      const successMessage = content.successMessage || 'Thank you! Your message has been sent.';
      const errorMessage = content.errorMessage || 'Something went wrong. Please try again.';
      const submitText = content.submitButtonText || 'Send Message';

      return `
        <section class="section-contactForm" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Get in Touch')}</h2>
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="contact-form-container">
            <div id="form-message-${sectionId}" class="form-message"></div>
            <form class="contact-form" id="contact-form-${sectionId}" data-section="${sectionId}">
              ${formFields}
              <button type="submit" class="form-submit">${escapeHtml(submitText)}</button>
            </form>
          </div>
        </section>
        <script>
          (function() {
            const form = document.getElementById('contact-form-${sectionId}');
            const messageEl = document.getElementById('form-message-${sectionId}');

            form.addEventListener('submit', async function(e) {
              e.preventDefault();
              const submitBtn = form.querySelector('.form-submit');
              const originalText = submitBtn.textContent;

              // Disable button
              submitBtn.disabled = true;
              submitBtn.textContent = 'Sending...';
              messageEl.className = 'form-message';
              messageEl.textContent = '';

              // Collect form data
              const formData = new FormData(form);
              const data = {};
              formData.forEach((value, key) => { data[key] = value; });

              try {
                const response = await fetch('${PLATFORM_API_URL}/leads', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    siteId: '${SITE_ID}',
                    formData: data,
                    source: '${sectionId}',
                    timestamp: new Date().toISOString()
                  })
                });

                if (response.ok) {
                  messageEl.className = 'form-message success';
                  messageEl.textContent = '${escapeHtml(successMessage).replace(/'/g, "\\'")}';
                  form.reset();
                } else {
                  throw new Error('Failed to submit');
                }
              } catch (err) {
                messageEl.className = 'form-message error';
                messageEl.textContent = '${escapeHtml(errorMessage).replace(/'/g, "\\'")}';
              } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
              }
            });
          })();
        </script>
      `;
    }

    case 'services': {
      const items = (content.items || []).map(item => {
        const visual = item.image
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="service-image">`
          : (item.icon ? `<div class="service-icon"><i class="fa-solid ${getIconClass(item.icon)}"></i></div>` : '');
        return `
          <div class="service-item">
            ${visual}
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
            ${item.price ? `<div class="service-price">${escapeHtml(item.price)}</div>` : ''}
          </div>
        `;
      }).join('');

      return `
        <section class="section-services" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Our Services')}</h2>
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="services-grid">${items}</div>
        </section>
      `;
    }

    case 'team': {
      const members = (content.members || []).map(member => `
        <div class="team-member">
          ${member.photo ? `<img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}" class="team-photo">` : ''}
          <h3>${escapeHtml(member.name)}</h3>
          <div class="role">${escapeHtml(member.role)}</div>
          ${member.bio ? `<p class="bio">${escapeHtml(member.bio)}</p>` : ''}
        </div>
      `).join('');

      return `
        <section class="section-team" id="${sectionId}">
          <h2>${escapeHtml(content.title || 'Our Team')}</h2>
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="team-grid">${members}</div>
        </section>
      `;
    }

    case 'gallery': {
      const cols = content.columns || 3;
      const images = (content.images || []).map(img => `
        <div class="gallery-item">
          <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || img.caption || '')}">
        </div>
      `).join('');

      return `
        <section class="section-gallery" id="${sectionId}">
          ${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ''}
          ${content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
          <div class="gallery-grid cols-${cols}">${images}</div>
        </section>
      `;
    }

    case 'footer': {
      const links = (content.links || []).map(link =>
        `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`
      ).join('');

      return `
        <footer class="section-footer" id="${sectionId}">
          ${content.logo ? `<img src="${escapeHtml(content.logo)}" alt="${escapeHtml(content.companyName)}" style="height:40px;margin-bottom:1rem;">` : ''}
          ${links ? `<ul class="footer-links">${links}</ul>` : ''}
          <p class="footer-copyright">${escapeHtml(content.copyright || `© ${new Date().getFullYear()} ${content.companyName || ''}`)}</p>
        </footer>
      `;
    }

    default:
      return `<!-- Unknown section type: ${section.type} -->`;
  }
}

// Generate full HTML page
function generatePage(config) {
  const sections = (config.sections || [])
    .filter(s => s.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const sectionsHtml = sections.map(s => generateSection(s, config)).join('\n');
  const css = generateCSS(config);
  const nav = generateNav(config);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.siteName || 'My Site')}</title>
  <meta name="description" content="${escapeHtml(config.description || '')}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>${css}</style>
</head>
<body>
  ${nav}
  <main>
    ${sectionsHtml}
  </main>
</body>
</html>`;
}

// Serve the site
app.get('/', (req, res) => {
  const html = generatePage(siteConfig);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Renderer] Site renderer running on port ${PORT}`);
  console.log(`[Renderer] Site: ${siteConfig.siteName || 'Unknown'}`);
  console.log(`[Renderer] Sections: ${(siteConfig.sections || []).length}`);
});
