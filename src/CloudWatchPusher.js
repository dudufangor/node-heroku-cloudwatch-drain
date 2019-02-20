"use strict";

require('log-timestamp');
const fs = require('fs');

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

    this.lastBatchPushed = null;
    this.lastSequenceTokenUsed = null;
  }

  isLocked() {
    return !this.lastPushCompleted;
  }

  debugIsLocked() {
    return !this.lastDebugPushCompleted;
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

  writeToFile(line) {
    fs.appendFileSync('/home/ubuntu/failed_batches.log', line);
  };

  push(messages, prioritySequenceToken) {
    this.lastPushCompleted = false;

    const params = {
      logEvents: messages.concat([]),
      logGroupName: this.group,
      logStreamName: this.stream,
      sequenceToken: (prioritySequenceToken || this.sequenceToken),
    };

    return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
      this.lastBatchPushed = messages;
      this.lastSequenceTokenUsed = this.sequenceToken;

      this.sequenceToken = data.nextSequenceToken;
      this.pushed += messages.length;

      this.debugPush();

      this.lastPushCompleted = true;
    }, error => {

      this.debugBuffer.addLog(`Error pushing to CloudWatch...`);
      this.debugBuffer.addLog(JSON.stringify(error));

      switch(error.code) {
        case 'DataAlreadyAcceptedException':
          this.debugBuffer.addLog(`Batch already pushed, skipping...`);

          this.writeToFile('\n\n\n\n\n\n\n\n');
          this.writeToFile('### Batch already accepted by CloudWatch ###');
          this.writeToFile(`With sequence token ${this.sequenceToken} the following batch was denied:`);
          this.writeToFile('\n\n');

          for (let message of messages) {
            this.writeToFile(message.message)
          };

          this.writeToFile('\n-----------------------------------------------------------------------------\n');

          this.writeToFile(`The previous batch was sent with sequence token ${this.lastSequenceTokenUsed}, the previous batch was:`);

          for (let message of this.lastBatchPushed) {
            this.writeToFile(message.message)
          };

          this.lastPushCompleted = true;

          this.debugPush();

          break;
        case 'InvalidSequenceTokenException':
          prioritySequenceToken = error.message.match(/(?:sequenceToken\sis:\s)(.+$)/)[1];

          this.debugBuffer.addLog(`Will try again with token: ${prioritySequenceToken}`);

          this.debugPush();

          this.push(messages, prioritySequenceToken);

          break;
        default:
          this.debugBuffer.addLog(`Token tried: ${this.sequenceToken}`);
          this.debugBuffer.addLog('Will try again...');

          this.debugPush();

          this.push(messages);
      }
    });
  }
}

module.exports = CloudWatchPusher;
