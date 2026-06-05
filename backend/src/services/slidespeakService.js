import axios from 'axios';

const SLIDESPEAK_BASE_URL = process.env.SLIDESPEAK_BASE_URL || 'https://api.slidespeak.co/api/v1';

const createClient = () => {
  const apiKey = process.env.SLIDESPEAK_API_KEY;
  if (!apiKey) {
    throw new Error('SLIDESPEAK_API_KEY is not set');
  }

  return axios.create({
    baseURL: SLIDESPEAK_BASE_URL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
  });
};

export const createPresentation = async ({
  plainText,
  document_uuids,
  length,
  template,
  language,
  fetch_images,
  use_document_images,
  tone,
  verbosity,
  custom_user_instructions,
  include_cover,
  include_table_of_contents,
  add_speaker_notes,
  use_general_knowledge,
  use_wording_from_document,
  use_branding_logo,
  use_branding_fonts,
  use_branding_color,
  branding_logo,
  branding_fonts,
  branding_color,
  run_sync,
  response_format,
}) => {
  const client = createClient();
  const payload = {
    plain_text: plainText,
    template,
  };
  if (Array.isArray(document_uuids) && document_uuids.length) {
    payload.document_uuids = document_uuids;
  }
  if (typeof length === 'number') payload.length = length;
  if (language) payload.language = language;
  if (typeof fetch_images === 'boolean') payload.fetch_images = fetch_images;
  if (typeof use_document_images === 'boolean') payload.use_document_images = use_document_images;
  if (tone) payload.tone = tone;
  if (verbosity) payload.verbosity = verbosity;
  if (custom_user_instructions) payload.custom_user_instructions = custom_user_instructions;
  if (typeof include_cover === 'boolean') payload.include_cover = include_cover;
  if (typeof include_table_of_contents === 'boolean')
    payload.include_table_of_contents = include_table_of_contents;
  if (typeof add_speaker_notes === 'boolean') payload.add_speaker_notes = add_speaker_notes;
  if (typeof use_general_knowledge === 'boolean')
    payload.use_general_knowledge = use_general_knowledge;
  if (typeof use_wording_from_document === 'boolean')
    payload.use_wording_from_document = use_wording_from_document;
  if (typeof use_branding_logo === 'boolean') payload.use_branding_logo = use_branding_logo;
  if (typeof use_branding_fonts === 'boolean') payload.use_branding_fonts = use_branding_fonts;
  if (typeof use_branding_color === 'boolean') payload.use_branding_color = use_branding_color;
  if (branding_logo) payload.branding_logo = branding_logo;
  if (branding_fonts) payload.branding_fonts = branding_fonts;
  if (branding_color) payload.branding_color = branding_color;
  if (typeof run_sync === 'boolean') payload.run_sync = run_sync;
  if (response_format) payload.response_format = response_format;
  const response = await client.post('/presentation/generate', payload);
  return response.data;
};

export const getTaskStatus = async (taskId) => {
  const client = createClient();
  const response = await client.get(`/task_status/${taskId}`);
  return response.data;
};

export const getDownloadUrl = async (requestId) => {
  const client = createClient();
  const response = await client.get(`/presentation/download/${requestId}`);
  return response.data;
};

export const listTemplates = async () => {
  const client = createClient();
  const response = await client.get('/presentation/templates');
  return response.data;
};

export default {
  createPresentation,
  getTaskStatus,
  getDownloadUrl,
  listTemplates,
};
