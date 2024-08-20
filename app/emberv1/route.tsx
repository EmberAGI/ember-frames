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
  sign_tx_url: z.string().nullable(),
});

const url = "https://api.emberai.xyz/v1/";

const fetchEmberResponse = async (
  inputText: string | undefined,
  fid: string | undefined,
  username?: string
) => {
  const response = await fetch(url + `chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${process.env.EMBER_API_KEY as string}`,
    },
    body: JSON.stringify({
      user_id: fid,
      message: inputText,
      username,
    }),
  });

  console.log(`\n\n---\n\nresponse:`);
  console.log(response);
  console.log("response.body");
  console.log(response.body);

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

  //mocking the async response using Timeout
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        inputText: "ANSWER:" + inputText,
      });
    }, 1000);
  });
};

const fetchEmberLastMessage = async (
  inputText: string | undefined,
  fid: string | undefined,
  username?: string
) => {
  const response = await fetch(url + `chat/last`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${process.env.EMBER_API_KEY as string}`,
    },
    body: JSON.stringify({
      user_id: fid,
      message: inputText,
      username,
      numberOfMessages: 1,
    }),
  });

  console.log(`\n\n---\n\nresponse:`);
  console.log(response);
  console.log("response.body");
  console.log(response.body);

  if (!response.ok || response.body == null) {
    throw new Error("Failed to connect to Ember server");
  }

  return response.json();
};

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
}

function withTimeOut<T>(promise: Promise<T>, timeout: number) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) =>
      setTimeout(
        () =>
          resolve({
            message:
              "I'm still working on your request, please click the refresh button to update your answer",
            status: "processing",
            sign_tx_url: "",
            show_refresh: true,
          }),
        timeout
      )
    ),
  ]);
}

/*const returnTrendingTokens = async () => {
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
};*/

const frameHandler = frames(
  async (ctx) => {
    const defaultTimeout = 4000;
    init(process.env.NEXT_PUBLIC_AIRSTACK_API_KEY as string);

    console.log("ctx", ctx.message);
    console.log("ctx.FID", ctx.message?.requesterFid);
    console.log("ctx.userDetails", ctx.userDetails);
    let autoAction = false;
    let signTxn = undefined;
    let showBuy = false;
    let showRefresh = false;
    let emberResponse = "No response from Ember";

    //let tokenResponse: any = [];

    const fid_string = String(ctx.message?.requesterFid);

    if (ctx.searchParams.op === "SEND") {
      autoAction = true;
      let response: any;
      const resetAndRespond: any = await fetchEmberResponse(
        "terminate",
        fid_string,
        ctx.userDetails?.profileName
      ).then(async (r) => {
        console.log("Reset Response", r);
        response = await withTimeOut(
          fetchEmberResponse(
            "send token",
            fid_string,
            ctx.userDetails?.profileName
          ),
          defaultTimeout
        );
      });
      console.log(resetAndRespond);

      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      showRefresh = response.show_refresh;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "SWAP") {
      autoAction = true;

      let response: any;
      const resetAndRespond: any = await fetchEmberResponse(
        "terminate",
        fid_string,
        ctx.userDetails?.profileName
      ).then(async (r) => {
        console.log("Reset Response", r);
        response = await withTimeOut(
          fetchEmberResponse(
            "swap token on Base",
            fid_string,
            ctx.userDetails?.profileName
          ),
          defaultTimeout
        );
      });
      console.log(resetAndRespond);

      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      showRefresh = response.show_refresh;
      console.log(emberResponse);
    }

    /*if (ctx.searchParams.op === "TKN") {
      autoAction = true;
      showBuy = true;
      tokenResponse = await returnTrendingTokens();
      emberResponse = `$${tokenResponse[0]?.symbol} is trending on Base. 📈 Would you like to buy it?`;
      console.log(emberResponse);
    }*/

    if (ctx.searchParams.op === "BUY") {
      autoAction = true;
      //tokenResponse = await returnTrendingTokens();

      let response: any;
      const resetAndRespond: any = await fetchEmberResponse(
        "terminate",
        fid_string,
        ctx.userDetails?.profileName
      ).then(async (r) => {
        console.log("Reset Response", r);
        response = await withTimeOut(
          /*  fetchEmberResponse(
            `buy ${tokenResponse[0]?.symbol} with address ${tokenResponse[0]?.address} on Base`,
            fid_string,
            ctx.userDetails?.profileName
          ), */
          fetchEmberResponse(
            `buy token on Base`,
            fid_string,
            ctx.userDetails?.profileName
          ),
          2500
        );
      });
      console.log(resetAndRespond);

      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      showRefresh = response.show_refresh;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "MSG") {
      let response: any;
      if (!ctx.message?.inputText && !autoAction && !signTxn) {
        const resetAndRespond: any = await fetchEmberResponse(
          "terminate",
          fid_string,
          ctx.userDetails?.profileName
        ).then(async (r) => {
          console.log("Reset Response", r);
          response = await withTimeOut(
            fetchEmberResponse(
              `ctx.message?.inputText`,
              fid_string,
              ctx.userDetails?.profileName
            ),
            defaultTimeout
          );
        });
        console.log(resetAndRespond);
      } else {
        response = await withTimeOut(
          fetchEmberResponse(
            showBuy
              ? `assistant: token is trending on Base. 📈 Would you like to buy it?/n/nuser:` +
                  ctx.message?.inputText
              : ctx.message?.inputText,
            fid_string,
            ctx.userDetails?.profileName
          ),
          defaultTimeout
        );
      }

      response.sign_tx_url && (signTxn = response.sign_tx_url);
      emberResponse = response.message as string;
      showRefresh = response.show_refresh;
      console.log(emberResponse);
    }

    if (ctx.searchParams.op === "RFS") {
      let response: any;
      autoAction = true;
      // async timeout function
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(4000).then(async () => {
        console.log("REFRESHING");
        response = await fetchEmberLastMessage(
          "",
          fid_string,
          ctx.userDetails?.profileName
        );
        console.log("LAST MESSAGE RESPONSE", response);
        emberResponse = response.lastMessages[0]?.content as string;
        response.lastMessages[0]?.sign_tx_url &&
          (signTxn = response.lastMessages[0]?.sign_tx_url);
        console.log(emberResponse);
      });
    }

    //const stringLabel = "Buy $" + tokenResponse[0]?.symbol;
    const showHello = !ctx.message?.inputText && !autoAction && !signTxn;

    const ButtonsArray = [
      !showRefresh && !ctx.message?.inputText && !autoAction && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "SWAP" } }}>
          Swap Token
        </Button>
      ),
      !showRefresh && !ctx.message?.inputText && !autoAction && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "SEND" } }}>
          Send Token
        </Button>
      ),
      /* !showRefresh && !ctx.message?.inputText && !autoAction && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "TKN" } }}>
          Trending Token
        </Button>
      ), */
      /*!showRefresh && !ctx.message?.inputText && !signTxn && showBuy && (
        <Button action="post" target={{ pathname: "/", query: { op: "BUY" } }}>
          {stringLabel}
        </Button>
      ),*/
      !showRefresh && !signTxn && (
        <Button action="post" target={{ pathname: "/", query: { op: "MSG" } }}>
          Message
        </Button>
      ),
      !showRefresh && signTxn && (
        <Button action="link" target={signTxn as string}>
          Sign Transaction
        </Button>
      ),
      showRefresh && (
        <Button action="post" target={{ pathname: "/", query: { op: "RFS" } }}>
          Refresh
        </Button>
      ),
    ];
    return {
      image: (
        <div tw="flex flex-col bg-orange-100 w-full h-full justify-between items-center ">
          <div tw="font-black bg-white w-full p-4 text-center flex justify-center border-b-4 border-orange-500 drop-shadow-sm">
            Ember{" <> "}
            {(ctx.userDetails?.profileName && ctx.userDetails?.profileName) ||
              (ctx.userDetails?.fnames.length > 0 &&
                ctx.userDetails?.fnames[0])}{" "}
            Chat
          </div>
          <div tw="flex w-full grow py-8">
            <img
              tw="ml-12 self-end rounded-full"
              src="https://cdn.prod.website-files.com/665df398da20e7e4232eeb7f/6660879eae654b12732ad593_favicon.png"
              width={100}
              height={100}
              alt="Ember Logo"
            />
            <div tw="flex flex-col">
              {showHello && (
                <div tw="bg-yellow-50  grow ml-8 mr-12 p-8 my-4 rounded-2xl rounded-bl-none border-2 border-orange-500 drop-shadow-sm w-10/12 text-2xl">
                  Hi, I am Ember. I can help you with your crypto transactions.
                  Click on the buttons below to perform an action or type a
                  message in the text box below
                </div>
              )}
              {/*showHello && !signTxn && (
                <div tw="bg-yellow-50  grow ml-8 mr-12 p-8 my-4 rounded-2xl rounded-bl-none border-2 border-orange-500 drop-shadow-lg w-10/12 text-2xl">
                  {"Also check out the top trending token on Base 📈."}
                </div>
              )*/}
              {(ctx.message?.inputText || autoAction) && (
                <div tw="bg-yellow-50 grow ml-8 mr-12 p-8 my-4 rounded-2xl rounded-bl-none border-2 border-orange-500 drop-shadow-lg w-10/12 text-2xl">
                  {emberResponse}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      imageOptions: { headers: { "Cache-Control": "public, max-age=0" } },
      textInput: !showRefresh ? "Say something" : undefined,
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
