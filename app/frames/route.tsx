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
import z from "zod";

const ChatEmberRespons = z.object({
  status: z.union([
    z.literal("done"),
    z.literal("processing"),
    z.literal("error"),
  ]),
  message: z.string(),
  sign_tx_url: z.string().optional(),
});

const fetchEmberResponse = async (inputText: string | undefined, fid: string | undefined, username?: string) => {
  const response = await fetch(`https://devapi.emberai.xyz/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "authorization": `Bearer ${process.env.EMBER_API_KEY as string}`
    },
    body: JSON.stringify({
      user_id: fid,
      message: inputText,
      username,
    }),
  });

  if (!response.ok || response.body == null) {
    throw new Error("Failed to connect to Ember server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    const { event, rawData } = parseSseResponse(decoder.decode(value));
    if (done && event !== "done") {
      throw new Error("Invalid response");
    }

    if (rawData == null) {
      continue;
    }

    const data = await ChatEmberRespons.safeParseAsync(JSON.parse(rawData));
    if (!data.success) {
      throw new Error("Invalid response");
    }
    const response = data.data;

    switch (event) {
      case "done":
        return response;
      case "activity":
        continue;
      case "error":
        return `Error: ${response.message}`;
      default:
        throw new Error("Invalid response");
    }
  }
}

function parseSseResponse(value: string) {
  const lines = value.split("\n");
  let event = undefined;
  let rawData = undefined;

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.substring("event: ".length).trim();
    } else if (line.startsWith("data: ")) {
      rawData = line.substring("data: ".length);
    }
  }

  return { event, rawData };

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

    const fid_string = String(ctx.message?.requesterFid);

    if (ctx.searchParams.op === "SEND") {
      autoAction = true;
      const response: any = await fetchEmberResponse("send token", fid_string, ctx.userDetails?.profileName);
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "SWAP") {
      autoAction = true;
      const response: any = await fetchEmberResponse("swap token on Base", fid_string, ctx.userDetails?.profileName);
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "BUY") {
      autoAction = true;
      const response: any = await fetchEmberResponse(
        `buy ${tokenResponse[0]?.symbol} with address ${tokenResponse[0]?.address} on Base`,
        fid_string,
        ctx.userDetails?.profileName
      );
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "MSG") {
      autoAction = true;
      const response: any = await fetchEmberResponse(ctx.message?.inputText, fid_string, ctx.userDetails?.profileName);
      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      console.log(emberResponse);
    }

    const stringLabel = "Buy $" + tokenResponse[0]?.symbol;

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
        <div tw="flex flex-col bg-orange-300 w-full h-full justify-center items-center">
          {tokenResponse?.length > 0 && (
            <div tw="flex"> Trending Token: {tokenResponse[0]?.symbol}</div>
          )}
          {!ctx.message?.inputText && (
            <div tw="flex flex-col">
              {(ctx.userDetails?.profileName && ctx.userDetails?.profileName) ||
                (ctx.userDetails?.fnames.length > 0 &&
                  ctx.userDetails?.fnames[0])}{" "}
              Chat to Ember!!{" "}
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
      }) as any,
    ],
  }
);

export const GET = frameHandler;
export const POST = frameHandler;
