import { getRandomNumber, getRandomRunTime } from "./config/config";
import { sellToken } from "./config/utils";

export const sell = async () => {
  console.log("----------------Start Selling----------------");
  const tokenAmount = getRandomNumber(
    Number(process.env.MIN_SELL_QUANTITY),
    Number(process.env.MAX_SELL_QUANTITY)
  );

  console.log(`I will sell ${tokenAmount} tokens`);

  await sellToken(tokenAmount);
  const breaktime: number = getRandomRunTime(
    Number(process.env.MIN_TRADE_WAIT),
    Number(process.env.MAX_TRADE_WAIT)
  );

  console.log(`I will wait ${breaktime} milisecond`);
  setTimeout(sell, breaktime);
};

let timeout = getRandomRunTime(
  Number(process.env.MIN_TIME),
  Number(process.env.MAX_TIME)
);
console.log(`We will exit this process after ${timeout} seconds...`);
sell();
setInterval(() => {
  if (timeout === 0) {
    console.log("process is exited\n\t Times up!");
    process.exit(1);
  }
  timeout--;
}, 1000);
