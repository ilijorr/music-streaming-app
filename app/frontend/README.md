# Music Streaming App - Frontend

Angular 19 standalone application for music streaming.

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK infrastructure deployed

## Configuration

⚠️ **IMPORTANT**: The application requires a `config.json` file in `src/assets/` directory with AWS resources information.

### Option 1: Generate config automatically (Recommended)

Run the deployment script from the infrastructure directory:

**Windows:**
```bash
cd ..\infrastructure
.\deploy.bat
```

**Linux/Mac:**
```bash
cd ../infrastructure
bash deploy.sh
```

This will:
1. Deploy CDK infrastructure
2. Fetch CloudFormation outputs
3. Generate `src/assets/config.json` automatically

### Option 2: Manual configuration

If you already have infrastructure deployed:

1. Copy the example config:
```bash
cp src/assets/config.json.example src/assets/config.json
```

2. Fill in the values from AWS Console or CloudFormation outputs:
```bash
# Get CloudFormation outputs
aws cloudformation describe-stacks --stack-name InfrastructureStack --query "Stacks[0].Outputs"
```

3. Update `config.json` with your AWS resource IDs.

## Development

1. Install dependencies:
```bash
npm install
```

2. Make sure `config.json` exists (see Configuration section above)

3. Start development server:
```bash
npm start
# or
ng serve
```

4. Open browser at `http://localhost:4200`

## Building for Production

```bash
npm run build
# or
ng build
```

Output will be in `dist/frontend/browser/` directory.

## Project Structure

```
src/
├── app/
│   ├── components/       # UI components
│   │   ├── auth/         # Login/Register
│   │   ├── create-artist/
│   │   ├── upload-music/
│   │   └── browse-music/
│   ├── services/         # Business logic and API calls
│   │   ├── auth.service.ts
│   │   ├── artist.service.ts
│   │   └── config.service.ts
│   ├── guards/           # Route guards (auth, admin)
│   ├── interceptors/     # HTTP interceptors (auth token)
│   ├── models/           # TypeScript interfaces
│   └── app.routes.ts     # Application routing
├── assets/
│   ├── config.json       # AWS configuration (generated)
│   └── config.json.example
└── styles.css            # Global styles
```

## Features

- **Authentication**: AWS Cognito integration with Amplify
- **Artist Management**: Create, list, and view artists (Admin only)
- **Music Upload**: Upload songs with metadata (Admin only)
- **Music Browsing**: Browse and listen to music (All users)
- **Role-Based Access**: Admin and User roles with different permissions
- **JWT Authentication**: Automatic token injection via HTTP interceptor

## User Roles

### Admin Can:
- Create artists (`/artists/create`)
- Upload music (`/music/upload`)
- Browse music (`/music/browse`)

### Users Can:
- Browse music (`/music/browse`)
- View artists and albums
- Play songs

### Making a User an Admin:

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <USER_POOL_ID> \
  --username <USERNAME> \
  --group-name Admins
```

## Troubleshooting

### Config file not found

If you see errors about `config.json` not being found:

1. Check if the file exists:
   ```bash
   ls src/assets/config.json
   ```
2. If missing, run deployment script or create manually
3. Restart development server after creating the file
4. Check browser console for fallback config warning

### CORS errors

If you see CORS errors in browser console:
- Check API Gateway CORS configuration in CDK stack
- Verify `apiUrl` in `config.json` is correct
- Make sure API allows your origin (`http://localhost:4200` for dev)

### Authentication errors

If authentication fails:
- Verify Cognito credentials in `config.json`
- Check AWS Amplify configuration
- Clear browser cache and try again
- Check browser console for detailed error messages

### "Not authenticated" errors

If you see 401 errors:
- Make sure you're logged in
- Check that JWT token is being sent (Network tab → Headers)
- Verify token hasn't expired (tokens expire after 1 hour)

### "Access denied" errors (403)

If you see 403 errors:
- Verify user is in correct Cognito group
- Check Lambda authorizer is working correctly
- View CloudWatch logs for Lambda functions

## AWS Resources

This frontend connects to:
- **API Gateway**: REST API for backend operations
- **Cognito User Pool**: User authentication and authorization
- **S3**: Music and image storage
- **DynamoDB**: Metadata storage (via API)

## Code Scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component:

```bash
ng generate component component-name
```

For a complete list of available schematics:

```bash
ng generate --help
```

## Testing

Run unit tests:
```bash
ng test
```

Run end-to-end tests:
```bash
ng e2e
```

## Additional Resources

- [Angular CLI Documentation](https://angular.dev/tools/cli)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
