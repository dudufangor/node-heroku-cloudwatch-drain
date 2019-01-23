"use strict";

require('log-timestamp');

class CloudWatchPusher {
  constructor(cloudWatchInstance, group, stream) {
    this.cloudWatchInstance = cloudWatchInstance;
    this.group = group;
    this.stream = stream;
    this.sequenceToken = null;
    this.lastPushCompleted = true;
  }

  isLocked() {
    return !this.lastPushCompleted;
  }

  async tricklePush (messages) {
    do {
      let batch = messages.splice(0, 150)
      console.log(`Sub-batch pushing... ${batch.length} messages`)
      await this.push(batch, true);
    } while (messages.length >= 1);

    this.lastPushCompleted = true;
  }

  push(messages, subBatch) {
    const params = {
      logEvents: messages.concat([]),
      logGroupName: this.group,
      logStreamName: this.stream,
      sequenceToken: this.sequenceToken,
    };

    this.lastPushCompleted = false;

    return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
      if (!subBatch) {
        this.lastPushCompleted = true;
      }

      this.sequenceToken = data.nextSequenceToken;
    }, error => {
      console.log(`Error pushing to CloudWatch... Sub-batch?: ${!!subBatch}`);

      console.log(error);

      if (error.code == 'InvalidParameterException' || error.statusCode == 413) {
        console.log('Will divide the current batch in smaller ones!');
        this.tricklePush(messages);
      } else if (error.code == 'InvalidSequenceTokenException') {
        this.sequenceToken = error.message.match(/(?:sequenceToken\sis:\s)(.+$)/)[1];
        this.push(messages, subBatch);
      } else {
        this.push(messages, subBatch);
      };
    });
  }
}

module.exports = CloudWatchPusher;
