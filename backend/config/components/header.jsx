import React from 'react';
import { Box, H3, Button, Icon } from '@adminjs/design-system';
import { styled } from '@adminjs/design-system/styled-components';

const StyledHeader = styled(Box)`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
`;

const NavButton = styled(Button)`
  margin-left: 8px;
`;

const Header = () => {
  return (
    <StyledHeader>
      <H3>Bedrock Express Admin</H3>
      <Box>
        <NavButton as="a" href="/chat" target="_blank" variant="primary">
          <Icon icon="Chat" />
          Chat Interface
        </NavButton>
        <NavButton as="a" href="/admin-access/logout" variant="danger">
          <Icon icon="Exit" />
          Logout
        </NavButton>
      </Box>
    </StyledHeader>
  );
};

export default Header;
