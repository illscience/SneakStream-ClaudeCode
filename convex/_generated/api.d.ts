/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adminSettings from "../adminSettings.js";
import type * as avatarQueue from "../avatarQueue.js";
import type * as chat from "../chat.js";
import type * as events from "../events.js";
import type * as follows from "../follows.js";
import type * as livestream from "../livestream.js";
import type * as nightclub from "../nightclub.js";
import type * as playbackState from "../playbackState.js";
import type * as playlist from "../playlist.js";
import type * as remix from "../remix.js";
import type * as streamCredentials from "../streamCredentials.js";
import type * as users from "../users.js";
import type * as videos from "../videos.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  adminSettings: typeof adminSettings;
  avatarQueue: typeof avatarQueue;
  chat: typeof chat;
  events: typeof events;
  follows: typeof follows;
  livestream: typeof livestream;
  nightclub: typeof nightclub;
  playbackState: typeof playbackState;
  playlist: typeof playlist;
  remix: typeof remix;
  streamCredentials: typeof streamCredentials;
  users: typeof users;
  videos: typeof videos;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
