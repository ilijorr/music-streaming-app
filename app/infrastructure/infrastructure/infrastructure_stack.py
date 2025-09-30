from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    aws_s3 as s3,
    aws_dynamodb as dynamodb,
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
            auto_delete_objects=True,  # Automatically delete objects on bucket deletion
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
