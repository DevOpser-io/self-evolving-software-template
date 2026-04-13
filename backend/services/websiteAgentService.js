/**
 * FILE: backend/services/websiteAgentService.js
 * PURPOSE: AI agent for converting chat messages into website configurations
 * DESCRIPTION: Uses Claude via Bedrock to interpret user intent and generate/update
 *              structured JSON site configurations within the allowed template system.
 */

const { generateResponse } = require('./llm');
const {
  SECTION_SCHEMAS,
  THEME_PRESETS,
  AVAILABLE_ICONS,
  createSiteConfig,
  applySiteConfigUpdates,
  validateSiteConfig,
  addSection,
  removeSection,
  reorderSections
} = require('./templateService');

// System prompt for the website builder AI agent
const WEBSITE_AGENT_SYSTEM_PROMPT = `You are a website builder AI assistant for DevOpser Lite.
Your job is to help users create and modify website configurations through natural language.

IMPORTANT CONSTRAINTS:
- You can ONLY modify: content, layout order, colors/theme, section visibility, images
- You CANNOT: add custom code, modify deployment settings, access external systems
- All responses must be valid JSON that follows the schema

AVAILABLE SECTION TYPES:
${Object.entries(SECTION_SCHEMAS).map(([type, schema]) => `- ${type}: ${schema.description}`).join('\n')}

AVAILABLE THEME PRESETS:
${Object.entries(THEME_PRESETS).map(([key, preset]) => `- ${key}: ${preset.name}`).join('\n')}

AVAILABLE ICONS (for features):
${AVAILABLE_ICONS.join(', ')}

IMAGE HANDLING:
You have FULL FLEXIBILITY to add images to ANY section. Here's where images can be added:

SECTION-LEVEL IMAGES (background or decorative):
- hero: "backgroundImage" - full background image behind the hero content
- pricing: "backgroundImage" - background for pricing section
- services: "backgroundImage" - background for services section
- contact: "backgroundImage" - background for contact section, "image" - side image
- footer: "backgroundImage" - footer background, "logo" - company logo
- about: "image" - side image, "imagePosition" - "left" or "right"
- story: "image" - side image, "imagePosition" - "left" or "right"

ITEM-LEVEL IMAGES (per feature, service, product, etc.):
- features: "items[].image" - image for each feature (can replace or complement icon)
- services: "items[].image" - image for each service (can replace or complement icon)
- pricing: "items[].image" - product/plan image for each tier
- team: "members[].photo" - team member profile photos
- testimonials: "items[].avatar" - testimonial author avatars
- gallery: "images[]" - array with {url, caption, alt} for each gallery image

PLACEHOLDER IMAGE FORMAT:
Use: https://placehold.co/{width}x{height}/{bgColor}/{textColor}?text={encoded_text}
Common sizes:
- Hero backgrounds: 1920x800
- Section backgrounds: 1920x600
- Side images: 600x400
- Feature/service images: 400x300
- Avatars/photos: 200x200 or 100x100
- Gallery images: 400x400

WHEN USERS ASK TO ADD IMAGES:
1. If they provide a URL, use it directly
2. If they describe what image they want, create a descriptive placeholder URL
3. If they just say "add an image" without specifics, create a relevant placeholder based on the section/context
4. For icons vs images: you can use EITHER an icon OR an image for features/services - image takes precedence when both are set

EXAMPLES:
- "Add a hero background image" → Set hero.backgroundImage to a placeholder
- "Put images on the features" → Set each features.items[].image to relevant placeholders
- "Add a photo to the first team member" → Set team.members[0].photo
- "Make the pricing section have a product image for each plan" → Set pricing.items[].image for each item
- "Add a company logo to the footer" → Set footer.logo

Users can also upload their own images through the builder's image picker.
AI-generated images will be available soon - for now, use descriptive placeholders.

When a user describes what they want, respond with a JSON object in this EXACT format:
{
  "action": "create" | "update" | "add_section" | "remove_section" | "reorder",
  "message": "A friendly message explaining what you did",
  "changes": {
    // For "create": full site config
    // For "update": partial updates to apply
    // For "add_section": { "type": "section_type", "position": number, "content": {...} }
    // For "remove_section": { "sectionId": "id" }
    // For "reorder": { "newOrder": ["id1", "id2", ...] }
  }
}

EXAMPLES:

User: "I want a landing page for an AI bedtime story app for kids"
Response:
{
  "action": "create",
  "message": "I've created a beautiful landing page for your AI bedtime story app! It includes a hero section, key features, an about section, and a contact form.",
  "changes": {
    "siteName": "Bedtime Stories AI",
    "theme": {
      "primaryColor": "#8B5CF6",
      "secondaryColor": "#EC4899",
      "fontFamily": "Inter"
    },
    "sections": [
      {
        "id": "hero-1",
        "type": "hero",
        "order": 0,
        "visible": true,
        "content": {
          "headline": "Magical Bedtime Stories for Little Dreamers",
          "subheadline": "AI-powered personalized stories that make bedtime the best time of day",
          "ctaText": "Try Free",
          "ctaLink": "#contact"
        }
      },
      {
        "id": "features-1",
        "type": "features",
        "order": 1,
        "visible": true,
        "content": {
          "title": "Why Parents Love Us",
          "items": [
            { "icon": "star", "title": "Personalized", "description": "Stories featuring your child's name and interests" },
            { "icon": "clock", "title": "Perfect Length", "description": "5-15 minute stories, perfect for bedtime" },
            { "icon": "heart", "title": "Safe Content", "description": "Age-appropriate, gentle stories every time" }
          ]
        }
      }
    ]
  }
}

User: "Make the headline more exciting"
Response:
{
  "action": "update",
  "message": "I've updated the headline to be more exciting and attention-grabbing!",
  "changes": {
    "sections": {
      "hero-1": {
        "content": {
          "headline": "Turn Bedtime into Adventure Time!"
        }
      }
    }
  }
}

User: "Add a pricing section with a free tier and a premium tier"
Response:
{
  "action": "add_section",
  "message": "I've added a pricing section with two tiers - a free option and a premium plan.",
  "changes": {
    "type": "pricing",
    "position": 2,
    "content": {
      "title": "Simple Pricing",
      "items": [
        {
          "name": "Free",
          "price": "$0",
          "period": "/month",
          "features": ["3 stories per month", "Basic personalization"],
          "ctaText": "Start Free",
          "highlighted": false
        },
        {
          "name": "Premium",
          "price": "$9.99",
          "period": "/month",
          "features": ["Unlimited stories", "Full personalization", "Audio narration", "Print-ready PDFs"],
          "ctaText": "Go Premium",
          "highlighted": true
        }
      ]
    }
  }
}

ALWAYS respond with valid JSON. No markdown, no explanations outside the JSON.
If the user's request is unclear, set action to "clarify" and ask a specific question in the message field.`;

/**
 * Process a chat message and generate site configuration changes
 * @param {string} userMessage - The user's message
 * @param {Object} currentConfig - Current site configuration (null for new sites)
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @returns {Promise<Object>} - { action, message, changes, newConfig }
 */
async function processMessage(userMessage, currentConfig = null, conversationHistory = []) {
  try {
    // Build the messages array for the AI
    const messages = [
      { role: 'system', content: WEBSITE_AGENT_SYSTEM_PROMPT }
    ];

    // Add conversation history
    for (const msg of conversationHistory.slice(-10)) { // Keep last 10 messages
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Add context about current configuration
    if (currentConfig) {
      messages.push({
        role: 'user',
        content: `Current site configuration:\n${JSON.stringify(currentConfig, null, 2)}`
      });
      messages.push({
        role: 'assistant',
        content: 'I understand the current configuration. What would you like to change?'
      });
    }

    // Add the user's new message
    messages.push({
      role: 'user',
      content: userMessage
    });

    console.log('[WebsiteAgent] Processing message:', userMessage.substring(0, 100));

    // Get response from Claude
    const response = await generateResponse(messages);
    console.log('[WebsiteAgent] Raw response:', response.substring(0, 500));

    // Parse the JSON response
    let parsedResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[WebsiteAgent] Failed to parse response:', parseError);
      return {
        action: 'error',
        message: 'I had trouble understanding that. Could you try rephrasing your request?',
        changes: null,
        newConfig: currentConfig
      };
    }

    // Validate and apply the changes
    let newConfig = currentConfig;

    switch (parsedResponse.action) {
      case 'create':
        // Create new site configuration
        newConfig = parsedResponse.changes;
        // Ensure required fields have defaults
        if (!newConfig.theme) {
          newConfig.theme = THEME_PRESETS.blue;
        }
        break;

      case 'update':
        // Apply partial updates to existing config
        if (!currentConfig) {
          return {
            action: 'error',
            message: 'No site exists yet. Would you like me to create one? Just describe what kind of website you want.',
            changes: null,
            newConfig: null
          };
        }
        newConfig = applySiteConfigUpdates(currentConfig, parsedResponse.changes);
        break;

      case 'add_section':
        // Add a new section
        if (!currentConfig) {
          return {
            action: 'error',
            message: 'No site exists yet. Let me create one first.',
            changes: null,
            newConfig: null
          };
        }
        const { type, position, content } = parsedResponse.changes;
        newConfig = addSection(currentConfig, type, position, content);
        break;

      case 'remove_section':
        // Remove a section
        if (!currentConfig) {
          return {
            action: 'error',
            message: 'No site exists to modify.',
            changes: null,
            newConfig: null
          };
        }
        newConfig = removeSection(currentConfig, parsedResponse.changes.sectionId);
        break;

      case 'reorder':
        // Reorder sections
        if (!currentConfig) {
          return {
            action: 'error',
            message: 'No site exists to modify.',
            changes: null,
            newConfig: null
          };
        }
        newConfig = reorderSections(currentConfig, parsedResponse.changes.newOrder);
        break;

      case 'clarify':
        // AI needs clarification
        return {
          action: 'clarify',
          message: parsedResponse.message,
          changes: null,
          newConfig: currentConfig
        };

      default:
        console.warn('[WebsiteAgent] Unknown action:', parsedResponse.action);
        return {
          action: 'error',
          message: 'I encountered an unexpected response. Please try again.',
          changes: null,
          newConfig: currentConfig
        };
    }

    // Validate the new configuration
    if (newConfig) {
      const validation = validateSiteConfig(newConfig);
      if (!validation.valid) {
        console.warn('[WebsiteAgent] Config validation errors:', validation.errors);
        // Try to fix common issues
        newConfig = sanitizeConfig(newConfig);
      }
    }

    return {
      action: parsedResponse.action,
      message: parsedResponse.message,
      changes: parsedResponse.changes,
      newConfig
    };
  } catch (error) {
    console.error('[WebsiteAgent] Error processing message:', error);
    return {
      action: 'error',
      message: 'I encountered an error processing your request. Please try again.',
      changes: null,
      newConfig: currentConfig
    };
  }
}

/**
 * Sanitize a configuration to fix common issues
 * @param {Object} config - Site configuration
 * @returns {Object} - Sanitized configuration
 */
function sanitizeConfig(config) {
  const sanitized = JSON.parse(JSON.stringify(config));

  // Ensure siteName exists
  if (!sanitized.siteName) {
    sanitized.siteName = 'My Website';
  }

  // Ensure theme exists with defaults
  if (!sanitized.theme) {
    sanitized.theme = { ...THEME_PRESETS.blue };
  }

  // Ensure sections is an array
  if (!Array.isArray(sanitized.sections)) {
    sanitized.sections = [];
  }

  // Fix section issues
  sanitized.sections = sanitized.sections.map((section, index) => {
    // Ensure required fields
    if (!section.id) {
      section.id = `${section.type || 'section'}-${Date.now()}-${index}`;
    }
    if (section.visible === undefined) {
      section.visible = true;
    }
    if (section.order === undefined) {
      section.order = index;
    }

    // Deep merge content with defaults
    const schema = SECTION_SCHEMAS[section.type];
    if (schema) {
      const defaultContent = schema.defaultContent || {};
      const existingContent = section.content || {};

      // Merge content, filling in missing required fields with defaults
      section.content = deepMergeWithDefaults(existingContent, defaultContent, schema.schema);
    } else if (!section.content) {
      section.content = {};
    }

    return section;
  });

  // Re-sort by order
  sanitized.sections.sort((a, b) => a.order - b.order);

  return sanitized;
}

/**
 * Deep merge content with defaults, ensuring required fields are filled
 * @param {Object} content - User-provided content
 * @param {Object} defaults - Default content
 * @param {Object} schema - Content schema
 * @returns {Object} - Merged content
 */
function deepMergeWithDefaults(content, defaults, schema) {
  const result = {};

  // Start with all fields from defaults
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const userValue = content[key];
    const fieldSchema = schema ? schema[key] : null;

    if (userValue === undefined || userValue === null) {
      // Use default value
      result[key] = Array.isArray(defaultValue)
        ? [...defaultValue]
        : (typeof defaultValue === 'object' && defaultValue !== null)
          ? { ...defaultValue }
          : defaultValue;
    } else if (Array.isArray(userValue) && Array.isArray(defaultValue)) {
      // For arrays, validate items if they have an itemSchema
      if (fieldSchema && fieldSchema.itemSchema) {
        result[key] = userValue.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            // Merge each array item with defaults from the first default item
            const defaultItem = defaultValue[0] || {};
            return mergeArrayItem(item, defaultItem, fieldSchema.itemSchema);
          }
          return item;
        });
      } else {
        result[key] = userValue;
      }
    } else if (typeof userValue === 'object' && typeof defaultValue === 'object' &&
               userValue !== null && defaultValue !== null && !Array.isArray(userValue)) {
      // Recursively merge nested objects
      result[key] = { ...defaultValue, ...userValue };
    } else {
      // Use user value
      result[key] = userValue;
    }
  }

  // Include any user fields not in defaults
  for (const [key, value] of Object.entries(content)) {
    if (!(key in result)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Merge an array item with defaults, ensuring required fields are present
 * @param {Object} item - User-provided item
 * @param {Object} defaultItem - Default item
 * @param {Object} itemSchema - Schema for the item
 * @returns {Object} - Merged item
 */
function mergeArrayItem(item, defaultItem, itemSchema) {
  const result = { ...item };

  // Fill in missing required fields from defaults
  for (const [key, fieldDef] of Object.entries(itemSchema || {})) {
    if (fieldDef.required && (result[key] === undefined || result[key] === null || result[key] === '')) {
      // Use default value if available
      if (defaultItem[key] !== undefined) {
        result[key] = defaultItem[key];
      } else {
        // Provide a sensible default based on type
        switch (fieldDef.type) {
          case 'string':
          case 'text':
            result[key] = 'Default text';
            break;
          case 'url':
            result[key] = '#';
            break;
          case 'enum':
            result[key] = fieldDef.values ? fieldDef.values[0] : '';
            break;
          case 'boolean':
            result[key] = false;
            break;
          default:
            result[key] = '';
        }
      }
    }
  }

  return result;
}

/**
 * Generate initial site configuration from a description
 * @param {string} description - Description of the desired website
 * @returns {Promise<Object>} - Generated site configuration
 */
async function generateSiteFromDescription(description) {
  return processMessage(description, null, []);
}

/**
 * Update site configuration based on user feedback
 * @param {Object} currentConfig - Current site configuration
 * @param {string} feedback - User's feedback/request
 * @param {Array} history - Conversation history
 * @returns {Promise<Object>} - Updated site configuration
 */
async function updateSiteFromFeedback(currentConfig, feedback, history = []) {
  return processMessage(feedback, currentConfig, history);
}

module.exports = {
  processMessage,
  generateSiteFromDescription,
  updateSiteFromFeedback,
  WEBSITE_AGENT_SYSTEM_PROMPT
};
