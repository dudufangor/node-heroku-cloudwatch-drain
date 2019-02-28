"use strict";

const path = require("path");

const fileFromArgument = process.argv[2];

require('log-timestamp');

const NumberHelpers = require("number_helpers");

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

const LOG_STREAM = `${config.logStreamPrefix}-${new Date().toISOString().replace(/:|\./gi, '_')}`;

const DEBUG_LOG_STREAM_NAME = `debug-${new Date().toISOString().replace(/:|\./gi, '_')}`;
const DEBUG_LOG_GROUP_NAME = 'Drain'

const setupWebServer = require("./setupExpress")(config.accessToken);
const setupCloudWatch = require("./setupCloudWatch");
const MessagesBuffer = require("./MessagesBuffer");
const CloudWatchPusher = require("./CloudWatchPusher");
const parseMetrics = require("./parseMetrics");

const debugBuffer = new MessagesBuffer([], 10, true);
const buffer = new MessagesBuffer(config.filters, config.batchSize);
const pusher = new CloudWatchPusher(cloudWatchLogsInstance, config.logGroup, LOG_STREAM, {streamName: DEBUG_LOG_STREAM_NAME, groupName: DEBUG_LOG_GROUP_NAME, buffer: debugBuffer});

let lastPushedTime = 0;
let lastOutput = 0;


const prettyNumber = (number) => {
	return NumberHelpers.number_to_human(number, {precision: 4});
};

const logProgress = () => {
	if ((Date.now() - lastOutput) >= 1000) {
		debugBuffer.addLog(
			`Pushed: ${prettyNumber(pusher.pushed)}, Enqueued: ${prettyNumber(buffer.messages.length)}`,
			{ total_pushed: pusher.pushed, enqueued: buffer.messages.length }
		);

		lastOutput = Date.now();
	}
};

const app = setupWebServer(function(line) {
	buffer.addLog(line);

	let batch = buffer.getMessagesBatch();

	logProgress();

	if (buffer.isBatchReady() && !pusher.isLocked()) {
		pusher.lastPushCompleted = false;

		pusher.push(batch);

		buffer.clearMessagesBatch();

		lastPushedTime = Date.now();
	}
});

setupCloudWatch(cloudWatchLogsInstance, config.logGroup, LOG_STREAM, {streamName: DEBUG_LOG_STREAM_NAME, groupName: DEBUG_LOG_GROUP_NAME})
	.then(() => {
		app.listen(config.serverPort, () => console.log(`Server up on port ${config.serverPort}`));
	})
	.catch(error => console.log(error));
