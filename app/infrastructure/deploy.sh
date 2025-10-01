#!/bin/bash

# ===================
# Deployment Script
# ===================

echo "Starting deployment..."

# Deploy CDK stack
echo "Deploying CDK stack..."
cdk deploy

# Check if deployment was successful
if [ $? -ne 0 ]; then
    echo "CDK deployment failed!"
    exit 1
fi

echo "CDK deployment successful!"

# ===================
# Angular config file generation
# ===================

echo "Generating Angular config file..."

# Get the API URL from CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text)

echo "API URL: $API_URL"

# Define the frontend config path
FRONTEND_CONFIG_PATH="../frontend/src/assets/config.json"

# Create directories if they don't exist
mkdir -p "$(dirname "$FRONTEND_CONFIG_PATH")"

# Create the config file
cat > "$FRONTEND_CONFIG_PATH" << EOF
{
  "apiUrl": "$API_URL"
}
EOF

echo "Angular config file generated at: $FRONTEND_CONFIG_PATH"

# Verify the file was created
if [ -f "$FRONTEND_CONFIG_PATH" ]; then
    echo "Config file content:"
    cat "$FRONTEND_CONFIG_PATH"
else
    echo "Error: Config file was not created!"
    exit 1
fi

echo "Deployment completed successfully!"
