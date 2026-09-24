import { Innertube, Platform } from 'youtubei.js';
import type { Types } from 'youtubei.js';
import { getVisitorData } from './po-token.js';

// Deciphering YouTube's signature-cipher stream URLs requires running a
// snippet of YouTube's own obfuscated player JS. youtubei.js intentionally
// doesn't bundle an evaluator (bundle-size/platform-neutrality), so we wire
// one up ourselves: this executes YouTube's own extracted code, not
// arbitrary user input.
Platform.shim.eval = async (data: Types.BuildScriptResult) => {
  return new Function(data.output)();
};

let instance: Promise<Innertube> | null = null;

/**
 * A single shared Innertube session. Session bootstrap (player/signature
 * fetching) is expensive, so every route reuses this instead of creating
 * a new client per request.
 *
 * Created with the same visitorData as the po_token minter (po-token.ts):
 * a token minted against one visitor session and then used against a
 * separately/randomly-generated session only grants YouTube's brief "cold
 * start" allowance — confirmed empirically at ~1-1.3MB of any stream
 * before a 403, regardless of chunking or retries. Matching visitorData
 * across both is what unlocks full playback.
 */
export async function getInnertube(): Promise<Innertube> {
  if (!instance) {
    instance = (async () => {
      const visitorData = await getVisitorData();
      return Innertube.create({ visitor_data: visitorData, generate_session_locally: true });
    })();
  }
  return instance;
}
