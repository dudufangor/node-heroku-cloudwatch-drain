"use strict";

require('log-timestamp');

function getLogGroup(cloudwatchlogs, name) {
	return cloudwatchlogs
		.describeLogGroups({
			logGroupNamePrefix: name,
		})
		.promise()
		.then(info => {
			return info.logGroups.find(logGroup => logGroup.logGroupName === name);
		});
}

function createLogGroup(cloudwatchlogs, name) {
	return cloudwatchlogs
		.createLogGroup({
			logGroupName: name,
		})
		.promise();
}

function createLogStream(cloudwatchlogs, group, stream) {
	return cloudwatchlogs
		.createLogStream({
			logGroupName: group,
			logStreamName: stream,
		})
		.promise();
}

function debugSetup(cloudwatchlogs, groupName, streamName) {
	return getLogGroup(cloudwatchlogs, groupName)
		.then(logGroup => {
			if (!logGroup) {
				return createLogGroup(cloudwatchlogs, groupName);
			}
		})
		.then(() => {
			return createLogStream(cloudwatchlogs, groupName, streamName);
		});
}

function setup(cloudwatchlogs, groupName, streamName, debug) {
	debugSetup(cloudwatchlogs, debug.groupName, debug.streamName);

	return getLogGroup(cloudwatchlogs, groupName)
		.then(logGroup => {
			if (!logGroup) {
				return createLogGroup(cloudwatchlogs, groupName);
			}
		})
		.then(() => {
			return createLogStream(cloudwatchlogs, groupName, streamName);
		});
}

module.exports = setup;
module.exports.getLogGroup = getLogGroup;
module.exports.createLogGroup = createLogGroup;
module.exports.createLogStream = createLogStream;
