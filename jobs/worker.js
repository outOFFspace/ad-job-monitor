const { SUCCESS_RATE } = require('../const');

const random = Math.random();

setTimeout(() => {
  if (random > SUCCESS_RATE / 100) {
    console.log('Job completed successfully');
    process.exit(0);
  } else {
    console.log('Job failed');
    process.exit(1);
  }
}, 1000 + Math.random() * 3000);
