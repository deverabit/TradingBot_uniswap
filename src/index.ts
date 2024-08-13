import { sellToken, buyToken } from "./config/utils";

import { getRandomNumber, getRandomRunTime } from "./config/config";

const main = async  () => {
  try {
    const rnt = getRandomRunTime(1, 2);
    if (rnt == 1) {
      console.log("----------------Start Buying----------------");
      const tokenAmount = getRandomNumber(
        Number(process.env.MIN_BUY_QUANTITY),
        Number(process.env.MAX_BUY_QUANTITY)
      );
      console.log(`I will buy ${tokenAmount} tokens`);

      await buyToken(tokenAmount);
    } else {
      console.log("----------------Start Selling----------------");

      const tokenAmount = getRandomNumber(
        Number(process.env.MIN_SELL_QUANTITY),
        Number(process.env.MAX_SELL_QUANTITY)
      );
      console.log(`I will sell ${tokenAmount} tokens`);

      await sellToken(tokenAmount);
    }
  } catch (error) {
    console.log(error);
  }

  const wtime = getRandomRunTime(
    Number(process.env.MIN_TRADE_WAIT),
    Number(process.env.MAX_TRADE_WAIT)
  );
  console.log(`waiting ${wtime} miliseconds...`);
  setTimeout(main, wtime);
};

let timeout = getRandomRunTime(
  Number(process.env.MIN_TIME),
  Number(process.env.MAX_TIME)
);
console.log(`We will exit this process after ${timeout} seconds...`);

main();
setInterval(() => {
  if (timeout === 0) {
    console.log("process is exited\n\t Times up!");
    process.exit(1);
  }
  timeout--;
}, 1000);
