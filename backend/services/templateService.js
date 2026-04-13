/**
 * FILE: backend/services/templateService.js
 * PURPOSE: Template validation and manipulation for DevOpser Lite
 * DESCRIPTION: Provides utilities for validating site configurations,
 *              creating sections, and managing template structure.
 */

const { SECTION_SCHEMAS, DEFAULT_SITE_CONFIG, THEME_PRESETS, AVAILABLE_ICONS } = require('../config/sectionSchemas');
const { v4: uuidv4 } = require('uuid');

/**
 * Validate a complete site configuration
 * @param {Object} config - Site configuration to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateSiteConfig(config) {
  const errors = [];

  if (!config) {
    return { valid: false, errors: ['Config is required'] };
  }

  // Validate siteName
  if (!config.siteName || typeof config.siteName !== 'string') {
    errors.push('siteName is required and must be a string');
  } else if (config.siteName.length > 100) {
    errors.push('siteName must be 100 characters or less');
  }

  // Validate theme
  if (config.theme) {
    const themeErrors = validateTheme(config.theme);
    errors.push(...themeErrors);
  }

  // Validate sections
  if (!Array.isArray(config.sections)) {
    errors.push('sections must be an array');
  } else {
    config.sections.forEach((section, index) => {
      const sectionErrors = validateSection(section);
      if (sectionErrors.length > 0) {
        errors.push(`Section ${index} (${section.id || 'unknown'}): ${sectionErrors.join(', ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate theme configuration
 * @param {Object} theme - Theme object
 * @returns {string[]} - Array of error messages
 */
function validateTheme(theme) {
  const errors = [];

  if (theme.primaryColor && !isValidColor(theme.primaryColor)) {
    errors.push('Invalid primaryColor format');
  }
  if (theme.secondaryColor && !isValidColor(theme.secondaryColor)) {
    errors.push('Invalid secondaryColor format');
  }
  if (theme.backgroundColor && !isValidColor(theme.backgroundColor)) {
    errors.push('Invalid backgroundColor format');
  }
  if (theme.textColor && !isValidColor(theme.textColor)) {
    errors.push('Invalid textColor format');
  }

  return errors;
}

/**
 * Validate a single section
 * @param {Object} section - Section to validate
 * @returns {string[]} - Array of error messages
 */
function validateSection(section) {
  const errors = [];

  if (!section.id || typeof section.id !== 'string') {
    errors.push('Section id is required');
  }

  if (!section.type || !SECTION_SCHEMAS[section.type]) {
    errors.push(`Invalid section type: ${section.type}`);
    return errors;
  }

  // Be lenient with order - default to 0 if not a number
  if (section.order !== undefined && typeof section.order !== 'number') {
    errors.push('Section order must be a number');
  }

  // Be lenient with visible - default to true if not set
  if (section.visible !== undefined && typeof section.visible !== 'boolean') {
    errors.push('Section visible must be a boolean');
  }

  // Validate content against schema
  const schema = SECTION_SCHEMAS[section.type];
  if (section.content) {
    const contentErrors = validateContent(section.content, schema.schema);
    errors.push(...contentErrors);
  }

  return errors;
}

/**
 * Validate content against a schema
 * @param {Object} content - Content object
 * @param {Object} schema - Schema definition
 * @returns {string[]} - Array of error messages
 */
function validateContent(content, schema) {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = content[key];

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type-specific validation
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${key} must be a string`);
        } else if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${key} must be ${rules.maxLength} characters or less`);
        }
        break;

      case 'text':
        if (typeof value !== 'string') {
          errors.push(`${key} must be a string`);
        } else if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${key} must be ${rules.maxLength} characters or less`);
        }
        break;

      case 'email':
        if (!isValidEmail(value)) {
          errors.push(`${key} must be a valid email`);
        }
        break;

      case 'url':
        if (value && !isValidUrl(value)) {
          errors.push(`${key} must be a valid URL`);
        }
        break;

      case 'enum':
        if (!rules.values.includes(value)) {
          // Soft validation - log warning but don't fail for invalid enums
          // This allows legacy data or agent-generated data to save
          console.warn(`[Validation] Warning: ${key} value "${value}" not in allowed list`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          // Soft validation - allow non-arrays to pass (treat as empty)
          console.warn(`[Validation] Warning: ${key} should be an array but is ${typeof value}`);
        } else {
          if (rules.minItems && value.length < rules.minItems) {
            // Soft validation for minItems - don't fail
            console.warn(`[Validation] Warning: ${key} has ${value.length} items, expected at least ${rules.minItems}`);
          }
          if (rules.maxItems && value.length > rules.maxItems) {
            errors.push(`${key} must have at most ${rules.maxItems} items`);
          }
          // Validate array items if itemSchema is defined
          // Use soft validation for nested items (warn but don't fail)
          if (rules.itemSchema) {
            value.forEach((item, idx) => {
              if (item && typeof item === 'object') {
                const itemErrors = validateContent(item, rules.itemSchema);
                itemErrors.forEach(err => {
                  // Only log as warning, don't add to errors
                  console.warn(`[Validation] Warning: ${key}[${idx}]: ${err}`);
                });
              }
            });
          }
        }
        break;
    }
  }

  return errors;
}

/**
 * Create a new section with default content
 * @param {string} type - Section type
 * @param {Object} content - Optional content overrides
 * @returns {Object} - New section object
 */
function createSection(type, content = {}) {
  const schema = SECTION_SCHEMAS[type];
  if (!schema) {
    throw new Error(`Unknown section type: ${type}`);
  }

  return {
    id: `${type}-${uuidv4().slice(0, 8)}`,
    type,
    order: 0,
    visible: true,
    content: {
      ...schema.defaultContent,
      ...content
    }
  };
}

/**
 * Create a new site configuration from a template
 * @param {string} siteName - Name of the site
 * @param {string} themePreset - Optional theme preset name
 * @returns {Object} - New site configuration
 */
function createSiteConfig(siteName, themePreset = null) {
  const config = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG));
  config.siteName = siteName;

  if (themePreset && THEME_PRESETS[themePreset]) {
    config.theme = { ...config.theme, ...THEME_PRESETS[themePreset] };
  }

  // Update section IDs to be unique
  config.sections = config.sections.map((section, index) => ({
    ...section,
    id: `${section.type}-${uuidv4().slice(0, 8)}`,
    order: index
  }));

  return config;
}

/**
 * Apply partial updates to a site configuration
 * @param {Object} currentConfig - Current site configuration
 * @param {Object} updates - Partial updates to apply
 * @returns {Object} - Updated configuration
 */
function applySiteConfigUpdates(currentConfig, updates) {
  const newConfig = JSON.parse(JSON.stringify(currentConfig));

  // Update siteName
  if (updates.siteName !== undefined) {
    newConfig.siteName = updates.siteName;
  }

  // Merge theme updates
  if (updates.theme) {
    newConfig.theme = { ...newConfig.theme, ...updates.theme };
  }

  // Handle section updates
  if (updates.sections) {
    if (Array.isArray(updates.sections)) {
      // Replace entire sections array
      newConfig.sections = updates.sections;
    } else if (typeof updates.sections === 'object') {
      // Partial section updates by ID
      for (const [sectionId, sectionUpdates] of Object.entries(updates.sections)) {
        const sectionIndex = newConfig.sections.findIndex(s => s.id === sectionId);
        if (sectionIndex !== -1) {
          // Deep merge content
          if (sectionUpdates.content) {
            newConfig.sections[sectionIndex].content = {
              ...newConfig.sections[sectionIndex].content,
              ...sectionUpdates.content
            };
          }
          // Update other section properties
          if (sectionUpdates.visible !== undefined) {
            newConfig.sections[sectionIndex].visible = sectionUpdates.visible;
          }
          if (sectionUpdates.order !== undefined) {
            newConfig.sections[sectionIndex].order = sectionUpdates.order;
          }
        }
      }
    }
  }

  // Re-sort sections by order
  newConfig.sections.sort((a, b) => a.order - b.order);

  return newConfig;
}

/**
 * Add a new section to the configuration
 * @param {Object} config - Current site configuration
 * @param {string} type - Section type to add
 * @param {number} position - Position to insert (default: end)
 * @param {Object} content - Optional content overrides
 * @returns {Object} - Updated configuration
 */
function addSection(config, type, position = null, content = {}) {
  const newConfig = JSON.parse(JSON.stringify(config));
  const newSection = createSection(type, content);

  if (position === null || position >= newConfig.sections.length) {
    // Add to end
    newSection.order = newConfig.sections.length;
    newConfig.sections.push(newSection);
  } else {
    // Insert at position
    newSection.order = position;
    newConfig.sections.splice(position, 0, newSection);
    // Update order of subsequent sections
    for (let i = position + 1; i < newConfig.sections.length; i++) {
      newConfig.sections[i].order = i;
    }
  }

  return newConfig;
}

/**
 * Remove a section from the configuration
 * @param {Object} config - Current site configuration
 * @param {string} sectionId - ID of section to remove
 * @returns {Object} - Updated configuration
 */
function removeSection(config, sectionId) {
  const newConfig = JSON.parse(JSON.stringify(config));
  const sectionIndex = newConfig.sections.findIndex(s => s.id === sectionId);

  if (sectionIndex === -1) {
    throw new Error(`Section not found: ${sectionId}`);
  }

  newConfig.sections.splice(sectionIndex, 1);

  // Update order of remaining sections
  newConfig.sections.forEach((section, index) => {
    section.order = index;
  });

  return newConfig;
}

/**
 * Reorder sections in the configuration
 * @param {Object} config - Current site configuration
 * @param {string[]} newOrder - Array of section IDs in new order
 * @returns {Object} - Updated configuration
 */
function reorderSections(config, newOrder) {
  const newConfig = JSON.parse(JSON.stringify(config));

  // Create a map for quick lookup
  const sectionMap = new Map(newConfig.sections.map(s => [s.id, s]));

  // Validate all IDs exist
  for (const id of newOrder) {
    if (!sectionMap.has(id)) {
      throw new Error(`Section not found: ${id}`);
    }
  }

  // Reorder sections
  newConfig.sections = newOrder.map((id, index) => {
    const section = sectionMap.get(id);
    section.order = index;
    return section;
  });

  return newConfig;
}

// Helper functions
function isValidColor(color) {
  // Validate hex color or named color
  return /^#([0-9A-F]{3}){1,2}$/i.test(color) || /^[a-z]+$/i.test(color);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return url.startsWith('/') || url.startsWith('#');
  }
}

module.exports = {
  validateSiteConfig,
  validateSection,
  validateTheme,
  createSection,
  createSiteConfig,
  applySiteConfigUpdates,
  addSection,
  removeSection,
  reorderSections,
  SECTION_SCHEMAS,
  DEFAULT_SITE_CONFIG,
  THEME_PRESETS,
  AVAILABLE_ICONS
};
