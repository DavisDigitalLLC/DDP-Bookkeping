// Server-side fallback for HEIC photos the browser's WASM decoder can't
// handle (some iPhone HEIC variants -- edited/duplicated photos, portrait
// depth data, certain HEVC profiles -- aren't supported by libheif's WASM
// build). Uses CloudConvert's full native decoder instead. Only called
// when the fast client-side conversion (heic2any) already failed.

const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;
const CLOUDCONVERT_BASE = 'https://api.cloudconvert.com/v2';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function cloudConvertRequest(path, options = {}) {
  const resp = await fetch(`${CLOUDCONVERT_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`CloudConvert ${path} failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  return resp.json();
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

    const job = await cloudConvertRequest('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: {
          'upload-file': { operation: 'import/upload' },
          'convert-file': { operation: 'convert', input: 'upload-file', output_format: 'jpg' },
          'export-file': { operation: 'export/url', input: 'convert-file' },
        },
      }),
    });

    const uploadTask = job.data.tasks.find((t) => t.name === 'upload-file');
    const { url: uploadUrl, parameters: uploadParams } = uploadTask.result.form;

    const form = new FormData();
    Object.entries(uploadParams).forEach(([k, v]) => form.append(k, v));
    form.append('file', new Blob([fileBuffer]), filename);

    const uploadResp = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!uploadResp.ok) throw new Error(`CloudConvert file upload failed (${uploadResp.status})`);

    const jobId = job.data.id;
    let finishedJob = null;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const statusJob = await cloudConvertRequest(`/jobs/${jobId}`);
      if (statusJob.data.status === 'finished') {
        finishedJob = statusJob.data;
        break;
      }
      if (statusJob.data.status === 'error') {
        const failedTask = statusJob.data.tasks.find((t) => t.status === 'error');
        throw new Error(`CloudConvert conversion failed: ${failedTask?.message || 'unknown error'}`);
      }
    }
    if (!finishedJob) throw new Error('CloudConvert conversion timed out');

    const exportTask = finishedJob.tasks.find((t) => t.name === 'export-file');
    const fileUrl = exportTask.result.files[0].url;

    const jpegResp = await fetch(fileUrl);
    if (!jpegResp.ok) throw new Error('Failed to download converted file');
    const jpegBuffer = Buffer.from(await jpegResp.arrayBuffer());

    res.setHeader('Content-Type', 'image/jpeg');
    res.status(200).send(jpegBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message || 'HEIC conversion failed' });
  }
};
