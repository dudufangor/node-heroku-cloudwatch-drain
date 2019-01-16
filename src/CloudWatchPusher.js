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

  tricklePush (messages) {
    do {
      let batch = messages.splice(0, 50)
      console.log(`Sub-batch pushing... ${batch.length} messages`)
      this.push(batch);
    } while (messages.length >= 1);
  }

  push(messages) {
    const params = {
      logEvents: messages.concat([]),
      logGroupName: this.group,
      logStreamName: this.stream,
      sequenceToken: this.sequenceToken,
    };

    this.lastPushCompleted = false;

    return this.cloudWatchInstance.putLogEvents(params).promise().then(data => {
      this.lastPushCompleted = true;
      this.sequenceToken = data.nextSequenceToken;
    }, error => {
      console.log('Error pushing to CloudWatch...');
      console.log(error);
      console.log('Will divide the current batch in smaller ones!');
      this.tricklePush(messages);
    });
  }
}

module.exports = CloudWatchPusher;
