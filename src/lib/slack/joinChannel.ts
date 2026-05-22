/** Backfill iff the channel is newly enabled (false→true) and the bot can see it. */
export function shouldBackfill(prevEnabled: boolean, nextEnabled: boolean, botInChannel: boolean): boolean {
  return nextEnabled && !prevEnabled && botInChannel;
}
