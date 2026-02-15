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
import type * as bidding from "../bidding.js";
import type * as chat from "../chat.js";
import type * as cleanupVideos from "../cleanupVideos.js";
import type * as crons from "../crons.js";
import type * as debugTrace from "../debugTrace.js";
import type * as entitlements from "../entitlements.js";
import type * as events from "../events.js";
import type * as follows from "../follows.js";
import type * as livestream from "../livestream.js";
import type * as notifications from "../notifications.js";
import type * as playbackState from "../playbackState.js";
import type * as playlist from "../playlist.js";
import type * as purchases from "../purchases.js";
import type * as recordingIngest from "../recordingIngest.js";
import type * as streamCredentials from "../streamCredentials.js";
import type * as tips from "../tips.js";
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
  bidding: typeof bidding;
  chat: typeof chat;
  cleanupVideos: typeof cleanupVideos;
  crons: typeof crons;
  debugTrace: typeof debugTrace;
  entitlements: typeof entitlements;
  events: typeof events;
  follows: typeof follows;
  livestream: typeof livestream;
  notifications: typeof notifications;
  playbackState: typeof playbackState;
  playlist: typeof playlist;
  purchases: typeof purchases;
  recordingIngest: typeof recordingIngest;
  streamCredentials: typeof streamCredentials;
  tips: typeof tips;
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
