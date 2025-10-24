from aws_cdk import (
    Stack,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_apigateway as apigateway,
    aws_lambda as _lambda,
    aws_iam as iam,
    aws_sns as sns,
    aws_sns_subscriptions as sns_subscriptions,
    aws_ses as ses,
    RemovalPolicy,
    Duration,
    CfnOutput,
)
from constructs import Construct


class InfrastructureStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Get account and region for naming
        account = self.account
        region = self.region

        # Create core infrastructure
        self._create_cognito_resources()
        self._create_dynamodb_tables()
        self._create_s3_buckets()
        self._create_notification_resources()
        self._create_lambda_layer()
        self._create_api_gateway()
        self._create_lambda_functions()
        self._create_outputs()

    def _create_cognito_resources(self):
        """Create Cognito User Pool and related resources for authentication"""

        # Create User Pool
        self.user_pool = cognito.UserPool(
            self, "MusicStreamingUserPool",
            user_pool_name="music-streaming-user-pool",
            sign_in_aliases=cognito.SignInAliases(
                username=True,
                email=True
            ),
            standard_attributes=cognito.StandardAttributes(
                given_name=cognito.StandardAttribute(required=True),
                family_name=cognito.StandardAttribute(required=True),
                email=cognito.StandardAttribute(required=True),
                birthdate=cognito.StandardAttribute(required=True)
            ),
            custom_attributes={
                "preferred_username": cognito.StringAttribute(min_len=1, max_len=50)
            },
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            self_sign_up_enabled=True,
            user_verification=cognito.UserVerificationConfig(
                email_subject="Verify your email for Music Streaming App",
                email_body="Thanks for signing up! Your verification code is {####}",
                email_style=cognito.VerificationEmailStyle.CODE
            ),
            removal_policy=RemovalPolicy.DESTROY
        )

        # Create User Pool Client
        self.user_pool_client = cognito.UserPoolClient(
            self, "MusicStreamingUserPoolClient",
            user_pool=self.user_pool,
            user_pool_client_name="music-streaming-client",
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True
            ),
            generate_secret=False,
            access_token_validity=Duration.hours(1),
            id_token_validity=Duration.hours(1),
            refresh_token_validity=Duration.days(30),
            supported_identity_providers=[cognito.UserPoolClientIdentityProvider.COGNITO]
        )

        # Create Admin Group
        self.admin_group = cognito.CfnUserPoolGroup(
            self, "AdminGroup",
            user_pool_id=self.user_pool.user_pool_id,
            group_name="Admins",
            description="Administrator group with full access to content management"
        )

    def _create_dynamodb_tables(self):
        """Create DynamoDB tables for data storage"""

        # Artists Table
        self.artists_table = dynamodb.Table(
            self, "ArtistsTable",
            table_name="MusicStreaming-Artists",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # Add GSI for genre filtering
        self.artists_table.add_global_secondary_index(
            index_name="GenreIndex",
            partition_key=dynamodb.Attribute(name="GSI1PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI1SK", type=dynamodb.AttributeType.STRING)
        )

        # Songs Table
        self.songs_table = dynamodb.Table(
            self, "SongsTable",
            table_name="MusicStreaming-Songs",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # Add GSI for artist filtering
        self.songs_table.add_global_secondary_index(
            index_name="ArtistIndex",
            partition_key=dynamodb.Attribute(name="GSI1PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI1SK", type=dynamodb.AttributeType.STRING)
        )

        # Add GSI for genre filtering
        self.songs_table.add_global_secondary_index(
            index_name="GenreIndex",
            partition_key=dynamodb.Attribute(name="GSI2PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI2SK", type=dynamodb.AttributeType.STRING)
        )

        # Add GSI for album filtering
        self.songs_table.add_global_secondary_index(
            index_name="AlbumIndex",
            partition_key=dynamodb.Attribute(name="GSI3PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI3SK", type=dynamodb.AttributeType.STRING)
        )

        # Albums Table
        self.albums_table = dynamodb.Table(
            self, "AlbumsTable",
            table_name="MusicStreaming-Albums",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # Add GSI for artist filtering
        self.albums_table.add_global_secondary_index(
            index_name="ArtistIndex",
            partition_key=dynamodb.Attribute(name="GSI1PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI1SK", type=dynamodb.AttributeType.STRING)
        )

        # Add GSI for genre filtering
        self.albums_table.add_global_secondary_index(
            index_name="GenreIndex",
            partition_key=dynamodb.Attribute(name="GSI2PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI2SK", type=dynamodb.AttributeType.STRING)
        )

        # Subscriptions Table
        self.subscriptions_table = dynamodb.Table(
            self, "SubscriptionsTable",
            table_name="MusicStreaming-Subscriptions",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # Add GSI for subscription lookups
        self.subscriptions_table.add_global_secondary_index(
            index_name="SubscriptionIndex",
            partition_key=dynamodb.Attribute(name="GSI1PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI1SK", type=dynamodb.AttributeType.STRING)
        )

    def _create_s3_buckets(self):
        """Create S3 buckets for media and image storage"""

        # Media bucket for audio files
        self.media_bucket = s3.Bucket(
            self, "MediaBucket",
            bucket_name=f"music-streaming-media-{self.account}-{self.region}",
            versioned=False,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            cors=[s3.CorsRule(
                allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
                allowed_origins=["*"],
                allowed_headers=["*"],
                max_age=3600
            )]
        )

        # Images bucket for cover art and artist images
        self.images_bucket = s3.Bucket(
            self, "ImagesBucket",
            bucket_name=f"music-streaming-images-{self.account}-{self.region}",
            versioned=False,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            cors=[s3.CorsRule(
                allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
                allowed_origins=["*"],
                allowed_headers=["*"],
                max_age=3600
            )]
        )

    def _create_notification_resources(self):
        """Create SNS and SES resources for notifications"""

        # SNS Topic for notifications
        self.notification_topic = sns.Topic(
            self, "NotificationTopic",
            topic_name="music-streaming-notifications",
            display_name="Music Streaming Notifications"
        )

        # Note: SES configuration needs to be done manually or via custom resource
        # as it requires domain verification

    def _create_lambda_layer(self):
        """Create Lambda layer with shared utilities and models"""

        self.lambda_layer = _lambda.LayerVersion(
            self, "MusicStreamingLayer",
            code=_lambda.Code.from_asset("../lambda_layer"),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_9],
            description="Shared utilities and models for music streaming app"
        )

    def _create_api_gateway(self):
        """Create API Gateway with Cognito authentication"""

        # Create Cognito authorizer
        self.cognito_authorizer = apigateway.CognitoUserPoolsAuthorizer(
            self, "CognitoAuthorizer",
            cognito_user_pools=[self.user_pool],
            authorizer_name="music-streaming-authorizer"
        )

        # Create API Gateway
        self.api = apigateway.RestApi(
            self, "MusicStreamingAPI",
            rest_api_name="music-streaming-api",
            description="API for Music Streaming Application",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"]
            ),
            binary_media_types=["audio/*", "image/*"],
            endpoint_configuration=apigateway.EndpointConfiguration(
                types=[apigateway.EndpointType.REGIONAL]
            )
        )

        # Create resource structure
        self.artists_resource = self.api.root.add_resource("artists")
        self.songs_resource = self.api.root.add_resource("songs")
        self.albums_resource = self.api.root.add_resource("albums")
        self.discover_resource = self.api.root.add_resource("discover")
        self.subscriptions_resource = self.api.root.add_resource("subscriptions")
        self.notifications_resource = self.api.root.add_resource("notifications")

        # Create path parameter resources
        self.artist_by_id_resource = self.artists_resource.add_resource("{artistId}")
        self.song_by_id_resource = self.songs_resource.add_resource("{songId}")
        self.album_by_id_resource = self.albums_resource.add_resource("{albumId}")
        self.subscription_by_id_resource = self.subscriptions_resource.add_resource("{subscriptionId}")
        self.notification_by_id_resource = self.notifications_resource.add_resource("{notificationId}")
        self.mark_all_read_resource = self.notifications_resource.add_resource("mark-all-read")

        # Create additional nested resources
        self.song_stream_resource = self.song_by_id_resource.add_resource("stream")
        self.album_songs_resource = self.album_by_id_resource.add_resource("songs")

    def _create_lambda_functions(self):
        """Create all Lambda functions"""

        # Base Lambda execution role
        lambda_role = iam.Role(
            self, "LambdaExecutionRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
            ]
        )

        # Grant permissions to DynamoDB tables
        self.artists_table.grant_read_write_data(lambda_role)
        self.songs_table.grant_read_write_data(lambda_role)
        self.albums_table.grant_read_write_data(lambda_role)
        self.subscriptions_table.grant_read_write_data(lambda_role)

        # Grant permissions to S3 buckets
        self.media_bucket.grant_read_write(lambda_role)
        self.images_bucket.grant_read_write(lambda_role)

        # Grant permissions to SNS
        self.notification_topic.grant_publish(lambda_role)

        # Grant SES permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            actions=["ses:SendEmail", "ses:SendRawEmail"],
            resources=["*"]
        ))

        # Grant Cognito permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            actions=["cognito-idp:ListUsers", "cognito-idp:AdminGetUser"],
            resources=[self.user_pool.user_pool_arn]
        ))

        # Environment variables for all lambdas
        lambda_environment = {
            "ARTISTS_TABLE": self.artists_table.table_name,
            "SONGS_TABLE": self.songs_table.table_name,
            "ALBUMS_TABLE": self.albums_table.table_name,
            "SUBSCRIPTIONS_TABLE": self.subscriptions_table.table_name,
            "MEDIA_BUCKET": self.media_bucket.bucket_name,
            "IMAGES_BUCKET": self.images_bucket.bucket_name,
            "NOTIFICATION_TOPIC_ARN": self.notification_topic.topic_arn,
            "USER_POOL_ID": self.user_pool.user_pool_id
        }

        # Artist Management Functions
        self._create_artist_functions(lambda_role, lambda_environment)

        # Song Management Functions
        self._create_song_functions(lambda_role, lambda_environment)

        # Album Management Functions
        self._create_album_functions(lambda_role, lambda_environment)

        # Discovery Functions
        self._create_discovery_functions(lambda_role, lambda_environment)

        # Subscription Functions
        self._create_subscription_functions(lambda_role, lambda_environment)

        # Notification Functions
        self._create_notification_functions(lambda_role, lambda_environment)

    def _create_artist_functions(self, lambda_role, environment):
        """Create artist management Lambda functions"""

        # Create Artist (Admin only)
        self.create_artist_function = _lambda.Function(
            self, "CreateArtistFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="create_artist.handler",
            code=_lambda.Code.from_asset("../lambdas/artists"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Get Artist
        self.get_artist_function = _lambda.Function(
            self, "GetArtistFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_artist.handler",
            code=_lambda.Code.from_asset("../lambdas/artists"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # List Artists
        self.list_artists_function = _lambda.Function(
            self, "ListArtistsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="list_artists.handler",
            code=_lambda.Code.from_asset("../lambdas/artists"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Update Artist (Admin only)
        self.update_artist_function = _lambda.Function(
            self, "UpdateArtistFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="update_artist.handler",
            code=_lambda.Code.from_asset("../lambdas/artists"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Delete Artist (Admin only)
        self.delete_artist_function = _lambda.Function(
            self, "DeleteArtistFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="delete_artist.handler",
            code=_lambda.Code.from_asset("../lambdas/artists"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # API Gateway integrations
        self.artists_resource.add_method("POST", apigateway.LambdaIntegration(self.create_artist_function),
                                         authorization_type=apigateway.AuthorizationType.COGNITO,
                                         authorizer=self.cognito_authorizer)
        self.artists_resource.add_method("GET", apigateway.LambdaIntegration(self.list_artists_function),
                                         authorization_type=apigateway.AuthorizationType.COGNITO,
                                         authorizer=self.cognito_authorizer)
        self.artist_by_id_resource.add_method("GET", apigateway.LambdaIntegration(self.get_artist_function),
                                              authorization_type=apigateway.AuthorizationType.COGNITO,
                                              authorizer=self.cognito_authorizer)
        self.artist_by_id_resource.add_method("PUT", apigateway.LambdaIntegration(self.update_artist_function),
                                              authorization_type=apigateway.AuthorizationType.COGNITO,
                                              authorizer=self.cognito_authorizer)
        self.artist_by_id_resource.add_method("DELETE", apigateway.LambdaIntegration(self.delete_artist_function),
                                              authorization_type=apigateway.AuthorizationType.COGNITO,
                                              authorizer=self.cognito_authorizer)

    def _create_song_functions(self, lambda_role, environment):
        """Create song management Lambda functions"""

        # Upload Song (Admin only)
        self.upload_song_function = _lambda.Function(
            self, "UploadSongFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="upload_song.handler",
            code=_lambda.Code.from_asset("../lambdas/songs"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(60)
        )

        # Get Song
        self.get_song_function = _lambda.Function(
            self, "GetSongFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_song.handler",
            code=_lambda.Code.from_asset("../lambdas/songs"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # List Songs
        self.list_songs_function = _lambda.Function(
            self, "ListSongsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="list_songs.handler",
            code=_lambda.Code.from_asset("../lambdas/songs"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Update Song (Admin only)
        self.update_song_function = _lambda.Function(
            self, "UpdateSongFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="update_song.handler",
            code=_lambda.Code.from_asset("../lambdas/songs"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(60)
        )

        # Delete Song (Admin only)
        self.delete_song_function = _lambda.Function(
            self, "DeleteSongFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="delete_song.handler",
            code=_lambda.Code.from_asset("../lambdas/songs"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Get Stream URL
        self.get_stream_url_function = _lambda.Function(
            self, "GetStreamUrlFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_stream_url.handler",
            code=_lambda.Code.from_asset("../lambdas/songs"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # API Gateway integrations
        self.songs_resource.add_method("POST", apigateway.LambdaIntegration(self.upload_song_function),
                                       authorization_type=apigateway.AuthorizationType.COGNITO,
                                       authorizer=self.cognito_authorizer)
        self.songs_resource.add_method("GET", apigateway.LambdaIntegration(self.list_songs_function),
                                       authorization_type=apigateway.AuthorizationType.COGNITO,
                                       authorizer=self.cognito_authorizer)
        self.song_by_id_resource.add_method("GET", apigateway.LambdaIntegration(self.get_song_function),
                                            authorization_type=apigateway.AuthorizationType.COGNITO,
                                            authorizer=self.cognito_authorizer)
        self.song_by_id_resource.add_method("PUT", apigateway.LambdaIntegration(self.update_song_function),
                                            authorization_type=apigateway.AuthorizationType.COGNITO,
                                            authorizer=self.cognito_authorizer)
        self.song_by_id_resource.add_method("DELETE", apigateway.LambdaIntegration(self.delete_song_function),
                                            authorization_type=apigateway.AuthorizationType.COGNITO,
                                            authorizer=self.cognito_authorizer)
        self.song_stream_resource.add_method("GET", apigateway.LambdaIntegration(self.get_stream_url_function),
                                             authorization_type=apigateway.AuthorizationType.COGNITO,
                                             authorizer=self.cognito_authorizer)

    def _create_album_functions(self, lambda_role, environment):
        """Create album management Lambda functions"""

        # Upload Album (Admin only)
        self.upload_album_function = _lambda.Function(
            self, "UploadAlbumFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="upload_album.handler",
            code=_lambda.Code.from_asset("../lambdas/albums"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(300)  # Longer timeout for album uploads
        )

        # Get Album
        self.get_album_function = _lambda.Function(
            self, "GetAlbumFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_album.handler",
            code=_lambda.Code.from_asset("../lambdas/albums"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # List Albums
        self.list_albums_function = _lambda.Function(
            self, "ListAlbumsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="list_albums.handler",
            code=_lambda.Code.from_asset("../lambdas/albums"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Update Album (Admin only)
        self.update_album_function = _lambda.Function(
            self, "UpdateAlbumFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="update_album.handler",
            code=_lambda.Code.from_asset("../lambdas/albums"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(60)
        )

        # Delete Album (Admin only)
        self.delete_album_function = _lambda.Function(
            self, "DeleteAlbumFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="delete_album.handler",
            code=_lambda.Code.from_asset("../lambdas/albums"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Get Album Songs
        self.get_album_songs_function = _lambda.Function(
            self, "GetAlbumSongsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_album_songs.handler",
            code=_lambda.Code.from_asset("../lambdas/albums"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # API Gateway integrations
        self.albums_resource.add_method("POST", apigateway.LambdaIntegration(self.upload_album_function),
                                        authorization_type=apigateway.AuthorizationType.COGNITO,
                                        authorizer=self.cognito_authorizer)
        self.albums_resource.add_method("GET", apigateway.LambdaIntegration(self.list_albums_function),
                                        authorization_type=apigateway.AuthorizationType.COGNITO,
                                        authorizer=self.cognito_authorizer)
        self.album_by_id_resource.add_method("GET", apigateway.LambdaIntegration(self.get_album_function),
                                             authorization_type=apigateway.AuthorizationType.COGNITO,
                                             authorizer=self.cognito_authorizer)
        self.album_by_id_resource.add_method("PUT", apigateway.LambdaIntegration(self.update_album_function),
                                             authorization_type=apigateway.AuthorizationType.COGNITO,
                                             authorizer=self.cognito_authorizer)
        self.album_by_id_resource.add_method("DELETE", apigateway.LambdaIntegration(self.delete_album_function),
                                             authorization_type=apigateway.AuthorizationType.COGNITO,
                                             authorizer=self.cognito_authorizer)
        self.album_songs_resource.add_method("GET", apigateway.LambdaIntegration(self.get_album_songs_function),
                                             authorization_type=apigateway.AuthorizationType.COGNITO,
                                             authorizer=self.cognito_authorizer)

    def _create_discovery_functions(self, lambda_role, environment):
        """Create content discovery Lambda functions"""

        # Discover Content by Genre
        self.discover_function = _lambda.Function(
            self, "DiscoverFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="discover.handler",
            code=_lambda.Code.from_asset("../lambdas/discovery"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # API Gateway integrations
        self.discover_resource.add_method("GET", apigateway.LambdaIntegration(self.discover_function),
                                          authorization_type=apigateway.AuthorizationType.COGNITO,
                                          authorizer=self.cognito_authorizer)

    def _create_subscription_functions(self, lambda_role, environment):
        """Create subscription management Lambda functions"""

        # Create Subscription
        self.create_subscription_function = _lambda.Function(
            self, "CreateSubscriptionFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="create_subscription.handler",
            code=_lambda.Code.from_asset("../lambdas/subscriptions"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Get User Subscriptions
        self.get_subscriptions_function = _lambda.Function(
            self, "GetSubscriptionsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_subscriptions.handler",
            code=_lambda.Code.from_asset("../lambdas/subscriptions"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Delete Subscription
        self.delete_subscription_function = _lambda.Function(
            self, "DeleteSubscriptionFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="delete_subscription.handler",
            code=_lambda.Code.from_asset("../lambdas/subscriptions"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # API Gateway integrations
        self.subscriptions_resource.add_method("POST", apigateway.LambdaIntegration(self.create_subscription_function),
                                               authorization_type=apigateway.AuthorizationType.COGNITO,
                                               authorizer=self.cognito_authorizer)
        self.subscriptions_resource.add_method("GET", apigateway.LambdaIntegration(self.get_subscriptions_function),
                                               authorization_type=apigateway.AuthorizationType.COGNITO,
                                               authorizer=self.cognito_authorizer)
        self.subscription_by_id_resource.add_method("DELETE", apigateway.LambdaIntegration(self.delete_subscription_function),
                                                    authorization_type=apigateway.AuthorizationType.COGNITO,
                                                    authorizer=self.cognito_authorizer)

    def _create_notification_functions(self, lambda_role, environment):
        """Create notification Lambda functions"""

        # Send Notifications
        self.send_notifications_function = _lambda.Function(
            self, "SendNotificationsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="send_notifications.handler",
            code=_lambda.Code.from_asset("../lambdas/notifications"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(60)
        )

        # Subscribe the notification Lambda function to the SNS topic
        self.notification_topic.add_subscription(
            sns_subscriptions.LambdaSubscription(self.send_notifications_function)
        )

        # Get Notifications
        self.get_notifications_function = _lambda.Function(
            self, "GetNotificationsFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get_notifications.handler",
            code=_lambda.Code.from_asset("../lambdas/notifications"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Mark Notification as Read
        self.mark_notification_read_function = _lambda.Function(
            self, "MarkNotificationReadFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="mark_notification_read.handler",
            code=_lambda.Code.from_asset("../lambdas/notifications"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # Mark All Notifications as Read
        self.mark_all_notifications_read_function = _lambda.Function(
            self, "MarkAllNotificationsReadFunction",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="mark_all_notifications_read.handler",
            code=_lambda.Code.from_asset("../lambdas/notifications"),
            role=lambda_role,
            environment=environment,
            layers=[self.lambda_layer],
            timeout=Duration.seconds(30)
        )

        # API Gateway integrations for notifications
        self.notifications_resource.add_method("GET", apigateway.LambdaIntegration(self.get_notifications_function),
                                              authorization_type=apigateway.AuthorizationType.COGNITO,
                                              authorizer=self.cognito_authorizer)
        self.notification_by_id_resource.add_method("PATCH", apigateway.LambdaIntegration(self.mark_notification_read_function),
                                                   authorization_type=apigateway.AuthorizationType.COGNITO,
                                                   authorizer=self.cognito_authorizer)
        self.mark_all_read_resource.add_method("PATCH", apigateway.LambdaIntegration(self.mark_all_notifications_read_function),
                                              authorization_type=apigateway.AuthorizationType.COGNITO,
                                              authorizer=self.cognito_authorizer)

    def _create_outputs(self):
        """Create CloudFormation outputs for frontend configuration"""
        
        # API Gateway URL
        CfnOutput(self, "ApiUrl",
                  value=self.api.url,
                  description="API Gateway URL for the music streaming app",
                  export_name="MusicStreamingApiUrl")
        
        # Cognito User Pool ID
        CfnOutput(self, "CognitoUserPoolId",
                  value=self.user_pool.user_pool_id,
                  description="Cognito User Pool ID",
                  export_name="MusicStreamingUserPoolId")
        
        # Cognito User Pool Client ID
        CfnOutput(self, "CognitoUserPoolClientId",
                  value=self.user_pool_client.user_pool_client_id,
                  description="Cognito User Pool Client ID",
                  export_name="MusicStreamingUserPoolClientId")
        
        # S3 Media Bucket Name
        CfnOutput(self, "S3MediaBucketName",
                  value=self.media_bucket.bucket_name,
                  description="S3 bucket for media files",
                  export_name="MusicStreamingMediaBucket")
        
        # S3 Images Bucket Name
        CfnOutput(self, "S3ImagesBucketName",
                  value=self.images_bucket.bucket_name,
                  description="S3 bucket for image files",
                  export_name="MusicStreamingImagesBucket")
        
        # SNS Topic ARN
        CfnOutput(self, "SNSTopicArn",
                  value=self.notification_topic.topic_arn,
                  description="SNS Topic ARN for notifications",
                  export_name="MusicStreamingSNSTopic")
        
        # AWS Region
        CfnOutput(self, "AWSRegion",
                  value=self.region,
                  description="AWS Region where resources are deployed",
                  export_name="MusicStreamingRegion")
