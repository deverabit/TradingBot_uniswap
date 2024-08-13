import tokens from "../token.json";

type TokenInfo = {
  address: string;
  poolAddress: string;
  decimal: number;
  symbol: string;
  name: string;
  gas_limit: number;
  gas_price: number;
};

export const ERROR = {
  sell: "Insufficient token in wallet",
  buy: "Insufficient Eth in wallet"
}

export const getTokenInfo = (symbol: string): TokenInfo => {
  return tokens[symbol];
};
export const getRandomRunTime = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const getRandomNumber = (min: number, max: number) => {
  const result = Math.random() * (max - min) + min;
  return result.toFixed(6);
};
