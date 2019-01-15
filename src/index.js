"use strict";

const path = require("path");

const fileFromArgument = process.argv[2];

require('log-timestamp');

if (!fileFromArgument) {
	console.error(
		"Please specify config file: \n Example: $ node-heroku-cloudwatch-drain config.js"
	);
	return process.exit(1);
}

let config;

try {
	config = require(path.resolve(process.cwd(), process.argv[2]));
} catch (e) {
	console.log("Invalid config file.");
	return process.exit(1);
}

const AWS = require("aws-sdk");
AWS.config.update({ region: config.awsCredentials.region });
const cloudWatchLogsInstance = new AWS.CloudWatchLogs();
const cloudWatchInstance = new AWS.CloudWatch();

const LOG_STREAM = config.logStreamPrefix + Math.random().toString().substr(2);

const setupWebServer = require("./setupExpress")(config.accessToken);
const setupCloudWatch = require("./setupCloudWatch");
const MessagesBuffer = require("./MessagesBuffer");
const CloudWatchPusher = require("./CloudWatchPusher");
const parseMetrics = require("./parseMetrics");

const buffer = new MessagesBuffer(config.filters, config.batchSize);
const pusher = new CloudWatchPusher(cloudWatchLogsInstance, config.logGroup, LOG_STREAM);

let lastPushedTime = 0;
let lastPushedMessages = 0;
let pushedMessages = 0;
let lastOutput = 0;

const app = setupWebServer(function(line) {
	buffer.addLog(line);

	let batch = buffer.getMessagesBatch();

	if (buffer.isBatchReady() && !pusher.isLocked()) {
		if ((Date.now() - lastOutput) >= 60000) {
			lastPushedMessages = pushedMessages;

			console.log(`${pushedMessages} pushed to CloudWatch | ${buffer.messages.length} messages enqueued`);
			console.log(`Throughtput is ${pushedMessages-lastPushedMessages} messages per minute.`);

			lastOutput = Date.now();
		}

		pusher.push(batch);

		pushedMessages += buffer.messagesBatch.length

		buffer.clearMessagesBatch();

		lastPushedTime = Date.now();
	}
});

setupCloudWatch(cloudWatchLogsInstance, config.logGroup, LOG_STREAM)
	.then(() => {
		app.listen(config.serverPort, () => console.log(`Server up on port ${config.serverPort}`));
	})
	.catch(error => console.log(error));
