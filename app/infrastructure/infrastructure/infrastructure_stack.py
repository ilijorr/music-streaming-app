from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    aws_s3 as s3,
    aws_dynamodb as dynamodb, aws_cognito as cognito,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_iam as iam,
    Duration,
)
from constructs import Construct
import os


class InfrastructureStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Get account and region for naming
        account = self.account
        region = self.region

        # ======================
        # S3 BUCKET FOR STORAGE
        # ======================
        music_bucket = s3.Bucket(
            self, "MusicStorageBucket",
            bucket_name=f"music-storage-{account}-{region}",
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            # Automatically delete objects on bucket deletion
            auto_delete_objects=True,
            cors=[
                s3.CorsRule(
                    allowed_methods=[
                        s3.HttpMethods.GET,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.DELETE,
                        s3.HttpMethods.HEAD
                    ],
                    allowed_origins=["*"],  # Open for dev environment
                    allowed_headers=["*"],
                    max_age=3000
                )
            ],
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            versioned=False
        )

        # Note: File type validation is handled at the application level (Lambda)
        # S3 bucket policies with content-type conditions are complex and can be restrictive
        # Access control is managed through IAM roles granted to Lambda functions

        # ======================
        # DYNAMODB TABLE
        # ======================
        music_table = dynamodb.Table(
            self, "MusicAppTable",
            table_name="MusicAppTable",
            partition_key=dynamodb.Attribute(
                name="PK",
                type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="SK",
                type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
            point_in_time_recovery=False  # Disabled for dev to save costs
        )

        # Add Global Secondary Index for genre search
        music_table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=dynamodb.Attribute(
                name="GSI1PK",
                type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="GSI1SK",
                type=dynamodb.AttributeType.STRING
            ),
            projection_type=dynamodb.ProjectionType.ALL
        )

        # ======================
        # COGNITO USER POOL
        # ======================
        user_pool = cognito.UserPool(
            self, "MusicAppUserPool",
            user_pool_name="MusicAppUserPool",
            # Sign-in configuration
            sign_in_aliases=cognito.SignInAliases(
                username=True,
                email=True
            ),
            # Self sign-up enabled
            self_sign_up_enabled=True,
            # Auto-verify email
            auto_verify=cognito.AutoVerifiedAttrs(
                email=True
            ),
            # Required attributes
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(
                    required=True,
                    mutable=True
                ),
                given_name=cognito.StandardAttribute(
                    required=True,
                    mutable=True
                ),
                family_name=cognito.StandardAttribute(
                    required=True,
                    mutable=True
                ),
                birthdate=cognito.StandardAttribute(
                    required=True,
                    mutable=True
                )
            ),
            # Password policy
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False
            ),
            # Account recovery
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            # Removal policy for dev
            removal_policy=RemovalPolicy.DESTROY
        )

        # User Pool Client for frontend
        user_pool_client = user_pool.add_client(
            "MusicAppClient",
            user_pool_client_name="MusicAppClient",
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
                admin_user_password=True
            ),
            # Token validity
            access_token_validity=Duration.hours(1),
            refresh_token_validity=Duration.days(30),
            id_token_validity=Duration.hours(1),
            prevent_user_existence_errors=True
        )

        # Create Cognito Groups
        admins_group = cognito.CfnUserPoolGroup(
            self, "AdminsGroup",
            user_pool_id=user_pool.user_pool_id,
            group_name="Admins",
            description="Administrator users with full access",
            precedence=1
        )

        users_group = cognito.CfnUserPoolGroup(
            self, "UsersGroup",
            user_pool_id=user_pool.user_pool_id,
            group_name="Users",
            description="Regular users with standard access",
            precedence=2
        )

        # ======================
        # LAMBDA FUNCTIONS
        # ======================
        # Get the path to lambdas directory
        lambdas_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'lambdas')

        # Environment variables for all functions
        lambda_environment = {
            'TABLE_NAME': music_table.table_name,
            'BUCKET_NAME': music_bucket.bucket_name,
            'USER_POOL_ID': user_pool.user_pool_id
        }

        # IAM role for Lambda functions
        lambda_role = iam.Role(
            self, "LambdaExecutionRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
            ]
        )

        # Grant permissions
        music_table.grant_read_write_data(lambda_role)
        music_bucket.grant_read_write(lambda_role)

        # Common Lambda configuration
        lambda_config = {
            'runtime': _lambda.Runtime.PYTHON_3_11,
            'timeout': Duration.seconds(30),
            'memory_size': 512,
            'environment': lambda_environment,
            'role': lambda_role
        }

        # Create Lambda layer for common code
        common_layer = _lambda.LayerVersion(
            self, "CommonLayer",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "..", "lambda_layer")),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_11],
            description="Common utilities and models for Lambda functions"
        )

        # ARTISTS FUNCTIONS
        create_artist_fn = _lambda.Function(
            self, "CreateArtistFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "artists")),
            handler="create_artist.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        list_artists_fn = _lambda.Function(
            self, "ListArtistsFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "artists")),
            handler="list_artists.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_artist_fn = _lambda.Function(
            self, "GetArtistFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "artists")),
            handler="get_artist.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        # SONGS FUNCTIONS
        upload_song_fn = _lambda.Function(
            self, "UploadSongFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="upload_song.lambda_handler",
            timeout=Duration.seconds(60),  # Longer timeout for file upload
            memory_size=1024,  # More memory for file processing
            environment=lambda_environment,
            role=lambda_role,
            runtime=_lambda.Runtime.PYTHON_3_11,
            layers=[common_layer]
        )

        list_songs_fn = _lambda.Function(
            self, "ListSongsFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="list_songs.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_song_fn = _lambda.Function(
            self, "GetSongFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="get_song.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_download_url_fn = _lambda.Function(
            self, "GetDownloadUrlFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="get_download_url.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_song_cover_url_fn = _lambda.Function(
            self, "GetSongCoverUrlFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="get_cover_url.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_presigned_url_fn = _lambda.Function(
            self, "GetPresignedUrlFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="get_presigned_url.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        create_song_from_s3_fn = _lambda.Function(
            self, "CreateSongFromS3Function",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "songs")),
            handler="create_song_from_s3.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        # ALBUMS FUNCTIONS
        create_album_fn = _lambda.Function(
            self, "CreateAlbumFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "albums")),
            handler="create_album.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        list_albums_fn = _lambda.Function(
            self, "ListAlbumsFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "albums")),
            handler="list_albums.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_album_fn = _lambda.Function(
            self, "GetAlbumFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "albums")),
            handler="get_album.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        upload_album_fn = _lambda.Function(
            self, "UploadAlbumFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "albums")),
            handler="upload_album.lambda_handler",
            timeout=Duration.seconds(300),  # 5 minutes for bulk upload
            memory_size=1024,  # More memory for processing multiple files
            environment=lambda_environment,
            role=lambda_role,
            runtime=_lambda.Runtime.PYTHON_3_11,
            layers=[common_layer]
        )

        get_cover_url_fn = _lambda.Function(
            self, "GetCoverUrlFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "albums")),
            handler="get_cover_url.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        get_album_songs_fn = _lambda.Function(
            self, "GetAlbumSongsFunction",
            code=_lambda.Code.from_asset(os.path.join(lambdas_path, "albums")),
            handler="get_album_songs.lambda_handler",
            layers=[common_layer],
            **lambda_config
        )

        # ======================
        # API GATEWAY
        # ======================
        # Create REST API
        api = apigateway.RestApi(
            self, "MusicStreamingAPI",
            rest_api_name="MusicStreamingAPI",
            description="API for Music Streaming Application",
            deploy_options=apigateway.StageOptions(
                stage_name="dev",
                throttling_rate_limit=1000,
                throttling_burst_limit=2000
            ),
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=[
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token'
                ]
            )
        )

        # Cognito Authorizer
        authorizer = apigateway.CognitoUserPoolsAuthorizer(
            self, "MusicAppAuthorizer",
            cognito_user_pools=[user_pool]
        )

        # API Resources and Methods

        # /artists
        artists = api.root.add_resource("artists")
        artists.add_method(
            "POST",
            apigateway.LambdaIntegration(create_artist_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )
        artists.add_method(
            "GET",
            apigateway.LambdaIntegration(list_artists_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /artists/{id}
        artist_id = artists.add_resource("{id}")
        artist_id.add_method(
            "GET",
            apigateway.LambdaIntegration(get_artist_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /songs
        songs = api.root.add_resource("songs")
        songs.add_method(
            "POST",
            apigateway.LambdaIntegration(upload_song_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )
        songs.add_method(
            "GET",
            apigateway.LambdaIntegration(list_songs_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /songs/{id}
        song_id = songs.add_resource("{id}")
        song_id.add_method(
            "GET",
            apigateway.LambdaIntegration(get_song_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /songs/{id}/download-url
        download_url = song_id.add_resource("download-url")
        download_url.add_method(
            "GET",
            apigateway.LambdaIntegration(get_download_url_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /songs/{id}/cover-url
        song_cover_url = song_id.add_resource("cover-url")
        song_cover_url.add_method(
            "GET",
            apigateway.LambdaIntegration(get_song_cover_url_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /songs/presigned-url
        presigned_url = songs.add_resource("presigned-url")
        presigned_url.add_method(
            "POST",
            apigateway.LambdaIntegration(get_presigned_url_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /songs/from-s3
        from_s3 = songs.add_resource("from-s3")
        from_s3.add_method(
            "POST",
            apigateway.LambdaIntegration(create_song_from_s3_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /albums
        albums = api.root.add_resource("albums")
        albums.add_method(
            "POST",
            apigateway.LambdaIntegration(create_album_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )
        albums.add_method(
            "GET",
            apigateway.LambdaIntegration(list_albums_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /albums/{id}
        album_id = albums.add_resource("{id}")
        album_id.add_method(
            "GET",
            apigateway.LambdaIntegration(get_album_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /albums/{id}/cover-url
        cover_url = album_id.add_resource("cover-url")
        cover_url.add_method(
            "GET",
            apigateway.LambdaIntegration(get_cover_url_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /albums/{id}/songs
        album_songs = album_id.add_resource("songs")
        album_songs.add_method(
            "GET",
            apigateway.LambdaIntegration(get_album_songs_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # /albums/upload - Bulk album upload
        albums_upload = albums.add_resource("upload")
        albums_upload.add_method(
            "POST",
            apigateway.LambdaIntegration(upload_album_fn),
            authorizer=authorizer,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # ======================
        # GATEWAY RESPONSES FOR CORS
        # ======================
        # Add CORS headers to all error responses from API Gateway
        cors_headers = {
            'Access-Control-Allow-Origin': "'*'",
            'Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'"
        }

        api.add_gateway_response(
            "Unauthorized",
            type=apigateway.ResponseType.UNAUTHORIZED,
            status_code="401",
            response_headers=cors_headers
        )

        api.add_gateway_response(
            "AccessDenied",
            type=apigateway.ResponseType.ACCESS_DENIED,
            status_code="403",
            response_headers=cors_headers
        )

        api.add_gateway_response(
            "Default4xx",
            type=apigateway.ResponseType.DEFAULT_4_XX,
            response_headers=cors_headers
        )

        api.add_gateway_response(
            "Default5xx",
            type=apigateway.ResponseType.DEFAULT_5_XX,
            response_headers=cors_headers
        )

        # ======================
        # CDK OUTPUTS
        # ======================
        CfnOutput(
            self, "S3BucketName",
            value=music_bucket.bucket_name,
            description="Name of the S3 bucket for music storage",
            export_name="MusicStorageBucketName"
        )

        CfnOutput(
            self, "DynamoDBTableName",
            value=music_table.table_name,
            description="Name of the DynamoDB table",
            export_name="MusicAppTableName"
        )

        CfnOutput(
            self, "CognitoUserPoolId",
            value=user_pool.user_pool_id,
            description="Cognito User Pool ID",
            export_name="MusicAppUserPoolId"
        )

        CfnOutput(
            self, "CognitoUserPoolClientId",
            value=user_pool_client.user_pool_client_id,
            description="Cognito User Pool Client ID",
            export_name="MusicAppUserPoolClientId"
        )

        CfnOutput(
            self, "CognitoUserPoolArn",
            value=user_pool.user_pool_arn,
            description="Cognito User Pool ARN",
            export_name="MusicAppUserPoolArn"
        )

        CfnOutput(
            self, "ApiUrl",
            value=api.url,
            description="API Gateway endpoint URL",
            export_name="MusicAppApiUrl"
        )
