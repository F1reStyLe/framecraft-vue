const baseUrl = (process.env.FRAMECRAFT_OPENAPI_URL || 'http://localhost:8180/swagger/openapi.yaml').replace(/\/$/, '')
const response = await fetch(baseUrl)

if (!response.ok) {
  throw new Error(`Unable to fetch FrameCraft OpenAPI: ${response.status} ${response.statusText}`)
}

const spec = await response.text()
const expectations = [
  '/v1/workspaces:',
  '/v1/content-projects:',
  '/v1/content-projects/{projectID}/text-generations:',
  '/v1/media/uploads:',
  '/v1/media/assets/{assetID}/complete:',
  'bearerAuth:',
  'has_thumbnail:',
]

const missing = expectations.filter((value) => !spec.includes(value))

if (missing.length) {
  throw new Error(`FrameCraft OpenAPI is missing expected contract entries: ${missing.join(', ')}`)
}

console.log(`FrameCraft contract verified: ${baseUrl}`)
