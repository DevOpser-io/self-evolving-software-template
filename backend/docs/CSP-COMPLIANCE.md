# Content Security Policy (CSP) Compliance

## Overview

DevOpser Lite implements a **strict Content Security Policy** to protect against XSS attacks, code injection, and other client-side vulnerabilities. This document outlines the CSP rules, implementation details, and development guidelines.

## CSP Configuration

The CSP is configured in `server.js` using Helmet.js:

```javascript
contentSecurityPolicy: {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https://placehold.co'],
    connectSrc: ["'self'", 'https://*.amazonaws.com'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'self'"],
    'script-src-attr': ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
  }
}
```

## Directive Explanations

| Directive | Value | Description |
|-----------|-------|-------------|
| `default-src` | `'self'` | Default fallback for all resource types |
| `script-src` | `'self'` | Scripts only from same origin (external files) |
| `style-src` | `'self'` | Styles only from same origin (external CSS files) |
| `img-src` | `'self' data: https://placehold.co` | Images from self, data URIs, and placeholder service |
| `connect-src` | `'self' https://*.amazonaws.com` | AJAX/fetch to self and AWS services |
| `font-src` | `'self'` | Fonts only from same origin |
| `object-src` | `'none'` | Block all plugins (Flash, Java, etc.) |
| `media-src` | `'self'` | Media files only from same origin |
| `frame-src` | `'self'` | Iframes only from same origin |
| `script-src-attr` | `'none'` | Block inline event handlers (`onclick`, etc.) |
| `form-action` | `'self'` | Form submissions only to same origin |
| `base-uri` | `'self'` | Base URL restricted to same origin |
| `frame-ancestors` | `'none'` | Prevent framing (clickjacking protection) |

## What is Blocked

### Inline Styles (BLOCKED)
```html
<!-- BLOCKED: Inline style attribute -->
<div style="color: red;">Text</div>

<!-- BLOCKED: <style> tag without proper nonce -->
<style>
  .class { color: red; }
</style>
```

### Inline Scripts (BLOCKED)
```html
<!-- BLOCKED: Inline script -->
<script>
  alert('Hello');
</script>

<!-- BLOCKED: Event handlers -->
<button onclick="doSomething()">Click</button>
```

### External Resources (BLOCKED unless whitelisted)
```html
<!-- BLOCKED: External CDN scripts -->
<script src="https://cdn.example.com/lib.js"></script>

<!-- BLOCKED: Google Fonts -->
<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
```

## What is Allowed

### External CSS Files
```html
<!-- ALLOWED: Self-hosted CSS -->
<link rel="stylesheet" href="/static/css/builder.css">
```

### External JavaScript Files
```html
<!-- ALLOWED: Self-hosted JS -->
<script src="/static/js/builder.js"></script>
```

### CSS Custom Properties via JavaScript
```javascript
// ALLOWED: Setting CSS custom properties
element.style.setProperty('--primary-color', '#3B82F6');

// ALLOWED: Adding/removing CSS classes
element.classList.add('has-custom-bg');
```

### Data Attributes for Dynamic Values
```html
<!-- ALLOWED: Data attributes + CSS classes -->
<div class="section-hero has-custom-bg"
     data-bg-start="#3B82F6"
     data-bg-end="#10B981">
</div>
```

### Server Data via JSON Blocks
```html
<!-- ALLOWED: JSON data blocks (not executed as scripts) -->
<script type="application/json" id="server-data">
{
  "siteId": "123",
  "siteData": {"name": "My Site"}
}
</script>
```

## File Structure

### CSP-Compliant Templates

| Template | External CSS | External JS |
|----------|--------------|-------------|
| `builder.ejs` | `/static/css/builder.css` | `/static/js/builder.js` |
| `landing-builder.ejs` | `/static/css/landing-builder.css` | `/static/js/landing-builder.js` |

### Static Assets Location
```
public/
├── static/
│   ├── css/
│   │   ├── builder.css          # Builder page styles
│   │   ├── landing-builder.css  # Landing page styles
│   │   ├── litera-bootstrap.min.css
│   │   └── nav.css
│   ├── js/
│   │   ├── builder.js           # Builder page logic
│   │   ├── landing-builder.js   # Landing page logic
│   │   └── bootstrap.bundle.min.js
│   └── fontawesome/
│       └── all.min.css
```

## Passing Server Data to JavaScript

Since inline scripts are blocked, server-rendered data must be passed via JSON blocks:

### In EJS Template:
```html
<script type="application/json" id="server-data">
{
  "siteId": "<%= site ? site.id : '' %>",
  "siteData": <%- site ? JSON.stringify(site) : 'null' %>
}
</script>
<script src="/static/js/builder.js"></script>
```

### In External JavaScript:
```javascript
// Read server data from JSON block
var serverDataEl = document.getElementById('server-data');
var serverData = serverDataEl ? JSON.parse(serverDataEl.textContent) : {};

var siteId = serverData.siteId || '';
var siteData = serverData.siteData || null;
```

## Dynamic Styling Without Inline Styles

### Using CSS Custom Properties
```css
/* In external CSS file */
.section-hero.has-custom-bg {
  background: linear-gradient(135deg,
    var(--hero-bg-start, #3B82F6),
    var(--hero-bg-end, #10B981));
}
```

```javascript
// In external JS file
heroEl.style.setProperty('--hero-bg-start', bgStart);
heroEl.style.setProperty('--hero-bg-end', bgEnd);
heroEl.classList.add('has-custom-bg');
```

### Using Data Attributes + CSS
```html
<!-- Data attributes store values -->
<div data-bg-start="#3B82F6" data-bg-end="#10B981"></div>
```

```javascript
// JavaScript reads data attributes
var bgStart = element.getAttribute('data-bg-start');
var bgEnd = element.getAttribute('data-bg-end');
```

## AI Agent Guidelines

The AI agent (in `websiteAgentTools.js`) is instructed to:

1. **Never suggest inline styles** - All styling through CSS classes
2. **Never suggest inline scripts** - All behavior through external JS
3. **Use hex colors only** - Not CSS color names
4. **Use data attributes** - For dynamic values that need CSS styling
5. **Respect section schemas** - Only use defined properties

### AI System Prompt CSP Section:
```
### CSP RULES (CRITICAL - ENFORCED BY BROWSER):
1. NO inline styles (style="...") - will be BLOCKED
2. NO inline scripts - will be BLOCKED
3. NO external fonts or CDNs - will be BLOCKED
4. NO event handlers in HTML (onclick="...") - will be BLOCKED
5. ALL styling is through CSS classes in external stylesheets
6. ALL JavaScript in external files only
7. Colors are applied via CSS custom properties (--primary-color, etc.)
8. Background colors use data-* attributes + CSS classes, NOT inline styles
```

## Adding New External Resources

To add a new external resource (CDN, API, etc.):

1. **Update server.js CSP directives**:
```javascript
// Example: Adding a new image CDN
imgSrc: ["'self'", 'data:', 'https://placehold.co', 'https://newcdn.example.com'],
```

2. **Document the change** in this file

3. **Test thoroughly** - Browser dev tools will show CSP violations

## Testing CSP Compliance

### Browser Developer Tools
1. Open Chrome/Firefox DevTools (F12)
2. Go to Console tab
3. Look for CSP violation errors like:
   ```
   Refused to apply inline style because it violates the following
   Content Security Policy directive: "style-src 'self'"
   ```

### CSP Report-Only Mode (for testing)
```javascript
// In server.js - use report-only to test without blocking
contentSecurityPolicy: {
  reportOnly: true,  // Add this for testing
  // ... directives
}
```

## Common CSP Violations & Fixes

### Violation: Inline Style
```
❌ Refused to apply inline style...
```
**Fix:** Move style to external CSS file, use CSS classes

### Violation: Inline Script
```
❌ Refused to execute inline script...
```
**Fix:** Move script to external JS file, use JSON data blocks for server data

### Violation: Eval
```
❌ Refused to evaluate a string as JavaScript...
```
**Fix:** Avoid `eval()`, `new Function()`, `setTimeout('string')`

### Violation: External Resource
```
❌ Refused to load the script 'https://...'...
```
**Fix:** Self-host the resource or add domain to CSP whitelist

## Security Benefits

1. **XSS Prevention** - Inline scripts cannot execute, even if injected
2. **Data Exfiltration Protection** - Connections limited to whitelisted domains
3. **Clickjacking Protection** - Frame ancestors set to 'none'
4. **Code Injection Mitigation** - eval() and related functions blocked

## References

- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Content Security Policy Level 3 Spec](https://www.w3.org/TR/CSP3/)
- [Helmet.js CSP Documentation](https://helmetjs.github.io/docs/csp/)
