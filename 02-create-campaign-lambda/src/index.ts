import { S3Event, S3EventRecord, Context } from "aws-lambda";
import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
	EventBridgeClient,
	PutRuleCommand,
	PutRuleCommandInput,
	PutTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import { SendEmailCommandInput } from "@aws-sdk/client-sesv2";

//============================================
// BASIC TYPES
type Recipient = {
	email: string;
	[key: string]: any;
};

type Segment = {
	list_name: string;
	recipients: Recipient[];
};

type CandidateSchema = {
	campaign_id: string;
	date: string;
	template_s3_uri: string;
	segments: Segment[];
};

type CampaignSchema = SendEmailCommandInput[];

type Cron = {
	minutes: string;
	hours: string;
	dayOfMonth: string;
	month: string;
	dayOfWeek: string;
	year: string;
};

//============================================

export const handler = async (
	event: S3Event,
	context: Context,
): Promise<void> => {
	// console.log("Received event:", JSON.stringify(event, null, 2));

	const configObject = { region: process.env.AWS_REGION };
	const s3Client = new S3Client(configObject);
	const eventClient = new EventBridgeClient(configObject);

	for (const record of event.Records) {
		const candidate = await processS3Event(s3Client, record);
		const { date, campaign_id } = candidate;
		await createCampaign(s3Client, candidate);
		await createEventBridgeRule(eventClient, campaign_id, date);
	}
};

async function createCampaign(s3Client: S3Client, candidate: CandidateSchema) {
	const campaignBucket = process.env.BUCKET;
	const campaignPrefix = process.env.CAMPAIGN_PREFIX;

	console.log("CANDIDATE", candidate);
	console.log("--->env:", campaignBucket, campaignPrefix);
	const campaign_id: string = candidate.campaign_id;
	const campaign_file_name = `${campaign_id}.json`;

	const campaign: CampaignSchema = createSimpleCampaign();

	try {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: campaignBucket,
				Key: `${campaignPrefix}/${campaign_file_name}`,
				Body: JSON.stringify(campaign),
			}),
		);
	} catch (err) {
		console.error("Error creating campaign:", err);
		throw err;
	}
}

function createSimpleCampaign(): SendEmailCommandInput[] {
	const recipients = [
		{ toAddress: "user3@example.com", fname: "user3" },
		{ toAddress: "user2@example.com", fname: "user2" },
		{ toAddress: "user1@example.com", fname: "user1" },
	];

	const campaign_id: string = "test-campaign-1";
	const campaign_date: string = "";
	const list_name: string = "sre-list";
	const FromEmailAddress: string = "sre@example.com";
	const TemplateName: string = "test2";
	const ConfigurationSetName = "sre-test-config-set";
	const campaingIdTag = {
		Name: "campaign_id",
		Value: campaign_id,
	};
	const listNameTag = {
		Name: "list_name",
		Value: list_name,
	};

	const campaign: SendEmailCommandInput[] = [];

	for (const recipient of recipients) {
		campaign.push({
			Destination: {
				ToAddresses: [recipient.toAddress],
			},
			FromEmailAddress: FromEmailAddress,
			Content: {
				Template: {
					TemplateName: TemplateName,
					TemplateData: `{"fname": "${recipient.fname}"}`,
				},
			},
			ConfigurationSetName: ConfigurationSetName,
			EmailTags: [campaingIdTag, listNameTag],
		});
	}
	return campaign;
}

async function processS3Event(
	s3Client: S3Client,
	record: S3EventRecord,
): Promise<CandidateSchema> {
	const { bucket, object } = record.s3;

	try {
		const getObjectCommand = new GetObjectCommand({
			Bucket: bucket.name,
			Key: object.key,
		});
		const response = await s3Client.send(getObjectCommand);
		console.log(
			`Content type of object ${object.key} is ${response.ContentType}`,
		);
		const body = await response.Body?.transformToString();
		const candidate: CandidateSchema = JSON.parse(body || "{}");
		return candidate;
	} catch (err) {
		console.error(
			`Error getting object ${object.key} from bucket ${bucket.name}. Make sure they exist and your bucket is in the same region as this function.`,
			err,
		);
		throw err;
	}
}

function dateToCronExpression(date: string): string {
	const utcDate = new Date(date).toISOString();

	console.log("utc", utcDate);

	const cron: Cron = {
		minutes: "*",
		hours: "*",
		dayOfMonth: "*",
		month: "*",
		dayOfWeek: "?",
		year: "*",
	};

	const yy_mm_dd = utcDate.split("T")[0];
	cron.year = yy_mm_dd.split("-")[0];
	cron.month = yy_mm_dd.split("-")[1];
	cron.dayOfMonth = yy_mm_dd.split("-")[2];

	const hh_mm_ss = utcDate.split("T")[1].split(":");
	cron.hours = hh_mm_ss[0];
	cron.minutes = hh_mm_ss[1];

	console.log(cron);
	return `cron(${cron.minutes} ${cron.hours} ${cron.dayOfMonth} ${cron.month} ${cron.dayOfWeek} ${cron.year})`;
}

async function createEventBridgeRule(
	eventClient: EventBridgeClient,
	campaignId: string,
	campaignDate: string,
): Promise<void> {
	const ruleName = `${campaignId}-rule`;
	const ScheduleExpression = dateToCronExpression(campaignDate);
	const input: PutRuleCommandInput = {
		Name: ruleName + "-start-rule",
		EventBusName: "default",
		Description:
			"Kickoff Campagin: '" +
			campaignId +
			"'.  See targets determine the lambda this invokes.",
		ScheduleExpression: ScheduleExpression,
		State: "ENABLED",
	};
	const cmd = new PutRuleCommand(input);
	await eventClient.send(cmd);
}

async function addPublsihLambdaToRule(
	eventClient: EventBridgeClient,
	ruleName: string,
): Promise<void> {
	// TODO 
	// const lambdaArn: process.env.PUBLISH_LAMBDA_ARN

	// create target from lambda arn above
}
