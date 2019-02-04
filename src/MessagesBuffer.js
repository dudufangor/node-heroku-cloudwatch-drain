require('log-timestamp');

function isValid(log, filters, lastOutput) {
  if (!log || !log.trim()) {
    return { res: false, lou:  lastOutput };
  }

  for (let filter of filters) {
    if (filters.test(log)) {
      let rOb = { res: false };

      if ((Date.now() - lastOutput) >= 1000) {
        rOb.lou = Date.now()
        console.log('Invalid record.');
        console.log(log);
      }

      return rOb;
    }
  }

  return { res: true, lou:  lastOutput };
}

class MessagesBuffer {
  constructor(filters, batchSize, debug) {
    this.messages = [];
    this.filters = filters || [];
    this.batchSize = batchSize;
    this.messagesBatch = [];
    this.debug = debug;
    this.lastOutput = 0;
  }

  queueAge() {
    try {
      return Date.now() - this.messages[this.getMessagesCount() - 1].timestamp;
    } catch(e) {
      return 0;
    }
  }

  getMessagesCount() {
    return this.messages.length;
  }

  clearMessages() {
    this.messages = [];
  }

  clearMessagesBatch() {
    this.messagesBatch = [];
  }

  isBatchReady() {
    if (this.messagesSize() >= 500) {
      return true;
    }

    if (this.messagesBatch.length >= this.batchSize) {
      return true;
    }

    if (this.messagesBatch.length >= 1 && this.messages.length < 1) {
      return true;
    }

    return false;
  }

  shouldFillBatch() {
    if (this.getMessagesCount() >= this.batchSize && !this.isBatchReady()) {
      return true;
    };


    if (!this.isBatchReady() && this.queueAge() >= 2000) {
      return true;
    }

    return false;
  }

  getMessagesBatch() {
    if (!this.isBatchReady()) {
      this.fillInBatch();
    }

    return this.messagesBatch;
  }

  getMessageSize(message) {
    return message.message.length;
  }

  messagesSize() {
    var sizeEstimate = 0;

    for (let message of this.messagesBatch) {
      sizeEstimate += 26 + this.getMessageSize(message);
    };

    return sizeEstimate;
  }

  maxBatchSize() {
    var batchCount = 1;
    var sizeEstimate = 0;

    for (let message of this.messages) {
      sizeEstimate += 26 + this.getMessageSize(message);

      if (batchCount >= this.batchSize) {
        break;
      }

      if (sizeEstimate >= 900000) {
        break;
      };

      batchCount += 1;
    };

    return batchCount;
  };

  fillInBatch() {
    if (this.shouldFillBatch()) {
      this.messagesBatch = this.messages.splice(0, this.maxBatchSize());
    };
  }

  addLog(log) {
    let validEntry = isValid(log, this.filters, this.lastOutput)

    this.lastOutput = validEntry.lou;

    if (validEntry.res) {
      if (this.debug) {
        console.log(log);
      };

      this.messages.push({
        timestamp: Date.now(),
        message: log.trim(),
      });
    }
  }
}

module.exports = MessagesBuffer;
module.exports.isValid = isValid;
