import { getRandomNumber, getRandomRunTime } from "./config/config";
import { buyToken } from "./config/utils";

export const buy = async () => {
  console.log("----------------Start Buying----------------");
  const tokenAmount = getRandomNumber(
    Number(process.env.MIN_BUY_QUANTITY),
    Number(process.env.MAX_BUY_QUANTITY)
  );

  console.log(`I will buy ${tokenAmount} tokens`);

  await buyToken(tokenAmount);
  const breaktime: number = getRandomRunTime(
    Number(process.env.MIN_TRADE_WAIT),
    Number(process.env.MAX_TRADE_WAIT)
  );

  console.log(`I will wait ${breaktime} milisecond`);
  setTimeout(buy, breaktime);
};

let timeout = getRandomRunTime(
  Number(process.env.MIN_TIME),
  Number(process.env.MAX_TIME)
);
console.log(`We will exit this process after ${timeout} seconds...`);

buy();
setInterval(() => {
  if (timeout === 0) {
    console.log("process is exited\n\t Times up!");
    process.exit(1);
  }
  timeout--;
}, 1000);
