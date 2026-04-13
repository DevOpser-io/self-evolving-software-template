/**
 * FILE: backend/config/sectionSchemas.js
 * PURPOSE: JSON schemas for website section types
 * DESCRIPTION: Defines the structure and default values for each section type
 *              that can be added to a DevOpser Lite website.
 */

// Available icon names for features (Bootstrap Icons names)
const AVAILABLE_ICONS = [
  'rocket', 'star', 'heart', 'check', 'shield', 'lightning-charge',
  'globe', 'people', 'clock', 'bar-chart', 'lock', 'cloud',
  'code-slash', 'phone', 'gear', 'headset', 'book', 'gift',
  'cpu', 'database', 'envelope', 'eye', 'file-text', 'flag',
  'folder', 'house', 'image', 'key', 'layers', 'link',
  'map', 'megaphone', 'moon', 'palette', 'pencil', 'person',
  'pie-chart', 'pin-map', 'play', 'plus-circle', 'power', 'puzzle',
  'search', 'send', 'share', 'shop', 'speedometer', 'sun',
  'terminal', 'trophy', 'truck', 'wifi', 'wrench', 'zoom-in'
];

// Section type definitions
const SECTION_SCHEMAS = {
  hero: {
    type: 'hero',
    displayName: 'Hero Banner',
    description: 'Main hero section with headline, subheadline, and call-to-action',
    defaultContent: {
      headline: 'Build Something Amazing',
      subheadline: 'Create beautiful websites with AI assistance in minutes',
      ctaText: 'Get Started',
      ctaLink: '#contact',
      backgroundImage: 'https://placehold.co/1920x800/3B82F6/white?text=Hero+Image',
      backgroundColorStart: null,  // Hex color for gradient start, null = use theme
      backgroundColorEnd: null     // Hex color for gradient end, null = use theme
    },
    schema: {
      headline: { type: 'string', maxLength: 100, required: true },
      subheadline: { type: 'string', maxLength: 300, required: false },
      ctaText: { type: 'string', maxLength: 30, required: false },
      ctaLink: { type: 'string', maxLength: 200, required: false },
      backgroundImage: { type: 'url', required: false },
      backgroundColorStart: { type: 'hexColor', required: false, description: 'Gradient start color in hex format (e.g., #000000)' },
      backgroundColorEnd: { type: 'hexColor', required: false, description: 'Gradient end color in hex format (e.g., #1a1a1a)' }
    }
  },

  features: {
    type: 'features',
    displayName: 'Features',
    description: 'Feature grid showcasing product capabilities with icons or images',
    defaultContent: {
      title: 'Features',
      subtitle: 'Everything you need to succeed',
      items: [
        { icon: 'rocket', title: 'Fast', description: 'Lightning-fast performance', image: null },
        { icon: 'shield', title: 'Secure', description: 'Enterprise-grade security', image: null },
        { icon: 'headset', title: 'Support', description: '24/7 customer support', image: null }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      subtitle: { type: 'string', maxLength: 200, required: false },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        itemSchema: {
          icon: { type: 'enum', values: AVAILABLE_ICONS, required: false, description: 'Icon to display (use icon OR image, not both)' },
          image: { type: 'url', required: false, description: 'Image URL to display instead of icon' },
          title: { type: 'string', maxLength: 50, required: true },
          description: { type: 'string', maxLength: 150, required: true }
        }
      }
    }
  },

  about: {
    type: 'about',
    displayName: 'About',
    description: 'About section with text and optional image',
    defaultContent: {
      title: 'About Us',
      content: 'We are a team dedicated to making website creation simple and accessible for everyone.',
      image: 'https://placehold.co/600x400/f3f4f6/6b7280?text=About+Us',
      imagePosition: 'right'
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      content: { type: 'text', maxLength: 1000, required: true },
      image: { type: 'url', required: false },
      imagePosition: { type: 'enum', values: ['left', 'right'], required: false }
    }
  },

  testimonials: {
    type: 'testimonials',
    displayName: 'Testimonials',
    description: 'Customer testimonials and reviews',
    defaultContent: {
      title: 'What Our Customers Say',
      items: [
        {
          quote: 'This product changed how we do business. Highly recommended!',
          author: 'Jane Smith',
          role: 'CEO, TechCorp',
          avatar: 'https://placehold.co/100x100/3B82F6/white?text=JS'
        },
        {
          quote: 'Outstanding service and support. The team went above and beyond.',
          author: 'Mike Johnson',
          role: 'Marketing Director',
          avatar: 'https://placehold.co/100x100/10B981/white?text=MJ'
        }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        itemSchema: {
          quote: { type: 'string', maxLength: 500, required: true },
          author: { type: 'string', maxLength: 100, required: true },
          role: { type: 'string', maxLength: 100, required: false },
          avatar: { type: 'url', required: false }
        }
      }
    }
  },

  pricing: {
    type: 'pricing',
    displayName: 'Pricing',
    description: 'Pricing tiers and plans with optional images',
    defaultContent: {
      title: 'Simple Pricing',
      subtitle: 'Choose the plan that works for you',
      backgroundImage: null,
      items: [
        {
          name: 'Starter',
          price: '$9',
          period: '/month',
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
          ctaText: 'Get Started',
          ctaLink: '#contact',
          highlighted: false,
          image: null
        },
        {
          name: 'Pro',
          price: '$29',
          period: '/month',
          features: ['Everything in Starter', 'Feature 4', 'Feature 5', 'Priority Support'],
          ctaText: 'Get Started',
          ctaLink: '#contact',
          highlighted: true,
          image: null
        }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      subtitle: { type: 'string', maxLength: 200, required: false },
      backgroundImage: { type: 'url', required: false, description: 'Background image for the pricing section' },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        itemSchema: {
          name: { type: 'string', maxLength: 50, required: true },
          price: { type: 'string', maxLength: 20, required: true },
          period: { type: 'string', maxLength: 20, required: false },
          features: { type: 'array', maxItems: 10, itemType: 'string' },
          ctaText: { type: 'string', maxLength: 30, required: false },
          ctaLink: { type: 'string', maxLength: 200, required: false },
          highlighted: { type: 'boolean', required: false },
          image: { type: 'url', required: false, description: 'Product/plan image' }
        }
      }
    }
  },

  contact: {
    type: 'contact',
    displayName: 'Contact',
    description: 'Contact form and information with optional background image',
    defaultContent: {
      title: 'Get in Touch',
      subtitle: 'We\'d love to hear from you',
      email: 'hello@example.com',
      phone: null,
      address: null,
      showForm: true,
      formFields: ['name', 'email', 'message'],
      backgroundImage: null,
      image: null
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      subtitle: { type: 'string', maxLength: 200, required: false },
      email: { type: 'email', required: false },
      phone: { type: 'string', maxLength: 30, required: false },
      address: { type: 'string', maxLength: 200, required: false },
      showForm: { type: 'boolean', required: false },
      formFields: { type: 'array', maxItems: 10, itemType: 'string' },
      backgroundImage: { type: 'url', required: false, description: 'Background image for the contact section' },
      image: { type: 'url', required: false, description: 'Side image for the contact section' }
    }
  },

  footer: {
    type: 'footer',
    displayName: 'Footer',
    description: 'Site footer with links, copyright, and optional logo',
    defaultContent: {
      companyName: 'My Company',
      copyright: '2024 My Company. All rights reserved.',
      logo: null,
      backgroundImage: null,
      links: [
        { label: 'Privacy', url: '/privacy' },
        { label: 'Terms', url: '/terms' }
      ],
      socialLinks: []
    },
    schema: {
      companyName: { type: 'string', maxLength: 100, required: true },
      copyright: { type: 'string', maxLength: 200, required: false },
      logo: { type: 'url', required: false, description: 'Company logo image URL' },
      backgroundImage: { type: 'url', required: false, description: 'Background image for the footer' },
      links: {
        type: 'array',
        maxItems: 6,
        itemSchema: {
          label: { type: 'string', maxLength: 50, required: true },
          url: { type: 'string', maxLength: 200, required: true }
        }
      },
      socialLinks: {
        type: 'array',
        maxItems: 5,
        itemSchema: {
          platform: { type: 'enum', values: ['twitter', 'facebook', 'instagram', 'linkedin', 'github'], required: true },
          url: { type: 'string', maxLength: 200, required: true }
        }
      }
    }
  },

  // New section types for multi-page support

  team: {
    type: 'team',
    displayName: 'Team Members',
    description: 'Display team members with photos and bios',
    defaultContent: {
      title: 'Meet Our Team',
      subtitle: 'The people behind our success',
      members: [
        {
          name: 'John Smith',
          role: 'CEO & Founder',
          bio: 'John brings 20 years of industry experience to lead our team.',
          photo: 'https://placehold.co/200x200/3B82F6/white?text=JS',
          email: null,
          linkedin: null
        },
        {
          name: 'Jane Doe',
          role: 'Head of Operations',
          bio: 'Jane ensures everything runs smoothly across all departments.',
          photo: 'https://placehold.co/200x200/10B981/white?text=JD',
          email: null,
          linkedin: null
        }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      subtitle: { type: 'string', maxLength: 200, required: false },
      members: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        itemSchema: {
          name: { type: 'string', maxLength: 100, required: true },
          role: { type: 'string', maxLength: 100, required: true },
          bio: { type: 'string', maxLength: 500, required: false },
          photo: { type: 'url', required: false },
          email: { type: 'email', required: false },
          linkedin: { type: 'url', required: false }
        }
      }
    }
  },

  services: {
    type: 'services',
    displayName: 'Services',
    description: 'Display services with descriptions, pricing, and optional images',
    defaultContent: {
      title: 'Our Services',
      subtitle: 'Professional solutions tailored to your needs',
      backgroundImage: null,
      items: [
        {
          icon: 'wrench',
          title: 'Consultation',
          description: 'Expert advice to help you make informed decisions.',
          price: null,
          ctaText: 'Learn More',
          ctaLink: '#contact',
          image: null
        },
        {
          icon: 'gear',
          title: 'Implementation',
          description: 'Full service implementation from start to finish.',
          price: null,
          ctaText: 'Get Quote',
          ctaLink: '#contact',
          image: null
        },
        {
          icon: 'headset',
          title: 'Support',
          description: 'Ongoing support to keep your business running smoothly.',
          price: null,
          ctaText: 'Contact Us',
          ctaLink: '#contact',
          image: null
        }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      subtitle: { type: 'string', maxLength: 200, required: false },
      backgroundImage: { type: 'url', required: false, description: 'Background image for the services section' },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 9,
        itemSchema: {
          icon: { type: 'enum', values: AVAILABLE_ICONS, required: false, description: 'Icon to display (use icon OR image, not both)' },
          image: { type: 'url', required: false, description: 'Image URL to display instead of icon' },
          title: { type: 'string', maxLength: 100, required: true },
          description: { type: 'string', maxLength: 500, required: true },
          price: { type: 'string', maxLength: 50, required: false },
          ctaText: { type: 'string', maxLength: 30, required: false },
          ctaLink: { type: 'string', maxLength: 200, required: false }
        }
      }
    }
  },

  story: {
    type: 'story',
    displayName: 'Our Story',
    description: 'Tell your company story with image and text',
    defaultContent: {
      title: 'Our Story',
      content: '<p>We started with a simple mission: to make a difference in our industry.</p><p>Over the years, we\'ve grown from a small team to a trusted partner for hundreds of businesses. Our commitment to quality and customer satisfaction remains at the core of everything we do.</p>',
      image: 'https://placehold.co/600x400/f3f4f6/6b7280?text=Our+Story',
      imagePosition: 'right',
      highlights: [
        { label: 'Years in Business', value: '10+' },
        { label: 'Happy Clients', value: '500+' },
        { label: 'Projects Completed', value: '1000+' }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      content: { type: 'text', maxLength: 5000, required: true },
      image: { type: 'url', required: false },
      imagePosition: { type: 'enum', values: ['left', 'right'], required: false },
      highlights: {
        type: 'array',
        maxItems: 4,
        itemSchema: {
          label: { type: 'string', maxLength: 50, required: true },
          value: { type: 'string', maxLength: 20, required: true }
        }
      }
    }
  },

  gallery: {
    type: 'gallery',
    displayName: 'Image Gallery',
    description: 'Display a gallery of images',
    defaultContent: {
      title: 'Gallery',
      subtitle: 'See our work in action',
      columns: 3,
      images: [
        { url: 'https://placehold.co/400x400/3B82F6/white?text=Project+1', caption: 'Project 1', alt: 'Project image' },
        { url: 'https://placehold.co/400x400/10B981/white?text=Project+2', caption: 'Project 2', alt: 'Project image' },
        { url: 'https://placehold.co/400x400/8B5CF6/white?text=Project+3', caption: 'Project 3', alt: 'Project image' }
      ]
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: false },
      subtitle: { type: 'string', maxLength: 200, required: false },
      columns: { type: 'enum', values: [2, 3, 4], required: false },
      images: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        itemSchema: {
          url: { type: 'url', required: false },
          caption: { type: 'string', maxLength: 100, required: false },
          alt: { type: 'string', maxLength: 100, required: false }
        }
      }
    }
  },

  contactForm: {
    type: 'contactForm',
    displayName: 'Contact Form',
    description: 'Lead capture form with configurable fields',
    defaultContent: {
      title: 'Get in Touch',
      subtitle: 'Fill out the form below and we\'ll get back to you within 24 hours.',
      successMessage: 'Thank you! We\'ll be in touch soon.',
      submitButtonText: 'Send Message',
      fields: [
        { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your name' },
        { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'you@example.com' },
        { name: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: '(555) 123-4567' },
        { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?' }
      ],
      contactInfo: {
        email: 'hello@example.com',
        phone: null,
        address: null,
        hours: null
      }
    },
    schema: {
      title: { type: 'string', maxLength: 100, required: true },
      subtitle: { type: 'string', maxLength: 300, required: false },
      successMessage: { type: 'string', maxLength: 200, required: false },
      submitButtonText: { type: 'string', maxLength: 30, required: false },
      fields: {
        type: 'array',
        minItems: 1,
        maxItems: 10,
        itemSchema: {
          name: { type: 'string', maxLength: 50, required: true },
          label: { type: 'string', maxLength: 100, required: true },
          type: { type: 'enum', values: ['text', 'email', 'tel', 'textarea', 'select'], required: true },
          required: { type: 'boolean', required: false },
          placeholder: { type: 'string', maxLength: 100, required: false },
          options: { type: 'array', maxItems: 20, itemType: 'string' }
        }
      },
      contactInfo: {
        type: 'object',
        schema: {
          email: { type: 'email', required: false },
          phone: { type: 'string', maxLength: 30, required: false },
          address: { type: 'string', maxLength: 200, required: false },
          hours: { type: 'string', maxLength: 200, required: false }
        }
      }
    }
  }
};

// Default site configuration template
const DEFAULT_SITE_CONFIG = {
  siteName: '',
  theme: {
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Inter'
  },
  sections: [
    {
      id: 'hero-1',
      type: 'hero',
      order: 0,
      visible: true,
      content: SECTION_SCHEMAS.hero.defaultContent
    },
    {
      id: 'features-1',
      type: 'features',
      order: 1,
      visible: true,
      content: SECTION_SCHEMAS.features.defaultContent
    },
    {
      id: 'about-1',
      type: 'about',
      order: 2,
      visible: true,
      content: SECTION_SCHEMAS.about.defaultContent
    },
    {
      id: 'contact-1',
      type: 'contact',
      order: 3,
      visible: true,
      content: SECTION_SCHEMAS.contact.defaultContent
    },
    {
      id: 'footer-1',
      type: 'footer',
      order: 4,
      visible: true,
      content: SECTION_SCHEMAS.footer.defaultContent
    }
  ]
};

// Available theme presets
const THEME_PRESETS = {
  blue: {
    name: 'Ocean Blue',
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937'
  },
  purple: {
    name: 'Royal Purple',
    primaryColor: '#8B5CF6',
    secondaryColor: '#EC4899',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937'
  },
  green: {
    name: 'Forest Green',
    primaryColor: '#10B981',
    secondaryColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937'
  },
  dark: {
    name: 'Dark Mode',
    primaryColor: '#60A5FA',
    secondaryColor: '#34D399',
    backgroundColor: '#111827',
    textColor: '#F9FAFB'
  },
  sunset: {
    name: 'Sunset',
    primaryColor: '#F59E0B',
    secondaryColor: '#EF4444',
    backgroundColor: '#FFFBEB',
    textColor: '#1F2937'
  }
};

module.exports = {
  SECTION_SCHEMAS,
  DEFAULT_SITE_CONFIG,
  THEME_PRESETS,
  AVAILABLE_ICONS
};
