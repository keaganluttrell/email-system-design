#! /bin/bash

# Step 1
# Push a campaign candidate json file to s3 to schedule a campaign

# s3 uri is the location for the candidates
s3_uri1="s3://example-email-service/candidates/"
s3_uri2="s3://example-email-service/campaigns/"

# file takes a json file of with a schema found in "schema.jsonc"
# examples are found in candidates folder
file="01-candidate/candidates/test-set-1.json"
name="test-set-1.json"
campaign="test-campaign-1.json"

# rm old file in s3 if exists
aws s3 rm ${s3_uri1}${name}
aws s3 rm ${s3_uri2}${campaign}

# cmd to send file to s3
aws s3 cp ${file} ${s3_uri1}

# once file is sent to s3 an action is taken to process your candidate
# a sns notification should be sent to slack #example-email-service channel

echo $(date)