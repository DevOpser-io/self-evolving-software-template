/**
 * FILE: backend/services/pageTemplates.js
 * PURPOSE: Page templates for multi-page site architecture
 * DESCRIPTION: Provides pre-built page templates for common service business pages.
 */

const { v4: uuidv4 } = require('uuid');
const { SECTION_SCHEMAS } = require('../config/sectionSchemas');

/**
 * Generate a unique page ID
 */
function generatePageId() {
  return `page-${uuidv4().slice(0, 8)}`;
}

/**
 * Generate a unique section ID
 */
function generateSectionId(type) {
  return `${type}-${uuidv4().slice(0, 8)}`;
}

/**
 * Create a section from schema with unique ID
 */
function createSection(type, contentOverrides = {}) {
  const schema = SECTION_SCHEMAS[type];
  if (!schema) {
    throw new Error(`Unknown section type: ${type}`);
  }

  return {
    id: generateSectionId(type),
    type,
    order: 0,
    visible: true,
    content: {
      ...JSON.parse(JSON.stringify(schema.defaultContent)),
      ...contentOverrides
    }
  };
}

/**
 * Page template definitions
 */
const PAGE_TEMPLATES = {
  home: {
    id: 'home',
    name: 'Home',
    slug: '',
    description: 'Main landing page with hero, features, and call to action',
    icon: 'house',
    createSections: (siteName) => [
      createSection('hero', {
        headline: `Welcome to ${siteName}`,
        subheadline: 'Professional services you can trust',
        ctaText: 'Get Started',
        ctaLink: '#contact'
      }),
      createSection('features', {
        title: 'Why Choose Us',
        subtitle: 'What sets us apart from the competition'
      }),
      createSection('testimonials', {
        title: 'What Our Clients Say'
      }),
      createSection('contact', {
        title: 'Ready to Get Started?',
        subtitle: 'Contact us today for a free consultation'
      }),
      createSection('footer', {
        companyName: siteName,
        copyright: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
      })
    ]
  },

  about: {
    id: 'about',
    name: 'About Us',
    slug: 'about',
    description: 'Tell your company story and introduce your team',
    icon: 'people',
    createSections: (siteName) => [
      createSection('hero', {
        headline: `About ${siteName}`,
        subheadline: 'Learn more about our story and mission',
        ctaText: 'Meet the Team',
        ctaLink: '#team',
        backgroundColorStart: '#1a365d',
        backgroundColorEnd: '#2d3748'
      }),
      createSection('story', {
        title: 'Our Story',
        content: `<p>${siteName} was founded with a simple mission: to provide exceptional service to our community.</p><p>Over the years, we've built a reputation for quality, reliability, and customer satisfaction. We're proud to have helped hundreds of clients achieve their goals.</p>`,
        image: 'https://placehold.co/600x400/f3f4f6/6b7280?text=Our+Story',
        imagePosition: 'right',
        highlights: [
          { label: 'Years Experience', value: '10+' },
          { label: 'Happy Clients', value: '500+' },
          { label: 'Projects Done', value: '1000+' }
        ]
      }),
      createSection('team', {
        title: 'Meet Our Team',
        subtitle: 'The dedicated professionals behind our success'
      }),
      createSection('footer', {
        companyName: siteName,
        copyright: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
      })
    ]
  },

  services: {
    id: 'services',
    name: 'Services',
    slug: 'services',
    description: 'Showcase your services and offerings',
    icon: 'wrench',
    createSections: (siteName) => [
      createSection('hero', {
        headline: 'Our Services',
        subheadline: 'Professional solutions tailored to your needs',
        ctaText: 'Get a Quote',
        ctaLink: '#contact',
        backgroundColorStart: '#065f46',
        backgroundColorEnd: '#047857'
      }),
      createSection('services', {
        title: 'What We Offer',
        subtitle: 'Comprehensive services to meet all your needs',
        items: [
          {
            icon: 'wrench',
            title: 'Service 1',
            description: 'Detailed description of your first service offering and its benefits to customers.',
            price: null,
            ctaText: 'Learn More',
            ctaLink: '#contact'
          },
          {
            icon: 'gear',
            title: 'Service 2',
            description: 'Detailed description of your second service offering and its benefits to customers.',
            price: null,
            ctaText: 'Learn More',
            ctaLink: '#contact'
          },
          {
            icon: 'headset',
            title: 'Service 3',
            description: 'Detailed description of your third service offering and its benefits to customers.',
            price: null,
            ctaText: 'Learn More',
            ctaLink: '#contact'
          }
        ]
      }),
      createSection('pricing', {
        title: 'Pricing Plans',
        subtitle: 'Transparent pricing with no hidden fees'
      }),
      createSection('contact', {
        title: 'Request a Quote',
        subtitle: 'Get in touch for a personalized quote'
      }),
      createSection('footer', {
        companyName: siteName,
        copyright: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
      })
    ]
  },

  contact: {
    id: 'contact',
    name: 'Contact',
    slug: 'contact',
    description: 'Contact form and business information',
    icon: 'envelope',
    createSections: (siteName) => [
      createSection('hero', {
        headline: 'Contact Us',
        subheadline: 'We\'d love to hear from you',
        ctaText: 'Send Message',
        ctaLink: '#contact-form',
        backgroundColorStart: '#7c3aed',
        backgroundColorEnd: '#6d28d9'
      }),
      createSection('contactForm', {
        title: 'Get in Touch',
        subtitle: 'Fill out the form below and we\'ll respond within 24 hours.',
        submitButtonText: 'Send Message',
        fields: [
          { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your name' },
          { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'you@example.com' },
          { name: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: '(555) 123-4567' },
          { name: 'service', label: 'Service Interested In', type: 'select', required: false, options: ['General Inquiry', 'Service 1', 'Service 2', 'Service 3'] },
          { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?' }
        ],
        contactInfo: {
          email: 'hello@example.com',
          phone: '(555) 123-4567',
          address: '123 Main Street, City, State 12345',
          hours: 'Mon-Fri: 9am-5pm'
        }
      }),
      createSection('footer', {
        companyName: siteName,
        copyright: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
      })
    ]
  },

  team: {
    id: 'team',
    name: 'Our Team',
    slug: 'team',
    description: 'Introduce your team members',
    icon: 'users',
    createSections: (siteName) => [
      createSection('hero', {
        headline: 'Our Team',
        subheadline: 'Meet the people who make it all happen',
        ctaText: 'Join Us',
        ctaLink: '#careers',
        backgroundColorStart: '#be185d',
        backgroundColorEnd: '#9d174d'
      }),
      createSection('team', {
        title: 'Leadership',
        subtitle: 'Our experienced leadership team',
        members: [
          {
            name: 'John Smith',
            role: 'CEO & Founder',
            bio: 'John founded the company with a vision to transform the industry.',
            photo: 'https://placehold.co/200x200/3B82F6/white?text=JS',
            email: null,
            linkedin: null
          },
          {
            name: 'Jane Doe',
            role: 'COO',
            bio: 'Jane oversees daily operations and ensures excellence in everything we do.',
            photo: 'https://placehold.co/200x200/10B981/white?text=JD',
            email: null,
            linkedin: null
          }
        ]
      }),
      createSection('team', {
        title: 'Our Specialists',
        subtitle: 'Expert professionals dedicated to your success',
        members: [
          {
            name: 'Team Member',
            role: 'Specialist',
            bio: 'Brings expertise and dedication to every project.',
            photo: 'https://placehold.co/200x200/8B5CF6/white?text=TM',
            email: null,
            linkedin: null
          }
        ]
      }),
      createSection('contact', {
        title: 'Interested in Joining Our Team?',
        subtitle: 'We\'re always looking for talented individuals'
      }),
      createSection('footer', {
        companyName: siteName,
        copyright: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
      })
    ]
  },

  gallery: {
    id: 'gallery',
    name: 'Gallery',
    slug: 'gallery',
    description: 'Showcase your work with images',
    icon: 'image',
    createSections: (siteName) => [
      createSection('hero', {
        headline: 'Our Work',
        subheadline: 'See examples of our projects and results',
        ctaText: 'Get Started',
        ctaLink: '/contact',
        backgroundColorStart: '#0891b2',
        backgroundColorEnd: '#0e7490'
      }),
      createSection('gallery', {
        title: 'Project Gallery',
        subtitle: 'Browse through our completed projects',
        columns: 3,
        images: [
          { url: 'https://placehold.co/400x400/3B82F6/white?text=Project+1', caption: 'Project 1', alt: 'Project image' },
          { url: 'https://placehold.co/400x400/10B981/white?text=Project+2', caption: 'Project 2', alt: 'Project image' },
          { url: 'https://placehold.co/400x400/8B5CF6/white?text=Project+3', caption: 'Project 3', alt: 'Project image' },
          { url: 'https://placehold.co/400x400/F59E0B/white?text=Project+4', caption: 'Project 4', alt: 'Project image' },
          { url: 'https://placehold.co/400x400/EF4444/white?text=Project+5', caption: 'Project 5', alt: 'Project image' },
          { url: 'https://placehold.co/400x400/06B6D4/white?text=Project+6', caption: 'Project 6', alt: 'Project image' }
        ]
      }),
      createSection('contact', {
        title: 'Like What You See?',
        subtitle: 'Let\'s discuss your project'
      }),
      createSection('footer', {
        companyName: siteName,
        copyright: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
      })
    ]
  }
};

/**
 * Create a new page from a template
 * @param {string} templateId - ID of the template to use
 * @param {string} siteName - Name of the site (for personalization)
 * @param {Object} overrides - Optional overrides for page properties
 * @returns {Object} - New page object
 */
function createPageFromTemplate(templateId, siteName, overrides = {}) {
  const template = PAGE_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown page template: ${templateId}`);
  }

  const sections = template.createSections(siteName);

  // Assign order to sections
  sections.forEach((section, index) => {
    section.order = index;
  });

  return {
    id: overrides.id || generatePageId(),
    name: overrides.name || template.name,
    slug: overrides.slug !== undefined ? overrides.slug : template.slug,
    isHome: template.slug === '',
    sections
  };
}

/**
 * Get list of available page templates
 * @returns {Array} - Array of template info objects
 */
function getAvailableTemplates() {
  return Object.entries(PAGE_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    icon: template.icon
  }));
}

/**
 * Convert legacy single-page config to multi-page format
 * @param {Object} config - Legacy config with sections array
 * @returns {Object} - New config with pages array
 */
function convertToMultiPageConfig(config) {
  if (config.pages && Array.isArray(config.pages)) {
    // Already in multi-page format
    return config;
  }

  const homePage = {
    id: 'home',
    name: 'Home',
    slug: '',
    isHome: true,
    sections: config.sections || []
  };

  return {
    siteName: config.siteName,
    theme: config.theme,
    pages: [homePage],
    navigation: {
      style: 'fixed-top',
      logo: { url: null, alt: config.siteName },
      links: [{ pageId: 'home', label: 'Home' }]
    },
    footer: config.sections?.find(s => s.type === 'footer')?.content || {
      companyName: config.siteName,
      copyright: `© ${new Date().getFullYear()} ${config.siteName}. All rights reserved.`
    }
  };
}

/**
 * Add a page to an existing site config
 * @param {Object} config - Site configuration
 * @param {string} templateId - Template to use for new page
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} - Updated configuration
 */
function addPageToConfig(config, templateId, overrides = {}) {
  const newConfig = JSON.parse(JSON.stringify(config));

  // Ensure config is in multi-page format
  if (!newConfig.pages) {
    Object.assign(newConfig, convertToMultiPageConfig(newConfig));
  }

  const newPage = createPageFromTemplate(templateId, newConfig.siteName, overrides);

  // Ensure unique slug
  const existingSlugs = new Set(newConfig.pages.map(p => p.slug));
  if (existingSlugs.has(newPage.slug)) {
    let counter = 1;
    let baseSlug = newPage.slug || templateId;
    while (existingSlugs.has(`${baseSlug}-${counter}`)) {
      counter++;
    }
    newPage.slug = `${baseSlug}-${counter}`;
  }

  newConfig.pages.push(newPage);

  // Add to navigation
  if (newConfig.navigation && newConfig.navigation.links) {
    newConfig.navigation.links.push({
      pageId: newPage.id,
      label: newPage.name
    });
  }

  return newConfig;
}

/**
 * Remove a page from site config
 * @param {Object} config - Site configuration
 * @param {string} pageId - ID of page to remove
 * @returns {Object} - Updated configuration
 */
function removePageFromConfig(config, pageId) {
  const newConfig = JSON.parse(JSON.stringify(config));

  if (!newConfig.pages) {
    return newConfig;
  }

  const pageIndex = newConfig.pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) {
    throw new Error(`Page not found: ${pageId}`);
  }

  // Don't allow removing the home page
  if (newConfig.pages[pageIndex].isHome) {
    throw new Error('Cannot remove the home page');
  }

  newConfig.pages.splice(pageIndex, 1);

  // Remove from navigation
  if (newConfig.navigation && newConfig.navigation.links) {
    newConfig.navigation.links = newConfig.navigation.links.filter(
      link => link.pageId !== pageId
    );
  }

  return newConfig;
}

/**
 * Get a specific page from config
 * @param {Object} config - Site configuration
 * @param {string} pageId - ID of page to get
 * @returns {Object|null} - Page object or null
 */
function getPageById(config, pageId) {
  if (!config.pages) {
    return null;
  }
  return config.pages.find(p => p.id === pageId) || null;
}

/**
 * Update a specific page in config
 * @param {Object} config - Site configuration
 * @param {string} pageId - ID of page to update
 * @param {Object} updates - Updates to apply
 * @returns {Object} - Updated configuration
 */
function updatePageInConfig(config, pageId, updates) {
  const newConfig = JSON.parse(JSON.stringify(config));

  if (!newConfig.pages) {
    return newConfig;
  }

  const pageIndex = newConfig.pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) {
    throw new Error(`Page not found: ${pageId}`);
  }

  // Apply updates
  if (updates.name !== undefined) {
    newConfig.pages[pageIndex].name = updates.name;
    // Update navigation label
    if (newConfig.navigation && newConfig.navigation.links) {
      const navLink = newConfig.navigation.links.find(l => l.pageId === pageId);
      if (navLink) {
        navLink.label = updates.name;
      }
    }
  }

  if (updates.slug !== undefined && !newConfig.pages[pageIndex].isHome) {
    newConfig.pages[pageIndex].slug = updates.slug;
  }

  if (updates.sections !== undefined) {
    newConfig.pages[pageIndex].sections = updates.sections;
  }

  return newConfig;
}

module.exports = {
  PAGE_TEMPLATES,
  createPageFromTemplate,
  getAvailableTemplates,
  convertToMultiPageConfig,
  addPageToConfig,
  removePageFromConfig,
  getPageById,
  updatePageInConfig,
  generatePageId,
  createSection
};
