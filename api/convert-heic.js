// Server-side fallback for HEIC photos the browser's WASM decoder can't
// handle (some iPhone HEIC variants -- edited/duplicated photos, portrait
// depth data, certain HEVC profiles -- aren't supported by libheif's WASM
// build). Uses CloudConvert's full native decoder instead. Only called
// when the fast client-side conversion (heic2any) already failed.
//
// Uses CloudConvert's sync API (sync.api.cloudconvert.com) with a base64
// import -- the whole job (import -> convert -> export) completes in one
// request/response, no separate upload step or polling loop needed. The
// tradeoff vs. the async import/upload flow is that the file has to fit in
// one request body (base64-encoded, ~33% larger than the original), which
// is fine for a phone photo but wouldn't scale to very large files.

const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;
const CLOUDCONVERT_SYNC_BASE = 'https://sync.api.cloudconvert.com/v2';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!CLOUDCONVERT_API_KEY) {
    res.status(500).json({ error: 'HEIC conversion is not configured (missing CLOUDCONVERT_API_KEY).' });
    return;
  }

  try {
    const fileBuffer = await readRawBody(req);
    if (fileBuffer.length === 0) throw new Error('No file received');
    const filename = String(req.headers['x-file-name'] || 'photo.heic');

    const jobResp = await fetch(`${CLOUDCONVERT_SYNC_BASE}/jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': {
            operation: 'import/base64',
            file: fileBuffer.toString('base64'),
            filename,
          },
          'convert-file': {
            operation: 'convert',
            input: 'import-file',
            output_format: 'jpg',
          },
          'export-file': {
            operation: 'export/url',
            input: 'convert-file',
          },
        },
      }),
    });

    if (!jobResp.ok) {
      const body = await jobResp.text().catch(() => '');
      throw new Error(`CloudConvert job failed (${jobResp.status}): ${body.slice(0, 200)}`);
    }
    const job = await jobResp.json();

    if (job.data.status === 'error') {
      const failedTask = job.data.tasks.find((t) => t.status === 'error');
      throw new Error(`CloudConvert conversion failed: ${failedTask?.message || 'unknown error'}`);
    }

    const exportTask = job.data.tasks.find((t) => t.name === 'export-file');
    const fileUrl = exportTask?.result?.files?.[0]?.url;
    if (!fileUrl) throw new Error('CloudConvert job finished without a downloadable file');

    const jpegResp = await fetch(fileUrl);
    if (!jpegResp.ok) throw new Error('Failed to download converted file');
    const jpegBuffer = Buffer.from(await jpegResp.arrayBuffer());

    res.setHeader('Content-Type', 'image/jpeg');
    res.status(200).send(jpegBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message || 'HEIC conversion failed' });
  }
};
