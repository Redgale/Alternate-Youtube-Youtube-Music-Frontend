import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import ffmpegPath from 'ffmpeg-static';

if (!ffmpegPath) {
  throw new Error('ffmpeg-static did not resolve a binary for this platform');
}

async function writeToFile(webStream: ReadableStream<Uint8Array>, path: string): Promise<void> {
  const nodeReadable = Readable.fromWeb(webStream as never);
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(path);
    nodeReadable.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    nodeReadable.on('error', reject);
  });
}

/**
 * Muxes separate video-only and audio-only streams into one MP4 with a
 * stream copy (no re-encode) via ffmpeg. Necessary because modern YouTube
 * almost never serves a single combined video+audio file — the same
 * reason yt-dlp shells out to ffmpeg when it's available.
 */
export async function muxToMp4(
  videoStream: ReadableStream<Uint8Array>,
  audioStream: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array>> {
  const dir = await mkdtemp(join(tmpdir(), 'media-dash-'));
  const videoPath = join(dir, 'video.src');
  const audioPath = join(dir, 'audio.src');
  const outPath = join(dir, 'out.mp4');

  const cleanup = () => void rm(dir, { recursive: true, force: true });

  try {
    await Promise.all([writeToFile(videoStream, videoPath), writeToFile(audioStream, audioPath)]);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath as string, [
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        outPath,
      ]);
      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      });
      proc.on('error', reject);
    });
  } catch (err) {
    cleanup();
    throw err;
  }

  const nodeStream = createReadStream(outPath);
  nodeStream.on('close', cleanup);
  nodeStream.on('error', cleanup);

  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}
