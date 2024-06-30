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
    let autoAction = false;
    let emberResponse = "No response from Ember";

    const response: any = await returnTrendingTokens();

    console.log(response);

    const counter = ctx.message
      ? ctx.searchParams.op === "+"
        ? ctx.state.counter + 1
        : ctx.state.counter - 1
      : ctx.state.counter;

    if (ctx.message?.inputText) {
      const response: any = await fetchEmberResponse(ctx.message.inputText);
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }
    if (ctx.searchParams.op === "SEND") {
      autoAction = true;
      const response: any = await fetchEmberResponse("TEXT QUERY FOR SEND");
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "SWAP") {
      autoAction = true;
      const response: any = await fetchEmberResponse("TEXT QUERY FOR SWAP");
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "BUY") {
      autoAction = true;
      const response: any = await fetchEmberResponse("TEXT QUERY FOR BUY");
      emberResponse = response.inputText as string;
      console.log(emberResponse);
    }

    const ButtonsArray = [
      !ctx.message?.inputText && !autoAction && (
        <Button action="post" target={{ pathname: "/", query: { op: "SEND" } }}>
          Send
        </Button>
      ),
      !ctx.message?.inputText && !autoAction && (
        <Button action="post" target={{ pathname: "/", query: { op: "SWAP" } }}>
          Swap Token
        </Button>
      ),
      !ctx.message?.inputText && !autoAction && (
        <Button action="post" target={{ pathname: "/", query: { op: "BUY" } }}>
          Buy Token
        </Button>
      ),
      <Button action="post" target={{ pathname: "/", query: { op: "" } }}>
        Message
      </Button>,
    ];
    return {
      image: (
        <div tw="flex flex-col bg-orange-300 w-full h-full justify-center items-center">
          {response?.length > 0 && (
            <div tw="flex"> Trending Token: {response[0]?.symbol}</div>
          )}
          {!ctx.message?.inputText && (
            <div tw="flex flex-col">
              <div>FID: {ctx.userDetails?.fid}</div>
              {ctx.userDetails?.profileName} Chat to Ember!{" "}
            </div>
          )}
          {(ctx.message?.inputText || autoAction) && (
            <div tw="flex">{emberResponse}</div>
          )}
        </div>
      ),
      textInput: "Say something",
      buttons: ButtonsArray,
      state: { counter: counter },
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
