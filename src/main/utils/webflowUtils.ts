import Webflow from "webflow-api";
import type { WebflowSitesResponseType } from "../../shared/types/types";
const webflow = new Webflow();

export const getSiteIdForSlug = async (accessToken: string, slug: string) => {
  const app = new Webflow({ token: accessToken });
  const sites = await app.sites();
  const site = sites.find((site) => site.shortName === slug);

  return site?._id;
};

export const canAccessSiteWithSlug = async (
  accessToken: string,
  slug: string
) => {
  if (!accessToken) {
    return false;
  }

  const app = new Webflow({ token: accessToken });

  try {
    const result = await app.sites();
    return true;
  } catch (e) {
    return false;
  }
};

// NOTE: webflow oauth tokens can't change access after creation, but they can be allowed on the whole workspace so new
// projects can be added without reauthenticating and the token can be revoked, so we need to check for each specific site
export const canAccessSite = async (accessToken: string, siteId: string) => {
  if (!accessToken) {
    return false;
  }

  const app = new Webflow({ token: accessToken });

  try {
    const result = await app.site({ siteId });
    return true;
  } catch (e) {
    return false;
  }
};

export const getSitesForToken = async (
  accessToken: string
): Promise<WebflowSitesResponseType> => {
  if (!accessToken) {
    return [];
  }

  // todo (yoav): add types for this
  const app = new Webflow({ token: accessToken });

  try {
    const result = await app.sites();
    return result;
  } catch (e) {
    return [];
  }
};
