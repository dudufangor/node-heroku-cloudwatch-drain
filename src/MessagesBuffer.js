require('log-timestamp');

function isValid(log, filters) {
  if (!log || !log.trim()) {
    return false;
  }

  for (let i = 0; i < filters.length; i++) {
    if (filters[i].test(log)) {
      return false;
    }
  }

  return true;
}

class MessagesBuffer {
  constructor(filters, batchSize, debug) {
    this.messages = [];
    this.filters = filters || [];
    this.batchSize = batchSize;
    this.messagesBatch = [];
    this.maxedBytesSize = false;
    this.debug = debug;
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
    this.maxedBytesSize = false;
  }

  isBatchReady() {
    if (this.maxedBytesSize) {
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
    message.message.length
  }

  messagesSize() {
    var sizeEstimate = 0;

    for (let message of this.messages) {
      sizeEstimate += 26 + this.getMessageSize(message);
    };

    return sizeEstimate;
  }

  maxBatchSize() {
    var batchCount = 1;
    var sizeEstimate = 0;

    for (let message of this.messages) {
      sizeEstimate += 26 + this.getMessageSize(message);

      if (sizeEstimate >= 900000 || batchCount >= this.batchSize) {
        break;
      } else {
        batchCount += 1;
      };
    };


    this.maxedBytesSize = true;

    return batchCount;
  };

  fillInBatch() {
    if (this.shouldFillBatch()) {
      this.messagesBatch = this.messages.splice(0, this.maxBatchSize());
    };
  }

  addLog(log) {
    if (isValid(log, this.filters)) {
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
