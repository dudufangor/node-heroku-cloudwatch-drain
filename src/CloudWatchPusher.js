"use strict";

require('log-timestamp');

class CloudWatchPusher {
  constructor(cloudWatchInstance, group, stream, debug) {
    this.cloudWatchInstance = cloudWatchInstance;

    this.group = group;
    this.stream = stream;
    this.sequenceToken = null;
    this.lastPushCompleted = true;

    this.debugBuffer = debug.buffer;
    this.debugGroup = debug.groupName;
    this.debugStream = debug.streamName;
    this.lastDebugPushCompleted = true;
    this.debugSequenceToken = null;
  }

  isLocked() {
    return !this.lastPushCompleted;
  }

  debugIsLocked() {
    return !this.lastDebugPushCompleted;
  }

  async tricklePush (messages) {
    do {
      let batch = messages.splice(0, 150)
      console.log(`Sub-batch pushing... ${batch.length} messages`)
      debugBuffer.addLog(`Sub-batch pushing... ${batch.length} messages`);
      await this.push(batch, true);
    } while (messages.length >= 1);

    this.lastPushCompleted = true;
  }

  debugPush(messages) {
    let batch = debugBuffer.getMessagesBatch();

    if (debugBuffer.isBatchReady() && !debugBuffer.debugIsLocked()) {
      this.lastDebugPushCompleted = false;

      const params = {
        logEvents: messages.concat([]),
        logGroupName: this.debugGroup,
        logStreamName: this.debugStream,
        sequenceToken: this.debugSequenceToken
      };

      return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
        this.debugSequenceToken = data.nextSequenceToken;
        this.lastDebugPushCompleted = true;
      }, error => {
        console.log(`Error pushing to CloudWatch... !!!Debug!!!`);
        console.log(error);
      });
    }
  }

  async push(messages, subBatch) {
    this.lastPushCompleted = false;

    const params = {
      logEvents: messages.concat([]),
      logGroupName: this.group,
      logStreamName: this.stream,
      sequenceToken: this.sequenceToken,
    };

    return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
      this.sequenceToken = data.nextSequenceToken;

      if (!subBatch) {
        this.lastPushCompleted = true;
      }
    }, async error => {
      console.log(`Error pushing to CloudWatch... Sub-batch?: ${!!subBatch}`);

      debugBuffer.addLog(`Error pushing to CloudWatch... Sub-batch?: ${!!subBatch}`);

      console.log(error);

      debugBuffer.addLog(JSON.stringify(error));

      if (error.code == 'InvalidParameterException' || error.statusCode == 413) {
        console.log('Will divide the current batch in smaller ones!');
        debugBuffer.addLog('Will divide the current batch in smaller ones!');
        this.tricklePush(messages);
      } else {
        console.log(`Token tried: ${this.sequenceToken}`);

        debugBuffer.addLog(`Token tried: ${this.sequenceToken}`);

        console.log('Will try again...')

        debugBuffer.addLog('Will try again...');

        await this.push(messages, subBatch);
      };
    });
  }
}

module.exports = CloudWatchPusher;
