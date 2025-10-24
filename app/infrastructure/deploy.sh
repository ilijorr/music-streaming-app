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

# Get CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue" \
    --output text)

MEDIA_BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='S3MediaBucketName'].OutputValue" \
    --output text)

IMAGES_BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='S3ImagesBucketName'].OutputValue" \
    --output text)

AWS_REGION=$(aws cloudformation describe-stacks \
    --stack-name InfrastructureStack \
    --query "Stacks[0].Outputs[?OutputKey=='AWSRegion'].OutputValue" \
    --output text)

echo "API URL: $API_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "Media Bucket Name: $MEDIA_BUCKET_NAME"
echo "Images Bucket Name: $IMAGES_BUCKET_NAME"
echo "AWS Region: $AWS_REGION"

# Define the frontend config path
FRONTEND_CONFIG_PATH="../frontend/src/assets/config.json"

# Create directories if they don't exist
mkdir -p "$(dirname "$FRONTEND_CONFIG_PATH")"

# Create the config file
cat > "$FRONTEND_CONFIG_PATH" << EOF
{
  "apiUrl": "$API_URL",
  "cognito": {
    "userPoolId": "$USER_POOL_ID",
    "userPoolClientId": "$USER_POOL_CLIENT_ID",
    "region": "$AWS_REGION"
  },
  "s3": {
    "mediaBucketName": "$MEDIA_BUCKET_NAME",
    "imagesBucketName": "$IMAGES_BUCKET_NAME",
    "region": "$AWS_REGION"
  },
  "allowedAudioFormats": [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac",
    "audio/mp4",
    "audio/x-m4a",
    "audio/ogg",
    "audio/vorbis",
    "audio/aac",
    "audio/x-aac"
  ],
  "allowedAudioExtensions": [
    ".mp3",
    ".wav",
    ".flac",
    ".m4a",
    ".ogg",
    ".aac"
  ]
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

CURRENT_DIR=$(pwd)
cd ../frontend

echo "Building Angular app..."
ng build --configuration production

echo "Deploying to S3..."
aws s3 sync ../frontend/dist/frontend/browser/ s3://siitcloudfront/ --delete

cd "$CURRENT_DIR"

echo "Deployment completed successfully!"
