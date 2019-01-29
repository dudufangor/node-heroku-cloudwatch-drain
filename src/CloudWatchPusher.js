"use strict";

require('log-timestamp');

class CloudWatchPusher {
  constructor(cloudWatchInstance, group, stream, debug) {
    this.cloudWatchInstance = cloudWatchInstance;

    this.pushed = 0;

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

  async tricklePush (messages, batchSize) {
    do {
      let batch = messages.splice(0, batchSize)
      this.debugBuffer.addLog(`Sub-batch pushing... ${batch.length} messages`);
      await this.push(batch, true);
    } while (messages.length >= 1);

    this.lastPushCompleted = true;
  }

  debugPush() {
    let batch = this.debugBuffer.getMessagesBatch();


    if (this.debugBuffer.isBatchReady() && !this.debugIsLocked()) {
      this.lastDebugPushCompleted = false;

      const params = {
        logEvents: batch.concat([]),
        logGroupName: this.debugGroup,
        logStreamName: this.debugStream,
        sequenceToken: this.debugSequenceToken
      };

      return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
        this.debugSequenceToken = data.nextSequenceToken;
        this.lastDebugPushCompleted = true;
        this.debugBuffer.clearMessagesBatch();
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

      this.pushed += messages.length;

      this.debugPush();
    }, async error => {

      this.debugBuffer.addLog(`Error pushing to CloudWatch... Sub-batch?: ${!!subBatch}`);
      this.debugBuffer.addLog(JSON.stringify(error));

      if (error.code == 'InvalidParameterException' || error.statusCode == 413) {
        let longest = messages.reduce((a, b) => {
          return a.message.length > b.message.length ? a : b;
        });

        this.debugBuffer.addLog('Will divide the current batch in smaller ones!');
        this.debugBuffer.addLog(`Longest record: [${longest.message}]`);

        this.tricklePush(messages, 50);

        this.debugPush();
      } else {

        this.debugBuffer.addLog(`Token tried: ${this.sequenceToken}`);
        this.debugBuffer.addLog('Will try again...');

        this.debugPush();

        await this.push(messages, subBatch);
      };
    });
  }
}

module.exports = CloudWatchPusher;
