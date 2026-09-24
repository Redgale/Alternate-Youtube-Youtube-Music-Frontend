import { BotGuardClient } from 'bgutils-js/botguard';
import { buildURL, parseLooseJSON, getHeaders, USER_AGENT } from 'bgutils-js/utils';
import { WebPoMinter } from 'bgutils-js/webpo';
import type { WebPoSignalOutput } from 'bgutils-js/shared-types';
import { JSDOM } from 'jsdom';

// YouTube now requires a "Proof of Origin" token, minted per video id, for
// most CDN stream requests to succeed (they 403 without one). Minting one
// means running YouTube's own BotGuard attestation challenge, which is
// browser JS — jsdom stands in for the DOM it expects. This runs once per
// TTL window (~12h), not per request; individual video tokens are cheap to
// mint from the resulting minter.

interface MinterState {
  minter: InstanceType<typeof WebPoMinter>;
  visitorData: string;
  expiresAt: number;
}

let statePromise: Promise<MinterState> | null = null;

async function bootstrap(): Promise<MinterState> {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'https://www.youtube.com',
    referrer: 'https://www.youtube.com/',
    resources: { userAgent: USER_AGENT },
  });

  const pageResponse = await fetch('https://www.youtube.com', {
    headers: { accept: '*/*', 'accept-language': 'en-US,en;q=0.7', 'user-agent': USER_AGENT },
  });
  const pageHtml = await pageResponse.text();

  const ytConfig = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
  if (!ytConfig) throw new Error('po-token: could not find ytcfg in youtube.com page');
  const parsedConfig = JSON.parse(ytConfig) as {
    INNERTUBE_CONTEXT?: { client?: { visitorData?: string } };
  };
  const visitorData = parsedConfig.INNERTUBE_CONTEXT?.client?.visitorData;
  if (!visitorData) throw new Error('po-token: could not find visitorData in ytcfg');
  (dom.window as unknown as { yt: unknown }).yt = { config_: parsedConfig };

  Object.assign(globalThis, {
    yt: (dom.window as unknown as { yt: unknown }).yt,
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin,
  });
  if (!('navigator' in globalThis)) {
    Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
  }

  const challengeMatch = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
  if (!challengeMatch) throw new Error('po-token: could not find attestation challenge in page');
  const challengeJson = parseLooseJSON(challengeMatch[1]) as {
    R: { bgChallenge?: { interpreterUrl: { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue: string }; program: string; globalName: string } };
  };
  const bgChallenge = challengeJson.R.bgChallenge;
  if (!bgChallenge) throw new Error('po-token: no bgChallenge in page response');

  const interpreterUrl = bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
  const interpreterJs = await (await fetch(`https:${interpreterUrl}`)).text();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(interpreterJs)();

  const botGuardClient = await BotGuardClient.create({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    globalObject: globalThis,
  });

  const requestKey = 'O43z0dpjhgX20SCx4KAo'; // fixed public key used by all BotGuard clients
  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botGuardClient.snapshot({ webPoSignalOutput });

  const integrityRes = await fetch(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify([requestKey, botguardResponse]),
  });
  const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] =
    (await integrityRes.json()) as [string, number, number, string];

  const minter = await WebPoMinter.create(
    { integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken },
    webPoSignalOutput,
  );

  return { minter, visitorData, expiresAt: Date.now() + (estimatedTtlSecs - 300) * 1000 };
}

async function getState(forceRefresh = false): Promise<MinterState> {
  if (!forceRefresh && statePromise) {
    const state = await statePromise;
    if (Date.now() < state.expiresAt) return state;
  }
  statePromise = bootstrap();
  return statePromise;
}

/**
 * `forceRefresh` redoes the whole BotGuard bootstrap instead of reusing the
 * cached minter — used as a one-shot retry when the CDN rejects a token,
 * since an occasional mint comes back invalid even within the minter's
 * advertised TTL.
 */
export async function mintPoToken(videoId: string, forceRefresh = false): Promise<string> {
  const { minter } = await getState(forceRefresh);
  return minter.mintAsWebsafeString(videoId);
}

/**
 * The Innertube session must be created with this same visitorData for
 * minted po_tokens to actually authorize full playback — a token minted
 * against one visitor/session and used against a differently-generated one
 * only grants YouTube's brief "cold start" allowance (confirmed
 * empirically: ~1-1.3MB of any stream, then 403) rather than full access.
 */
export async function getVisitorData(): Promise<string> {
  const { visitorData } = await getState();
  return visitorData;
}
