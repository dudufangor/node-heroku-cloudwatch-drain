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
    this.lastRecordPushed = null;
  }

  isLocked() {
    return !this.lastPushCompleted;
  }

  debugIsLocked() {
    return !this.lastDebugPushCompleted;
  }

  // async tricklePush (messages, batchSize, noComplete) {
  //   do {
  //     let batch = messages.splice(0, batchSize)
  //     this.debugBuffer.addLog(`Sub-batch pushing... ${batch.length} messages`);
  //     await this.push(batch, true);
  //   } while (messages.length >= 1);
  //   if (!noComplete) {
  //     this.lastPushCompleted = true;
  //   }
  // }

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

  push(messages, callback) {
    this.lastPushCompleted = false;

    const params = {
      logEvents: messages.concat([]),
      logGroupName: this.group,
      logStreamName: this.stream,
      sequenceToken: this.sequenceToken,
    };

    return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
      this.sequenceToken = data.nextSequenceToken;
      this.pushed += messages.length;
      this.lastRecordPushed = messages.slice(-1)[0];
      this.debugPush();

      this.lastPushCompleted = true;
    }, error => {

      this.debugBuffer.addLog(`Error pushing to CloudWatch...`);
      this.debugBuffer.addLog(JSON.stringify(error));

      if (error.code == 'DataAlreadyAcceptedException') {
        console.log('-\n\n-');

        this.debugBuffer.addLog(`Batch already pushed, skipping...`);
        this.debugBuffer.addLog(`Last record on previous batch: ${JSON.stringify(this.lastRecordPushed)}`)
        this.debugBuffer.addLog('-\n-')
        this.debugBuffer.addLog(`Last record on this failed batch: ${JSON.stringify(messages.slice(-1)[0])}`)

        this.debugBuffer.addLog('\n\n');

        callback();

        this.lastPushCompleted = true;

        this.debugPush();
      } else {
        this.debugBuffer.addLog(`Token tried: ${this.sequenceToken}`);
        this.debugBuffer.addLog('Will try again...');

        this.debugPush();

        this.push(messages);
      };
    });
  }
}

module.exports = CloudWatchPusher;
