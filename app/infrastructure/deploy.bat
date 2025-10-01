@echo off
REM ===================
REM Deployment Script
REM ===================

echo Starting deployment...

REM Deploy CDK stack
echo Deploying CDK stack...
call cdk deploy

REM Check if deployment was successful
if %ERRORLEVEL% neq 0 (
    echo CDK deployment failed!
    exit /b 1
)

echo CDK deployment successful!

REM ===================
REM Angular config file generation
REM ===================

echo Generating Angular config file...

REM Get CloudFormation outputs
for /f "delims=" %%i in ('aws cloudformation describe-stacks --stack-name InfrastructureStack --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text') do set API_URL=%%i
for /f "delims=" %%i in ('aws cloudformation describe-stacks --stack-name InfrastructureStack --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text') do set USER_POOL_ID=%%i
for /f "delims=" %%i in ('aws cloudformation describe-stacks --stack-name InfrastructureStack --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue" --output text') do set USER_POOL_CLIENT_ID=%%i
for /f "delims=" %%i in ('aws cloudformation describe-stacks --stack-name InfrastructureStack --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" --output text') do set BUCKET_NAME=%%i

REM Extract region from User Pool ID (format: region_randomstring)
for /f "tokens=1 delims=_" %%i in ("%USER_POOL_ID%") do set AWS_REGION=%%i

echo API URL: %API_URL%
echo User Pool ID: %USER_POOL_ID%
echo User Pool Client ID: %USER_POOL_CLIENT_ID%
echo S3 Bucket Name: %BUCKET_NAME%
echo AWS Region: %AWS_REGION%

REM Define the frontend config path
set FRONTEND_CONFIG_PATH=..\frontend\src\assets\config.json

REM Create directories if they don't exist
if not exist "..\frontend\src\assets" mkdir "..\frontend\src\assets"

REM Create the config file
(
echo {
echo   "apiUrl": "%API_URL%",
echo   "cognito": {
echo     "userPoolId": "%USER_POOL_ID%",
echo     "userPoolClientId": "%USER_POOL_CLIENT_ID%",
echo     "region": "%AWS_REGION%"
echo   },
echo   "s3": {
echo     "bucketName": "%BUCKET_NAME%",
echo     "region": "%AWS_REGION%"
echo   },
echo   "allowedAudioFormats": [
echo     "audio/mpeg",
echo     "audio/mp3",
echo     "audio/wav",
echo     "audio/wave",
echo     "audio/x-wav",
echo     "audio/flac",
echo     "audio/x-flac",
echo     "audio/mp4",
echo     "audio/x-m4a",
echo     "audio/ogg",
echo     "audio/vorbis",
echo     "audio/aac",
echo     "audio/x-aac"
echo   ],
echo   "allowedAudioExtensions": [
echo     ".mp3",
echo     ".wav",
echo     ".flac",
echo     ".m4a",
echo     ".ogg",
echo     ".aac"
echo   ]
echo }
) > "%FRONTEND_CONFIG_PATH%"

echo Angular config file generated at: %FRONTEND_CONFIG_PATH%

REM Verify the file was created
if exist "%FRONTEND_CONFIG_PATH%" (
    echo Config file content:
    type "%FRONTEND_CONFIG_PATH%"
) else (
    echo Error: Config file was not created!
    exit /b 1
)

echo Deployment completed successfully!
