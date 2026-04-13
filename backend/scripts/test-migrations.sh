#!/bin/bash

# Set required environment variables for testing
# These are placeholders - set actual values in your .env file or environment
export DB_NAME_SECRET_NAME="${DB_NAME_SECRET_NAME:-test-db-name-secret}"
export DB_USER_SECRET_NAME="${DB_USER_SECRET_NAME:-test-db-user-secret}"
export DB_PASSWORD_SECRET_NAME="${DB_PASSWORD_SECRET_NAME:-test-db-password-secret}"
export DB_HOST_SECRET_NAME="${DB_HOST_SECRET_NAME:-test-db-host-secret}"
export DB_PORT_SECRET_NAME="${DB_PORT_SECRET_NAME:-test-db-port-secret}"
export REGION="${REGION:-us-east-1}"
# CUSTOMER_CROSS_ACCOUNT_ROLE_ARN must be set in .env or environment

# Load existing .env file if it exists
if [ -f "../../.env" ]; then
  echo "Loading variables from .env file..."
  export $(grep -v '^#' ../../.env | xargs)
fi

# Run the migration script
echo "Running migration script..."
node run-prod-migrations.js
