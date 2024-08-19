const fs = require("fs");
const subject = "Hi {{fname}}, this is a test email for AWS SES!";
const text = "Hi {{fname}}, this is a test email for AWS SES!";
const html = fs.readFileSync("test.html", "utf-8");

const o = {
	TemplateName: "test1",
	TemplateContent: {
		Subject: subject,
		Text: text,
		Html: html,
	},
};

fs.writeFileSync("x.json", JSON.stringify(o));
