"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
//============================================
const handler = async (event, context) => {
    // console.log("Received event:", JSON.stringify(event, null, 2));
    const configObject = { region: process.env.AWS_REGION };
    const s3Client = new client_s3_1.S3Client(configObject);
    const eventClient = new client_eventbridge_1.EventBridgeClient(configObject);
    for (const record of event.Records) {
        const candidate = await processS3Event(s3Client, record);
        const { date, campaign_id } = candidate;
        await createCampaign(s3Client, candidate);
        await createEventBridgeRule(eventClient, campaign_id, date);
    }
};
exports.handler = handler;
async function createCampaign(s3Client, candidate) {
    const campaignBucket = process.env.BUCKET;
    const campaignPrefix = process.env.CAMPAIGN_PREFIX;
    console.log("CANDIDATE", candidate);
    console.log("--->env:", campaignBucket, campaignPrefix);
    const campaign_id = candidate.campaign_id;
    const campaign_file_name = `${campaign_id}.json`;
    const campaign = createSimpleCampaign();
    try {
        await s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: campaignBucket,
            Key: `${campaignPrefix}/${campaign_file_name}`,
            Body: JSON.stringify(campaign),
        }));
    }
    catch (err) {
        console.error("Error creating campaign:", err);
        throw err;
    }
}
function createSimpleCampaign() {
    const recipients = [
        { toAddress: "user3@example.com", fname: "user3" },
        { toAddress: "user2@example.com", fname: "user2" },
        { toAddress: "user1@example.com", fname: "user1" },
    ];
    const campaign_id = "test-campaign-1";
    const campaign_date = "";
    const list_name = "sre-list";
    const FromEmailAddress = "sre@example.com";
    const TemplateName = "test2";
    const ConfigurationSetName = "sre-test-config-set";
    const campaingIdTag = {
        Name: "campaign_id",
        Value: campaign_id,
    };
    const listNameTag = {
        Name: "list_name",
        Value: list_name,
    };
    const campaign = [];
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
async function processS3Event(s3Client, record) {
    const { bucket, object } = record.s3;
    try {
        const getObjectCommand = new client_s3_1.GetObjectCommand({
            Bucket: bucket.name,
            Key: object.key,
        });
        const response = await s3Client.send(getObjectCommand);
        console.log(`Content type of object ${object.key} is ${response.ContentType}`);
        const body = await response.Body?.transformToString();
        const candidate = JSON.parse(body || "{}");
        return candidate;
    }
    catch (err) {
        console.error(`Error getting object ${object.key} from bucket ${bucket.name}. Make sure they exist and your bucket is in the same region as this function.`, err);
        throw err;
    }
}
function dateToCronExpression(date) {
    const utcDate = new Date(date).toISOString();
    console.log("utc", utcDate);
    const cron = {
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
async function createEventBridgeRule(eventClient, campaignId, campaignDate) {
    const ruleName = `${campaignId}-rule`;
    const ScheduleExpression = dateToCronExpression(campaignDate);
    const input = {
        Name: ruleName + "-start-rule",
        EventBusName: "default",
        Description: "Kickoff Campagin: '" +
            campaignId +
            "'.  See targets determine the lambda this invokes.",
        ScheduleExpression: ScheduleExpression,
        State: "ENABLED",
    };
    const cmd = new client_eventbridge_1.PutRuleCommand(input);
    await eventClient.send(cmd);
}
