import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { SnsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

export class CreateCampaignLambdaStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const env = props?.env;
		// lambda name
		const createCampaignLambdaName = "create-campaign-lambda";

		// resolve s3 bucket
		const bucketName = "example-email-service";
		const candidatesPrefix = "candidates";
		const campaignPrefix = "campaigns";
		const bucket = s3.Bucket.fromBucketName(
			this,
			"get-candidate-bucket",
			bucketName,
		);

		//==========================
		// Developement Purposes -- change notification to a production setup
		//==========================
		// resovle sns topic
		const topicName = "notify-sre";
		const notifySREtopic = sns.Topic.fromTopicArn(
			this,
			"get-candidate-topic",
			`arn:aws:sns:${env?.region}:${env?.account}:${topicName}`,
		);

		// create log group
		const logGroup = new logs.LogGroup(
			this,
			createCampaignLambdaName + "-log-group",
			{
				logGroupName: "/aws/lambda/" + createCampaignLambdaName,
				retention: logs.RetentionDays.ONE_WEEK, // Set the log retention period
				removalPolicy: cdk.RemovalPolicy.DESTROY, // Set the removal policy
			},
		);

		// create iam policies
		const lambdaS3ListPolicy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ["s3:ListBucket"],
			resources: [
				bucket.bucketArn,
				bucket.bucketArn + "/" + candidatesPrefix,
				bucket.bucketArn + "/" + campaignPrefix,
				bucket.bucketArn + "/" + candidatesPrefix + "/*",
				bucket.bucketArn + "/" + campaignPrefix + "/*",
			],
		});

		const lambdaS3GetPolicy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ["s3:GetObject"],
			resources: [
				bucket.bucketArn + "/" + candidatesPrefix,
				bucket.bucketArn + "/" + candidatesPrefix + "/*",
			],
		});

		const lambdaS3PushPolicy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ["s3:PutObject"],
			resources: [bucket.bucketArn + "/" + campaignPrefix + "/*"],
		});

		const lambdaLogPolicy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
				"logs:CreateLogGroup",
				"logs:CreateLogStream",
				"logs:PutLogEvents",
			],
			resources: [logGroup.logGroupArn],
		});

		const createEventBridgeRulePolicy = new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ["events:PutRule", "events:PutTargets"],
			resources: ["*"],
		});

		// create lambda role
		const role = new iam.Role(this, createCampaignLambdaName + "-role", {
			assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
		});

		// add policies to role
		role.addToPolicy(lambdaS3ListPolicy);
		role.addToPolicy(lambdaS3GetPolicy);
		role.addToPolicy(lambdaS3PushPolicy);
		role.addToPolicy(lambdaLogPolicy);
		role.addToPolicy(createEventBridgeRulePolicy);

		// create lambda to read from s3 bucket
		const createCampaignLambda = new lambda.Function(
			this,
			createCampaignLambdaName,
			{
				functionName: createCampaignLambdaName,
				runtime: lambda.Runtime.NODEJS_20_X,
				handler: "index.handler",
				code: lambda.Code.fromAsset("../02-create-campaign-lambda/dist"),
				role: role,
				environment: {
					BUCKET: bucketName,
					CANDIDATE_PREFIX: candidatesPrefix,
					CAMPAIGN_PREFIX: campaignPrefix,
					// TODO: Add PublishToSQSLambdaArn Here, see if you can get it from cdk.out
					// PUBLISH_LAMBDA_ARN: PublishToSQSLambda.Arn or whatever
				},
				
				//==========================
				// Developement Purposes -- change notification to a production setup
				//==========================
				onSuccess: new SnsDestination(notifySREtopic),
				onFailure: new SnsDestination(notifySREtopic),
				logGroup: logGroup,
			},
		);

		// create trigger for createCampaignLambda
		// invoke lambda from s3 object created event
		bucket.addEventNotification(
			s3.EventType.OBJECT_CREATED,
			new cdk.aws_s3_notifications.LambdaDestination(createCampaignLambda),
			{ suffix: ".json", prefix: "candidates/" },
		);
	}
}
