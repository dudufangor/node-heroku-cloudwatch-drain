require('log-timestamp');

const MessagesBuffer = require("./MessagesBuffer");

var testBuffer = async () => {
  let pms = 0;
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function maxRuntime(start) {
    return (((new Date().getTime()) - start) >= 1000)
  }

  let start = new Date().getTime();
  let buffer = new MessagesBuffer([], 10);

  var i;
  for (i = 0; i <= 54; i++) {
    buffer.addLog(`logline n ${i}`);
  }

  console.log('\nLOGS ADDED!\n')

  do {
    let batch = buffer.getMessagesBatch();

    if (buffer.isBatchReady()) {
      console.log(`${pms}`)
      // console.log(`${batch[0].message} --- ${batch[batch.length - 1].message}`);
      pms += buffer.messagesBatch.length;
      buffer.clearMessagesBatch();
    }
  } while (buffer.getMessagesCount() > 1);
}

testBuffer();
