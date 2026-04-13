// Using CommonJS compatible imports
const React = require('react');
const { Box, H2, H5, Text } = require('@adminjs/design-system');

const Dashboard = () => {
  return (
    <Box variant="grey">
      <Box variant="white" padding="xl">
        <H2>Welcome to Bedrock Express Admin Panel</H2>
        <Text>This admin panel allows you to manage users and conversations in your application.</Text>
        
        <Box marginTop="xl">
          <H5>Quick Links</H5>
          <Box marginTop="default">
            <Text>• <a href="/admin/resources/User">Manage Users</a></Text>
            <Text>• <a href="/admin/resources/Conversation">View Conversations</a></Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

module.exports = Dashboard;
