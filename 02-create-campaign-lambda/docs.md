# Infrastructure

## S3
**S3 Bucket**: `example-email-service`

**S3 URI**: `s3://example-email-service/candidates/`

## Invokes

**CreateCampaignLambda**: Validates Candidate and Creates Campaign

## Creates

**S3 Object**: `s3://example-email-service/campaigns/`

**EventBridgeRule**: Start date of the campaign
- triggers [Publish to SQS Lambda](../03-publish-campaign-to-sqs-lambda/docs.md)

## Notification Success/Fail

**Campaign Created SNS Topic Name**: notify-sre
