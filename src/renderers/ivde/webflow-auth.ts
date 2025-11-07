import { state, setState } from "./store";
// import { createEffect } from "solid-js";
import { electrobun } from "./init";

// const port = 3000;

export const getAccessTokenForSlug = async (slug: string) => {
  const tokens = getWebflowTokens();

  for (const i in tokens) {
    const token = tokens[i];
    const canAccess = await electrobun.rpc?.request.canAccessSiteWithSlug({
      accessToken: token.token,
      slug: slug,
    });
    if (canAccess) {
      return token.token;
    }
  }

  // no tokens found with access to the slug, let's have the user authenticate a new token for us
  return await getAccessToken();
};

export const getAccessToken = (): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    // TODO: have a dedicated webview for authenticating stuff like this so that
    // we don't have to remember/restore the currentEgg
    setState("webflowAuth", {
      authUrl: "https://function-1-hzvvukamdq-uc.a.run.app/authorize-url",
      resolver: (accessToken) => {
        electrobun.rpc?.send.addToken({
          name: "webflow",
          url: "https://webflow.com",
          endpoint: "https://api.webflow.com",
          token: accessToken,
        });
      },
    });
  });
};

export const getWebflowAccessToken = async () => {
  return state.tokens.find((token) => token.name === "webflow")?.token;
};

export const getWebflowTokens = () => {
  return state.tokens.filter((token) => token.name === "webflow");
};
