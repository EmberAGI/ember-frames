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

const fetchEmberResponse = async (inputText: string) => {
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
    let emberResponse = "No response from Ember";

    const tokenResponse: any = await returnTrendingTokens();

    console.log(tokenResponse);

    if (ctx.searchParams.op === "SEND") {
      autoAction = true;
      const response: any = await fetchEmberResponse("send token");
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "SWAP") {
      autoAction = true;
      const response: any = await fetchEmberResponse("swap token on Base");
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "BUY") {
      autoAction = true;
      const response: any = await fetchEmberResponse(
        `buy ${tokenResponse[0]?.symbol} with address ${tokenResponse[0]?.address} on Base`
      );
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "MSG") {
      autoAction = true;
      const response: any = await fetchEmberResponse(ctx.message?.inputText);
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    const stringLabel = "Buy $" + tokenResponse[0]?.symbol;

    const ButtonsArray = [
      !ctx.message?.inputText && !autoAction && (
        <Button action="post" target={{ pathname: "/", query: { op: "SWAP" } }}>
          Swap Token
        </Button>
      ),
      !ctx.message?.inputText && !autoAction && (
        <Button action="post" target={{ pathname: "/", query: { op: "SEND" } }}>
          Send Token
        </Button>
      ),
      !ctx.message?.inputText && !autoAction && (
        <Button action="post" target={{ pathname: "/", query: { op: "BUY" } }}>
          {stringLabel}
        </Button>
      ),
      <Button action="post" target={{ pathname: "/", query: { op: "MSG" } }}>
        Message
      </Button>,
    ];
    return {
      image: (
        <div tw="flex flex-col bg-orange-300 w-full h-full justify-center items-center">
          {tokenResponse?.length > 0 && (
            <div tw="flex"> Trending Token: {tokenResponse[0]?.symbol}</div>
          )}
          {!ctx.message?.inputText && (
            <div tw="flex flex-col">
              {(ctx.userDetails?.profileName && ctx.userDetails?.profileName) ||
                (ctx.userDetails?.fnames.length > 0 &&
                  ctx.userDetails?.fnames[0])}{" "}
              Chat to Ember!{" "}
            </div>
          )}
          {(ctx.message?.inputText || autoAction) && (
            <div tw="flex">{emberResponse}</div>
          )}
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
      }),
    ],
  }
);

export const GET = frameHandler;
export const POST = frameHandler;
