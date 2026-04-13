# Google OAuth Setup Guide

This guide explains how to configure Google OAuth authentication for the Bedrock Express application.

## Overview

The application supports Google OAuth authentication with graceful fallback. If Google OAuth credentials are not configured, the application will continue to work with traditional email/password authentication, and the Google sign-in button will not appear.

## Features

- **Optional Integration**: Google OAuth is completely optional - the app works without it
- **Graceful Fallback**: Missing credentials won't break the application
- **OAuth Users Skip MFA**: Users who sign in with Google automatically bypass MFA requirements
- **Account Linking**: Existing users can link their Google account to their email account

## Configuration Methods

### Method 1: Using AWS Secrets Manager (Recommended for Production)

Add the following keys to your `ADDITIONAL_SECRETS` in AWS Secrets Manager:

```json
{
  "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "your-client-secret"
}
```

### Method 2: Using Environment Variables

Set the following environment variables:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

## Getting Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - For local development: `http://localhost:8000/auth/google/callback`
     - For staging: `https://staging.yourdomain.com/auth/google/callback`
     - For production: `https://yourdomain.com/auth/google/callback`
5. Save your Client ID and Client Secret

## Verification

### Check if OAuth is Configured

1. Start the server and check the logs:
   ```bash
   npm run dev
   ```

2. Look for OAuth status messages:
   - Success: `[OAuth] ✅ Google OAuth strategy configured successfully`
   - Missing credentials: `[OAuth] ⚠️  Google OAuth not configured - missing credentials`

3. Visit the login page:
   - If configured: Google sign-in button will appear
   - If not configured: Only email/password login will be available

### Test OAuth Status Endpoint

```bash
curl http://localhost:8000/auth/google/status
```

Response when configured:
```json
{
  "enabled": true,
  "message": "Google OAuth is configured and available"
}
```

Response when not configured:
```json
{
  "enabled": false,
  "message": "Google OAuth is not configured"
}
```

## User Experience

### For New Users
1. Click "Sign in with Google" on the login page
2. Authorize the application
3. Account is automatically created with:
   - Email verified status
   - No password required
   - MFA bypassed

### For Existing Users
1. If an account exists with the same email:
   - Google account is linked automatically
   - Email is marked as verified
   - User can now sign in with either Google or password

### MFA Behavior
- OAuth users (Google, GitHub) automatically skip MFA requirements
- Traditional email/password users can opt-in to MFA
- MFA is never enforced for OAuth authenticated sessions

## Troubleshooting

### Google Sign-in Button Not Appearing
- Check server logs for OAuth configuration status
- Verify credentials are properly set in ADDITIONAL_SECRETS or environment
- Ensure the credentials are valid and not expired

### Authentication Errors
- Verify redirect URIs match exactly in Google Console
- Check that Google+ API is enabled
- Ensure client ID and secret are correct

### Session Issues
- Clear browser cookies
- Restart the server after changing OAuth configuration
- Check Redis connection for session storage

## Security Considerations

1. **Never commit credentials** to version control
2. **Use HTTPS in production** for OAuth redirects
3. **Rotate secrets regularly** using AWS Secrets Manager
4. **Monitor OAuth usage** in Google Cloud Console

## Database Schema

The User model includes OAuth fields:
- `googleId`: Unique Google user ID
- `githubId`: Unique GitHub user ID (for future implementation)
- `oauthProvider`: Indicates which OAuth provider was used

## Migration

Run the migration to add OAuth fields to existing databases:
```bash
npx sequelize-cli db:migrate
```

## Implementation Details

The OAuth implementation includes:
- Passport.js Google OAuth 2.0 strategy
- Automatic email verification for OAuth users
- Account linking for existing users
- Graceful fallback when credentials are missing
- Clear console instructions for setup

## Support

If you encounter issues:
1. Check server logs for detailed OAuth messages
2. Verify credentials in AWS Secrets Manager or environment
3. Test with the `/auth/google/status` endpoint
4. Review redirect URI configuration in Google Console