require('log-timestamp');

const MessagesBuffer = require("./MessagesBuffer");
const CloudWatchPusher = require("./CloudWatchPusher");


var testBuffer = async () => {
  let pms = 0;
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function maxRuntime(start) {
    return (((new Date().getTime()) - start) >= 1000)
  }

  let start = new Date().getTime();
  let buffer = new MessagesBuffer([], 113);
  const pusher = new CloudWatchPusher('penis', 'fff', 'vruum');

  var i;
  for (i = 0; i <= 1000; i++) {
    buffer.addLog(`logline n ${i}`);
  }

  console.log('\nLOGS ADDED!\n')

  do {
    let batch = buffer.getMessagesBatch();

    if (buffer.isBatchReady() && !pusher.isLocked()) {
      // await sleep(200)
      await pusher.push(batch);
      buffer.clearMessagesBatch();
    }
  } while (buffer.getMessagesCount() > 1);
}

testBuffer();
