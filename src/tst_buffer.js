require('log-timestamp');

const MessagesBuffer = require("./MessagesBuffer");
const CloudWatchPusher = require("./CloudWatchPusher");


var testBuffer = async () => {
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  let buffer = new MessagesBuffer([/\[\dm.{1}\[\d{2}m/, /INFO:\s(done|start)/, /<.+\/>/, /\w+:\s.+;/], 113);

  var i;
  for (i = 0; i <= 50; i++) {
    buffer.addLog(`bla, bla, bla INFO: done`);
    await sleep(200);
  }

  // do {
  //   let batch = buffer.getMessagesBatch();
  //
  //   if (buffer.isBatchReady() && !pusher.isLocked()) {
  //     // await sleep(200)
  //     await pusher.push(batch);
  //     buffer.clearMessagesBatch();
  //   }
  // } while (buffer.getMessagesCount() > 1);
}

testBuffer();

// cat forever.log | grep -m 2 -C 30 'Error pushing to CloudWatch'
