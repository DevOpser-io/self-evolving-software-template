/**
 * AWS Configuration
 * Sets up AWS credentials and configuration for services
 */
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const config = require('./index');
const logger = console; // Using console for logging

/**
 * Assumes a cross-account role and returns temporary credentials
 * @param {string} roleArn - The ARN of the role to assume
 * @param {string} sessionName - The name for the session
 * @returns {Promise<Object>} - Temporary credentials
 */
async function assumeRole(roleArn, sessionName = 'BedrockExpressSession') {
  try {
    logger.info(`Attempting to assume role: ${roleArn}`);
    
    // Create STS client
    const stsClient = new STSClient({ region: config.aws.region });
    
    // Create command to assume role
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName
    });
    
    const response = await stsClient.send(assumeRoleCommand);
    
    logger.info('Successfully assumed role');
    return {
      accessKeyId: response.Credentials.AccessKeyId,
      secretAccessKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
      expiration: response.Credentials.Expiration
    };
  } catch (error) {
    logger.error(`Failed to assume role ${roleArn}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  region: config.aws.region,
  crossAccountRoleArn: config.aws.customerCrossAccountRoleArn,
  assumeRole
};
