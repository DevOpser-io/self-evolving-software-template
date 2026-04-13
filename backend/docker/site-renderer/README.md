# DevOpser Site Renderer

A stateless container that renders websites from JSON configuration. This container is designed to be deployed to AWS Lightsail Container Services in customer accounts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER WEBSITE FLOW                         │
│                                                                  │
│  ┌──────────┐      ┌──────────────┐      ┌─────────────────┐   │
│  │ End User │──────│   Lightsail  │──────│  Site Renderer  │   │
│  │ Browser  │      │   Endpoint   │      │   Container     │   │
│  └──────────┘      └──────────────┘      └────────┬────────┘   │
│                                                    │            │
│                                           SITE_CONFIG env var   │
│                                           (JSON from builder)   │
│                                                    │            │
│  ┌─────────────────────────────────────────────────┴──────────┐ │
│  │                                                             │ │
│  │  Form Submission ──────────────────────────► Platform API   │ │
│  │  (Lead Capture)           POST /api/leads   (lite.devopser) │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Stateless Design**: All configuration comes from the `SITE_CONFIG` environment variable
- **Section Types**: Hero, Features, About, Testimonials, Pricing, Contact, ContactForm, Team, Gallery, Services, Footer
- **Lead Capture**: Contact forms submit data to the platform API for lead tracking
- **Image Support**: All sections support images (background, feature, team photos, etc.)
- **Responsive Design**: Mobile-first responsive CSS
- **Security Hardened**: Runs as non-root user, minimal attack surface

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_CONFIG` | Yes | JSON configuration for the site |
| `SITE_ID` | Yes | UUID of the site (for lead tracking) |
| `PLATFORM_API_URL` | No | Platform API URL (default: https://lite.example.com/api) |
| `PORT` | No | Server port (default: 80) |

## Site Configuration Schema

```json
{
  "siteName": "My Business",
  "description": "Business description for SEO",
  "theme": {
    "primaryColor": "#3B82F6",
    "secondaryColor": "#10B981",
    "textColor": "#1F2937",
    "backgroundColor": "#FFFFFF",
    "fontFamily": "Inter, system-ui, sans-serif"
  },
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "order": 1,
      "visible": true,
      "content": {
        "headline": "Welcome to Our Business",
        "subheadline": "We help you succeed",
        "ctaText": "Get Started",
        "ctaLink": "#contact",
        "backgroundImage": "https://example.com/hero.jpg"
      }
    },
    {
      "id": "features",
      "type": "features",
      "order": 2,
      "content": {
        "title": "Our Features",
        "subtitle": "What we offer",
        "items": [
          {
            "title": "Feature 1",
            "description": "Description here",
            "icon": "rocket",
            "image": "https://example.com/feature1.jpg"
          }
        ]
      }
    },
    {
      "id": "contact",
      "type": "contactForm",
      "order": 10,
      "content": {
        "title": "Contact Us",
        "subtitle": "We'd love to hear from you",
        "fields": [
          { "name": "name", "label": "Your Name", "type": "text", "required": true },
          { "name": "email", "label": "Email Address", "type": "email", "required": true },
          { "name": "phone", "label": "Phone Number", "type": "tel", "required": false },
          { "name": "message", "label": "Message", "type": "textarea", "required": true }
        ],
        "submitButtonText": "Send Message",
        "successMessage": "Thank you! We'll be in touch soon.",
        "errorMessage": "Something went wrong. Please try again."
      }
    }
  ]
}
```

## Building the Image

```bash
cd backend/docker/site-renderer
docker build -t devopser-site-renderer:latest .
```

## Running Locally

```bash
docker run -p 8080:80 \
  -e SITE_CONFIG='{"siteName":"Test","sections":[]}' \
  -e SITE_ID='test-site-id' \
  devopser-site-renderer:latest
```

## Security Considerations (NIST CSF Alignment)

### PR.AC - Access Control
- Container runs as non-root user (UID 1001)
- No shell access required
- Minimal base image (node:18-alpine)

### PR.DS - Data Security
- HTTPS termination at Lightsail load balancer
- Helmet.js security headers
- CSP configured for allowed sources

### PR.IP - Information Protection
- Stateless design - no persistent data in container
- Configuration injected via environment variables
- No secrets stored in container

### PR.PT - Protective Technology
- Health check endpoint for orchestration
- Resource limits enforced by Lightsail tier
- Compression enabled for performance

## Lead Capture

Contact forms automatically submit to the platform API:

```javascript
POST https://lite.example.com/api/leads
{
  "siteId": "uuid-of-site",
  "formData": {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Hello!"
  },
  "source": "contactForm",
  "timestamp": "2025-01-12T12:00:00Z"
}
```

Site owners can view their leads in the DevOpser dashboard.

## Supported Section Types

| Type | Description |
|------|-------------|
| `hero` | Hero banner with headline, CTA, background image |
| `features` | Feature grid with icons/images |
| `about` | About section with image |
| `testimonials` | Customer testimonials |
| `pricing` | Pricing plans |
| `contact` | Contact information display |
| `contactForm` | Lead capture form |
| `team` | Team members with photos |
| `gallery` | Image gallery |
| `services` | Services listing |
| `footer` | Site footer with links |

## Icon Support

Uses Font Awesome 6 icons. Supported icon names:
- rocket, star, heart, check, shield
- lightning-charge, globe, people, clock
- bar-chart, lock, cloud, code-slash
- phone, gear, headset, book, gift
- cpu, database, envelope, eye
- wrench, trophy, map

## License

Copyright DevOpser. All rights reserved.
