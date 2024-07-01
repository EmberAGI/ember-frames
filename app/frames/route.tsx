/* eslint-disable react/jsx-key */
import { Button } from "frames.js/next";
import { frames } from "./frames";
import { appURL } from "../utils";
import {
  onchainDataFramesjsMiddleware as onchainData,
  Features,
  TransferType,
  getTrendingTokens,
  Audience,
  TrendingTokensCriteria,
  TimeFrame,
} from "@airstack/frames";
import { init } from "@airstack/frames";

const fetchEmberResponse = async (inputText: string | undefined) => {
  //mocking the async response using Timeout
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        inputText: "ANSWER:" + inputText,
      });
    }, 1000);
  });
};

const returnTrendingTokens = async () => {
  const { data, error }: { data: any; error?: any } = await getTrendingTokens({
    audience: Audience.All,
    criteria: TrendingTokensCriteria.UniqueWallets,
    timeFrame: TimeFrame.OneDay,
    transferType: TransferType.All,
    swappable: true,
    limit: 1,
  });
  if (error) throw new Error(error);
  return data;
};

const frameHandler = frames(
  async (ctx) => {
    init(process.env.NEXT_PUBLIC_AIRSTACK_API_KEY as string);

    console.log("ctx", ctx.message);
    console.log("ctx.FID", ctx.message?.requesterFid);
    let autoAction = false;
    let signTxn = undefined;
    let emberResponse = "No response from Ember";

    const tokenResponse: any = await returnTrendingTokens();

    console.log(tokenResponse);

    if (ctx.searchParams.op === "SEND") {
      autoAction = true;
      const response: any = await fetchEmberResponse("send token");
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "SWAP") {
      autoAction = true;
      const response: any = await fetchEmberResponse("swap token on Base");
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "BUY") {
      autoAction = true;
      const response: any = await fetchEmberResponse(
        `buy ${tokenResponse[0]?.symbol} with address ${tokenResponse[0]?.address} on Base`
      );
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "MSG") {
      autoAction = true;
      const response: any = await fetchEmberResponse(ctx.message?.inputText);
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    const stringLabel = "Buy $" + tokenResponse[0]?.symbol;
    const showHello = !ctx.message?.inputText && !autoAction && !signTxn;

    const ButtonsArray = [
      !ctx.message?.inputText && !autoAction && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "SWAP" } }}>
          Swap Token
        </Button>
      ),
      !ctx.message?.inputText && !autoAction && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "SEND" } }}>
          Send Token
        </Button>
      ),
      !ctx.message?.inputText && !autoAction && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "BUY" } }}>
          {stringLabel}
        </Button>
      ),
      !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "MSG" } }}>
          Message
        </Button>
      ),
      signTxn && (
        <Button action="link" target={signTxn as string}>
          Sign Transaction
        </Button>
      ),
    ];
    return {
      image: (
        <div tw="flex flex-col bg-orange-100 w-full h-full justify-between items-center">
          <div tw="font-black bg-white w-full p-4 text-center flex justify-center border-b-4 border-orange-500 drop-shadow-sm">
            Ember{" "}
            {(!ctx.message?.inputText &&
              ctx.userDetails?.profileName &&
              ctx.userDetails?.profileName) ||
              (ctx.userDetails?.fnames.length > 0 &&
                "<" + ctx.userDetails?.fnames[0] + ">")}
          </div>
          <div tw="flex w-full grow py-8">
            <img
              tw="ml-12 self-end rounded-full"
              src="https://cdn.prod.website-files.com/665df398da20e7e4232eeb7f/6660879eae654b12732ad593_favicon.png"
              width={100}
              height={100}
            />
            <div tw="flex flex-col">
              {showHello && (
                <div tw="bg-yellow-50  grow ml-8 mr-12 p-8 my-4 rounded-2xl rounded-bl-none border-2 border-orange-500 drop-shadow-sm w-10/12 ">
                  "Hi, I am Ember. I can help you with your crypto transactions.
                  Click on the buttons below to perform an action or type a
                  message in the text box below"
                </div>
              )}
              {tokenResponse?.length > 0 && !signTxn && (
                <div tw="bg-yellow-50  grow ml-8 mr-12 p-8 my-4 rounded-2xl rounded-bl-none border-2 border-orange-500 drop-shadow-lg w-10/12 ">
                  {"$" + tokenResponse[0]?.symbol + " is trending on Base 📈."}
                </div>
              )}
              {(ctx.message?.inputText || autoAction) && (
                <div tw="bg-yellow-50  grow ml-8 mr-12 p-8 my-4 rounded-2xl rounded-bl-none border-2 border-orange-500 drop-shadow-lg w-10/12 ">
                  {emberResponse}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      textInput: "Say something",
      buttons: ButtonsArray,
    };
  },
  {
    middleware: [
      // Add Onchain Data Middleware
      onchainData({
        apiKey: process.env.NEXT_PUBLIC_AIRSTACK_API_KEY as string,
        // Add `USER_DETAILS` to the `features` array
        features: [Features.USER_DETAILS],
      }) as any,
    ],
  }
);

export const GET = frameHandler;
export const POST = frameHandler;
